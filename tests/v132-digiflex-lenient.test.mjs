import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v132 — therapist report after v131 bedside try: "too difficult, need to hold
// too long". Causes found with slow (1–3 s) synthetic squeezes: (1) the relaxed
// baseline followed a slow squeeze upward (3%/frame drift), so the patient had
// to squeeze ever further; (2) the absolute calibrated threshold could keep the
// detector "on" when the relaxed hold on the exerciser already scored high;
// (3) release needed half of (peak − baseline) and the baseline could be far
// too low (hand entered the frame open), so the patient had to relax almost to
// an open hand. Fix: relative rule only, rolling-minimum baseline that ignores
// half-squeezed frames, capped rise, 40% release (20% after 2 s), 80 ms minimum,
// 3-frame median, a 4 s "never released" re-base, and a squeeze meter next to
// the exerciser picture.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v132 source wiring: relative-only rule, rolling-minimum baseline, capped rise, release fractions, meter', () => {
  assert.match(src, /const DIGIFLEX_RELATIVE_RISE = 0\.25;/);
  assert.match(src, /const DIGIFLEX_MAX_RISE = 0\.08;/);
  assert.match(src, /const DIGIFLEX_OFF_FRACTION = 0\.4;/);
  assert.match(src, /const DIGIFLEX_OFF_FRACTION_LATE = 0\.2;/);
  assert.match(src, /const DIGIFLEX_LATE_MS = 2000;/);
  assert.match(src, /const DIGIFLEX_BASELINE_WINDOW_MS = 2500;/);
  assert.match(src, /const DIGIFLEX_RESEED_MS = 3000;/);
  assert.match(src, /const DIGIFLEX_STUCK_MS = 4000;/);
  assert.match(src, /\}else if\(now - d\.since > DIGIFLEX_STUCK_MS\)\{/);
  assert.match(src, /const DIGIFLEX_MIN_SQUEEZE_MS = 80;/);
  assert.match(src, /if\(d\.hist\.length > 3\) d\.hist\.shift\(\);/);
  assert.match(src, /const rise = Math\.min\(DIGIFLEX_MAX_RISE, Math\.max\(DIGIFLEX_MIN_RISE, gap \* DIGIFLEX_RELATIVE_RISE\)\);/);
  // baseline only takes "settled" frames (below baseline + 40% of rise); reseeds after 3 s unsettled
  assert.match(src, /const settled = d\.baseline == null \|\| sc < d\.baseline \+ rise \* 0\.4;/);
  assert.match(src, /if\(now - d\.unsettledSince > DIGIFLEX_RESEED_MS\)\{\n\s*d\.base = \[\{ t:now, v:sc \}\]; d\.unsettledSince = 0;/);
  assert.match(src, /while\(d\.base\.length && now - d\.base\[0\]\.t > DIGIFLEX_BASELINE_WINDOW_MS\) d\.base\.shift\(\);/);
  assert.match(src, /if\(d\.base\.length\) d\.baseline = Math\.min\(\.\.\.d\.base\.map\(b => b\.v\)\);/);
  // no absolute threshold / isGrasping in the "on" rule any more
  assert.match(src, /const on = sc >= d\.baseline \+ rise;/);
  assert.doesNotMatch(src, /const on = isGrasping \|\| sc >= enter/);
  // release: capped riseNow, late fraction, or back near the relaxed level
  assert.match(src, /const riseNow = Math\.min\(rise \* 2, Math\.max\(rise \* 0\.6, d\.peak - \(d\.baseline == null \? exit : d\.baseline\)\)\);/);
  assert.match(src, /const frac = now - d\.since > DIGIFLEX_LATE_MS \? DIGIFLEX_OFF_FRACTION_LATE : DIGIFLEX_OFF_FRACTION;/);
  assert.match(src, /const off = sc <= d\.peak - riseNow \* frac \|\| sc <= d\.baseline \+ rise \* 0\.5;/);
  // squeeze meter beside the exerciser picture
  assert.match(src, /const lvl = clamp01\(cook\.digi\.level \|\| 0\);/);
  // untouched gates
  assert.match(src, /numHands:\s*2/);
});

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

async function withPage(fn){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qa && window.__qa.startGame);
  try{
    const result = await fn(page);
    assert.deepEqual(errors, []);
    return result;
  }finally{
    await context.close();
  }
}

// Ramp helper run inside the page: 33 ms frames, curl rises lo→hi over upMs,
// holds, falls back over downMs. Returns when the detector switched on/off
// (ms after the ramp start) and how many reps were counted.
const RAMP = `
  const c = window.__qa.cook;
  function pause(){ const d = c.debug(); const until = Math.max(d.outcomeUntil, d.readyAt); if(d.now < until) window.advanceTime(until - d.now + 200); }
  function ramp(lo, hi, upMs, holdMs, downMs){
    pause();
    const stepMs = 33; let t = 0, onAt = null, offAt = null; const repsBefore = c.step().reps, idxBefore = c.step().idx;
    const feed = (curl) => { window.__qa.setLevel6ToolFrame({ curl, stepMs, nx:.5, ny:.55 }); t += stepMs;
      const s = c.step(); if(s.squeezing && onAt == null) onAt = t; if(!s.squeezing && onAt != null && offAt == null) offAt = t; };
    for(let k = 0; k < 10; k++) feed(lo);
    const t0 = t;
    for(let x = 0; x < upMs; x += stepMs) feed(lo + (hi - lo) * x / upMs);
    for(let x = 0; x < holdMs; x += stepMs) feed(hi);
    for(let x = 0; x < downMs; x += stepMs) feed(hi - (hi - lo) * x / downMs);
    for(let k = 0; k < 15; k++) feed(lo);
    const s = c.step();
    return { on: onAt == null ? null : onAt - t0, off: offAt == null ? null : offAt - t0, up: upMs, hold: holdMs,
      counted: s.idx === idxBefore ? s.reps - repsBefore : 1 };
  }
`;

test('v132 e2e: a slow 1.5 s squeeze (curl .20→.45) switches on early in the ramp and releases within 0.4 s of relaxing', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate('(() => {' + RAMP + `
    window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
    return ramp(.20, .45, 1500, 500, 1200);
  })()`));
  assert.equal(r.counted, 1);
  assert.ok(r.on !== null && r.on < 600, 'on within 0.6 s of a 1.5 s ramp, got ' + r.on);
  assert.ok(r.off !== null && r.off - (r.up + r.hold) < 400, 'off within 0.4 s of relaxing, got ' + (r.off - (r.up + r.hold)));
});

test('v132 e2e: a small, slow squeeze (curl .20→.26, score rise ≈ 0.09) still counts', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate('(() => {' + RAMP + `
    window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
    return ramp(.20, .26, 1200, 400, 800);
  })()`));
  assert.equal(r.counted, 1);
  assert.ok(r.on !== null, 'small squeeze detected');
  assert.ok(r.off !== null && r.off - (r.up + r.hold) < 600, 'released, got ' + (r.off - (r.up + r.hold)));
});

test('v132 e2e: hand already curled round the exerciser (curl .35 relaxed → .45) counts and does not have to open to release', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate('(() => {' + RAMP + `
    window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
    // 30 frames relaxed on the exerciser first so the baseline is the curled hold, not an open hand
    pause();
    for(let k = 0; k < 30; k++) window.__qa.setLevel6ToolFrame({ curl:.35, stepMs:33, nx:.5, ny:.55 });
    const a = ramp(.35, .45, 1000, 400, 1000);
    const b = ramp(.35, .45, 1000, 400, 1000);
    return { a, b, baseline: c.step().baseline };
  })()`));
  assert.equal(r.a.counted, 1);
  assert.equal(r.b.counted, 1);
  assert.ok(r.a.off !== null && r.a.off - (r.a.up + r.a.hold) < 500, 'release from a curled hold, got ' + (r.a.off - (r.a.up + r.a.hold)));
  assert.ok(r.baseline > 0.5, 'baseline is the curled relaxed hold, got ' + r.baseline);
});

test('v132 e2e: a tired hand that no longer relaxes fully is re-based after 3 s and keeps counting', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate('(() => {' + RAMP + `
    window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
    pause();
    for(let k = 0; k < 30; k++) window.__qa.setLevel6ToolFrame({ curl:.20, stepMs:33, nx:.5, ny:.55 });
    // relaxed level creeps up to .28 and stays there for 5 s: this first looks like a
    // squeeze, but a "squeeze" that never releases is re-based after 4 s (no rep)
    const reps0 = c.step().reps;
    for(let k = 0; k < 150; k++) window.__qa.setLevel6ToolFrame({ curl:.28, stepMs:33, nx:.5, ny:.55 });
    const base = c.step().baseline, squeezing = c.step().squeezing, reps1 = c.step().reps;
    const sq = ramp(.28, .36, 800, 400, 800);
    return { base, squeezing, phantom: reps1 - reps0, sq };
  })()`));
  assert.ok(r.base > 0.4, 'baseline re-seeded to the new relaxed level, got ' + r.base);
  assert.equal(r.squeezing, false);
  assert.equal(r.phantom, 0, 'a hold that never releases is not a rep');
  assert.equal(r.sq.counted, 1);
});
