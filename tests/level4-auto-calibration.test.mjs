import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibration, armAtAngle, capture, poseForArm } from './fixtures/level4-two-point-test-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function packet(angle, generation, nowMs, opts = {}) {
  const fresh = opts.fresh !== false;
  const arm = opts.arm === undefined ? armAtAngle(angle, opts.lateral || 0) : opts.arm;
  const side = opts.side || 'right';
  const lm = opts.lm === undefined && arm ? poseForArm(arm, side, opts.torso) : opts.lm;
  return {
    arm, lm, side, imageAspect: opts.aspect || 1,
    enableHorizontalAbduction: opts.enableHorizontalAbduction,
    frameFresh: fresh, frameGeneration: generation, nowMs,
    frame: { fresh, generation, ageMs: fresh ? 16 : 900, source:'test-decoded-frame', reason:fresh ? 'fresh-decoded-frame' : 'stale-decoded-frame' },
  };
}
function step(controller, auto, angle, generation, nowMs, opts) {
  const p = packet(angle, generation, nowMs, opts);
  controller.update(p); auto.update(p, controller);
  return auto.snapshot();
}
function seedPreAnchor(controller, auto, angle = 120, opts = {}) {
  // This uses the same decoded-frame route as the bedside runtime. There is no
  // test-only anchor injection API: a real pre-button history is mandatory.
  for (let i=0; i<6; i++) step(controller, auto, angle, -6 + i, -200 + i * 33, opts);
  assert.equal(auto.snapshot().preAnchor.available, true, 'six stable pre-button frames establish the patient anchor');
}
function begin(controller, auto, angle = 120, opts = {}) {
  seedPreAnchor(controller, auto, angle, opts);
  auto.start(0);
  step(controller, auto, angle, 1, 0, opts);
  step(controller, auto, angle, 2, 2999);
  return step(controller, auto, angle, 3, 3000); // transition consumes no endpoint sample
}
function stable(controller, auto, angle, generation, nowMs, trace = [0,1,-1,2,-2,0,1,-1,0,12]) {
  let snap;
  for (let i=0; i<trace.length; i++) snap = step(controller, auto, angle + trace[i], generation + i, nowMs + i * 33);
  return snap;
}
function autoPair(start, end) {
  const controller = calibration.createController();
  const auto = calibration.createAutoCalibration();
  begin(controller, auto, start);
  let gen = 4;
  let snap = stable(controller, auto, start, gen, 3033); gen += 20;
  assert.equal(snap.phase, 'capture-extended', 'stable supported flexion is a candidate only');
  // Deliberate travel is observed but only a held far endpoint may commit.
  step(controller, auto, start + (end - start) * .55, gen++, 3500);
  step(controller, auto, start + (end - start) * .82, gen++, 3533);
  snap = stable(controller, auto, end, gen, 3600);
  return {controller, auto, snap};
}

test('withdrawal countdown accepts no endpoint samples or controller mutation', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration();
  seedPreAnchor(controller, auto, 120);
  auto.start(0);
  for (let g=1; g<=18; g++) step(controller, auto, 120, g, g * 100);
  assert.equal(auto.snapshot().phase, 'countdown');
  assert.equal(auto.snapshot().stableFrames, 0);
  assert.equal(controller.snapshot().endpoints.flexed, null);
  assert.equal(controller.snapshot().endpoints.extended, null);
});

test('duplicate decoded generations cannot advance automatic stable credit', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration();
  begin(controller, auto);
  for (let i=0; i<20; i++) step(controller, auto, 120, 4, 3040 + i * 30);
  assert.equal(auto.snapshot().phase, 'capture-flexed');
  assert.equal(auto.snapshot().stableFrames, 1);
  assert.equal(controller.snapshot().endpoints.flexed, null);
});

test('realistic stationary noise plus isolated outliers still captures a pair', () => {
  const {controller, snap} = autoPair(120, 95);
  assert.equal(snap.phase, 'complete');
  const out = controller.snapshot();
  assert.equal(out.auto.flexed, true); assert.equal(out.auto.extended, true);
  assert.equal(out.manual.flexed, false); assert.equal(out.gameReady, true);
  assert.ok(Math.abs(out.endpoints.flexed.angle - 120) < 2.5);
  assert.ok(Math.abs(out.endpoints.extended.angle - 95) < 2.5);
  // The noisy hold is deliberately allowed to continue after the atomic commit;
  // an exact subsequent fresh endpoint must still map directly to 1.
  controller.update(packet(out.endpoints.extended.angle, 999, 5000));
  assert.equal(controller.snapshot().progress, 1, 'extended patient endpoint maps directly to 1');
  // A raw landmark spike did not become the endpoint.
  assert.ok(Math.abs(out.endpoints.extended.angle - 95) < 4);
});

test('automatic endpoint direction may increase or decrease without reorientation', () => {
  for (const [start, end] of [[120,95],[65,98]]) {
    const {controller, snap} = autoPair(start, end);
    assert.equal(snap.phase, 'complete');
    const out = controller.snapshot();
    assert.ok(Math.sign(out.endpoints.extended.angle - out.endpoints.flexed.angle) === Math.sign(end-start));
    controller.update(packet(out.endpoints.extended.angle, 999, 5000));
    assert.equal(controller.snapshot().progress, 1);
  }
});

test('sustained drift is not accepted as a flexed hold', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration(); begin(controller, auto, 120);
  for (let i=0; i<15; i++) step(controller, auto, 120 + i, 4+i, 3033+i*33);
  assert.equal(auto.snapshot().phase, 'capture-flexed');
  assert.equal(controller.snapshot().endpoints.flexed, null);
  assert.ok(Math.abs(auto.snapshot().summary.slope) > auto.config.maxDriftDegPerFrame);
});

test('first post-countdown therapist/other-arm frame cannot establish identity and preserves manual endpoints', () => {
  const controller = calibration.createController();
  const baseline = capture(controller, 145, 70, 1).endpoints;
  const auto = calibration.createAutoCalibration();
  seedPreAnchor(controller, auto, 120);
  auto.start(0);
  step(controller, auto, 120, 1, 0);
  step(controller, auto, 120, 2, 3000); // countdown transition, no endpoint sample
  const therapist = armAtAngle(120); ['shoulder','elbow','wrist','otherShoulder'].forEach(k => { therapist[k].x += .55; });
  step(controller, auto, 120, 3, 3033, {arm:therapist, torso:{dx:.55}});
  assert.equal(auto.snapshot().phase, 'retry');
  assert.equal(auto.snapshot().reason, 'torso-moved/person-changed');
  assert.equal(auto.snapshot().stableFrames, 0);
  assert.deepEqual(controller.snapshot().endpoints, baseline);
});

test('no pre-button patient anchor refuses sampling and cannot be created after the button', () => {
  const controller = calibration.createController();
  const baseline = capture(controller, 145, 70, 1).endpoints;
  const auto = calibration.createAutoCalibration();
  auto.start(0);
  assert.equal(auto.snapshot().phase, 'retry');
  assert.equal(auto.snapshot().reason, 'pre-anchor-required');
  for(let i=0;i<10;i++) step(controller, auto, 120, 10+i, 3033+i*33);
  assert.equal(auto.snapshot().stableFrames, 0, 'post-button frames do not earn endpoint credit');
  assert.equal(auto.snapshot().lock, null, 'the first later arm never becomes the lock');
  assert.deepEqual(controller.snapshot().endpoints, baseline);
});

test('matching frozen pre-anchor admits stable endpoint capture; later identity jump fails closed', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration();
  begin(controller, auto, 120);
  for(let i=0;i<4;i++) step(controller, auto, 120,4+i,3033+i*33);
  assert.equal(auto.snapshot().stableFrames,4);
  const jump=armAtAngle(120); ['shoulder','elbow','wrist','otherShoulder'].forEach(k=>{ jump[k].y+=.50; });
  step(controller,auto,120,8,3180,{arm:jump,torso:{dy:.50}});
  assert.equal(auto.snapshot().phase,'retry');
  assert.equal(auto.snapshot().reason,'torso-moved/person-changed');
  assert.equal(controller.snapshot().endpoints.flexed,null);
});

test('person-change retry discards the stale lock and admits a newly established patient anchor', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration();
  begin(controller, auto, 120);
  const shiftedArm=armAtAngle(120);
  ['shoulder','elbow','wrist','otherShoulder'].forEach(k=>{ shiftedArm[k].x+=.55; });
  step(controller, auto, 120, 4, 3033, {arm:shiftedArm});
  let snap = auto.snapshot();
  assert.equal(snap.phase, 'retry');
  assert.equal(snap.reason, 'torso-moved/person-changed');
  assert.equal(snap.lock, null);
  assert.equal(snap.preAnchor.available, false);
  assert.equal(snap.preAnchor.frozen, false);

  for (let i=0; i<6; i++) step(controller, auto, 120, 10+i, 3200+i*33, {arm:shiftedArm});
  snap = auto.snapshot();
  assert.equal(snap.preAnchor.available, true, 'six replacement-patient frames establish a new anchor');
  auto.start(3500);
  assert.equal(auto.snapshot().phase, 'countdown');
  assert.equal(auto.snapshot().lock.side, 'right');
});

test('stale frames and pose loss reset partial auto stability credit', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration(); begin(controller, auto, 120);
  for(let i=0;i<5;i++) step(controller, auto, 120, 4+i,3033+i*33);
  assert.equal(auto.snapshot().stableFrames, 5);
  step(controller, auto, 120, 9, 3220, {fresh:false});
  assert.equal(auto.snapshot().stableFrames, 0); assert.equal(auto.snapshot().reason, 'frame-stale');
  for(let i=0;i<5;i++) step(controller, auto, 120, 10+i,3250+i*33);
  step(controller, auto, 120, 20, 3440, {arm:null});
  assert.equal(auto.snapshot().stableFrames, 0); assert.equal(auto.snapshot().reason, 'selected-arm-lost');
});

test('insufficient deliberate excursion times out to retry without endpoint mutation', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration(); begin(controller, auto, 120);
  stable(controller, auto, 120, 4, 3033);
  stable(controller, auto, 114, 30, 3800);
  step(controller, auto, 114, 50, 24050);
  assert.equal(auto.snapshot().phase, 'retry'); assert.equal(auto.snapshot().reason, 'timeout-extension');
  assert.equal(controller.snapshot().endpoints.flexed, null); assert.equal(controller.snapshot().gameReady, false);
});

test('manual fallback remains available after automatic cancellation', () => {
  const controller = calibration.createController(); const auto = calibration.createAutoCalibration(); seedPreAnchor(controller, auto); auto.start(0); auto.cancel();
  const snap = capture(controller, 142, 68, 1);
  assert.equal(snap.gameReady, true); assert.equal(snap.manual.flexed, true); assert.equal(snap.manual.extended, true);
});

test('shoulder abduction is aspect-aware, smoothed, and does not change elbow readiness', () => {
  const makeLm = (side, aspect) => {
    const lm = Array.from({length:33}, ()=>({x:0,y:0,visibility:0}));
    const si=side==='left'?11:12, ei=side==='left'?13:14, wi=side==='left'?15:16, hi=side==='left'?23:24;
    lm[si]={x:.5,y:.3,visibility:1}; lm[ei]={x:.5 + .2/aspect,y:.3,visibility:1}; lm[wi]={x:.7,y:.3,visibility:1}; lm[hi]={x:.5,y:.7,visibility:1};
    return lm;
  };
  for(const aspect of [.5625, 1.7778]) {
    const c=calibration.createController(); const lm=makeLm('right',aspect);
    c.update({lm,side:'right',imageAspect:aspect,frameFresh:true,frameGeneration:1,frame:{fresh:true,generation:1}});
    const s=c.snapshot(); assert.ok(Math.abs(s.filteredShoulderAbduction-90)<.5, 'aspect '+aspect);
    assert.equal(s.gameReady,false);
  }
});

test('linear Level 4 admission disables horizontal observation and no shoulder-flexion signal exists', () => {
  const c=calibration.createController();
  const first=packet(140,1,0,{enableHorizontalAbduction:false});
  c.update(first); c.markFlexed();
  const second=packet(70,2,33,{enableHorizontalAbduction:false});
  c.update(second); c.markExtended();
  const changed=packet(105,3,66,{enableHorizontalAbduction:false,lateral:.35});
  c.update(changed);
  const s=c.snapshot();
  assert.equal(s.gameReady,true);
  assert.equal(s.shoulderAbduction,null);
  assert.equal(s.shoulderOutward,null);
  assert.equal(s.abductionProgress,0);
  const source=fs.readFileSync(path.join(root,'level4-elbow-calibration.js'),'utf8');
  assert.doesNotMatch(source,/shoulderFlexion|shoulderElevation|shoulderHike/);
});

test('patient-facing calibration UI has three readings and collapsed therapist details', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const id of ['level4FlexedEndpoint','level4ExtendedEndpoint','level4ShoulderAbduction','level4AutoProgress']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/重試自動偵測/); assert.match(html,/Retry auto/);
  assert.match(html,/function level4MaybeStartAutoCalibration\(\)/);
  assert.match(html,/auto\.preAnchor\?\.available !== true/);
  assert.match(html,/level4AutoAction" hidden/);
  assert.match(html,/level4ManualActions" hidden/);
  assert.match(html,/>屈肘<br>Flexed</);
  assert.match(html,/>伸肘<br>Extended</);
  assert.match(html,/>外展<br>Outward</);
  assert.match(html,/id="btnLevel4MarkFlexed"/); assert.match(html,/id="btnLevel4MarkExtended"/);
  assert.match(html,/<details data-testid="details-level4-therapist"/);
  assert.doesNotMatch(html,/<details[^>]+details-level4-therapist[^>]+open/);
  assert.doesNotMatch(html,/id="level4RawElbowAngle"/);
  assert.match(html,/shoulderAbduction:/);
  assert.match(html,/function isLevel4HorizontalPathGame\(\)/);
  assert.match(html,/horizontalReading\.hidden = !horizontalEnabled/);
});
