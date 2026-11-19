import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v131 — therapist request (19 Nov): public Level 6 煮蛋炒飯 is played holding
// a hand-grip exerciser (Digi-Flex). Each of the 12 egg-fried-rice steps needs
// N whole-hand squeezes (squeeze → relax = 1), N rising through the recipe;
// each squeeze moves the step's prop on the canvas (Cooking-Mama style) over
// an AI-generated home-kitchen background — the continuation of the
// Level 3/4 supermarket story. Detection is deliberately lenient (patients
// tire): a squeeze counts from a relative rise over the patient's own relaxed
// level, not only from the calibrated threshold.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v131 source wiring: task profile, routing, constants, calibration copy', () => {
  assert.match(src, /function isLevel6DigiflexTask\(\)\{\n\s*return isLevel6\(\) && state\.level6Task === 'cooking';/);
  // public Level 6 cooking now runs the 12-step module (grasp type), not the generic picker
  assert.match(src, /cooking:\{\n\s*id:'cooking', theme:'cooking',\n\s*gameType:'grasp',/);
  assert.match(src, /if\(theme === 'cooking' && isLevel6DigiflexTask\(\)\) return true;\n\s*return !isGrossTabletop\(\) && isAdvTheme\(theme\);/);
  // progressive counts and the therapist amount setting
  assert.match(src, /const COOK_DIGIFLEX_NEED = \[3,4,4,3,5,2,2,3,4,5,1,8\];/);
  assert.match(src, /const COOK_SQUEEZE_AMOUNTS = \{ less:0\.5, normal:1, more:1\.5 \};/);
  assert.match(src, /cookSqueezeAmount: 'normal',/);
  assert.match(src, /id="cookSqueezeCard"/);
  assert.match(src, /data-cook-squeeze="less"[\s\S]*data-cook-squeeze="normal"[\s\S]*data-cook-squeeze="more"/);
  // lenient relative rule + minimum squeeze duration (values relaxed in v132, see that suite)
  assert.match(src, /const DIGIFLEX_RELATIVE_RISE = 0\.25;/);
  assert.match(src, /const DIGIFLEX_MIN_RISE = 0\.03;/);
  assert.match(src, /const DIGIFLEX_MIN_SQUEEZE_MS = 80;/);
  assert.match(src, /const on = sc >= d\.baseline \+ rise;/);
  assert.match(src, /const off = sc <= d\.peak - riseNow \* frac \|\| sc <= d\.baseline \+ rise \* 0\.5;/);
  // calibration: relaxed hold vs squeeze on the exerciser
  // (v135: calibration is optional for this task; rows are labelled 可選)
  assert.match(src, /hint\.textContent = '患手揸住握力器，成隻手入鏡。/);
  assert.match(src, /openCheck\.textContent = '○ 放鬆揸住握力器（可選）';/);
  assert.match(src, /function digiflexCalibRelaxedQualifies\(vals, value\)/);
  // no pose model for this task, no pose note
  assert.match(src, /if\(state\.theme === 'cooking' && !isLevel6DigiflexTask\(\)\)\{\n\s*const pose = await ensurePoseLandmarker\(\)/);
  // canvas scene + new AI assets, supermarket continuation banner
  assert.match(src, /function cookRenderDigiflex\(ctx\)/);
  assert.match(src, /imgCookKitchenBg\.src = 'img\/cook_kitchen_bg\.jpg'/);
  assert.match(src, /imgCookDigiflex\.src = 'img\/cook_digiflex_relax\.png'/);
  assert.match(src, /imgCookSpatula\.src = 'img\/cook_spatula\.png'/);
  assert.match(src, /'買完餸返到屋企，而家煮蛋炒飯！'/);
  // disclaimer: no tool identification, no force measurement
  assert.match(src, /tail:'網頁只睇手指開合，唔識別器材，亦唔量度握力。'/);
  // research track untouched: isLevel6() already excludes research.active
  assert.match(src, /function isLevel6\(\)\{ return !research\.active && state\.level === '67'; \}/);
});

test('v131 totals: 少 25 / 中 44 / 多 69 squeezes (per-step minimum 1)', () => {
  const need = [3,4,4,3,5,2,2,3,4,5,1,8];
  const total = m => need.reduce((s, n) => s + Math.max(1, Math.round(n * m)), 0);
  assert.equal(total(0.5), 25);
  assert.equal(total(1), 44);
  assert.equal(total(1.5), 69);
  assert.match(src, /less:'少（25 下）', normal:'中（44 下）', more:'多（69 下）'/);
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

test('Level 6 cooking e2e: grasp type, 12-step module, three squeeze→relax cycles advance step 1 (抓鬆冷飯, 3 下)', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.startGame({ level: '67', level6Task: 'cooking', duration: 300, affectedSide: 'right' });
    const out = { gameType: window.__qa.state().gameType, game: window.__qa.adv.game(), first: window.__qa.cook.step() };
    out.after = [];
    for(let i = 0; i < 3; i++) out.after.push(window.__qa.cook.squeeze());
    return out;
  }));
  assert.equal(r.gameType, 'grasp');
  assert.equal(r.game, 'cooking');
  assert.equal(r.first.idx, 0);
  assert.equal(r.first.need, 3);
  assert.equal(r.first.digiflex, true);
  assert.deepEqual(r.after.map(s => [s.idx, s.reps]), [[0, 1], [0, 2], [1, 0]]);
  // the squeeze/relax prompt shows the patient what to do next
  assert.match(r.after[0].prompt, /揸實/);
});

test('Level 6 cooking e2e: a small squeeze (relative rise over the relaxed level, below the calibrated threshold) still counts', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.startGame({ level: '67', level6Task: 'cooking', duration: 300, affectedSide: 'right' });
    // synthetic curl .20 → score ≈ .33 (relaxed hold); curl .30 → score ≈ .49,
    // below the default enter threshold .56 but ≥ baseline + 0.084
    const a = window.__qa.cook.squeeze({ hi: .30, lo: .20 });
    const b = window.__qa.cook.squeeze({ hi: .30, lo: .20 });
    return { a: [a.idx, a.reps], b: [b.idx, b.reps], baseline: a.baseline };
  }));
  assert.deepEqual(r.a, [0, 1]);
  assert.deepEqual(r.b, [0, 2]);
  assert.ok(r.baseline > 0.2 && r.baseline < 0.45, 'relaxed baseline is tracked');
});

test('Level 6 cooking e2e: a 60 ms blip is not a squeeze; an unfinished squeeze does not carry into the next step', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.startGame({ level: '67', level6Task: 'cooking', duration: 300, affectedSide: 'right' });
    const blip = window.__qa.cook.squeeze({ holdMs: 60, relaxMs: 400 });
    // leave the hand squeezed, force the step, then relax: no rep on step 2
    window.__qa.cook.squeeze({ relaxMs: 0 });
    const forced = window.__qa.cook.completeStep();
    window.advanceTime(4000);
    for(let i = 0; i < 8; i++) window.__qa.setLevel6ToolFrame({ curl: .2, stepMs: 60, nx: .5, ny: .55 });
    const next = window.__qa.cook.step();
    return { blip: [blip.idx, blip.reps], forced, next: [next.idx, next.reps] };
  }));
  assert.deepEqual(r.blip, [0, 0]);
  assert.equal(r.forced, 1);
  assert.deepEqual(r.next, [1, 0]);
});

test('Level 6 cooking e2e: 少 setting halves the counts (step 1 needs 2) and the card is only shown for Level 6 cooking', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    window.__qa.startGame({ level: '67', level6Task: 'cooking', duration: 300, affectedSide: 'right', cookSqueezeAmount: 'less' });
    const need = window.__qa.cook.step().need;
    const totals = window.__qa.cook.totals();
    const sq = [window.__qa.cook.squeeze(), window.__qa.cook.squeeze()].map(s => [s.idx, s.reps]);
    return { need, totals, sq };
  }));
  assert.equal(r.need, 2);
  assert.deepEqual([r.totals.less, r.totals.normal, r.totals.more], [25, 44, 69]);
  assert.equal(r.totals.amount, 'less');
  assert.deepEqual(r.sq, [[0, 1], [1, 0]]);
});

test('Level 6 cooking e2e: calibration copy speaks of relaxing / squeezing the exerciser', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const r = await withPage(page => page.evaluate(() => {
    // real UI path: Level 6 button → activity library → 煮蛋炒飯 card → setup screen
    document.getElementById('btnLevel67').click();
    const cookCard = document.querySelector('.activity-card[data-theme="cooking"]');
    if(cookCard) cookCard.click();
    const card = document.getElementById('cookSqueezeCard');
    const out = {
      cardHidden: card ? card.hidden : null,
      preview: document.getElementById('preview-cook-squeeze')?.textContent || '',
      hiddenForOthers: null,
    };
    const other = document.querySelector('.activity-card[data-theme="flowers"]');
    if(other){ other.click(); out.hiddenForOthers = card.hidden; }
    return out;
  }));
  assert.equal(r.cardHidden, false);
  assert.equal(r.preview, '中（44 下）');
  assert.equal(r.hiddenForOthers, true);
});
