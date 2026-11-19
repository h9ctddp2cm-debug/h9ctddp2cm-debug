import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v128 — therapist bedside report (19 Nov): Level 6 晾衫 with the REAL cloth
// peg still released late or not at all after v119. All earlier rules compared
// the live aperture with the CALIBRATION postures. At the rack the arm is
// raised and the hand turned, so the camera sees a foreshortened gap: a relaxed
// grip there can sit below the calibrated 35% release points, and an aperture
// hovering around a threshold keeps resetting the 180 ms confirmation.
// v128 adds a RELATIVE release for the public peg task: the garment also drops
// when both digits and the combined aperture reopen ≥ 30% of their calibrated
// range (floor 0.010) above the smallest median-smoothed aperture seen during
// THIS hold, once the hold has lasted 300 ms.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v128 source wiring: constants, sampling, hold tracking, releasing, resets, HUD', () => {
  assert.match(src, /const PUBLIC_PEG_RELATIVE_RELEASE_RATIO = 0\.30;/);
  assert.match(src, /const PUBLIC_PEG_RELATIVE_MIN_DELTA = 0\.010;/);
  assert.match(src, /const PUBLIC_PEG_RELATIVE_SMOOTH_N = 5;/);
  assert.match(src, /const PUBLIC_PEG_RELATIVE_MIN_HOLD_MS = 300;/);
  // sampled only for the public peg task, never in research
  assert.match(src, /if\(!research\.active\)\{\n\s*updateToolPinchAdapt\(nearRatio, farRatio, ratio\);[\s\S]{0,200}if\(publicPegReleaseRelaxationEnabled\(\)\) pegRelativeSample\(nearRatio, farRatio, ratio\);/);
  // releasing = stabilised pinch release OR relative reopen (public peg only)
  assert.match(src, /const pegRelativeOpen = isLevel6ToolGestureTask\(\) && publicPegReleaseRelaxationEnabled\(\)\n\s*\? \(pegRelativeHoldTrack\(nowMs\(\)\),\n\s*pegRelativeReleaseOpen\(state\.personalToolPinch, nowMs\(\)\)\)\n\s*: false;/);
  assert.match(src, /\? \(publicPegReleaseRelaxationEnabled\(\) \? \(!isGrasping \|\| pegRelativeOpen\) : handOpenPrep\)/);
  // research / pinch / grasp branches unchanged
  assert.match(src, /: \(isPinchMode\(\) \? handOpenPrep : !isGrasping\);/);
  // baseline reset on pick-up and after every drop; full reset with the adaptive tracker
  assert.match(src, /heldItem = nearest; grabCount\+\+;\n\s*pegRelativeHoldReset\(\);/);
  assert.equal((src.match(/releaseDwellLastOpenAt = 0;\n\s*pegRelativeHoldReset\(\);/g) || []).length, 1);
  assert.match(src, /pegUnpinchedSinceMs = 0;\n\s*bareUnpinchedSinceMs = 0;\n\s*pegRelativeReset\(\);/);  // v130 adds the bare idle timer reset
  // ?perf=1 HUD shows the relative baseline
  assert.match(src, /衣夾 相對 基線 近\$\{p\.tool\.relBaseNear\}/);
  // next pick-up still needs a positively separated hand (unchanged)
  assert.match(src, /const openPrep = isLevel6ToolGestureTask\(\) \? handOpenPrep/);
});

/* ---------------- Behavioural harness ---------------- */
function extractRelative(){
  const block = src.match(/const PUBLIC_PEG_RELATIVE_RELEASE_RATIO[\s\S]*?function pegRelativeReleaseOpen\(t, now\)\{[\s\S]*?\n\}/);
  assert.ok(block, 'relative block not found');
  const factory = new Function(block[0] +
    '\nreturn {pegRelative, pegRelativeHoldReset, pegRelativeReset, pegRelativeSample, pegRelativeSmoothed, pegRelativeHoldTrack, pegRelativeDeltas, pegRelativeReleaseOpen};');
  return factory();
}
// v119 synthetic calibration (near closed 0.25 / far 0.28 / combo 0.26, ranges 0.20):
// absolute release points near 0.32, far 0.35, gate 0.33.
const CAL = {
  enter: 0.31, nearExit: 0.32, farExit: 0.35, nearOpen: 0.344, farOpen: 0.374, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
  comboClosed: 0.26, comboRange: 0.20,
};
const combo = (near, far) => near * 0.68 + far * 0.32;
function feed(api, near, far, frames, t0, step = 33){
  let now = t0;
  let open = false;
  for(let i = 0; i < frames; i++){
    api.pegRelativeSample(near, far, combo(near, far));
    api.pegRelativeHoldTrack(now);
    open = api.pegRelativeReleaseOpen(CAL, now);
    now += step;
  }
  return { open, now };
}

test('v128 deltas: 30% of each calibrated range, floored at 0.010', () => {
  const api = extractRelative();
  const d = api.pegRelativeDeltas(CAL);
  assert.ok(Math.abs(d.near - 0.06) < 1e-9 && Math.abs(d.far - 0.06) < 1e-9 && Math.abs(d.combo - 0.06) < 1e-9);
  const tiny = api.pegRelativeDeltas({ nearRange: 0.004, farRange: 0.005, comboRange: 0.006 });
  assert.deepEqual([tiny.near, tiny.far, tiny.combo], [0.010, 0.010, 0.010]);
  assert.equal(api.pegRelativeDeltas(null), null);
  assert.equal(api.pegRelativeDeltas({ enter: 0.3 }), null, 'legacy object without ranges → path off');
});

test('bedside defect: foreshortened hand at the rack never clears the absolute points, relative path releases', () => {
  const api = extractRelative();
  api.pegRelativeReset();
  // squeeze at the rack reads near 0.20 / far 0.23 (below the calibrated closed baseline)
  let r = feed(api, 0.20, 0.23, 20, 1000);
  assert.equal(r.open, false, 'squeezing holds');
  assert.ok(api.pegRelative.base && Math.abs(api.pegRelative.base.near - 0.20) < 1e-9);
  // relaxed on the opened peg: near 0.27 / far 0.30 — still BELOW the absolute
  // release points (0.32 / 0.35), i.e. the v119 symptom …
  assert.ok(0.27 < CAL.nearExit && 0.30 < CAL.farExit);
  r = feed(api, 0.27, 0.30, 6, r.now);
  // … but 0.07 above this hold's baseline (≥ 0.06) → relative release
  assert.equal(r.open, true, 'relative reopen releases the garment');
});

test('a light loosening or one drifting digit never releases; a static hold never releases', () => {
  const api = extractRelative();
  api.pegRelativeReset();
  let r = feed(api, 0.20, 0.23, 20, 1000);
  // 20% of range loosening while carrying: below the 30% delta
  r = feed(api, 0.24, 0.27, 10, r.now);
  assert.equal(r.open, false, 'light loosening keeps the garment');
  // one digit flies open (tracking drift), the other stays at the baseline
  r = feed(api, 0.20, 0.45, 10, r.now);
  assert.equal(r.open, false, 'single moving landmark cannot release');
  // the drift lowered nothing: baseline still the squeeze
  assert.ok(Math.abs(api.pegRelative.base.near - 0.20) < 1e-9);
  // static hold for 5 s at any aperture → never "open"
  for(const [n, f] of [[0.20, 0.23], [0.30, 0.33], [0.40, 0.44]]){
    api.pegRelativeReset();
    const s = feed(api, n, f, 150, 1000);
    assert.equal(s.open, false, `static hold at ${n}/${f} never releases`);
  }
});

test('300 ms minimum hold and 5-frame median: a single spike frame does not move the baseline', () => {
  const api = extractRelative();
  api.pegRelativeReset();
  // reopen immediately after the pick-up (< 300 ms) is ignored
  let r = feed(api, 0.20, 0.23, 5, 1000);          // 0–165 ms
  r = feed(api, 0.30, 0.33, 3, r.now);             // 165–264 ms
  assert.equal(r.open, false, 'no release inside the first 300 ms of a hold');
  // later the same reopen releases
  r = feed(api, 0.30, 0.33, 4, r.now);
  assert.equal(r.open, true);
  // median smoothing: one bogus near-zero frame inside a steady squeeze
  api.pegRelativeHoldReset();
  r = feed(api, 0.20, 0.23, 10, 5000);
  api.pegRelativeSample(0.02, 0.05, combo(0.02, 0.05));
  api.pegRelativeHoldTrack(r.now);
  api.pegRelativeReleaseOpen(CAL, r.now);
  assert.ok(Math.abs(api.pegRelative.base.near - 0.20) < 1e-9, 'spike frame does not lower the baseline');
  // resets
  api.pegRelativeHoldReset();
  assert.equal(api.pegRelative.base, null);
  assert.equal(api.pegRelative.holdSince, 0);
  assert.equal(api.pegRelative.hist.length, 5, 'hold reset keeps the aperture history');
  api.pegRelativeReset();
  assert.equal(api.pegRelative.hist.length, 0);
});

/* ---------------- End-to-end in the page (Playwright, skipped if unavailable) ---------------- */
import { before, after } from 'node:test';
import { pathToFileURL } from 'node:url';

const SCALE = 0.2597; // synthetic-hand scale shared with tests/v70, v108, v110, v119
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

test('laundry rack e2e: foreshortened hand at the rack — relaxed grip below the absolute points still drops the garment', async t => {
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
      // v129: hovering on the upper half of the rack now hangs the garment by
      // itself, so the gesture path is exercised on the rack's lower legs (still
      // inside the padded drop box, but below the auto-hang line).
      const rackLow = { x: target.x, y: target.y + target.h * 0.4 };
      const out = {};
      const frame = (tag, near, far, count, pos) => {
        let st;
        for(let i = 0; i < count; i++){
          window.__qa.setLevel6ToolFrame({ gesture: 'open', stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'],
            ...pos, apertures: { index: gap(near), middle: gap(far) } });
          st = window.__qa.level6ToolState();
        }
        out[tag] = { held: st.held, grab: st.grabCount, correct: st.correctCount, grasping: st.isGrasping,
          openPrep: st.handOpenPrep, rel: st.perfTool ? { base: st.perfTool.relBaseNear, open: st.perfTool.relOpen } : null };
      };
      frame('approach', 0.45, 0.48, 10, at(item));
      frame('squeeze', 0.26, 0.29, 15, at(item));
      // raised + turned hand at the rack: the whole gap reads smaller (foreshortened)
      frame('carryTight', 0.20, 0.23, 45, at(rackLow));   // 1.5 s squeeze at the rack
      frame('carryLoose', 0.23, 0.26, 30, at(rackLow));   // 15% of range loosening, 1 s
      // relaxed on the opened peg: 0.27 / 0.30 — BELOW the absolute release
      // points (0.32 / 0.35) and the gate (0.33): the v119 symptom …
      frame('relaxForeshort', 0.27, 0.30, 30, at(rackLow)); // 1 s
      frame('stillRelaxed', 0.27, 0.30, 30, at(item));
      return out;
    }, { cal: CAL, SCALE });
    assert.equal(log.approach.openPrep, true);
    assert.equal(log.squeeze.grab, 1, 'squeeze picks up once');
    assert.ok(log.squeeze.held, 'garment held');
    assert.ok(log.carryTight.held, 'tight squeeze at the rack keeps the garment');
    assert.ok(log.carryLoose.held, '15% loosening at the rack keeps the garment');
    assert.equal(log.carryLoose.grasping, true, 'absolute path still sees a closed pinch');
    assert.equal(log.relaxForeshort.held, null, 'relative reopen drops the garment even below the absolute points');
    assert.equal(log.relaxForeshort.correct, 1, 'garment landed on the rack');
    assert.equal(log.stillRelaxed.grab, 1, 'same relaxed posture over a garment does not re-grab');
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
