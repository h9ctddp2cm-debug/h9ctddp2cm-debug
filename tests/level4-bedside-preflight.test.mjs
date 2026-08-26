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

test('patient panel presents endpoints, keeps the path-only shoulder row hidden by default, and keeps details collapsed', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['level4FlexedEndpoint', 'level4ExtendedEndpoint',
    'level4AutoProgress']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /id="level4ShoulderAbductionReading" hidden/);
  assert.match(html, /\.level4-reading\[hidden\]\{\s*display:none !important;\s*\}/);
  assert.match(html, /function level4PatientReadyGuidance\(\)/);
  assert.match(html, /isLevel4HorizontalPathGame\(\)/);
  assert.match(html, /治療師詳細資料 \/ Therapist details/);
  assert.match(html, /<details data-testid="details-level4-therapist"/);
  assert.doesNotMatch(html, /id="level4RawElbowAngle"/);
  assert.doesNotMatch(html, /id="level4VerificationCount"/);
});
