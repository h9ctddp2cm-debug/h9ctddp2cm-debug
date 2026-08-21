import test from 'node:test';
import assert from 'node:assert/strict';
import { calibration, feed, capture } from './fixtures/level4-two-point-test-helpers.mjs';

for (const [name, aspect] of [['iPhone portrait', 9/16], ['iPad portrait', 3/4], ['iPad landscape', 4/3]]) {
  test(name + ' preserves manually captured endpoints', () => {
    const controller = calibration.createController();
    capture(controller, 148.5, 61.5, 1, { aspect });
    assert.equal(feed(controller, 148.5, { generation:50, aspect }).progress, 0);
    assert.equal(feed(controller, 61.5, { generation:70, aspect }).progress, 1);
  });
}
