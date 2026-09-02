import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v75 Level 6 tool-pinch adaptive tracking (31 Aug 2026 user report:
// 晾衫夾唔到衫、筷子偵測唔到手指開合):
//   In normal game mode the tool-pinch detector learns the patient's ACTUAL
//   tool-constrained aperture range live, instead of assuming the bare-hand
//   range. SAFETY: the tracker is fail-closed — thresholds only exist after
//   enough genuine open/close movement is observed; a static posture (or a
//   drifting single landmark) must never manufacture a release. The dual-digit
//   release rule (BOTH near and far digits reopen) is unchanged. Research
//   mode bypasses the adaptive path entirely.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contracts ---------------- */

test('adaptive tracker exists with fail-closed movement gates', () => {
  assert.match(publicSource, /const TOOL_ADAPT_MIN_SAMPLES = 90;/);
  assert.match(publicSource, /const TOOL_ADAPT_MIN_SPAN = 0\.020;/);
  assert.match(publicSource, /const TOOL_HAND_TOO_CLOSE_SCALE = 0\.55;/);
  // insufficient movement → thresholds stay null (fail closed to defaults)
  assert.match(publicSource, /toolPinchAdapt\.thresholds = null;\s*return;/);
});

test('threshold priority: adaptive → personal calibration → defaults, never in research mode', () => {
  assert.match(publicSource,
    /const t = \(!research\.active && toolPinchAdapt\.thresholds\)\s*\|\| \(!research\.active && state\.personalToolPinch\)\s*\|\| TOOL_PINCH_DEFAULTS;/);
});

test('adaptive state is reset at game start and stop', () => {
  const calls = publicSource.match(/resetToolPinchAdapt\(\);/g) || [];
  assert.ok(calls.length >= 2, 'resetToolPinchAdapt must be called at start AND stop sites');
});

test('dual-digit release rule survives in computeToolPinchState', () => {
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /const bothReopened = nearRatio >= t\.nearExit && farRatio >= t\.farExit;/);
});

test('live 開合 feedback + too-close hints are wired', () => {
  assert.match(publicSource, /function toolPinchLiveHint\(\)/);
  assert.match(publicSource, /手太貼近鏡頭，請後移少少/);
  // calibration open-stage too-close guard
  assert.match(publicSource, /res\.pinchScale >= TOOL_HAND_TOO_CLOSE_SCALE/);
});

/* ---------------- Behavioural harness ---------------- */

function extractAdaptive(){
  const defaults = publicSource.match(/const TOOL_PINCH_DEFAULTS = \{[\s\S]*?\};/);
  const adapt = publicSource.match(/const TOOL_ADAPT_MIN_SAMPLES[\s\S]*?function updateToolPinchAdapt[\s\S]*?\n\}/);
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/);
  const reset = publicSource.match(/function resetToolPinchAdapt\(\)\{[\s\S]*?\n\}/);
  assert.ok(defaults && adapt && fn, 'adaptive tool-pinch block not found');
  const hasFinite = (lm, idxs) => idxs.every(i => lm[i]
    && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) && Number.isFinite(lm[i].z));
  const factory = new Function('hasFiniteHandLandmarks', 'research', 'state', 'nowMs',
    defaults[0] + '\n' + adapt[0] + '\n' + fn[0] +
    '\nreturn {computeToolPinchState, toolPinchAdapt, resetToolPinchAdapt, updateToolPinchAdapt};');
  return factory(hasFinite, {active: false}, {personalToolPinch: null}, () => 0);
}

// Same synthetic-hand shape as tests/v70-tool-pinch.test.mjs:
// scale = max(palmLength, palmWidth*1.35) = 0.2597.
function syntheticHand(indexGap, middleGap){
  const lm = [];
  for(let i = 0; i < 21; i++) lm.push({x: .5, y: .5, z: 0});
  lm[0]  = {x: .42, y: .72, z: 0};
  lm[5]  = {x: .43, y: .55, z: 0};
  lm[9]  = {x: .52, y: .53, z: 0};
  lm[17] = {x: .62, y: .58, z: 0};
  lm[4]  = {x: .48, y: .49, z: 0};
  lm[8]  = {x: lm[4].x + indexGap, y: lm[4].y, z: 0};
  lm[12] = {x: lm[4].x + middleGap, y: lm[4].y, z: 0};
  return lm;
}
const SCALE = 0.2597;

test('static posture never creates adaptive thresholds (fail closed)', () => {
  const mod = extractAdaptive();
  for(let i = 0; i < 150; i++) mod.computeToolPinchState(syntheticHand(0.08, 0.10), false);
  assert.equal(mod.toolPinchAdapt.thresholds, null, 'no movement → no thresholds');
  // and a small reopen therefore does NOT release under bare-hand defaults
  const r = mod.computeToolPinchState(syntheticHand(0.09, 0.11), true);
  assert.equal(r.isPinching, true, 'small excursion must stay held without learned range');
});

test('genuine open/close movement learns an ordered, in-range threshold set', () => {
  const mod = extractAdaptive();
  for(let i = 0; i < 150; i++){
    const open = i % 2 === 0;
    mod.computeToolPinchState(open ? syntheticHand(0.10, 0.12) : syntheticHand(0.06, 0.08), false);
  }
  const t = mod.toolPinchAdapt.thresholds;
  assert.ok(t && t.adaptive === true, 'thresholds learned after real movement');
  const nearLo = 0.06 / SCALE, nearHi = 0.10 / SCALE;
  // with perfectly proportional synthetic digits enter ≈ nearExit; real
  // hands differ — only require enter never exceeds the release band
  assert.ok(t.enter > 0 && t.enter <= t.nearExit + 1e-6, 'enter not above release band');
  assert.ok(t.nearExit > nearLo && t.nearExit < nearHi, 'nearExit inside observed near range');
  assert.ok(t.nearOpen >= t.nearExit && t.farOpen >= t.farExit, 're-arm at least as open as release');
  // small tool-constrained reopen now releases (both digits past their exits)
  const held = mod.computeToolPinchState(syntheticHand(0.06, 0.08), true);
  assert.equal(held.isPinching, true, 'closed hand stays held');
  const released = mod.computeToolPinchState(syntheticHand(0.095, 0.115), true);
  assert.equal(released.isPinching, false, 'learned range makes the small reopen release');
});

test('one drifting digit alone must not release under adaptive thresholds', () => {
  const mod = extractAdaptive();
  for(let i = 0; i < 150; i++){
    const open = i % 2 === 0;
    mod.computeToolPinchState(open ? syntheticHand(0.10, 0.12) : syntheticHand(0.06, 0.08), false);
  }
  assert.ok(mod.toolPinchAdapt.thresholds, 'thresholds learned');
  // index reopens fully but middle stays clamped shut → hold
  const r = mod.computeToolPinchState(syntheticHand(0.11, 0.075), true);
  assert.equal(r.isPinching, true, 'single-digit reopen must not release the item');
});

test('resetToolPinchAdapt clears histories and thresholds', () => {
  const mod = extractAdaptive();
  for(let i = 0; i < 150; i++){
    const open = i % 2 === 0;
    mod.computeToolPinchState(open ? syntheticHand(0.10, 0.12) : syntheticHand(0.06, 0.08), false);
  }
  assert.ok(mod.toolPinchAdapt.thresholds, 'precondition: learned');
  mod.resetToolPinchAdapt();
  assert.equal(mod.toolPinchAdapt.thresholds, null);
  assert.equal(mod.toolPinchAdapt.combo.length, 0);
  assert.equal(mod.toolPinchAdapt.near.length, 0);
  assert.equal(mod.toolPinchAdapt.far.length, 0);
});
