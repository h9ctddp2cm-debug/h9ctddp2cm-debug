import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v73 Level 3/4 保齡球場景 regression tests (30 Aug 2026 user request):
//   1. New shoulder-flexion visual scene「荃灣保齡球場」for Levels 3 and 4 ONLY.
//   2. When the patient lifts the shoulder to the OT-selected target angle,
//      the bowling ball rolls up the lane, hits the pins, and ALL pins fall
//      completely on screen so the patient knows the target was reached.
//   3. Impact plays applause + a multi-voice「好波」cheer (local offline mp3)
//      as positive reinforcement; pins reset standing for the next repetition.
//   4. SAFETY: the scene is a pure visual/audio reward layer. It reads only
//      shoulderFlexionState progress/targetReady. It must not introduce any
//      hand-contact, pickup-dwell, grip or release signal into the L3/L4
//      branch, and must not alter target-reached judgement.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');
const buildScript = readFileSync(path.join(root, 'scripts', 'build-dist.sh'), 'utf8');

function slice(startMarker, endMarker){
  const start = publicSource.indexOf(startMarker);
  assert.ok(start >= 0, 'missing start marker: ' + startMarker);
  const end = publicSource.indexOf(endMarker, start);
  assert.ok(end > start, 'missing end marker: ' + endMarker);
  return publicSource.slice(start, end);
}

/* ---------------- Source contract: assets & theme wiring ---------------- */

test('bowling scene assets are preloaded and shipped', () => {
  assert.match(publicSource, /img\/bowling_alley_bg\.png/);
  assert.match(publicSource, /img\/bowling_pin\.png/);
  assert.match(publicSource, /img\/bowling_ball\.png/);
  assert.match(publicSource, /audio\/haobo_cheer\.mp3/);
  // dist build must bundle the new offline audio directory
  assert.match(buildScript, /cp -R "\$ROOT\/audio" "\$DIST\/audio"/);
});

test('bowlinglane theme is registered and offered first on Levels 3/4', () => {
  assert.match(publicSource, /id:'bowlinglane',title:'荃灣保齡球場'/);
  assert.match(publicSource, /return \['bowlinglane','tsuenwan','dimsum','flowers','laundry','cards','mahjong'\];/);
  assert.match(publicSource, /if\(themeId === 'bowlinglane'\) return level === '3' \|\| level === '4';/);
});

test('bowlinglane gating: Levels 3/4 only (functional)', () => {
  const code = slice('function themeAvailableForLevel(themeId', '\nfunction availableThemeOrder');
  const fn = new Function('state', code + '\nreturn themeAvailableForLevel;')({level: '3'});
  assert.equal(fn('bowlinglane', '3'), true);
  assert.equal(fn('bowlinglane', '4'), true);
  assert.equal(fn('bowlinglane', '2'), false);
  assert.equal(fn('bowlinglane', '5'), false);
  assert.equal(fn('bowlinglane', '67'), false);
  // fridge stays Level-5-only, unchanged by v73
  assert.equal(fn('fridge', '5'), true);
  assert.equal(fn('fridge', '3'), false);
});

test('bowlinglane variant drives the item visuals; pins are scene-drawn (no generic target)', () => {
  assert.match(publicSource, /bowlinglane:\[\s*\{ type:'bowlingball', itemLabel:'保齡球'/);
  // v74 widened this branch to also cover the teahouse dim sum mode
  assert.match(publicSource, /if\(state\.theme==='bowlinglane'\|\|isTeahouseDimsumMode\(\)\)\{\s*\/\/ v73[^]{0,120}\s*targets=\[\];\s*return;/);
  assert.match(publicSource, /if\(state\.theme==='bowlinglane'\)\{ drawBowlingAlleyScene\(ctx,cw,ch\); return; \}/);
});

/* ---------------- Safety invariants ---------------- */

test('scene block admits no hand-contact/grip/release signal', () => {
  const scene = slice('/* ==================== v73 保齡球場景', 'function drawShoulderFlexionGuide');
  for(const banned of ['heldItem', 'gripActive', 'dwellTarget', 'releaseItem',
    'handContact', 'pinch', 'grabDistance', 'landmarks']){
    assert.ok(!scene.includes(banned), 'scene block must not reference ' + banned);
  }
  // reward layer reads shoulder state only
  assert.match(scene, /shoulderFlexionState\.progress/);
});

test('strike starts only from the existing targetReady award point', () => {
  assert.match(publicSource, /shoulderFlexionCycleAwarded=true;\s*triggerFeedback\(true\);\s*if\(state\.theme==='bowlinglane'\)startBowlingStrike\(\);/);
  // pins reset for the next repetition when the cycle completes
  assert.match(publicSource, /advanceLevel3RoundVariant\(\);\s*resetBowlingStrike\(\);/);
});

/* ---------------- Functional: strike state machine & geometry ---------------- */

function loadStrikeModule(){
  const code = slice('const bowlingStrike={', 'function drawBowlingBallSprite');
  let now = 0;
  let applause = 0;
  const mod = new Function(
    'isShoulderFlexionLevel', 'state', 'nowMs', 'getAudioCtx', 'playApplauseSound', 'imgBowlingAlleyBg',
    code + '\nreturn {bowlingStrike,startBowlingStrike,updateBowlingStrike,resetBowlingStrike,bowlingLaneGeometry,isBowlingLaneTheme};'
  )(
    () => true,
    {level: '3', theme: 'bowlinglane'},
    () => now,
    () => { throw new Error('no audio in tests'); },
    () => { applause++; },
    {naturalWidth: 768, naturalHeight: 1028},
  );
  return {mod, setNow: v => { now = v; }, getApplause: () => applause};
}

test('strike machine: roll -> impact (sounds once) -> down -> reset', () => {
  const {mod, setNow, getApplause} = loadStrikeModule();
  assert.equal(mod.bowlingStrike.phase, 'idle');
  setNow(1000);
  mod.startBowlingStrike();
  assert.equal(mod.bowlingStrike.phase, 'roll');
  assert.equal(mod.bowlingStrike.pinSeeds.length, 10);
  // re-trigger during animation is a no-op
  mod.startBowlingStrike();
  assert.equal(mod.bowlingStrike.startedMs, 1000);
  setNow(1000 + 619);
  mod.updateBowlingStrike();
  assert.equal(mod.bowlingStrike.phase, 'roll');
  setNow(1000 + 620);
  mod.updateBowlingStrike();
  assert.equal(mod.bowlingStrike.phase, 'impact');
  assert.equal(getApplause(), 1);
  mod.updateBowlingStrike();
  assert.equal(getApplause(), 1, 'impact sounds must play exactly once');
  setNow(1000 + 620 + 680);
  mod.updateBowlingStrike();
  assert.equal(mod.bowlingStrike.phase, 'down');
  mod.resetBowlingStrike();
  assert.equal(mod.bowlingStrike.phase, 'idle');
  assert.equal(mod.bowlingStrike.pinSeeds, null);
});

test('lane geometry stays on-canvas in both iPad orientations', () => {
  const {mod} = loadStrikeModule();
  for(const [cw, ch] of [[820, 1180], [1180, 820]]){
    const g = mod.bowlingLaneGeometry(cw, ch);
    assert.ok(g.py0 >= 0, `panel top on screen (${cw}x${ch}): ${g.py0}`);
    assert.ok(g.py1 <= ch, `panel bottom on screen (${cw}x${ch}): ${g.py1}`);
    assert.ok(g.laneX - g.pw / 2 >= 0, 'panel left edge on screen');
    assert.ok(g.laneX + g.pw / 2 <= cw, 'panel right edge on screen');
    // pins stand just above the existing item-path top (ch*0.34), so the
    // ball's normal lift travel visually reaches the pin deck
    assert.ok(Math.abs(g.pinBaseY - ch * 0.315) < 1e-6);
    assert.ok(g.py0 + g.topH < g.py1, 'lane section has positive height');
  }
});
