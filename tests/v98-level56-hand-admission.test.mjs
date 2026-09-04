import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

function functionSource(name){
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for(let i = open; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

/* ---------- source-level contracts ---------- */

test('v98 safety pause fires after 30 s, not 5 s', () => {
  assert.match(html, /const MAX_HOLD_MS = 30000;/);
  assert.doesNotMatch(html, /const MAX_HOLD_MS = 5000;/);
  // Overlay copy derives from the constant, so it cannot drift.
  assert.match(html, /Math\.round\(MAX_HOLD_MS\s*\/\s*1000\)/);
});

test('v98 large photo assets are drawn through the down-sampled bitmap cache', () => {
  assert.match(html, /const SCALED_BITMAP_MIN_SOURCE_EDGE = 400;/);
  assert.match(html, /const scaledBitmapCache = new WeakMap\(\);/);
  const helper = functionSource('scaledBitmapFor');
  assert.match(helper, /imageSmoothingQuality = 'high'/);
  assert.match(helper, /targetW \* targetH \* 1\.5 >= iw \* ih/);
  assert.match(functionSource('drawImageScaled'), /ctx\.drawImage\(bmp \|\| img, dx, dy, dw, dh\)/);
  for(const fn of ['drawSteamerTarget', 'drawBigPlateTarget', 'drawTeahouseDimsumSprite', 'drawDimsumPhoto', 'drawSprite', 'drawSpriteBottom']){
    assert.match(functionSource(fn), /drawImageScaled\(/, `${fn} must use drawImageScaled`);
  }
  // Level 5 food items in renderGame.
  assert.match(functionSource('renderGame'), /drawImageScaled\(ctx, f\.img, drawX - dw\/2, drawY - dh\/2, dw, dh\)/);
  // Source-rect atlas draws are left alone (they are already small).
  assert.doesNotMatch(functionSource('drawImageScaled'), /sx, sy, sw, sh/);
});

test('v98 per-frame performance instrumentation is wired into the public loop', () => {
  const loop = functionSource('gameLoop');
  assert.match(loop, /const perfT0 = performance\.now\(\);\s*updateTracking\(publicFrame\);/);
  assert.match(loop, /noteFramePerf\(perfT2, perfT1 - perfT0, perfT2 - perfT1\);/);
  assert.match(loop, /updateFramePerfOverlay\(perfT2\);/);
  assert.match(functionSource('framePerfOverlayEnabled'), /get\('perf'\) === '1'/);
  assert.match(functionSource('framePerfSnapshot'), /handDelegate:framePerf\.handDelegate/);
  assert.match(functionSource('framePerfSnapshot'), /hand:\{ \.\.\.handAdmitDiag \}/);
  assert.match(html, /\n  perf\(\)\{ return framePerfSnapshot\(\); \},/);
  assert.match(functionSource('initGame'), /resetFramePerf\(\);/);
});

test('v98 hand model delegate is chosen from measured tracking cost and can be forced by URL', () => {
  const ensure = functionSource('ensureHandLandmarker');
  assert.match(ensure, /delegate: preferredHandDelegate\(\)/);
  assert.doesNotMatch(ensure, /delegate: isAppleTouchDevice\(\) \? "CPU" : "GPU"/);
  assert.match(ensure, /framePerf\.handDelegate = options\.baseOptions\.delegate;/);
  assert.match(ensure, /framePerf\.handDelegate = 'CPU';/);
  const pref = functionSource('preferredHandDelegate');
  assert.match(pref, /if\(isAppleTouchDevice\(\)\) return 'CPU';/);
  assert.match(functionSource('handDelegateOverride'), /get\('handDelegate'\)/);
  const rec = functionSource('recordHandDelegatePerformance');
  assert.match(rec, /if\(state\.qaMode \|\| research\.active\) return \{ action:'skip'/);
  assert.match(rec, /p\.trackMs > HAND_DELEGATE_SLOW_MS && !Number\.isFinite\(rec\.CPU\)/);
  assert.match(rec, /rec\.pref = 'CPU'; action = 'try-cpu';/);
  assert.match(rec, /rec\.settled = true; action = 'settle-gpu';/);
  assert.match(rec, /rec\.settled = true; action = 'settle-cpu';/);
  assert.match(functionSource('endGame'), /recordHandDelegatePerformance\(\);/);
  assert.match(html, /const HAND_DELEGATE_SLOW_MS = 70;/);
});

test('v98 affected-hand admission constants and research isolation', () => {
  assert.match(html, /const AFFECTED_HAND_TRACK_MS = 1500;/);
  assert.match(html, /const LONE_HAND_ADMIT_MS = 1000;/);
  assert.match(functionSource('affectedHandContinuityEnabled'),
    /!research\.active && \(state\.level === '5' \|\| state\.level === '67'\)/);
  const grace = functionSource('graspTrackingGraceEligible');
  assert.match(grace, /\(state\.level === '5' \|\| state\.level === '67'\)\s*&& res\.reason === 'affected-hand-not-detected'/);
  const stab = functionSource('stabiliseDetectedGesture');
  assert.match(stab, /mode === 'grasp' && state\.level === '5'\s*\?\s*60/);
});

/* ---------- browser behaviour ---------- */

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    browser = null;
    console.warn('playwright unavailable; v98 admission tests skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

async function withPage(fn){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qa && typeof window.__qa.startGame === 'function');
  try{
    await fn(page);
  }finally{
    await context.close();
  }
  assert.deepEqual(errors.map(String), []);
}

const probeScript = `
  window.__p = (() => {
    const point = (x=0.5, y=0.5) => Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
    const hand = (label, score, x=0.5, y=0.5) => ({
      lm: point(x, y),
      hd: label === null ? [] : [{ categoryName: label, score }],
    });
    const results = (...hands) => ({
      landmarks: hands.map(h => h.lm),
      handednesses: hands.map(h => h.hd),
    });
    return { point, hand, results,
      pick: (res, side) => window.__qa.gestureProbe.affectedHand(res, side).index };
  })();
`;

test('v98 public Level 5: a lone hand with missing or uncertain label is admitted; a lone confidently opposite hand only after 1 s', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      const out = {};
      out.missing = pick(results(hand(null, 0)), 'left');
      out.uncertainLeft = pick(results(hand('Left', 0.40)), 'left');
      out.uncertainRight = pick(results(hand('Right', 0.50)), 'left');
      // Fresh lone confidently-opposite hand: rejected on the first frames.
      out.oppositeFirst = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.advanceTime(400);
      out.oppositeAt400 = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.advanceTime(700);
      out.oppositeAt1100 = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      return out;
    });
    assert.equal(r.missing, 0);
    assert.equal(r.uncertainLeft, 0);
    assert.equal(r.uncertainRight, 0);
    // The confidently opposite lone hand is rejected until it has been alone
    // and opposite-labelled continuously for LONE_HAND_ADMIT_MS.
    assert.equal(r.oppositeFirst, -1);
    assert.equal(r.oppositeAt400, -1);
    assert.equal(r.oppositeAt1100, 0);
  });
});

test('v98 public Level 5: a fresh lone confidently opposite hand is rejected until it has been alone for 1 s', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      const out = {};
      out.first = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.advanceTime(300);
      out.at300 = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.advanceTime(300);
      out.at600 = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      // An uncertain frame in between resets the opposite streak.
      out.uncertainMid = pick(results(hand('Right', 0.50, 0.2, 0.2)), 'left');
      window.advanceTime(300);
      out.at900afterReset = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.advanceTime(1000);
      out.at1100 = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      // A second hand entering resets the lone streak.
      out.twoHands = pick(results(hand('Right', 0.99, 0.2, 0.2), hand('Right', 0.99, 0.8, 0.8)), 'left');
      out.loneAgain = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      return out;
    });
    assert.equal(r.first, -1);
    assert.equal(r.at300, -1);
    assert.equal(r.at600, -1);
    assert.equal(r.uncertainMid, 0);
    assert.equal(r.at900afterReset, -1);
    assert.equal(r.at1100, 0);
    assert.equal(r.twoHands, -1);
    assert.equal(r.loneAgain, -1);
  });
});

test('v98 public Level 5: with two hands in view the strict label still decides and an assisting hand never displaces the affected hand', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      const out = {};
      out.leftSecond = pick(results(hand('Right', 0.95, 0.2, 0.5), hand('Left', 0.90, 0.7, 0.5)), 'left');
      out.bothOpposite = pick(results(hand('Right', 0.95, 0.2, 0.5), hand('Right', 0.95, 0.7, 0.5)), 'left');
      // Continuity: after a confident Left at (0.7,0.5), an ambiguous label near
      // that wrist is kept within 1500 ms, a confident opposite is not.
      pick(results(hand('Left', 0.90, 0.7, 0.5), hand('Right', 0.95, 0.2, 0.5)), 'left');
      window.advanceTime(1200);
      out.continuityAmbiguous = pick(results(hand('Right', 0.60, 0.72, 0.52), hand('Right', 0.95, 0.2, 0.5)), 'left');
      window.advanceTime(100);
      out.continuityConfidentOpposite = pick(results(hand('Right', 0.90, 0.72, 0.52), hand('Right', 0.95, 0.2, 0.5)), 'left');
      return out;
    });
    assert.equal(r.leftSecond, 1);
    assert.equal(r.bothOpposite, -1);
    assert.equal(r.continuityAmbiguous, 0);
    assert.equal(r.continuityConfidentOpposite, -1);
  });
});

test('v98 public Level 6 shares the lone-hand and continuity admission; Level 4 default page stays strict', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(probeScript);
    const strict = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      return { missing: pick(results(hand(null, 0)), 'left'), uncertain: pick(results(hand('Left', 0.4)), 'left') };
    });
    assert.deepEqual(strict, { missing: -1, uncertain: -1 });
    await page.evaluate(() => window.__qa.startGame({ level: '67', level6Task: 'flowers', theme: 'flowers', duration: 60, affectedSide: 'right' }));
    const l6 = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      const out = {};
      out.missing = pick(results(hand(null, 0)), 'right');
      out.uncertain = pick(results(hand('Right', 0.45)), 'right');
      out.oppositeFresh = pick(results(hand('Left', 0.99, 0.1, 0.1), hand('Left', 0.99, 0.9, 0.9)), 'right');
      return out;
    });
    assert.equal(l6.missing, 0);
    assert.equal(l6.uncertain, 0);
    assert.equal(l6.oppositeFresh, -1);
  });
});

test('v98 perf snapshot is exposed through the QA surface and counts admission paths', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const perf = await page.evaluate(() => {
      const { hand, results, pick } = window.__p;
      pick(results(hand('Left', 0.9)), 'left');
      // Same place, label lost: continuity keeps it.
      pick(results(hand(null, 0)), 'left');
      // Far away, label lost, alone in view: lone-hand admission.
      pick(results(hand(null, 0, 0.1, 0.1)), 'left');
      return window.__qa.perf();
    });
    for(const key of ['trackMs', 'renderMs', 'frameMs', 'fps', 'samples', 'longFrames', 'canvas', 'video', 'dpr', 'scaledBitmaps', 'hand']){
      assert.ok(key in perf, `perf snapshot missing ${key}`);
    }
    assert.equal(perf.hand.strict, 1);
    assert.equal(perf.hand.continuity, 1);
    assert.equal(perf.hand.lone, 1);
    assert.equal(perf.hand.path, 'lone');
    const delegate = await page.evaluate(() => window.__qa.handDelegate());
    assert.ok(['GPU', 'CPU'].includes(delegate.preferred));
  });
});
