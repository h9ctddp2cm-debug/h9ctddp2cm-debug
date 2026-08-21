/* The retired three-cycle preflight is intentionally absent. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibration, capture } from './fixtures/level4-two-point-test-helpers.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('two fresh therapist captures make the two-point controller ready without a repetition lock', () => {
  const controller = calibration.createController();
  const snap = capture(controller, 148.5, 61.5);
  assert.equal(snap.gameReady, true);
  assert.equal('preflightPassed' in snap, false);
  assert.equal('verification' in snap, false);
});

test('therapist panel names raw and filtered angle rather than verification cycles', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['level4RawElbowAngle', 'level4FilteredElbowAngle',
    'level4NormalizedProgress', 'level4RecognisedState']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.doesNotMatch(html, /id="level4VerificationCount"/);
});
