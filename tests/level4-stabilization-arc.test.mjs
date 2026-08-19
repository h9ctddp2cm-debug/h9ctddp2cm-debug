/* Deterministic Level 4 stabilization + arc-phase tests.
   Signal A = stabilized reach (flexed 0 -> participant's calibrated extended 1).
   Signal B = side-correct shoulder-abduction / lateral arc, only valid while the
   calibrated elbow extension is maintained (dissociation from flexor synergy). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const calib = require(path.join(root, 'level4-elbow-calibration.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const moduleJs = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');

/* ---- synthetic right-hemi poses, iPad on the same table at about 45 deg ---- */
/* Synthetic right-hemi poses matching the clinical setup: iPad on the same
   table at roughly 45 degrees, supported forearm. The projected arm is
   straighter at the extended endpoint than at the flexed start, as it is on
   the real device at this camera angle. */
const POSES = {
  flexed:{
    shoulder:{x:0.45, y:0.30, z:0}, otherShoulder:{x:0.60, y:0.30, z:0},
    elbow:{x:0.45, y:0.48, z:0}, wrist:{x:0.58, y:0.48, z:0},
  },
  extended:{
    shoulder:{x:0.45, y:0.30, z:0}, otherShoulder:{x:0.60, y:0.30, z:0},
    elbow:{x:0.54, y:0.35, z:-0.10}, wrist:{x:0.74, y:0.36, z:-0.30},
  },
  // Shoulder abduction outward to the patient's right, elbow still extended.
  arcOut:{
    shoulder:{x:0.45, y:0.30, z:0}, otherShoulder:{x:0.60, y:0.30, z:0},
    elbow:{x:0.34, y:0.33, z:-0.12}, wrist:{x:0.22, y:0.34, z:-0.26},
  },
  // Same lateral position, but the elbow has folded back into flexion.
  arcOutFlexed:{
    shoulder:{x:0.45, y:0.30, z:0}, otherShoulder:{x:0.60, y:0.30, z:0},
    elbow:{x:0.33, y:0.48, z:0}, wrist:{x:0.46, y:0.48, z:0},
  },
};

function mirrorPose(pose){
  const flip = (p) => ({x:1-p.x, y:p.y, z:p.z});
  return {
    shoulder:flip(pose.shoulder), otherShoulder:flip(pose.otherShoulder),
    elbow:flip(pose.elbow), wrist:flip(pose.wrist),
  };
}

function landmarks(pose, side){
  const lm = new Array(33).fill(null).map(() => ({x:0.5, y:0.5, z:0, visibility:0.99}));
  const idx = side === 'left'
    ? {shoulder:11, other:12, elbow:13, wrist:15}
    : {shoulder:12, other:11, elbow:14, wrist:16};
  const put = (i, p) => { lm[i] = {x:p.x, y:p.y, z:p.z || 0, visibility:0.99}; };
  put(idx.shoulder, pose.shoulder);
  put(idx.other, pose.otherShoulder);
  put(idx.elbow, pose.elbow);
  put(idx.wrist, pose.wrist);
  return lm;
}

function feed(controller, pose, frames, {side = 'right', jitter = 0, phase = 0} = {}){
  let last = null;
  for(let n = 0; n < frames; n++){
    const i = n + phase;
    const shifted = jitter
      ? {
          shoulder:pose.shoulder, otherShoulder:pose.otherShoulder,
          elbow:{x:pose.elbow.x + (i % 2 ? jitter : -jitter), y:pose.elbow.y + (i % 3 ? -jitter : jitter), z:pose.elbow.z},
          wrist:{x:pose.wrist.x + (i % 2 ? -jitter : jitter), y:pose.wrist.y + (i % 2 ? jitter : -jitter), z:pose.wrist.z},
        }
      : pose;
    last = controller.update({lm:landmarks(shifted, side), side, mirrorX:true});
  }
  return last;
}

function calibrated(side = 'right'){
  const controller = calib.createController();
  const poses = side === 'left'
    ? {flexed:mirrorPose(POSES.flexed), extended:mirrorPose(POSES.extended),
       arcOut:mirrorPose(POSES.arcOut), arcOutFlexed:mirrorPose(POSES.arcOutFlexed)}
    : POSES;
  feed(controller, poses.flexed, 14, {side});
  feed(controller, poses.extended, 14, {side});
  feed(controller, poses.flexed, 14, {side});
  assert.equal(controller.snapshot().calibrated, true, 'two-pose calibration should succeed');
  return {controller, poses};
}

test('stationary jitter is suppressed relative to the raw fused signal', () => {
  const {controller, poses} = calibrated();
  const lerp = (a, b, t) => ({x:a.x + (b.x - a.x) * t, y:a.y + (b.y - a.y) * t, z:(a.z || 0) + ((b.z || 0) - (a.z || 0)) * t});
  // Mid-reach, where no endpoint snap can help: pure stabilizer behaviour.
  const held = {
    shoulder:poses.flexed.shoulder, otherShoulder:poses.flexed.otherShoulder,
    elbow:lerp(poses.flexed.elbow, poses.extended.elbow, 0.5),
    wrist:lerp(poses.flexed.wrist, poses.extended.wrist, 0.5),
  };
  feed(controller, held, 12);
  const before = controller.snapshot().progress;
  let stabilizedRange = 0;
  let instantMin = 1;
  let instantMax = 0;
  for(let i = 0; i < 30; i++){
    feed(controller, held, 1, {jitter:0.006, phase:i});
    const snap = controller.snapshot();
    stabilizedRange = Math.max(stabilizedRange, Math.abs(snap.progress - before));
    instantMin = Math.min(instantMin, snap.instantProgress);
    instantMax = Math.max(instantMax, snap.instantProgress);
  }
  const instantRange = instantMax - instantMin;
  assert.ok(stabilizedRange <= 0.08,
    `stationary jitter moved stabilized progress by ${stabilizedRange.toFixed(3)}`);
  assert.ok(stabilizedRange <= instantRange * 0.75 + 1e-9,
    `stabilizer should damp jitter: stabilized ${stabilizedRange.toFixed(3)} vs raw ${instantRange.toFixed(3)}`);
});

test('the calibrated endpoints snap and stay still under jitter', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.extended, 10);
  const atEnd = controller.snapshot().progress;
  let drift = 0;
  for(let i = 0; i < 24; i++){
    feed(controller, poses.extended, 1, {jitter:0.006, phase:i});
    drift = Math.max(drift, Math.abs(controller.snapshot().progress - atEnd));
  }
  assert.equal(drift, 0, 'the extended endpoint must be rock steady while jittering');
});

test('a single-frame landmark jump is rejected instead of teleporting the item', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.extended, 12);
  const before = controller.snapshot().progress;
  const broken = {
    shoulder:poses.extended.shoulder, otherShoulder:poses.extended.otherShoulder,
    elbow:{x:0.90, y:0.92, z:0.4}, wrist:{x:0.05, y:0.95, z:0.5},
  };
  feed(controller, broken, 1);
  const after = controller.snapshot();
  assert.ok(Math.abs(after.progress - before) <= 0.17,
    `single bad frame changed progress by ${(after.progress - before).toFixed(3)}`);
});

test('smooth extension and flexion stay responsive without lag', () => {
  const {controller, poses} = calibrated();
  const lerp = (a, b, t) => ({x:a.x + (b.x - a.x) * t, y:a.y + (b.y - a.y) * t, z:(a.z || 0) + ((b.z || 0) - (a.z || 0)) * t});
  const at = (t) => ({
    shoulder:poses.flexed.shoulder, otherShoulder:poses.flexed.otherShoulder,
    elbow:lerp(poses.flexed.elbow, poses.extended.elbow, t),
    wrist:lerp(poses.flexed.wrist, poses.extended.wrist, t),
  });
  feed(controller, poses.flexed, 8);
  // A 20 frame sweep is a brisk clinical reach at 30 fps.
  let midway = null;
  for(let i = 1; i <= 20; i++){
    feed(controller, at(i / 20), 1);
    if(i === 12) midway = controller.snapshot().progress;
  }
  assert.ok(midway >= 0.25, `mid-sweep progress lagged at ${midway.toFixed(3)}`);
  feed(controller, poses.extended, 4);
  const peak = controller.snapshot().progress;
  assert.ok(peak >= 0.8, `extension only reached ${peak.toFixed(3)} after a full sweep`);
  for(let i = 19; i >= 0; i--) feed(controller, at(i / 20), 1);
  feed(controller, poses.flexed, 4);
  const back = controller.snapshot().progress;
  assert.ok(back <= 0.2, `flexion only returned to ${back.toFixed(3)}`);
});

test('rapid reversal is followed instead of being averaged away', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.extended, 10);
  assert.ok(controller.snapshot().progress >= 0.8);
  feed(controller, poses.flexed, 6);
  assert.ok(controller.snapshot().progress <= 0.25, 'reversal to flexed should be tracked quickly');
  feed(controller, poses.extended, 6);
  assert.ok(controller.snapshot().progress >= 0.75, 'reversal back to extended should be tracked quickly');
});

test('right-hemi 45 degree cycle runs flexed -> reach -> arc -> return -> flexed in order', () => {
  const {controller, poses} = calibrated('right');
  feed(controller, poses.extended, 10);
  let snap = controller.snapshot();
  assert.equal(snap.cycle.phase, 'reached');
  feed(controller, poses.arcOut, 10);
  snap = controller.snapshot();
  assert.equal(snap.arcActive, true, 'outward abduction should activate the arc signal');
  assert.equal(snap.cycle.phase, 'arc-out');
  assert.ok(snap.progress >= 0.8, 'reach must be held through the arc, not collapse');
  feed(controller, poses.extended, 8);
  assert.equal(controller.snapshot().cycle.phase, 'arc-return');
  feed(controller, poses.flexed, 10);
  snap = controller.snapshot();
  assert.equal(snap.cycle.ordered, true);
  assert.equal(snap.cycle.count, 1);
  assert.ok(snap.progress <= 0.2, 'the cycle must end back at the flexed start');
});

test('left-hemi mirrored cycle produces the same normalized signals', () => {
  const right = calibrated('right');
  feed(right.controller, right.poses.extended, 10);
  feed(right.controller, right.poses.arcOut, 10);
  const rightSnap = right.controller.snapshot();

  const left = calibrated('left');
  feed(left.controller, left.poses.extended, 10, {side:'left'});
  feed(left.controller, left.poses.arcOut, 10, {side:'left'});
  const leftSnap = left.controller.snapshot();

  assert.equal(leftSnap.arcActive, rightSnap.arcActive);
  assert.ok(Math.abs(leftSnap.arcProgress - rightSnap.arcProgress) < 1e-6,
    'outward direction must be mirrored by the affected side');
  assert.ok(Math.abs(leftSnap.progress - rightSnap.progress) < 1e-6);
});

test('elbow flexion during the lateral arc pauses and resets lateral scoring', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.extended, 10);
  feed(controller, poses.arcOut, 10);
  assert.equal(controller.snapshot().arcActive, true);
  feed(controller, poses.arcOutFlexed, 8);
  const snap = controller.snapshot();
  assert.equal(snap.arc.paused, true, 'flexor synergy during the arc must pause scoring');
  assert.equal(snap.arcActive, false);
  assert.equal(snap.arcProgress, 0, 'lateral credit must reset, not accumulate');
  assert.match(snap.arc.reason, /arc-paused-elbow-flexed/);
});

test('lateral abduction alone, without a prior reach, never activates the arc', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.flexed, 10);
  const sideways = {
    shoulder:poses.flexed.shoulder, otherShoulder:poses.flexed.otherShoulder,
    elbow:{x:0.32, y:0.48, z:0}, wrist:{x:0.24, y:0.52, z:0},
  };
  feed(controller, sideways, 12);
  const snap = controller.snapshot();
  assert.equal(snap.arcActive, false);
});

test('debug text reports stage, stabilizer, arc and cycle state', () => {
  const {controller, poses} = calibrated();
  feed(controller, poses.extended, 8);
  feed(controller, poses.arcOut, 8);
  const text = controller.toText();
  for(const key of ['stage:', 'progress:', 'stabilizer:', 'arc:', 'arcActive:', 'arcPaused:',
    'arcReason:', 'retention:', 'cycle:', 'cycleOrdered:', 'rejected:', 'side:']){
    assert.ok(text.includes(key), `missing ${key} in diagnostics text`);
  }
});

test('final Level 4 taxonomy: dimsum and bowling are linear, wipe/mahjong/bus are path games', () => {
  // Category 2 shares one ordered gate helper in both the page and the module.
  assert.match(html, /function level4PathGateOpen\(motion\)/);
  assert.match(html, /const valid = !!\(motion\?\.engaged && level4PathGateOpen\(motion\)\)/);
  assert.match(moduleJs, /function level4MotionPathReady\(motion\)/);
  assert.match(moduleJs, /const valid = !!\(motion\?\.engaged && level4MotionPathReady\(motion\)\)/);
  assert.match(moduleJs, /const onPath = level4MotionPathReady\(motion\)/);
  // Bowling stays purely linear: it must never consult the arc signal.
  const bowling = moduleJs.slice(moduleJs.indexOf('function updateLevel4Bowling'),
    moduleJs.indexOf('function level4MotionArcProgress') > 0
      ? moduleJs.indexOf('function updateLevel4MahjongWash')
      : moduleJs.length);
  assert.doesNotMatch(bowling, /PathReady|arcProgress|arcActive/);
});
