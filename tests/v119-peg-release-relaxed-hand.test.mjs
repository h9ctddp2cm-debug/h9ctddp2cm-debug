import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v119 — therapist bedside report (18 Nov): with the REAL cloth peg, a
// hemiplegic hand that visibly relaxed (fingers resting on the open peg, no
// longer squeezing) still could not drop the garment on the rack. Releasing
// demanded both digits to reopen to 50% of the calibrated 揸實→鬆開 range; a
// tired hand resting on the opened peg often reaches only 30–45% of the range
// it showed during calibration. v119 (public peg only):
//   - per-digit release 50% → 35%, re-arm 62% → 47%;
//   - combined entry 40% → 25%; release gate stays entry + 10% (= 35%), so the
//     v110 guarantee (no static aperture is both closed and reopened) holds;
//   - the DROP now follows the stabilised pinch release itself. Before v119 the
//     held garment only dropped once handOpenPrep (= isSeparated = both digits
//     past the RE-ARM points, 62%) was true, so a hand that had un-pinched at
//     50% still carried the garment — the exact bedside symptom.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v119 public peg constants and calibration wiring', () => {
  assert.match(publicSource, /const PUBLIC_PEG_RELEASE_RATIO = 0\.35;/);
  assert.match(publicSource, /const PUBLIC_PEG_REARM_RATIO = 0\.47;/);
  assert.match(publicSource, /const PUBLIC_PEG_ENTER_RATIO = 0\.25;/);
  assert.match(publicSource, /const PUBLIC_PEG_HYSTERESIS_RATIO = 0\.10;/);
  // ordering closed < release < re-arm must survive: entry (25%) + gate (10%) = release (35%) < re-arm (47%)
  assert.ok(0.25 + 0.10 <= 0.35 && 0.35 < 0.47);
  // research derivation still uses the v70 values
  assert.match(publicSource, /publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_RELEASE_RATIO : 0\.62;/);
  assert.match(publicSource, /publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_REARM_RATIO : 0\.74;/);
  assert.match(publicSource, /publicPegReleaseRelaxationEnabled\(\) \? PUBLIC_PEG_ENTER_RATIO : 0\.56;/);
  // the drop follows the stabilised pinch release for the public peg task only
  assert.match(publicSource,
    /const releasing = isLevel6ToolGestureTask\(\)\n\s*\? \(publicPegReleaseRelaxationEnabled\(\) \? !isGrasping : handOpenPrep\)/);
  // the NEXT pick-up still needs a positively separated hand
  assert.match(publicSource, /const openPrep = isLevel6ToolGestureTask\(\) \? handOpenPrep/);
  // build / cache identifiers bumped
  assert.match(publicSource, /const LEVEL_APP_BUILD = "v124-20261118-laundry-rack-ladder";/);
  const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v124-20261118-laundry-rack-ladder";/);
});

/* ---------------- Behavioural harness (as tests/v108, v110) ---------------- */

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

// Same synthetic-hand geometry as tests/v70, v108, v110: scale = 0.2597.
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

// The same calibrated tripod peg grip as tests/v108 and v110 (near closed
// 0.25, far closed 0.28, each with a 0.20 range; combined closed 0.26, range
// 0.20), derived with the v110 ratios …
const V110_CAL = {
  enter: 0.34,
  nearExit: 0.35, farExit: 0.38, nearOpen: 0.374, farOpen: 0.404, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
  comboClosed: 0.26, comboRange: 0.20,
};
// … and with the v119 ratios: entry 25% = 0.31, gate 0.33; near release 35% =
// 0.32 (pair floor 0.304 does not bind), far release 0.35; re-arm 47% = 0.344 / 0.374.
const V115_CAL = {
  enter: 0.31,
  nearExit: 0.32, farExit: 0.35, nearOpen: 0.344, farOpen: 0.374, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
  comboClosed: 0.26, comboRange: 0.20,
};

// A relaxed hemiplegic hand resting on the opened peg: both digits ~40% of
// their calibrated range above the closed baseline (near 0.33, far 0.36).
const RELAXED_ON_PEG = () => syntheticHand(gap(0.33), gap(0.36));

test('bedside defect: a hand relaxed to 40% of its range stayed held under v110', () => {
  const {computeToolPinchState} = extractPeg({personal: V110_CAL});
  assert.equal(computeToolPinchState(RELAXED_ON_PEG(), true).isPinching, true,
    'v110 thresholds: 40% reopen is below the 50% release points → garment never dropped');
});

test('v119: the same relaxed hand releases, a squeezed hand still holds, re-grab needs a real squeeze', () => {
  const {computeToolPinchState, publicPegReleaseGate} = extractPeg({personal: V115_CAL});
  assert.ok(Math.abs(publicPegReleaseGate(V115_CAL) - 0.33) < 1e-9, 'gate = entry + 10% of range');
  // squeezed on the peg's hard stop → arms the hold
  const grab = computeToolPinchState(syntheticHand(gap(0.26), gap(0.29)), false);
  assert.equal(grab.isPinching, true, 'squeezed grip picks up');
  // slight loosening (20% of range) still holds — no premature drop while carrying
  const carry = computeToolPinchState(syntheticHand(gap(0.29), gap(0.32)), true);
  assert.equal(carry.isPinching, true, 'light loosening while carrying keeps the garment');
  // relaxed on the open peg (40% of range) → releases
  const rel = computeToolPinchState(RELAXED_ON_PEG(), true);
  assert.equal(rel.isPinching, false, 'relaxed hand on the opened peg drops the garment');
  // after release, the same relaxed posture does not re-grab (above entry 0.31)
  const idle = computeToolPinchState(RELAXED_ON_PEG(), false);
  assert.equal(idle.isPinching, false, 'relaxed posture does not re-arm a hold');
});

test('v119 keeps the v110 guarantee: no static aperture is ever both closed and reopened', () => {
  const {computeToolPinchState} = extractPeg({personal: V115_CAL});
  const holdSequence = (hand, start, steps = 6) => {
    const seq = [start];
    for(let i = 0; i < steps; i++) seq.push(computeToolPinchState(hand, seq[seq.length - 1]).isPinching);
    return seq;
  };
  const flips = seq => { let n = 0; for(let i = 2; i < seq.length; i++) if(seq[i] !== seq[i - 1]) n++; return n; };
  for(let r = 0.20; r <= 0.70; r += 0.005){
    for(const spread of [0, 0.03, 0.05, 0.12, 0.30]){
      const hand = syntheticHand(gap(r), gap(r + spread));
      for(const start of [true, false]){
        const seq = holdSequence(hand, start);
        assert.equal(flips(seq), 0, `aperture ${r.toFixed(3)} spread ${spread} start=${start}: ${seq.join(',')}`);
      }
    }
  }
});

test('v119 ratios never apply to research mode or to non-peg tasks', () => {
  const research = extractPeg({research: {active: true}, personal: V115_CAL});
  // research ignores the public personal object and keeps DEFAULTS: a relaxed
  // 0.33/0.36 hand is well below the research default entry, so it (re)arms
  assert.equal(research.computeToolPinchState(RELAXED_ON_PEG(), false).isPinching, true);
  const notPeg = extractPeg({personal: V115_CAL, pegTask: false});
  // non-peg task: calibrated object used verbatim, no gate relaxation path —
  // the plain bothReopened rule still releases at the calibrated exits
  assert.equal(notPeg.computeToolPinchState(RELAXED_ON_PEG(), true).isPinching, false);
  assert.equal(notPeg.publicPegReleaseGate({enter: 0.5}), 0.5 + 1e-6, 'legacy object: strictly above entry');
});

/* ---------------- End-to-end in the page (Playwright, skipped if unavailable) ---------------- */

let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    console.warn('playwright unavailable; browser checks skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

test('public peg task: pick up, carry with light loosening, relax to 40% → garment lands on the rack', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const log = await page.evaluate(({ cal, SCALE }) => {
      const gap = r => r * SCALE;
      window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60, affectedSide: 'right' });
      window.__qa.setLevel6PersonalToolCalibration({ pinch: cal });
      const l = window.__qa.level67Layout();
      const item = l.items[0], target = l.targets.find(v => v.type === 'laundry_rack');
      const at = p => ({ nx: p.x / l.canvas.width, ny: p.y / l.canvas.height });
      const out = {};
      const frame = (tag, near, far, count, pos) => {
        let st;
        for(let i = 0; i < count; i++){
          window.__qa.setLevel6ToolFrame({ gesture: 'open', stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'],
            ...pos, apertures: { index: gap(near), middle: gap(far) } });
          st = window.__qa.level6ToolState();
        }
        out[tag] = { held: st.held, grab: st.grabCount, correct: st.correctCount, grasping: st.isGrasping, openPrep: st.handOpenPrep };
      };
      frame('approach', 0.45, 0.48, 10, at(item));
      frame('squeeze', 0.26, 0.29, 15, at(item));
      frame('carryLoose', 0.29, 0.32, 60, at(target));   // 20% of range, 2 s
      frame('relax40', 0.33, 0.36, 45, at(target));      // 40% of range, 1.5 s
      frame('stillRelaxed', 0.33, 0.36, 30, at(item));   // back over a garment, same posture
      return out;
    }, { cal: V115_CAL, SCALE });
    assert.equal(log.approach.openPrep, true);
    assert.equal(log.squeeze.grab, 1, 'squeeze picks up once');
    assert.ok(log.squeeze.held, 'garment held');
    assert.ok(log.carryLoose.held, '20% loosening while carrying keeps the garment');
    assert.equal(log.carryLoose.grasping, true);
    assert.equal(log.relax40.held, null, 'relaxed hand (40%) drops the garment');
    assert.equal(log.relax40.correct, 1, 'garment landed on the rack');
    assert.equal(log.relax40.openPrep, false, '40% is below the 47% re-arm point: not yet open preparation');
    assert.equal(log.stillRelaxed.grab, 1, 'same relaxed posture over a garment does not re-grab');
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
