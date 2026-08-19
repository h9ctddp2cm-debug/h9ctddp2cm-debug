/* Deterministic bedside preflight: a calibrated mapping is not a gameplay
   unlock until three live, ordered flexed -> extended -> flexed cycles occur. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const calibration = require(path.join(root, 'level4-elbow-calibration.js'));

const FLEXED = {
  shoulder:{x:0.45,y:0.30,z:0,visibility:1},
  elbow:{x:0.45,y:0.48,z:0,visibility:1},
  wrist:{x:0.58,y:0.48,z:0,visibility:1},
  otherShoulder:{x:0.60,y:0.30,z:0,visibility:1},
};
const EXTENDED = {
  shoulder:{x:0.45,y:0.30,z:0,visibility:1},
  elbow:{x:0.54,y:0.35,z:-0.10,visibility:1},
  wrist:{x:0.74,y:0.36,z:-0.30,visibility:1},
  otherShoulder:{x:0.60,y:0.30,z:0,visibility:1},
};

function feed(controller, arm, frames = 14){
  for(let frame = 0; frame < frames; frame++){
    controller.update({arm,side:'right'});
  }
  return controller.snapshot();
}
function midpoint(a, b, fraction = 0.5){
  const point = (from, to) => ({
    x:from.x + (to.x - from.x) * fraction,
    y:from.y + (to.y - from.y) * fraction,
    z:(from.z || 0) + ((to.z || 0) - (from.z || 0)) * fraction,
    visibility:1,
  });
  return {
    shoulder:point(a.shoulder,b.shoulder), elbow:point(a.elbow,b.elbow),
    wrist:point(a.wrist,b.wrist), otherShoulder:a.otherShoulder,
  };
}
function calibrated(options){
  // Raise the automatic sample threshold so this helper specifically exercises
  // the therapist's labelled Mark start / Mark end flow.
  const controller = calibration.createController({minStableSamples:99,...options});
  // Exercise the therapist-facing supported-pose controls rather than relying
  // on automatic staging. The bedside preflight is explicitly downstream of
  // these two labelled captures.
  controller.update({arm:FLEXED,side:'right'});
  controller.markFlexed();
  controller.update({arm:EXTENDED,side:'right'});
  controller.markExtended();
  assert.equal(controller.snapshot().calibrated, true);
  assert.equal(controller.snapshot().gameReady, false, 'endpoint capture alone must stay locked');
  return controller;
}

test('three ordered participant-calibrated cycles unlock gameplay and expose bedside QA state', () => {
  const controller = calibrated();
  // First return only arms the sequence; it cannot be counted as a cycle.
  let state = feed(controller, FLEXED);
  assert.equal(state.verification.count, 0);
  assert.equal(state.verification.phase, 'await-extended');
  assert.equal(state.recognisedState, '下方起點');

  for(let cycle = 1; cycle <= 3; cycle++){
    state = feed(controller, midpoint(FLEXED, EXTENDED), 6);
    assert.equal(state.recognisedState, '伸肘中');
    state = feed(controller, EXTENDED);
    assert.equal(state.recognisedState, '上方終點');
    assert.equal(state.verification.phase, 'await-flexed-return');
    state = feed(controller, FLEXED);
    assert.equal(state.verification.count, cycle);
  }
  assert.equal(state.preflightPassed, true);
  assert.equal(state.gameReady, true);
  assert.equal(state.verification.count, 3);
  assert.equal(state.verification.phase, 'complete');
  assert.equal(state.recognisedState, '下方起點');
});

test('inverted raw elbow-angle direction still makes extension increase calibrated progress', () => {
  // Semantic capture names remain flexed then extended; this deliberately
  // makes the raw 2D angle separation negative, as can happen with a camera
  // view whose projected angle runs in the opposite direction.
  const manual = calibration.createController({minStableSamples:99});
  feed(manual, EXTENDED, 5);
  manual.markFlexed();
  feed(manual, FLEXED, 5);
  manual.markExtended();
  let state = manual.snapshot();
  assert.ok(state.separation.angle < 0, 'test fixture must invert raw angle sign');
  assert.equal(state.progress, 1, 'second captured endpoint is normalised as extension');

  feed(manual, EXTENDED); // lower / flexed start for this calibrated pair
  for(let cycle = 0; cycle < 3; cycle++){
    state = feed(manual, FLEXED);
    assert.ok(state.progress > 0.9, 'extension always increases normalised progress');
    state = feed(manual, EXTENDED);
  }
  assert.equal(state.gameReady, true);
  assert.equal(state.preflightPassed, true);
});

test('the therapist preflight panel renders the current elbow angle, sign-safe progress, exact state labels and counter', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for(const id of [
    'level4RawElbowAngle',
    'level4NormalizedProgress',
    'level4RecognisedState',
    'level4VerificationCount',
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /level4Reach\.elbowAngle\.toFixed\(1\) \+ '°'/);
  assert.match(html, /Math\.round\(clamp01\(level4Reach\.progress\)\*100\) \+ '%'/);
  assert.match(html, /level4Reach\.recognisedState \|\| '追蹤未就緒'/);
  assert.match(html, /verification\.count \+ '\/' \+ verification\.required/);
});

test('missing tracking, reversed movement and a stalled movement keep the game locked with retry state', () => {
  const controller = calibrated({verificationStallFrames:150});
  controller.update({arm:null,side:'right'});
  let state = controller.snapshot();
  assert.equal(state.gameReady, false);
  assert.equal(state.verification.failure, 'tracking-missing');

  feed(controller, FLEXED);
  // Move far enough to begin extension but below the reach gate, then reverse.
  feed(controller, midpoint(FLEXED, EXTENDED, 0.3), 5);
  feed(controller, FLEXED, 5);
  state = controller.snapshot();
  assert.equal(state.gameReady, false);
  assert.equal(state.verification.failure, 'reversed');
  assert.match(controller.guidance().main, /次序反轉/);

  const stalled = calibrated({verificationStallFrames:4});
  feed(stalled, FLEXED);
  // Enter the flexion-return phase, then stop short of the lower endpoint.
  const mid = midpoint(FLEXED, EXTENDED, 0.3);
  feed(stalled, mid, 4);
  feed(stalled, mid, 10);
  state = stalled.snapshot();
  assert.equal(state.gameReady, false);
  assert.equal(state.verification.failure, 'stalled');
  assert.match(stalled.guidance().main, /動作停滯/);
});
