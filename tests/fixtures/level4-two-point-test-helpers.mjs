import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
export const calibration = require(path.join(root, 'level4-elbow-calibration.js'));

const SHOULDER = { x: 0.50, y: 0.30, visibility: 1 };
const ELBOW = { x: 0.50, y: 0.50, visibility: 1 };
const OTHER = { x: 0.68, y: 0.30, visibility: 1 };
const FOREARM = 0.20;

export function armAtAngle(degrees, lateral = 0) {
  const rad = degrees * Math.PI / 180;
  // shoulder->elbow points down. Rotate that unit vector to obtain an exact
  // 2D elbow angle, then optionally move the whole arm laterally (which leaves
  // the elbow angle invariant while changing the arc signal).
  const ux = 0;
  const uy = -1;
  return {
    shoulder: { x: SHOULDER.x + lateral, y: SHOULDER.y, z: 0, visibility: 1 },
    elbow: { x: ELBOW.x + lateral, y: ELBOW.y, z: 0, visibility: 1 },
    wrist: {
      x: ELBOW.x + lateral + FOREARM * (ux * Math.cos(rad) - uy * Math.sin(rad)),
      y: ELBOW.y + FOREARM * (ux * Math.sin(rad) + uy * Math.cos(rad)),
      z: 0, visibility: 1,
    },
    otherShoulder: { ...OTHER, z: 0 },
  };
}

// A full patient pose for automatic-calibration tests.  The selected arm may
// foreshorten or extend independently while this torso stays stable; helpers
// can replace/move the torso explicitly to exercise fail-closed continuity.
export function poseForArm(arm, side = 'right', torso = {}) {
  const lm = Array.from({length:33}, () => ({x:.5, y:.5, visibility:.05}));
  const left = side === 'left';
  lm[left ? 11 : 12] = {...arm.shoulder};
  lm[left ? 13 : 14] = {...arm.elbow};
  lm[left ? 15 : 16] = {...arm.wrist};
  lm[left ? 12 : 11] = {...arm.otherShoulder, visibility:1};
  const shoulderMidX = ((arm.shoulder.x || .5) + (arm.otherShoulder.x || .68)) / 2 + (torso.dx || 0);
  const shoulderY = ((arm.shoulder.y || .3) + (arm.otherShoulder.y || .3)) / 2 + (torso.dy || 0);
  const hipY = shoulderY + (torso.height || .38);
  const halfSpan = Math.abs((arm.shoulder.x || .5) - (arm.otherShoulder.x || .68)) / 2 || .09;
  lm[11] = lm[11].visibility >= 1 ? lm[11] : {x:shoulderMidX-halfSpan,y:shoulderY,visibility:1};
  lm[12] = lm[12].visibility >= 1 ? lm[12] : {x:shoulderMidX+halfSpan,y:shoulderY,visibility:1};
  lm[23] = {x:shoulderMidX-halfSpan*.9,y:hipY,visibility:1};
  lm[24] = {x:shoulderMidX+halfSpan*.9,y:hipY,visibility:1};
  return lm;
}

export function feed(controller, degrees, { frames = 5, generation = 1, fresh = true, lateral = 0, aspect = 1 } = {}) {
  let snap;
  for (let index = 0; index < frames; index++) {
    const gen = generation + index;
    controller.update({
      arm: armAtAngle(degrees, lateral), side: 'right', imageAspect: aspect,
      frameFresh: fresh, frameGeneration: gen,
      frame: { fresh, generation: gen, ageMs: fresh ? 18 : 820,
        source: 'test-decoded-frame', reason: fresh ? 'fresh-decoded-frame' : 'stale-decoded-frame' },
    });
    snap = controller.snapshot();
  }
  return snap;
}

export function capture(controller, flexed, extended, generation = 1, options = {}) {
  feed(controller, flexed, { generation, ...options });
  controller.markFlexed();
  feed(controller, extended, { generation: generation + 20, ...options });
  controller.markExtended();
  return controller.snapshot();
}
