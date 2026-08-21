/* Numeric-only replay derived from the v28 visible debug evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';

const V28_REPLAY = [148.5, 142, 128, 105, 83, 61.5, 83, 105, 128, 148.5];

test('v28 replay is monotonic in captured direction and normal return is not classified reversed', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const outward = V28_REPLAY.slice(0, 6).map((angle, index) => feed(controller, angle, { generation:50 + index * 7 }).progress);
  const returning = V28_REPLAY.slice(6).map((angle, index) => feed(controller, angle, { generation:100 + index * 7 }).progress);
  for (let i=1; i<outward.length; i++) assert.ok(outward[i] >= outward[i-1] - 0.02);
  for (let i=1; i<returning.length; i++) assert.ok(returning[i] <= returning[i-1] + 0.02);
  const snap = controller.snapshot();
  assert.equal(snap.reason, 'ready');
  assert.equal(snap.progress, 0);
});

test('two-point replay leaves its captured endpoints unchanged without hidden relearning', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  for (let i=0; i<20; i++) feed(controller, 40 + i, { generation:100+i });
  const snap = controller.snapshot();
  assert.equal(snap.endpoints.flexed.angle.toFixed(1), '148.5');
  assert.equal(snap.endpoints.extended.angle.toFixed(1), '61.5');
  assert.equal('preflightPassed' in snap, false);
});
