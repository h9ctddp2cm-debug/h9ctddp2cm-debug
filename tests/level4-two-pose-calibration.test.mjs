import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';

test('v28 captured angles 148.5 flexed and 61.5 extended map exactly to 0 and 1', () => {
  const controller = calibration.createController();
  const ready = capture(controller, 148.5, 61.5);
  assert.equal(ready.calibrated, true);
  assert.equal(ready.gameReady, true, 'two fresh labelled captures immediately make the controller ready');
  assert.equal(ready.endpoints.flexed.angle.toFixed(1), '148.5');
  assert.equal(ready.endpoints.extended.angle.toFixed(1), '61.5');
  assert.equal(feed(controller, 148.5, { generation: 50 }).progress, 0);
  assert.equal(feed(controller, 61.5, { generation: 70 }).progress, 1);
});

test('captured order is the signed direction for both high-angle and low-angle extension', () => {
  const decreasing = calibration.createController();
  capture(decreasing, 148.5, 61.5);
  assert.ok(feed(decreasing, 105, { generation: 50 }).progress > 0.35);
  const increasing = calibration.createController();
  capture(increasing, 61.5, 148.5);
  assert.ok(feed(increasing, 105, { generation: 50 }).progress > 0.35);
  assert.equal(feed(increasing, 61.5, { generation: 65 }).progress, 0);
  assert.equal(feed(increasing, 148.5, { generation: 80 }).progress, 1);
});

test('only insufficient absolute elbow-angle separation rejects capture with clear guidance', () => {
  const controller = calibration.createController();
  feed(controller, 90, { generation: 1 });
  assert.equal(controller.markFlexed(), true);
  feed(controller, 93.5, { generation: 20 });
  assert.equal(controller.markExtended(), false);
  const snap = controller.snapshot();
  assert.equal(snap.reason, 'angle-separation-too-small');
  assert.match(controller.guidance().en, /too similar|recapture/i);
  assert.equal(snap.calibrated, false);
});

test('diagnostics expose fresh frame, angle endpoints, raw/filtered angle and progress', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const text = controller.toText();
  for (const token of ['frame:fresh', 'generation:', 'rawAngle:', 'filteredAngle:', 'progress:',
    'captured:flexed=148.5°', 'extended=61.5°', 'ready:true']) assert.match(text, new RegExp(token));
});
