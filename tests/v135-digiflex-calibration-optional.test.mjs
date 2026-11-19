import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v135 — therapist after v134 bedside try: "difficult to pass the tracking".
// The Level 6 煮蛋炒飯 (Digi-Flex) calibration screen demanded a relax/squeeze
// range (span ≥ 0.02, 750 ms relaxed, 450 ms squeezed) before 開始遊戲 enabled,
// although since v132 the rep counter is relative to the participant's own
// relaxed level and does not depend on that gate. Now (public mode only) the
// start button enables as soon as the hand has been seen for 0.8 s; the two
// relax/squeeze rows stay as optional refinements. Uncalibrated play uses a
// lenient default range (rise 0.04). Research mode keeps the full gate.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v135 source wiring: optional Digi-Flex calibration, default range, copy', () => {
  assert.match(src, /function digiflexCalibOptional\(\)\{ return !research\.active && isLevel6DigiflexTask\(\); \}/);
  assert.match(src, /c\.ready = c\.detectedDone && \(\(c\.openDone && c\.closedDone\) \|\| digiflexCalibOptional\(\)\);/);
  assert.match(src, /const DIGIFLEX_DEFAULT_GAP = 0\.16;/);
  assert.match(src, /const calibrated = Number\.isFinite\(state\.personalGraspEnter\) && Number\.isFinite\(state\.personalGraspExit\);/);
  assert.match(src, /const gap = calibrated \? Math\.max\(0\.03, \(enter - exit\) \/ 0\.25\) : DIGIFLEX_DEFAULT_GAP;/);
  assert.match(src, /openCheck\.textContent = '○ 放鬆揸住握力器（可選）';/);
  assert.match(src, /closeCheck\.textContent = '○ 揸實握力器（可選）';/);
  assert.match(src, /「偵測」打咗剔就可以按「開始遊戲」/);
  // the other calibration paths are untouched
  assert.match(src, /const requiredOpenHoldMs = isLevel6RealToolTask\(\) \? 450 : 750;/);
  assert.match(src, /const DIGIFLEX_CALIB_MIN_RANGE = 0\.02;/);
  // detection rules (v132) untouched
  assert.match(src, /const on = sc >= d\.baseline \+ rise;/);
  assert.match(src, /const rise = Math\.min\(DIGIFLEX_MAX_RISE, Math\.max\(DIGIFLEX_MIN_RISE, gap \* DIGIFLEX_RELATIVE_RISE\)\);/);
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

test('v135 e2e: Digi-Flex calibration is optional in public mode and the rows say so; peg task keeps the full gate', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.selectLevel('67');
    window.__qa.selectLevel6Task('cooking');
    const cooking = window.__qa.cook.calibProbe();
    window.__qa.selectLevel6Task('peg');
    const peg = window.__qa.cook.calibProbe();
    return { cooking, peg };
  }));
  assert.equal(r.cooking.optional, true);
  assert.equal(r.cooking.research, false);
  assert.equal(r.cooking.openCheck, '○ 放鬆揸住握力器（可選）');
  assert.equal(r.cooking.closeCheck, '○ 揸實握力器（可選）');
  assert.match(r.cooking.hint, /「偵測」打咗剔/);
  assert.equal(r.peg.optional, false);
  assert.equal(r.peg.openCheck, '○ 鬆開衣夾');
});

test('v135 e2e: uncalibrated start uses the default range (rise 0.04) and a modest slow squeeze still counts', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
    const c = window.__qa.cook;
    const d0 = c.debug(); const until = Math.max(d0.outcomeUntil, d0.readyAt); if(d0.now < until) window.advanceTime(until - d0.now + 200);
    const feed = (curl) => window.__qa.setLevel6ToolFrame({ curl, stepMs:33, nx:.5, ny:.55 });
    for(let k = 0; k < 15; k++) feed(.20);
    const riseBefore = c.debug().digi.rise;
    for(let x = 0; x < 1200; x += 33) feed(.20 + .20 * x / 1200);
    for(let x = 0; x < 400; x += 33) feed(.40);
    for(let x = 0; x < 900; x += 33) feed(.40 - .20 * x / 900);
    for(let k = 0; k < 15; k++) feed(.20);
    return { rise: riseBefore, reps: c.step().reps, calibrated: Number.isFinite(c.calibProbe().personalGraspEnter) };
  }));
  assert.equal(r.calibrated, false);
  assert.ok(Math.abs(r.rise - 0.04) < 1e-9, 'default rise 0.04, got ' + r.rise);
  assert.equal(r.reps, 1);
});
