import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v108 (7 Sep 2026 therapist bedside report): a stroke participant's affected
// hand holding the REAL cloth peg could pick up but never release, even after
// a three-step calibration passed. Release demanded BOTH digits to reopen to
// 62% of the calibrated range and, once a calibration existed, the in-play
// adaptive tracker was ignored. Public peg task only:
//   - release 62% → 50%, re-arm 74% → 62% of each digit's own calibrated range;
//   - decisive-digit release: one digit past its re-arm point + the other digit
//     moved ≥ 30% of its own range (both digits must still move);
//   - adaptive tracker may LOWER (never raise) release/re-arm points, floored at
//     25% of the calibrated range; calibrated ENTRY is never touched;
//   - pair-baseline guard: every relaxed NEAR threshold is floored at
//     farClosed + 12% of the near range (capped at the v70 62% point), so a
//     digit static at its own closed baseline while the other digit flies open
//     can never release — v108 is never easier to fool than v107.
// Research modes keep the v70 numbers and the plain dual-digit rule.
// The result screen also gains two department-therapist cartoons (thumbs-up /
// fist-pump) beside the 成績單 card, hidden in research mode.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contracts ---------------- */

test('v108 public peg constants and gate exist', () => {
  assert.match(publicSource, /const PUBLIC_PEG_RELEASE_RATIO = 0\.50;/);
  assert.match(publicSource, /const PUBLIC_PEG_REARM_RATIO = 0\.62;/);
  assert.match(publicSource, /const PUBLIC_PEG_DECISIVE_OTHER_RATIO = 0\.30;/);
  assert.match(publicSource, /const PUBLIC_PEG_ADAPT_FLOOR_RATIO = 0\.25;/);
  assert.match(publicSource, /const PUBLIC_PEG_PAIR_MARGIN_RATIO = 0\.12;/);
  assert.match(publicSource, /function publicPegNearFloor\(nearClosed, nearRange, farClosed\)/);
  assert.match(publicSource,
    /function publicPegReleaseRelaxationEnabled\(\)\{\s*return !research\.active && typeof isLevel6RealToolTask === 'function' && isLevel6RealToolTask\(\);/);
});

test('calibration derivation: public peg 50%/62%, research keeps 62%/74%', () => {
  assert.match(publicSource,
    /const releaseRatio = publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_RELEASE_RATIO : 0\.62;/);
  assert.match(publicSource,
    /const rearmRatio = publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_REARM_RATIO : 0\.74;/);
  assert.match(publicSource, /nearExit: Math\.max\(closedNearMean \+ gapNear \* releaseRatio, nearExitFloor\),/);
  assert.match(publicSource, /farExit: closedFarMean \+ gapFar \* releaseRatio,/);
  assert.match(publicSource, /farOpen: closedFarMean \+ gapFar \* rearmRatio,/);
  // per-digit baselines stored for the decisive path and the adaptive floor
  assert.match(publicSource, /nearClosed: closedNearMean, farClosed: closedFarMean,/);
  assert.match(publicSource, /nearRange: gapNear, farRange: gapFar,/);
  // entry ratio untouched
  assert.match(publicSource, /enter: closedMean \+ gapC \* 0\.56,/);
});

test('dual-digit rule survives; decisive path is gated and needs both digits to move', () => {
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /const bothReopened = nearRatio >= t\.nearExit && farRatio >= t\.farExit;/);
  assert.match(fn, /const decisiveReopen = publicPegReleaseRelaxationEnabled\(\) && !useChopstickFlex/);
  assert.match(fn, /farRatio >= t\.farClosed \+ t\.farRange \* PUBLIC_PEG_DECISIVE_OTHER_RATIO/);
  assert.match(fn, /nearRatio >= Math\.max\(t\.nearClosed \+ t\.nearRange \* PUBLIC_PEG_DECISIVE_OTHER_RATIO,\s*publicPegNearFloor\(t\.nearClosed, t\.nearRange, t\.farClosed\)\)/);
  assert.match(fn, /: \(bothReopened \|\| decisiveReopen\);/);
});

test('perf HUD reports live peg numbers for bedside reporting', () => {
  assert.match(publicSource, /function framePerfToolSnapshot\(\)/);
  assert.match(publicSource, /tool: framePerfToolSnapshot\(\),/);
  assert.match(publicSource, /衣夾 近指 \$\{p\.tool\.near\} 放手≥\$\{p\.tool\.nearExit\} 張開≥\$\{p\.tool\.nearOpen\}/);
  assert.match(publicSource, /'校準\+自適應降低'/);
});

test('result screen: two therapist cartoons flank the 成績單 card, hidden in research mode', () => {
  assert.match(publicSource, /<div class="result-stage" id="resultStage">/);
  assert.match(publicSource, /<img class="result-cheer result-cheer-like" id="resultCheerLike"\s*src="img\/advanced\/result_cheer_like\.png"/);
  assert.match(publicSource, /<img class="result-cheer result-cheer-go" id="resultCheerGo"\s*src="img\/advanced\/result_cheer_go\.png"/);
  assert.match(publicSource, /\.result-stage\.research-mode \.result-cheer\{ display:none; \}/);
  assert.match(publicSource, /\.result-cheer\[hidden\]\{ display:none; \}/);
  // the flex stage rule must survive the public sanitizer: no forbidden words in its header
  const stageHeader = publicSource.slice(publicSource.lastIndexOf('}', publicSource.indexOf('.result-stage{')) + 1, publicSource.indexOf('.result-stage{'));
  assert.doesNotMatch(stageHeader, /research|pilot/i, 'result-stage rule header must not contain sanitizer-forbidden words');
  assert.match(publicSource, /\.result-cheer\{[^}]*pointer-events:none;/);
  assert.match(publicSource,
    /document\.getElementById\('resultStage'\)\?\.classList\.toggle\('research-mode', research\.active\);/);
  assert.ok(existsSync(path.join(root, 'img/advanced/result_cheer_like.png')), 'thumbs-up cartoon asset');
  assert.ok(existsSync(path.join(root, 'img/advanced/result_cheer_go.png')), 'fist-pump cartoon asset');
});

/* ---------------- Behavioural harness ---------------- */

function extractPeg({research = {active: false}, personal = null, pegTask = true} = {}){
  const defaults = publicSource.match(/const TOOL_PINCH_DEFAULTS = \{[\s\S]*?\};/);
  const adapt = publicSource.match(/const TOOL_ADAPT_MIN_SAMPLES[\s\S]*?function updateToolPinchAdapt[\s\S]*?\n\}/);
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/);
  assert.ok(defaults && adapt && fn, 'tool-pinch blocks not found');
  const hasFinite = (lm, idxs) => idxs.every(i => lm[i]
    && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) && Number.isFinite(lm[i].z));
  const factory = new Function('hasFiniteHandLandmarks', 'research', 'state', 'nowMs', 'isLevel6RealToolTask',
    defaults[0] + '\n' + adapt[0] + '\n' + fn[0] +
    '\nreturn {computeToolPinchState, publicPegEffectiveThresholds, publicPegReleaseRelaxationEnabled, publicPegNearFloor, toolPinchAdapt};');
  return factory(hasFinite, research, {personalToolPinch: personal}, () => 0, () => pegTask);
}

// Same synthetic-hand geometry as tests/v70 and v75: scale = 0.2597.
const SCALE = 0.2597;
function syntheticHand(indexGap, middleGap){
  const lm = Array.from({length: 21}, () => ({x: .5, y: .5, z: 0}));
  lm[0]  = {x: .42, y: .72, z: 0};
  lm[5]  = {x: .43, y: .55, z: 0};
  lm[9]  = {x: .52, y: .53, z: 0};
  lm[17] = {x: .62, y: .58, z: 0};
  lm[4]  = {x: .48, y: .49, z: 0};
  lm[8]  = {x: lm[4].x + indexGap, y: lm[4].y, z: 0};
  lm[12] = {x: lm[4].x + middleGap, y: lm[4].y, z: 0};
  return lm;
}
const gap = ratio => ratio * SCALE;

// A calibrated tripod peg grip as v108 would derive it: both tips sit on the
// peg so the closed baselines are close (near 0.25, far 0.28), each with a
// 0.20 range. near: release 0.35 (50%), re-arm 0.374 (62%);
// far: release 0.38, re-arm 0.404. Pair floor = min(0.374, 0.28+0.024) = 0.304.
const CAL = {
  enter: 0.37,
  nearExit: 0.35, farExit: 0.38, nearOpen: 0.374, farOpen: 0.404, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
};
// A grip whose closed baselines sit far apart (near 0.25, far 0.35): the pair
// floor (0.374) equals the v70 62% point, so no relaxation applies to the near
// digit and v107 behaviour is preserved.
const CAL_WIDE = {
  enter: 0.37,
  nearExit: 0.374, farExit: 0.45, nearOpen: 0.374, farOpen: 0.474, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.35, nearRange: 0.20, farRange: 0.20,
};

test('publicPegNearFloor caps at the 62% point and rises with the far baseline', () => {
  const {publicPegNearFloor} = extractPeg();
  assert.ok(Math.abs(publicPegNearFloor(0.25, 0.20, 0.28) - 0.304) < 1e-9);
  assert.ok(Math.abs(publicPegNearFloor(0.25, 0.20, 0.35) - 0.374) < 1e-9, 'never above 62%');
  assert.ok(Math.abs(publicPegNearFloor(0.25, 0.20, 0.50) - 0.374) < 1e-9);
  assert.equal(publicPegNearFloor(NaN, 0.20, 0.28), -Infinity, 'legacy calibration → no floor');
});

test('both digits reopening to 50% of their own range releases the peg', () => {
  const {computeToolPinchState} = extractPeg({personal: CAL});
  // near 0.36 (≥0.35), far 0.39 (≥0.38) — under the v70 62% rule (0.374/0.404)
  // this hand would have stayed locked in the hold.
  const r = computeToolPinchState(syntheticHand(gap(0.36), gap(0.39)), true);
  assert.equal(r.isPinching, false, '50% dual-digit reopen must release');
  // still held when only 40% of the way open
  const h = computeToolPinchState(syntheticHand(gap(0.33), gap(0.36)), true);
  assert.equal(h.isPinching, true, 'below release point stays held');
});

test('decisive-digit release: one digit past re-arm + other digit moved ≥30%', () => {
  const {computeToolPinchState} = extractPeg({personal: CAL});
  // near 0.38 ≥ nearOpen 0.374; far 0.35 < farExit 0.38 but ≥ farClosed+30% (0.34)
  // (min/max labelling: gaps 0.38 and 0.35 → near 0.35, far 0.38 — so use a
  //  pair where the LARGER ratio is the decisive one and the smaller has moved)
  const r = computeToolPinchState(syntheticHand(gap(0.33), gap(0.41)), true);
  // far 0.41 ≥ farOpen 0.404; near 0.33 < nearExit 0.35 but ≥ max(0.31, floor 0.304)
  assert.equal(r.isPinching, false, 'decisive far digit + moving near digit releases');
  // near digit decisive: near 0.38 ≥ nearOpen 0.374, far 0.38 ≥ farClosed+30% (0.34)
  const r2 = computeToolPinchState(syntheticHand(gap(0.38), gap(0.38)), true);
  assert.equal(r2.isPinching, false, 'both digits past 62%/50% releases');
});

test('a single drifting digit still never releases (other digit static)', () => {
  const {computeToolPinchState} = extractPeg({personal: CAL});
  // one digit static at the NEAR closed baseline, the other flies open
  const a = computeToolPinchState(syntheticHand(gap(0.25), gap(0.80)), true);
  assert.equal(a.isPinching, true, 'digit static at near baseline → hold');
  // one digit static at the FAR closed baseline (0.28), the other flies open
  const b = computeToolPinchState(syntheticHand(gap(0.28), gap(0.80)), true);
  assert.equal(b.isPinching, true, 'digit static at far baseline → hold (pair floor 0.304)');
  // other digit moved only 20% of its range (0.29 < 0.31)
  const c = computeToolPinchState(syntheticHand(gap(0.29), gap(0.60)), true);
  assert.equal(c.isPinching, true, '20% movement of the other digit is not enough');
});

test('wide closed baselines: pair floor keeps v107 behaviour, no single-digit release', () => {
  const {computeToolPinchState} = extractPeg({personal: CAL_WIDE});
  // far digit static at its closed baseline 0.35 while the other digit flies open
  const a = computeToolPinchState(syntheticHand(gap(0.35), gap(0.90)), true);
  assert.equal(a.isPinching, true, 'static far digit can never release');
  // decisive path floor = 0.374: near 0.36 is not enough even with far wide open
  const b = computeToolPinchState(syntheticHand(gap(0.36), gap(0.90)), true);
  assert.equal(b.isPinching, true, 'near below the 62% floor holds');
  // genuine reopen of both digits still releases
  const c = computeToolPinchState(syntheticHand(gap(0.38), gap(0.46)), true);
  assert.equal(c.isPinching, false, 'both digits past their points release');
});

test('relaxation is off outside the public peg task and in research mode', () => {
  const notPeg = extractPeg({personal: CAL, pegTask: false});
  assert.equal(notPeg.publicPegReleaseRelaxationEnabled(), false);
  // the decisive case must NOT release when the gate is closed
  const r = notPeg.computeToolPinchState(syntheticHand(gap(0.33), gap(0.41)), true);
  assert.equal(r.isPinching, true, 'decisive path disabled for other tasks');

  const research = extractPeg({personal: CAL, research: {active: true}});
  assert.equal(research.publicPegReleaseRelaxationEnabled(), false, 'research never relaxes');
});

test('publicPegEffectiveThresholds lowers release/re-arm only, floored, entry untouched', () => {
  const {publicPegEffectiveThresholds} = extractPeg({personal: CAL});
  // no adaptive data → calibrated object returned unchanged
  assert.equal(publicPegEffectiveThresholds(CAL, null), CAL);
  // adaptive lower than calibrated: near requested 0.29 → floored at the pair
  // floor 0.304 (25% floor would be 0.30); far requested 0.30 → floored at
  // farClosed+25% = 0.33
  const t = publicPegEffectiveThresholds(CAL,
    {enter: 0.90, nearExit: 0.29, nearOpen: 0.30, farExit: 0.30, farOpen: 0.31});
  assert.ok(Math.abs(t.nearExit - 0.304) < 1e-9, 'near release floored at pair floor');
  assert.ok(Math.abs(t.farExit - 0.33) < 1e-9, 'far release floored at 25% of range');
  assert.ok(t.nearOpen >= t.nearExit && t.farOpen >= t.farExit, 're-arm never below release');
  assert.equal(t.enter, CAL.enter, 'entry threshold never changed by the adaptive path');
  assert.equal(t.adaptiveLowered, true);
  // modest lowering inside the allowed band is taken as-is
  const m = publicPegEffectiveThresholds(CAL,
    {enter: 0.90, nearExit: 0.33, nearOpen: 0.35, farExit: 0.36, farOpen: 0.38});
  assert.ok(Math.abs(m.nearExit - 0.33) < 1e-9);
  assert.ok(Math.abs(m.farExit - 0.36) < 1e-9);
  // adaptive HIGHER than calibrated: never raised
  const u = publicPegEffectiveThresholds(CAL,
    {enter: 0.20, nearExit: 0.50, nearOpen: 0.55, farExit: 0.60, farOpen: 0.65});
  assert.equal(u.nearExit, CAL.nearExit);
  assert.equal(u.farExit, CAL.farExit);
  assert.equal(u.nearOpen, CAL.nearOpen);
  assert.equal(u.farOpen, CAL.farOpen);
  assert.equal(u.adaptiveLowered, false);
  // legacy calibration without per-digit baselines → unchanged
  const legacy = {enter: 0.36, nearExit: 0.35, farExit: 0.45, nearOpen: 0.374, farOpen: 0.474};
  assert.equal(publicPegEffectiveThresholds(legacy, {nearExit: 0.1, farExit: 0.1}), legacy);
});

test('entry into the pinch is unchanged by the v108 path', () => {
  const {computeToolPinchState} = extractPeg({personal: CAL});
  // combined aperture below enter (0.37) closes; clearly open does not
  const closed = computeToolPinchState(syntheticHand(gap(0.30), gap(0.40)), false);
  assert.equal(closed.isPinching, true, 'closing to the calibrated entry still arms');
  const open = computeToolPinchState(syntheticHand(gap(0.45), gap(0.55)), false);
  assert.equal(open.isPinching, false, 'open hand does not arm');
});
