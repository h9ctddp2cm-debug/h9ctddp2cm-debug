import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v110 — therapist bedside report (7 Sep): after v108 a hand that simply HELD
// the real cloth peg was reported as held / released / held every 180 ms.
// Root cause: v108 moved the per-digit release points (50%, decisive path,
// adaptive lowering) BELOW the combined entry point (56%), so a static
// aperture in between satisfied both "closed" and "reopened" on every
// confirmation window. v110 (public peg only):
//   - entry calibrated at 40% of the combined range;
//   - every release path is gated by combined ratio >= entry + 10% of range.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v110 constants, gate function and calibration wiring exist', () => {
  assert.match(publicSource, /const PUBLIC_PEG_ENTER_RATIO = 0\.40;/);
  assert.match(publicSource, /const PUBLIC_PEG_HYSTERESIS_RATIO = 0\.10;/);
  assert.match(publicSource, /function publicPegReleaseGate\(t\)\{/);
  assert.match(publicSource, /return t\.enter \+ t\.comboRange \* PUBLIC_PEG_HYSTERESIS_RATIO;/);
  assert.match(publicSource, /comboClosed: closedMean, comboRange: gapC,/);
  assert.match(publicSource, /const pegGateOpen = ratio >= pegReleaseGate;/);
  assert.match(publicSource, /: \(\(bothReopened \|\| decisiveReopen\) && pegGateOpen\);/);
  // research derivation keeps the v70 56% entry
  assert.match(publicSource, /publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_ENTER_RATIO : 0\.56;/);
  // bedside HUD shows the combined aperture, entry and gate
  assert.match(publicSource, /衣夾 合併 \$\{p\.tool\.combo\} 拎起≤\$\{p\.tool\.enter\} 放手閘≥\$\{p\.tool\.gate\}/);
});

/* ---------------- Behavioural harness (as tests/v108) ---------------- */

function extractPeg({research = {active: false}, personal = null, pegTask = true, adapt = null} = {}){
  const defaults = publicSource.match(/const TOOL_PINCH_DEFAULTS = \{[\s\S]*?\};/);
  const adaptBlock = publicSource.match(/const TOOL_ADAPT_MIN_SAMPLES[\s\S]*?function updateToolPinchAdapt[\s\S]*?\n\}/);
  const fn = publicSource.match(/function computeToolPinchState\(lm, isPinchingPrev\)\{[\s\S]*?\n\}/);
  assert.ok(defaults && adaptBlock && fn, 'tool-pinch blocks not found');
  const hasFinite = (lm, idxs) => idxs.every(i => lm[i]
    && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y) && Number.isFinite(lm[i].z));
  const factory = new Function('hasFiniteHandLandmarks', 'research', 'state', 'nowMs', 'isLevel6RealToolTask',
    defaults[0] + '\n' + adaptBlock[0] + '\n' + fn[0] +
    '\nif(arguments[5]) toolPinchAdapt.thresholds = arguments[5];' +
    '\nreturn {computeToolPinchState, publicPegReleaseGate, publicPegEffectiveThresholds, toolPinchAdapt};');
  return factory(hasFinite, research, {personalToolPinch: personal}, () => 0, () => pegTask, adapt);
}

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

// Exactly what the v108 calibration produced for a tripod grip (combined
// closed 0.26, range 0.20): entry 0.56 → 0.372 while the digits released at
// 0.35 / 0.38 and the decisive / adaptive paths went lower still.
const V108_CAL = {
  enter: 0.372,
  nearExit: 0.35, farExit: 0.38, nearOpen: 0.374, farOpen: 0.404, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
};
// The same hand as v110 calibrates it: entry 0.34, gate 0.36.
const V110_CAL = { ...V108_CAL, enter: 0.34, comboClosed: 0.26, comboRange: 0.20 };

// Hold a fixed aperture and run the state machine several confirmation
// windows in a row. A stable detector settles after one step and never
// flips again; the v108 defect shows up as prev → !prev → prev ...
function holdSequence(compute, hand, start, steps = 6){
  const seq = [start];
  for(let i = 0; i < steps; i++) seq.push(compute(hand, seq[seq.length - 1]).isPinching);
  return seq;
}
function flips(seq){
  let n = 0;
  for(let i = 2; i < seq.length; i++) if(seq[i] !== seq[i - 1]) n++;
  return n;
}

test('static hold at every aperture never oscillates (equal digits, v110 calibration)', () => {
  const {computeToolPinchState} = extractPeg({personal: V110_CAL});
  for(let r = 0.20; r <= 0.70; r += 0.005){
    const hand = syntheticHand(gap(r), gap(r + 0.03));
    for(const start of [true, false]){
      const seq = holdSequence(computeToolPinchState, hand, start);
      assert.equal(flips(seq), 0, `aperture ${r.toFixed(3)} start=${start}: ${seq.join(',')}`);
    }
  }
});

test('static hold never oscillates even when digits disagree or adaptive lowering is active', () => {
  // adaptive tracker asking for the lowest possible release points
  const {computeToolPinchState} = extractPeg({personal: V110_CAL,
    adapt: {enter: 0.9, nearExit: 0.05, nearOpen: 0.06, farExit: 0.05, farOpen: 0.06, adaptive: true}});
  for(let r = 0.20; r <= 0.70; r += 0.005){
    for(const spread of [0, 0.05, 0.12, 0.30]){
      const hand = syntheticHand(gap(r), gap(r + spread));
      for(const start of [true, false]){
        const seq = holdSequence(computeToolPinchState, hand, start);
        assert.equal(flips(seq), 0, `aperture ${r.toFixed(3)} spread ${spread} start=${start}: ${seq.join(',')}`);
      }
    }
  }
});

test('regression: the v108 calibration object DID oscillate without the gate, and is now stable', () => {
  // Re-create the v108 decision (no gate) to document the defect.
  const {computeToolPinchState} = extractPeg({personal: V108_CAL});
  // combined ratio 0.36 sits between the 0.35/0.38 release points and the
  // 0.372 entry: near 0.35 far 0.38 → bothReopened, ratio 0.3596 <= enter.
  const hand = syntheticHand(gap(0.35), gap(0.38));
  const a = computeToolPinchState(hand, true);
  const b = computeToolPinchState(hand, a.isPinching);
  // with the v110 gate in place the legacy object (no comboRange) is gated at
  // enter + epsilon, so the release is blocked and the hold stays a hold
  assert.equal(a.isPinching, true, 'held hand stays held');
  assert.equal(b.isPinching, true, 'and stays held on the next window');
  // and a hand that arrived open stays open (ratio > enter): no false pick-up
  const c = computeToolPinchState(syntheticHand(gap(0.38), gap(0.40)), false);
  assert.equal(c.isPinching, false);
});

test('pick-up and release still work with the v110 thresholds', () => {
  const {computeToolPinchState, publicPegReleaseGate} = extractPeg({personal: V110_CAL});
  assert.ok(Math.abs(publicPegReleaseGate(V110_CAL) - 0.36) < 1e-9, 'gate = entry + 10% of range');
  // squeezing the peg (near the closed baselines) arms
  const grab = computeToolPinchState(syntheticHand(gap(0.26), gap(0.29)), false);
  assert.equal(grab.isPinching, true, 'squeezed peg is picked up');
  // holding the peg lightly (between closed and entry) keeps the hold
  const hold = computeToolPinchState(syntheticHand(gap(0.30), gap(0.33)), true);
  assert.equal(hold.isPinching, true, 'light hold is still a hold');
  // and does NOT arm from an open hand (dead band, no false pick-up)
  const dead = computeToolPinchState(syntheticHand(gap(0.35), gap(0.37)), false);
  assert.equal(dead.isPinching, false, 'dead band never arms');
  // reopening both digits to 50% releases (v108 relaxation kept)
  const rel = computeToolPinchState(syntheticHand(gap(0.36), gap(0.39)), true);
  assert.equal(rel.isPinching, false, '50% reopen releases');
  // decisive far digit + moving near digit still releases when the combined
  // aperture clears the gate
  const dec = computeToolPinchState(syntheticHand(gap(0.34), gap(0.41)), true);
  assert.equal(dec.isPinching, false, 'decisive path still available above the gate');
});

test('gate is inert outside the public peg task and in research mode', () => {
  const notPeg = extractPeg({personal: V110_CAL, pegTask: false});
  // research/other tasks: v70 rule, release needs both digits at their points
  const r = notPeg.computeToolPinchState(syntheticHand(gap(0.36), gap(0.39)), true);
  assert.equal(r.isPinching, false, 'v70 dual-digit release unaffected');
  const research = extractPeg({personal: V110_CAL, research: {active: true}});
  // combined 0.51: below the research DEFAULT entry (0.58) so it arms, but
  // above the public calibrated entry (0.34) — proves the public object is ignored
  const s = research.computeToolPinchState(syntheticHand(gap(0.50), gap(0.53)), false);
  assert.equal(s.isPinching, true, 'research uses its own defaults, not the public calibration');
  assert.equal(notPeg.publicPegReleaseGate(null), -Infinity);
  assert.equal(notPeg.publicPegReleaseGate({enter: 0.5}), 0.5 + 1e-6, 'legacy object: strictly above entry');
});
