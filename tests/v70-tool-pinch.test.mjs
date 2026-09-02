import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v70 tool-in-hand regression tests, derived from the 30 Aug 2026 home
// recordings: with real chopsticks in the affected hand, calibration stuck at
// 揸開三指 (bare-hand open gate unreachable while gripping a tool) and gameplay
// never armed a grasp. The chopstick and cloth-peg tasks now calibrate and
// interpret the tripod aperture against the participant's own tool-constrained
// range, with per-digit release thresholds (the middle finger rides the tool
// and moves far less than the index).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contracts ---------------- */

test('real-tool pinch predicate covers exactly the peg task in normal mode', () => {
  assert.match(publicSource,
    /function isLevel6RealToolTask\(\)\{\s*return isLevel6\(\) && state\.level6Task === 'peg';\s*\}/);
});

test('gameplay pinch branch routes tool tasks through the tool interpreter', () => {
  assert.match(publicSource,
    /const pinch = isLevel6RealToolTask\(\)\s*\?\s*computeToolPinchState\(lm, isGrasping\)\s*:\s*computePinchState\(lm, isGrasping\);/);
});

test('calibration open gate is range-based for tool tasks, unchanged for bare hand', () => {
  assert.match(publicSource,
    /isLevel6RealToolTask\(\)\s*\?\s*toolCalibOpenQualifies\(c\.toolVals, value\)\s*:\s*\(Number\.isFinite\(value\) && calibLooksOpen\(res\)\)/);
  // v68 bare-hand contract must survive verbatim.
  assert.match(publicSource, /Number\.isFinite\(value\)\s*&&\s*calibLooksOpen\(res\)/);
});

test('dropout reset clears the v70 tool accumulators', () => {
  assert.match(publicSource,
    /lostForMs\s*>\s*CALIB_DROPOUT_GRACE_MS[\s\S]{0,300}c\.toolVals\s*=\s*\[\]/);
  assert.match(publicSource,
    /lostForMs\s*>\s*CALIB_DROPOUT_GRACE_MS[\s\S]{0,400}c\.closedNear\s*=\s*\[\];\s*c\.closedFar\s*=\s*\[\]/);
});

test('rebaseline discards per-digit evidence gathered against a poisoned baseline', () => {
  assert.match(publicSource,
    /c\.moreOpenMs\s*>=\s*600[\s\S]{0,500}c\.openNear\s*=\s*\[\];\s*c\.openFar\s*=\s*\[\]/);
});

test('release requires movement from BOTH digits against their own ranges', () => {
  assert.match(publicSource,
    /const bothReopened = nearRatio\s*>=\s*t\.nearExit\s*&&\s*farRatio\s*>=\s*t\.farExit;/);
});

test('personal tool thresholds are derived only for ready tool-task calibrations', () => {
  assert.match(publicSource,
    /c\.ready && isLevel6RealToolTask\(\) && state\.personalToolPinch == null/);
  assert.match(publicSource, /personalToolPinch:null,/);
  assert.match(publicSource, /state\.personalToolPinch = null;/);
  assert.match(publicSource, /const gapC = Math\.max\(0\.006, openMean - closedMean\)/);
  assert.match(publicSource, /const gapNear = Math\.max\(0\.004, openNearMean - closedNearMean\)/);
  assert.match(publicSource, /const gapFar = Math\.max\(0\.005, openFarMean - closedFarMean\)/);
});

test('small valid chopstick calibration keeps entry and release inside the measured range', () => {
  const closed = {combo: 0.388, near: 0.300, far: 0.430};
  const open = {combo: 0.400, near: 0.309, far: 0.442};
  const gapC = Math.max(0.006, open.combo - closed.combo);
  const gapNear = Math.max(0.004, open.near - closed.near);
  const gapFar = Math.max(0.005, open.far - closed.far);
  const thresholds = {
    enter: closed.combo + gapC * 0.56,
    nearExit: closed.near + gapNear * 0.62,
    farExit: closed.far + gapFar * 0.62,
    nearOpen: closed.near + gapNear * 0.74,
    farOpen: closed.far + gapFar * 0.74,
  };
  assert.ok(thresholds.enter > closed.combo && thresholds.enter < open.combo);
  assert.ok(thresholds.nearExit > closed.near && thresholds.nearExit < open.near);
  assert.ok(thresholds.farExit > closed.far && thresholds.farExit < open.far);
  assert.ok(thresholds.nearOpen > thresholds.nearExit && thresholds.nearOpen < open.near);
  assert.ok(thresholds.farOpen > thresholds.farExit && thresholds.farOpen < open.far);
});

test('tool defaults keep coherent hysteresis ordering', () => {
  const m = publicSource.match(/const TOOL_PINCH_DEFAULTS = \{[\s\S]*?\};/);
  assert.ok(m, 'TOOL_PINCH_DEFAULTS not found');
  const d = new Function(m[0] + ' return TOOL_PINCH_DEFAULTS;')();
  assert.ok(d.enter < d.nearExit, 'enter must be tighter than nearExit');
  assert.ok(d.nearExit < d.nearOpen, 'release must be easier than re-arm separation');
  assert.ok(d.farExit < d.farOpen, 'release must be easier than re-arm separation (far digit)');
  assert.ok(d.nearExit <= d.farExit, 'far digit is allowed a wider exit than the near digit');
});

/* ---------------- Behavioural: tool calibration range gate ---------------- */

function extractToolCalib(){
  const m = publicSource.match(/const TOOL_CALIB_MIN_RANGE[\s\S]*?function toolCalibOpenQualifies\(vals, value\)\{[\s\S]*?\n\}/);
  assert.ok(m, 'tool calibration helpers not found');
  return new Function(m[0] + '\nreturn {toolCalibRange, toolCalibOpenQualifies};')();
}

test('a static posture never qualifies as open, regardless of duration', () => {
  const {toolCalibOpenQualifies} = extractToolCalib();
  const staticVals = Array.from({length: 60}, () => 0.40);
  assert.equal(toolCalibOpenQualifies(staticVals, 0.40), false);
  // A static FIST also never qualifies (the v68 poisoning scenario).
  const fistVals = Array.from({length: 60}, () => 0.22);
  assert.equal(toolCalibOpenQualifies(fistVals, 0.22), false);
});

test('too few samples never qualify', () => {
  const {toolCalibOpenQualifies} = extractToolCalib();
  assert.equal(toolCalibOpenQualifies([0.30, 0.50, 0.31, 0.49], 0.50), false);
  assert.equal(toolCalibOpenQualifies(undefined, 0.50), false);
  assert.equal(toolCalibOpenQualifies([], NaN), false);
});

test('after genuine open-close movement, only the top of the range qualifies', () => {
  const {toolCalibOpenQualifies} = extractToolCalib();
  const vals = [];
  for(let i = 0; i < 5; i++) vals.push(0.30, 0.34, 0.42, 0.48, 0.50, 0.46, 0.36, 0.31);
  assert.equal(toolCalibOpenQualifies(vals, 0.48), true, 'top-band aperture should qualify');
  assert.equal(toolCalibOpenQualifies(vals, 0.33), false, 'closed-band aperture must not qualify');
});

/* ---------------- Behavioural: computeToolPinchState ---------------- */

function extractToolPinch(personal){
  // v75: computeToolPinchState now feeds the in-game adaptive tracker, so the
  // harness compiles that block too (fresh per extraction — histories empty,
  // fail-closed to the personal/default thresholds under test).
  const defaults = publicSource.match(/const TOOL_PINCH_DEFAULTS = \{[\s\S]*?\};/);
  const adapt = publicSource.match(/const TOOL_ADAPT_MIN_SAMPLES[\s\S]*?function updateToolPinchAdapt[\s\S]*?\n\}/);
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/);
  assert.ok(defaults && adapt && fn, 'computeToolPinchState not found');
  const hasFinite = (lm, idxs) => idxs.every(i => lm[i]
    && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) && Number.isFinite(lm[i].z));
  const factory = new Function('hasFiniteHandLandmarks', 'research', 'state', 'nowMs',
    defaults[0] + '\n' + adapt[0] + '\n' + fn[0] + '\nreturn computeToolPinchState;');
  return factory(hasFinite, {active: false}, {personalToolPinch: personal || null}, () => 0);
}

// Same geometry as the QA synthetic hand: fixed palm, fingertip gaps supplied.
function syntheticHand(indexGap, middleGap){
  const lm = Array.from({length: 21}, () => ({x: .5, y: .5, z: 0}));
  lm[0] = {x: .42, y: .72, z: 0};
  lm[5] = {x: .43, y: .55, z: 0};
  lm[9] = {x: .52, y: .53, z: 0};
  lm[17] = {x: .62, y: .58, z: 0};
  lm[4] = {x: .48, y: .49, z: 0};
  lm[8] = {x: lm[4].x + indexGap, y: lm[4].y, z: 0};
  lm[12] = {x: lm[4].x + middleGap, y: lm[4].y, z: 0};
  return lm;
}

test('closing both digits enters the pinch under tool defaults', () => {
  const toolPinch = extractToolPinch();
  const res = toolPinch(syntheticHand(0.10, 0.15), false);
  assert.equal(res.valid, true);
  assert.equal(res.isPinching, true);
});

test('a single drifting landmark can never release a held item', () => {
  const toolPinch = extractToolPinch();
  // Index tip flies open while the middle digit stays closed on the tool.
  const res = toolPinch(syntheticHand(0.26, 0.12), true);
  assert.equal(res.isPinching, true, 'far-digit-only reopen must NOT release');
  // And the mirrored case: middle opens, index stays closed.
  const res2 = toolPinch(syntheticHand(0.12, 0.26), true);
  assert.equal(res2.isPinching, true, 'one closed digit must keep the item held');
});

test('reopening BOTH digits releases and re-arms', () => {
  const toolPinch = extractToolPinch();
  const res = toolPinch(syntheticHand(0.18, 0.20), true);
  assert.equal(res.isPinching, false, 'both digits past their exits must release');
  const armed = toolPinch(syntheticHand(0.18, 0.20), false);
  assert.equal(armed.isSeparated, true, 'the same aperture must re-arm open-prep');
});

test('calibrated tool thresholds make a small real-tool excursion releasable', () => {
  // Tool-constrained personal range: apertures far below every bare-hand gate.
  const personal = {enter: .32, nearExit: .30, farExit: .36, nearOpen: .33, farOpen: .40, scoreOpen: .45};
  const toolPinch = extractToolPinch(personal);
  const closed = toolPinch(syntheticHand(0.06, 0.08), false);
  assert.equal(closed.isPinching, true, 'tool-closed aperture must enter the pinch');
  const reopened = toolPinch(syntheticHand(0.09, 0.11), true);
  assert.equal(reopened.isPinching, false,
    'a small but genuine both-digit reopen within the tool range must release');
  // The identical aperture under bare-hand defaults would stay held forever —
  // this is the exact failure recorded on 30 Aug 2026.
  const bareDefaults = extractToolPinch(null);
  assert.equal(bareDefaults(syntheticHand(0.09, 0.11), true).isPinching, true);
});

test('missing landmarks fail closed', () => {
  const toolPinch = extractToolPinch();
  const lm = syntheticHand(0.10, 0.15);
  lm[8] = {x: NaN, y: NaN, z: NaN};
  const res = toolPinch(lm, true);
  assert.equal(res.valid, false);
  assert.equal(res.isPinching, false);
});
