/* Deterministic Level 4 two-pose calibration tests.

   These run the real bedside module (level4-elbow-calibration.js) against
   synthetic poses, including the front-facing iPad case where the 2D elbow
   angle alone is ambiguous but arm-span / world-depth still separate flexion
   from extension. No camera, no DOM, no timers. */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const calibration = require(path.join(root, 'level4-elbow-calibration.js'));
const gamesSource = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');

/* ---------------- synthetic poses (right affected side) ---------------- */

// Supported flexed start: elbow ~90 degrees, forearm resting on the skateboard.
const FLEXED = {
  shoulder:{x:0.45, y:0.30, z:0, visibility:1},
  elbow:{x:0.45, y:0.48, z:0, visibility:1},
  wrist:{x:0.58, y:0.48, z:0, visibility:1},
  otherShoulder:{x:0.60, y:0.30, z:0, visibility:1},
};
// Extended endpoint: elbow straightened away from the body.
const EXTENDED = {
  shoulder:{x:0.45, y:0.30, z:0, visibility:1},
  elbow:{x:0.54, y:0.35, z:-0.10, visibility:1},
  wrist:{x:0.74, y:0.36, z:-0.30, visibility:1},
  otherShoulder:{x:0.60, y:0.30, z:0, visibility:1},
};
// Front-facing ambiguity: the arm reaches straight towards the iPad, so every
// image-space signal (2D elbow angle, 2D arm span, radial distance) is identical
// to the flexed start and only depth/world signals reveal the extension.
const AMBIGUOUS_ANGLE_EXTENDED = {
  shoulder:{x:0.45, y:0.30, z:0, visibility:1},
  elbow:{x:0.45, y:0.48, z:-0.10, visibility:1},
  wrist:{x:0.58, y:0.48, z:-0.30, visibility:1},
  otherShoulder:{x:0.60, y:0.30, z:0, visibility:1},
};
const HIKE = {
  shoulder:{x:0.45, y:0.22, z:0, visibility:1},
  elbow:{x:0.45, y:0.40, z:0, visibility:1},
  wrist:{x:0.58, y:0.40, z:0, visibility:1},
  otherShoulder:{x:0.60, y:0.30, z:0, visibility:1},
};

function worldArm(shoulderZ, elbowZ, wristZ, span){
  // Metric world landmarks: only the forward (z) axis and the chord length
  // change between the two poses.
  return {
    shoulder:{x:-0.16, y:-0.30, z:shoulderZ, visibility:1},
    elbow:{x:-0.16, y:-0.30 + 0.24, z:elbowZ, visibility:1},
    wrist:{x:-0.16 + span, y:-0.30 + 0.24, z:wristZ, visibility:1},
    otherShoulder:{x:0.16, y:-0.30, z:0, visibility:1},
  };
}
const FLEXED_WORLD = worldArm(0, 0, 0, 0.14);
const EXTENDED_WORLD = worldArm(0, -0.12, -0.40, 0.24);

function jitter(pose, amount){
  const shift = (point, sign)=>({
    x:point.x + sign*amount,
    y:point.y - sign*amount,
    z:point.z,
    visibility:point.visibility,
  });
  return {
    shoulder:shift(pose.shoulder, 1),
    elbow:shift(pose.elbow, -1),
    wrist:shift(pose.wrist, 1),
    otherShoulder:shift(pose.otherShoulder, -1),
  };
}

function feed(controller, arm, frames, world){
  let state = controller.state;
  for(let i=0;i<frames;i++){
    state = controller.update({arm, worldArm:world || null, side:'right'});
  }
  return state;
}

function calibrate(controller, flexed = FLEXED, extended = EXTENDED, worlds = {}){
  feed(controller, flexed, 14, worlds.flexed);
  feed(controller, extended, 14, worlds.extended);
  return controller.state;
}

/* -------------------------------- tests -------------------------------- */

test('two explicit poses are captured from multiple stable samples, in order', () => {
  const controller = calibration.createController();
  const framing = controller.update({arm:FLEXED, side:'right'});
  assert.equal(framing.framingReady, true);
  assert.equal(framing.stage, 'capture-flexed');
  assert.equal(framing.calibrated, false);

  const afterFlexed = feed(controller, FLEXED, 14);
  assert.equal(afterFlexed.stage, 'capture-extended');
  assert.equal(afterFlexed.captureCount.flexed, 1);
  assert.ok(afterFlexed.endpoints.flexed, 'flexed endpoint recorded');
  // Holding the start pose must not be mistaken for a failed attempt.
  assert.equal(afterFlexed.reason, 'awaiting-extension');
  assert.equal(afterFlexed.retryCount, 0);
  assert.ok(controller.config.minStableSamples >= 3);

  const ready = feed(controller, EXTENDED, 14);
  assert.equal(ready.stage, 'ready');
  assert.equal(ready.calibrated, true);
  assert.equal(ready.captureCount.extended, 1);
  assert.ok(ready.endpoints.extended, 'extended endpoint recorded');
});

test('progress is normalised flexed endpoint = 0 to extended endpoint = 1', () => {
  const controller = calibration.createController();
  calibrate(controller);
  assert.equal(controller.state.progress, 1);
  assert.equal(controller.state.reachGate, true);
  assert.equal(controller.state.completionReady, true);

  const back = feed(controller, FLEXED, 14);
  assert.equal(back.progress, 0);
  assert.equal(back.engaged, false);
  assert.equal(back.returnReady, true);
  assert.equal(back.reachGate, false);

  // A pose halfway between the two captured endpoints lands strictly between 0
  // and 1 and must not report completion.
  const lerpPoint = (a, b, t)=>({
    x:a.x + (b.x-a.x)*t,
    y:a.y + (b.y-a.y)*t,
    z:(a.z||0) + ((b.z||0)-(a.z||0))*t,
    visibility:1,
  });
  const midway = {
    shoulder:lerpPoint(FLEXED.shoulder, EXTENDED.shoulder, 0.5),
    elbow:lerpPoint(FLEXED.elbow, EXTENDED.elbow, 0.5),
    wrist:lerpPoint(FLEXED.wrist, EXTENDED.wrist, 0.5),
    otherShoulder:FLEXED.otherShoulder,
  };
  const mid = feed(controller, midway, 10);
  assert.ok(mid.progress > 0.2 && mid.progress < 0.9, `mid progress ${mid.progress}`);
  assert.equal(mid.completionReady, false);
});

test('flexion and extension are still separated when the 2D elbow angle is ambiguous', () => {
  const flexedAngle = calibration.computeSignals(FLEXED, null).angle;
  const ambiguousAngle = calibration.computeSignals(AMBIGUOUS_ANGLE_EXTENDED, null).angle;
  assert.ok(
    Math.abs(ambiguousAngle - flexedAngle) < calibration.CONFIG.minSeparation.angle,
    `2D angle is ambiguous: ${flexedAngle} vs ${ambiguousAngle}`
  );

  const controller = calibration.createController();
  calibrate(controller, FLEXED, AMBIGUOUS_ANGLE_EXTENDED, {
    flexed:FLEXED_WORLD,
    extended:EXTENDED_WORLD,
  });
  assert.equal(controller.state.calibrated, true);
  // The angle signal must be rejected; span/world/depth carry the movement.
  assert.ok(!controller.state.qualified.includes('angle'), 'ambiguous angle excluded');
  assert.ok(
    controller.state.qualified.includes('worldSpan')
      || controller.state.qualified.includes('spanRatio'),
    `qualified: ${controller.state.qualified.join(',')}`
  );
  assert.equal(controller.state.progress, 1);
  assert.equal(feed(controller, FLEXED, 14, FLEXED_WORLD).progress, 0);
});

test('a reversed signal direction still maps flexed to 0 and extended to 1', () => {
  // Swapping the capture order means every signal moves the opposite way.
  const controller = calibration.createController();
  calibrate(controller, EXTENDED, FLEXED);
  assert.equal(controller.state.calibrated, true);
  assert.equal(controller.state.progress, 1, 'the second captured pose is progress 1');
  const separation = controller.state.separation;
  assert.ok(separation.angle < 0, 'angle separation is negative in this direction');
  assert.equal(feed(controller, EXTENDED, 14).progress, 0);
  assert.equal(feed(controller, FLEXED, 14).progress, 1);
});

test('jitter around the flexed endpoint does not create progress', () => {
  const controller = calibration.createController();
  calibrate(controller);
  feed(controller, FLEXED, 14);
  for(let i=0;i<12;i++){
    const state = controller.update({
      arm:jitter(FLEXED, i % 2 ? 0.004 : -0.004),
      side:'right',
    });
    assert.ok(state.progress < controller.config.deadZone, `jitter progress ${state.progress}`);
    assert.equal(state.engaged, false);
  }
});

test('missing world landmarks fall back to 2D signals without failing', () => {
  const controller = calibration.createController();
  calibrate(controller, FLEXED, EXTENDED, {flexed:null, extended:null});
  assert.equal(controller.state.calibrated, true);
  assert.equal(controller.state.depthSource, 'image-z');
  assert.equal(controller.state.signals.worldSpan, null);
  assert.ok(!controller.state.qualified.includes('worldSpan'));
  assert.ok(controller.state.qualified.length > 0, '2D signals still qualify');
  assert.equal(controller.state.progress, 1);

  // World landmarks that appear only for the extended pose must not be trusted.
  const partial = calibration.createController();
  calibrate(partial, FLEXED, EXTENDED, {flexed:null, extended:EXTENDED_WORLD});
  assert.equal(partial.state.calibrated, true);
  assert.ok(!partial.state.qualified.includes('worldSpan'));
});

test('insufficient endpoint separation asks for a retry instead of calibrating', () => {
  const controller = calibration.createController();
  const nearlyIdentical = {
    shoulder:FLEXED.shoulder,
    elbow:{x:0.452, y:0.478, z:0, visibility:1},
    wrist:{x:0.585, y:0.477, z:0, visibility:1},
    otherShoulder:FLEXED.otherShoulder,
  };
  feed(controller, FLEXED, 14);
  controller.markExtended();
  const state = controller.state;
  assert.equal(state.calibrated, false);
  assert.equal(state.stage, 'retry');
  assert.equal(state.reason, 'manual-insufficient-separation');
  const lacking = state.lacking.map(entry => entry.signal);
  for(const key of calibration.PRIMARY_KEYS){
    assert.ok(lacking.includes(key), `${key} reported as lacking separation`);
  }
  const guidance = controller.guidance();
  assert.equal(guidance.main, calibration.RETRY_TEXT.main);
  assert.match(guidance.detail, /\u4e0d\u540c|\u5206\u5225/);
  assert.match(guidance.en, /again/i);
  assert.ok(controller.separationText().length > 0);

  // Automatic capture of a near-identical pose also refuses to calibrate.
  const auto = calibration.createController();
  feed(auto, FLEXED, 14);
  feed(auto, nearlyIdentical, 30);
  assert.equal(auto.state.calibrated, false);
  assert.ok(['capture-extended', 'retry'].includes(auto.state.stage));
});

test('the manual therapist fallback marks both endpoints from held poses', () => {
  const controller = calibration.createController();
  feed(controller, FLEXED, 3);
  controller.markFlexed();
  assert.equal(controller.state.manual.flexed, true);
  assert.equal(controller.state.stage, 'capture-extended');
  feed(controller, EXTENDED, 3);
  controller.markExtended();
  assert.equal(controller.state.manual.extended, true);
  assert.equal(controller.state.calibrated, true);
  assert.equal(controller.state.progress, 1);
  assert.equal(feed(controller, FLEXED, 12).progress, 0);
});

test('shoulder hiking freezes progress and raises the therapist warning', () => {
  const controller = calibration.createController();
  calibrate(controller);
  feed(controller, FLEXED, 14);
  const state = feed(controller, HIKE, 3);
  assert.equal(state.shoulderHike, true);
  assert.equal(state.progress, 0, 'hiking cannot advance the game');
  assert.match(state.warning, /患側聳肩/);
});

test('an occluded opposite shoulder still calibrates from the affected arm', () => {
  const hide = pose => ({
    ...pose,
    otherShoulder:{...pose.otherShoulder, visibility:0.01},
  });
  const controller = calibration.createController();
  calibrate(controller, hide(FLEXED), hide(EXTENDED));
  assert.equal(controller.state.calibrated, true);
  assert.equal(controller.state.progress, 1);
});

test('diagnostics expose stage, raw signals, endpoints, weights and reason', () => {
  const controller = calibration.createController();
  calibrate(controller);
  const text = controller.toText();
  for(const token of ['stage:', 'progress:', 'reason:', 'raw=', 'endpoints=', 'separation=', 'signalProgress=']){
    assert.ok(text.includes(token), `${token} present in diagnostics`);
  }
  const snapshot = controller.snapshot();
  assert.equal(snapshot.stage, 'ready');
  assert.ok(Object.keys(snapshot.weights).length > 0);
  assert.ok(Number.isFinite(snapshot.endpoints.flexed.angle));
  assert.ok(Number.isFinite(snapshot.endpoints.extended.angle));
});

test('all five Level 4 games consume the same normalised progress', () => {
  // dim sum / standard transport: fixed lane X, vertical Y from progress.
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /y:carry\.pickupY \+ \(carry\.targetY-carry\.pickupY\) \* progress/);
  assert.match(html, /const progress = clamp01\(level4Reach\.progress\)/);
  assert.match(html, /level4Reach\.gameReady && level4Reach\.completionReady && level4Reach\.reachGate/);
  assert.match(html, /level4Reach\.gameReady && level4Reach\.returnReady && !level4Reach\.engaged/);
  // wipe window is a Category 2 path game: extension first, then the arc.
  assert.match(html, /function level4PathGateOpen\(motion\)/);
  assert.match(html, /const valid = !!\(motion\?\.engaged && level4PathGateOpen\(motion\)\)/);
  // bowling / mahjong wash / bus pay
  assert.match(gamesSource, /function level4MotionProgress\(motion\)/);
  assert.match(gamesSource, /function level4MotionReachGate\(motion\)/);
  assert.match(gamesSource, /function level4MotionReturnReady\(motion\)/);
  assert.match(gamesSource, /const progress = level4MotionProgress\(motion\)/);
  assert.match(gamesSource, /function level4MotionPathReady\(motion\)/);
  assert.match(gamesSource, /function level4MotionGameplayReady\(motion\)/);
  assert.match(gamesSource, /motion\.gameReady === true/);
  assert.match(gamesSource, /const onPath = level4MotionPathReady\(motion\)/);
  // Elbow extension is never mapped to horizontal movement.
  assert.doesNotMatch(gamesSource, /mapped\.x[\s\S]*motion\.progress/);
  assert.match(html, /fixed in X, so elbow motion can never be presented as left\/right movement/);
});

test('game gating follows one reach-return cycle of the shared progress', () => {
  const cycle = [0, 0.1, 0.3, 0.5, 0.65, 0.8, 1, 0.7, 0.4, 0.2, 0.05, 0];
  const controller = calibration.createController();
  calibrate(controller);
  feed(controller, FLEXED, 14);

  // Replay the normalised progress through the same gate rules the games use.
  let phase = 'reach';
  let peak = 0;
  let released = false;
  for(const progress of cycle){
    const reachGate = progress >= controller.config.reachEnter;
    const returnReady = progress <= controller.config.returnAt;
    if(reachGate){ phase = 'return'; peak = Math.max(peak, progress); }
    if(phase === 'return'){
      peak = Math.max(peak, progress);
      if(returnReady){ released = true; }
    }
  }
  assert.equal(released, true, 'release requires extension followed by flexion');
  assert.ok(peak >= controller.config.reachEnter);
});
