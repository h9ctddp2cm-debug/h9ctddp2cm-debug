import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v137 — therapist bedside (20 Nov, after v136): in Level 3/4 a patient who
// lifted the arm past the target got no response, and had to lower the arm
// fully to the captured rest pose and start over before the game reacted.
// Cause: when the reward animation ended the game layer called setTarget(),
// which forces 'await-start' even when the patient was already half-way into
// the next lift; the strict return gates (≤45 % of the excursion AND settled
// at the lowest angle seen) then made every re-arm feel like "back to 0°".
// Fix (public patient mode only, research sessions untouched):
//   1. the public game layer no longer resets the controller when the reward
//      animation ends (research keeps setTarget()), so a lift already under way
//      keeps counting; completeHeldRepetition() counts a lift still held up when the animation
//      ends, so an arm kept at or above the set angle keeps scoring (therapist
//      rule: patients may prefer to keep the arm up rather than lower it);
//   2. a repetition completes / re-arms once the arm has dropped 10° below the
//      highest angle of that lift (patientRearmDropDeg, therapist decision:
//      「只要比啱啱舉高個下嗰個點低10度就得喇」) — no return to the start pose;
//   3. the lowering filter is faster (patientDownSmoothAlpha 0.16 → 0.25);
//   4. the public prompts and readouts show no degree figures.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const api = require(path.join(root, 'shoulder-flexion-controller.js'));
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const controllerSrc = readFileSync(path.join(root, 'shoulder-flexion-controller.js'), 'utf8');

// Right arm seen from the front on a 4:3 camera; `deg` is the camera-visible
// angle of the upper arm from straight down (lap rest ≈ 25°).
function lm(deg){
  const a = Array.from({length:33}, () => ({x:.5, y:.5, visibility:.05}));
  const sh = {x:.45, y:.30, visibility:1};
  const r = deg * Math.PI / 180;
  a[12] = sh;
  a[14] = {x: sh.x + .18 * Math.sin(r), y: sh.y + .18 * Math.cos(r) / 1.33, visibility:1};
  a[16] = {x: sh.x + .36 * Math.sin(r), y: sh.y + .36 * Math.cos(r) / 1.33, visibility:1};
  a[11] = {x:.62, y:.30, visibility:1};
  a[24] = {x:.45, y:.70, visibility:1};
  a[23] = {x:.62, y:.70, visibility:1};
  return a;
}
function session(level, target, patientAssist){
  const c = api.createController({level});
  c.setTarget(target, level);
  let gen = 0, t = 0;
  const feed = (deg, frames) => {
    let s;
    for(let i = 0; i < frames; i++){
      gen++; t += 33;
      s = c.update({lm: lm(deg), side:'right', imageAspect:1.33, frameFresh:true,
        frameGeneration:gen, nowMs:t, patientAssist});
    }
    return s;
  };
  const ready = feed(25, 30); // rest on lap → camera zero
  assert.equal(ready.calibrated, true);
  return {c, feed};
}

test('v137 config: faster lowering filter and the 10° drop-from-peak patient re-arm rule', () => {
  assert.equal(api.CONFIG.patientDownSmoothAlpha, 0.25);
  assert.equal(api.CONFIG.patientRearmDropDeg, 10);
  assert.equal(api.CONFIG.patientReliftDeg, undefined);
  assert.equal(api.CONFIG.relativeReturnCap, 0.45); // research gate unchanged
  assert.match(controllerSrc, /const droppedFromPeak=patientAssist\s*&& state\.estimatedAngle<=state\.cyclePeakDeg-config\.patientRearmDropDeg;/);
  assert.match(controllerSrc, /const droppedFromPeak=patientAssist\s*&& state\.estimatedAngle<=state\.startPeakDeg-config\.patientRearmDropDeg;/);
  assert.match(controllerSrc, /const atStart=inWindow\|\|atOwnFloor\|\|droppedFromPeak;/);
  assert.match(controllerSrc, /state\.returnStableFrames=inWindow\|\|atOwnFloor\|\|droppedFromPeak/);
  assert.match(controllerSrc, /state\.phase=patientAssist\?'outward':'await-start'; state\.cyclePeakDeg=null;/);
});

test('patient mode: a lift already under way when the reward ends keeps counting (no reset)', () => {
  const {feed} = session('4', 60, true);
  assert.equal(feed(95, 8).targetReady, true);          // first lift
  assert.equal(feed(28, 12).repetitions, 1);            // back to lap → rep 1
  const midLift = feed(60, 6);                          // already lifting when the animation ends
  assert.equal(midLift.phase, 'outward');               // nothing resets it …
  const over = feed(95, 6);                             // … so lifting past the target
  assert.equal(over.targetReady, true);                 // is credited at once
  assert.equal(over.phase, 'await-return');
});

test('legacy setTarget() after a reward still forces await-start (what the research path keeps)', () => {
  const {c, feed} = session('4', 60, true);
  feed(95, 8); feed(28, 12); feed(60, 6);
  c.setTarget(60, '4');
  assert.equal(c.snapshot().phase, 'await-start');
  assert.equal(feed(95, 8).targetReady, false);         // the v136 behaviour the patients hit
});

test('patient mode: dropping 10° below the peak completes the repetition and re-arms at once', () => {
  const {feed} = session('4', 60, true);
  const top = feed(95, 8);                              // peak ≈ 69° above rest
  assert.equal(top.targetReady, true);
  const smallDip = feed(90, 8);                         // ≈ 4° below the peak: still the same lift
  assert.equal(smallDip.repetitions, 0);
  assert.equal(smallDip.phase, 'await-return');
  const dropped = feed(80, 8);                          // ≈ 14° below the peak → counted
  assert.equal(dropped.repetitions, 1);                 // next lift admitted immediately
  // therapist rule: nothing else is required — the arm is still at the target, so the
  // new lift is credited straight away
  assert.equal(feed(80, 4).targetReady, true);
  assert.equal(feed(60, 10).repetitions, 2);            // another 10°+ drop → repetition 2
  assert.equal(feed(95, 8).targetReady, true);          // and a normal full lift still counts
});

test('patient mode: an arm kept up at the target keeps scoring once each animation ends (completeHeldRepetition)', () => {
  const {c, feed} = session('4', 60, true);
  const up = feed(120, 10);                             // lifted and held, never lowered
  assert.equal(up.targetReady, true);
  assert.equal(up.repetitions, 0);
  // the game layer calls this when the reward animation has finished and the arm is still up
  assert.equal(c.completeHeldRepetition(), true);
  const after = c.snapshot();
  assert.equal(after.repetitions, 1);
  assert.equal(after.phase, 'outward');
  assert.equal(after.targetReady, false);
  const again = feed(120, 3);                           // still at the target → credited again at once
  assert.equal(again.targetReady, true);
  assert.equal(c.completeHeldRepetition(), true);       // next animation ends → repetition 2
  assert.equal(c.snapshot().repetitions, 2);
  // not applicable while the lift is still on its way up or already counted
  assert.equal(c.completeHeldRepetition(), false);
  assert.equal(feed(100, 10).repetitions, 3);           // a 10°+ drop from the peak still counts the current lift
});

test('completeHeldRepetition() is exposed and does nothing before calibration', () => {
  const c = api.createController({level:'3'});
  assert.equal(c.rearmAfterReward, undefined);
  assert.equal(typeof c.completeHeldRepetition, 'function');
  assert.equal(c.completeHeldRepetition(), false);
});

test('index.html: the public game counts a held lift once the animation has finished, before the reward-cycle check', () => {
  const start = html.indexOf('function updateShoulderFlexionGame(){');
  const end = html.indexOf('\nfunction ', start + 10);
  const update = html.slice(start, end);
  const held = update.indexOf('shoulderFlexionController.completeHeldRepetition()');
  const diff = update.indexOf('shoulderFlexionState.repetitions!==shoulderFlexionLastRepetition');
  assert.ok(held > 0 && diff > held, 'held-repetition completion must run before the repetition diff');
  assert.match(update, /if\(!research\.active&&shoulderRewardCycle\.active&&!shoulderRewardCycle\.repetitionReady\s*&&shoulderRewardVisualFinished\(\)/);
});

test('index.html: public reward end no longer resets the controller; research keeps setTarget', () => {
  const start = html.indexOf('function finishShoulderRewardCycle(){');
  const end = html.indexOf('\nlet shoulderHoldSpokenSecond', start);
  const finish = html.slice(start, end);
  assert.match(finish, /if\(shoulderFlexionController&&research\.active\)\{\s*shoulderFlexionController\.setTarget\(state\.shoulderTargetDeg,state\.level\);/);
  assert.equal((finish.match(/setTarget\(/g) || []).length, 1);
});

test('index.html: public Level 3/4 prompts and readouts carry no degree figures', () => {
  assert.match(html, /\}else if\(!research\.active\)\{[\s\S]{0,260}setActionPrompt\('慢慢放低',''\);[\s\S]{0,80}setActionPrompt\('放低啲再抬高',''\);[\s\S]{0,40}setActionPrompt\('抬高',''\);/);
  // research prompts unchanged
  assert.match(html, /setActionPrompt\('到起點',shoulderFlexionState\.selectedStartDeg\+'°'\);/);
  assert.match(html, /setActionPrompt\('抬高至',target\+'°'\);/);
  // live 現在／目標 readouts hidden in public mode, shown in research
  assert.match(html, /if\(readouts\) readouts\.hidden=!research\.active;/);
  assert.match(html, /\.level4-live-readouts\[hidden\]\{ display:none !important; \}/);
  // canvas 目標 xx° labels only in research
  assert.match(html, /if\(topY>=34 && research\.active\)\{/);
  assert.match(html, /if\(research\.active\)\{ \/\/ v137: public mode shows no degree figure\n\s*ctx\.fillStyle='#155f53'/);
});

test('v137 release markers', () => {
  const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
  assert.match(html, /const LEVEL_APP_BUILD = "v137-20261120-shoulder-rearm-drop10";/);
  assert.match(html, /perf v137/);
  assert.match(sw, /^const CACHE_VERSION = "fthue-rehab-v137-20261120-shoulder-rearm-drop10";/);
  assert.match(manifest, /v137-20261120-shoulder-rearm-drop10/);
});
