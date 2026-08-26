import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';

test('fresh same-generation poses are required for each therapist capture', () => {
  const controller = calibration.createController();
  controller.update({ arm:null, frameFresh:true, frameGeneration:3, frame:{fresh:true,generation:3} });
  assert.equal(controller.markFlexed(), false);
  assert.equal(controller.snapshot().reason, 'capture-needs-fresh-current-pose');
  feed(controller, 148.5, { generation:4 });
  assert.equal(controller.markFlexed(), true);
});

test('pose dropouts and stale frames fail closed without changing captured endpoints', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const before = controller.snapshot().endpoints;
  controller.update({ arm:null, frameFresh:false, frameGeneration:80,
    frame:{fresh:false,generation:80,ageMs:900,reason:'stale-decoded-frame',source:'test'} });
  const stale = controller.snapshot();
  assert.equal(stale.gameReady, false);
  assert.equal(stale.reason, 'frame-stale');
  assert.deepEqual(stale.endpoints, before);
  controller.update({ arm:null, frameFresh:true, frameGeneration:81,
    frame:{fresh:true,generation:81,ageMs:15,reason:'fresh-decoded-frame',source:'test'} });
  const dropout = controller.snapshot();
  assert.equal(dropout.gameReady, false);
  assert.equal(dropout.reason, 'selected-arm-lost');
  assert.deepEqual(dropout.endpoints, before);
});
