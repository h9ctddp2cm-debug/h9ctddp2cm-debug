import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';

test('endpoint captures remain fixed throughout live use', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const before = controller.snapshot().endpoints;
  for (let i=0; i<30; i++) feed(controller, i % 2 ? 70 : 140, {generation:100+i});
  assert.deepEqual(controller.snapshot().endpoints, before);
});

test('normal return stays a valid calibrated movement rather than a reversal failure', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  feed(controller, 61.5, {generation:60});
  const end = feed(controller, 148.5, {generation:80});
  assert.equal(end.reason, 'ready');
  assert.equal(end.gameReady, true);
  assert.equal(end.progress, 0);
});
