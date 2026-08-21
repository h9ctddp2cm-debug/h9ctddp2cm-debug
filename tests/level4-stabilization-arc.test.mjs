import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('fixed median/EMA and endpoint hysteresis stabilize the direct angle map', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const values = [62, 61, 62.5, 60.7, 61.5].map((angle, i) => feed(controller, angle, {generation:50+i*5}).progress);
  assert.ok(values.every(value => value >= 0.94));
  assert.equal(controller.snapshot().stabilizer.reason, 'median3-ema');
});

test('arc state is separate and cannot change linear angle progress', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const atExtension = feed(controller, 61.5, {generation:50, lateral:0}).progress;
  const afterLateral = feed(controller, 61.5, {generation:70, lateral:0.18}).progress;
  assert.equal(atExtension, 1);
  assert.equal(afterLateral, 1);
  const source = fs.readFileSync(path.join(root, 'level4-elbow-calibration.js'), 'utf8');
  assert.match(source, /function updateArc\(\)/);
  assert.doesNotMatch(source, /rangeExpansion|conflictSuppression|hiddenRelearning|arcHold|arcPaused|extensionRetention/);
});
