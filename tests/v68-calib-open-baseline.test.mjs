import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v68 calibration open-baseline regression tests, derived from the 30 Aug 2026
// Level 5 home recording:
//   The hand landmarker confirmed detection ~1.5s after the hand was raised,
//   by which time the participant had already closed the hand. The old open
//   stage was a blind 750ms timer that sampled whatever posture followed first
//   detection, so the "open" baseline was captured from a fist. The light-close
//   criterion (value >= openMean + 0.035) then became permanently unreachable,
//   輕合手 never ticked, and 開始遊戲 stayed disabled.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contract: quality-gated open stage ---------------- */

test('open baseline is sampled only from frames that actually look open', () => {
  assert.match(publicSource, /Number\.isFinite\(value\)\s*&&\s*calibLooksOpen\(res\)/);
  // The completion criterion is cumulative qualifying open time, not a blind
  // wall-clock timer started at first detection.
  assert.match(publicSource, /const requiredOpenHoldMs = isLevel6RealToolTask\(\) \? 450 : 750/);
  assert.doesNotMatch(publicSource, /now\s*-\s*c\.openStart\s*>=\s*750/);
});

test('grasp interpretation exposes finger visibility counts for calibration', () => {
  assert.match(publicSource, /graspOpenCount:\s*grasp\.openCount,\s*graspCurledCount:\s*grasp\.curledCount/);
});

test('a poisoned open baseline is recaptured after sustained more-open evidence', () => {
  // Sustained evidence that the live hand is clearly MORE open than the stored
  // "open" baseline restarts the open stage instead of leaving 輕合手 stuck.
  assert.match(publicSource, /c\.moreOpenMs\s*>=\s*600[\s\S]{0,400}c\.openDone\s*=\s*false/);
  assert.match(publicSource, /c\.moreOpenMs\s*>=\s*600[\s\S]{0,400}c\.openScores\s*=\s*\[\]/);
  // Closed-stage evidence collected against the poisoned baseline is discarded.
  assert.match(publicSource, /c\.moreOpenMs\s*>=\s*600[\s\S]{0,400}c\.closedScores\s*=\s*\[\]/);
  // Grasp-mode margin mirrors the light-close margin.
  assert.match(publicSource, /value\s*<=\s*openMean\s*-\s*0\.015/);
});

test('calibration dropout reset clears the v68 open-stage accumulators', () => {
  assert.match(publicSource, /lostForMs\s*>\s*CALIB_DROPOUT_GRACE_MS[\s\S]{0,300}c\.openHoldMs\s*=\s*0/);
  assert.match(publicSource, /lostForMs\s*>\s*CALIB_DROPOUT_GRACE_MS[\s\S]{0,300}c\.moreOpenMs\s*=\s*0/);
});

test('all calibration state objects carry the v68 open-stage fields', () => {
  const literals = publicSource.match(/detectedStart:0,\s*openHoldMs:0,\s*openTickAt:0,\s*moreOpenMs:0,\s*closedHoldMs:0/g) || [];
  assert.equal(literals.length, 4);
});

/* ---------------- Behavioural: calibLooksOpen predicate ---------------- */

function extractCalibLooksOpen(mode){
  const match = publicSource.match(/function calibLooksOpen\(res\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'calibLooksOpen not found in index.html');
  return new Function(
    'isPinchMode', 'isPegMode',
    `${match[0]}; return calibLooksOpen;`
  )(() => mode === 'pinch', () => mode === 'peg');
}

test('grasp mode: a fist never qualifies as the open baseline', () => {
  const looksOpen = extractCalibLooksOpen('grasp');
  assert.equal(looksOpen({graspOpenCount: 0, graspCurledCount: 5}), false);
  assert.equal(looksOpen({graspOpenCount: 1, graspCurledCount: 3}), false);
});

test('grasp mode: an open or limited-extension stroke hand qualifies', () => {
  const looksOpen = extractCalibLooksOpen('grasp');
  assert.equal(looksOpen({graspOpenCount: 4, graspCurledCount: 0}), true);
  assert.equal(looksOpen({graspOpenCount: 2, graspCurledCount: 2}), true);
  // Nothing meaningfully curled counts as open even without full extension.
  assert.equal(looksOpen({graspOpenCount: 0, graspCurledCount: 1}), true);
});

test('grasp mode: pose-wrist fallback frames keep the pre-v68 behaviour', () => {
  const looksOpen = extractCalibLooksOpen('grasp');
  // Gross-tabletop pose fallback has no finger counts; it reports isOpenPrep.
  assert.equal(looksOpen({isOpenPrep: true}), true);
  assert.equal(looksOpen({isOpenPrep: false}), false);
});

test('pinch and peg modes gate the open stage on isOpenPrep', () => {
  const pinchLooksOpen = extractCalibLooksOpen('pinch');
  assert.equal(pinchLooksOpen({isOpenPrep: true}), true);
  assert.equal(pinchLooksOpen({isOpenPrep: false, graspOpenCount: 4, graspCurledCount: 0}), false);
  const pegLooksOpen = extractCalibLooksOpen('peg');
  assert.equal(pegLooksOpen({isOpenPrep: true}), true);
  assert.equal(pegLooksOpen({isOpenPrep: false}), false);
});
