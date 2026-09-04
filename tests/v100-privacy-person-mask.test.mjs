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

test('v100 person segmentation uses the local selfie segmenter and fails open to the v99 hand window', () => {
  assert.ok(fs.existsSync(path.join(root, 'vendor/mediapipe/models/selfie_segmenter.tflite')), 'model shipped in vendor');
  assert.match(html, /const PRIVACY_SEG_W = 192;/);
  assert.match(html, /const PRIVACY_SEG_THRESHOLD = 0\.5;/);
  assert.match(html, /const PRIVACY_SEG_SEED_RADIUS = 0\.08;/);
  assert.match(html, /const PRIVACY_SEG_SEED_HOLD_MS = 2500;/);
  const ensure = functionSource('ensurePrivacySegmenter');
  assert.match(ensure, /modelAssetPath:"\.\/vendor\/mediapipe\/models\/selfie_segmenter\.tflite"/);
  assert.match(ensure, /runningMode:"VIDEO"/);
  assert.match(ensure, /outputConfidenceMasks:true/);
  assert.match(ensure, /privacySegmenterFailed = true;/);
  // The segmenter is fed a down-scaled copy, never the full camera frame, and results are closed.
  const update = functionSource('updatePrivacyPersonMask');
  assert.match(update, /ictx\.drawImage\(video, 0, 0, w, h\);/);
  assert.match(update, /segmentForVideo\(privacySegInput, ts\)/);
  assert.match(update, /result\.close\(\)/);
  assert.match(update, /if\(privacySegmenterFailed\) return false;/);
  // Only the component connected to the tracked hand/wrist is revealed.
  assert.match(update, /privacyPersonComponent\(prob, mw, mh, privacyCurrentSeed\(\), PRIVACY_SEG_THRESHOLD\)/);
  const layer = functionSource('drawPrivacyPersonLayer');
  assert.match(layer, /globalCompositeOperation = 'destination-in'/);
  assert.match(layer, /if\(state\.mirrorX\)\{ lctx\.translate\(rectW, 0\); lctx\.scale\(-1, 1\); \}/);
});

test('v100 calibration loop draws blur, then the participant layer, then the hand window; camera stop resets', () => {
  const loop = functionSource('startCalibLoop');
  const iBlur = loop.indexOf('drawPrivacyBlurredVideo(ctx, video, rectW, rectH);');
  const iSeg = loop.indexOf('updatePrivacyPersonMask(video, seedPt);');
  const iLayer = loop.indexOf('drawPrivacyPersonLayer(ctx, video, rectW, rectH);');
  const iWin = loop.indexOf('drawPrivacySharpWindow(ctx, video, rectW, rectH, privacyWindowPts);');
  assert.ok(iBlur >= 0 && iSeg > iBlur && iLayer > iSeg && iWin > iLayer, 'draw order blur -> person -> hand window');
  assert.match(loop, /if\(privacyBlurEnabled\(\)\) ensurePrivacySegmenter\(\);/);
  assert.match(loop, /resetPrivacySegmentation\(\);/);
  assert.match(functionSource('stopCamera'), /resetPrivacySegmentation\(\);/);
  // Seed is the wrist: hand landmark 0, or the affected wrist (last of the three pose points).
  assert.match(loop, /privacyWindowPts\.length >= 21 \? privacyWindowPts\[0\] : privacyWindowPts\[privacyWindowPts\.length - 1\]/);
});

/* ---------- browser behaviour ---------- */

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    browser = null;
    console.warn('playwright unavailable; v100 tests skipped:', error.message);
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

// 12x8 probability grid: a large person on the left (cols 0-4), a small second
// person on the right (cols 9-10), background elsewhere.
const gridScript = `
  window.__grid = (() => {
    const w = 12, h = 8, prob = new Float32Array(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const i = y * w + x;
      if(x <= 4 && y >= 1) prob[i] = 0.9;
      else if(x >= 9 && x <= 10 && y >= 3) prob[i] = 0.8;
      else prob[i] = 0.1;
    }
    const alphaAt = (res, x, y) => res.alpha[y * w + x];
    return { w, h, prob, alphaAt };
  })();
`;

test('v100 component picker keeps only the person connected to the tracked wrist', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(gridScript);
    const r = await page.evaluate(() => {
      const g = window.__grid;
      const seedLeft = window.__qa.privacyPersonComponent(g.prob, g.w, g.h, { x: 2 / g.w, y: 4 / g.h });
      const seedRight = window.__qa.privacyPersonComponent(g.prob, g.w, g.h, { x: 9.5 / g.w, y: 5 / g.h });
      const noSeed = window.__qa.privacyPersonComponent(g.prob, g.w, g.h, null);
      // Seed on background pixels within the 8 % radius (1 px here) of the small person snaps to it.
      const nearRight = window.__qa.privacyPersonComponent(g.prob, g.w, g.h, { x: 11 / g.w, y: 5 / g.h });
      // Seed far from every person falls back to the largest component.
      const farSeed = window.__qa.privacyPersonComponent(g.prob, g.w, g.h, { x: 7 / g.w, y: 0 });
      const pick = (res) => ({ components: res.components, size: res.size, seeded: res.seeded,
        left: g.alphaAt(res, 2, 4), right: g.alphaAt(res, 9, 5), bg: g.alphaAt(res, 7, 4) });
      return { seedLeft: pick(seedLeft), seedRight: pick(seedRight), noSeed: pick(noSeed), nearRight: pick(nearRight), farSeed: pick(farSeed) };
    });
    assert.equal(r.seedLeft.components, 2);
    assert.deepEqual([r.seedLeft.left, r.seedLeft.right, r.seedLeft.bg, r.seedLeft.seeded], [255, 0, 0, true]);
    assert.equal(r.seedLeft.size, 5 * 7);
    assert.deepEqual([r.seedRight.left, r.seedRight.right, r.seedRight.seeded], [0, 255, true]);
    assert.deepEqual([r.noSeed.left, r.noSeed.right, r.noSeed.seeded], [255, 0, false]);
    assert.deepEqual([r.nearRight.left, r.nearRight.right, r.nearRight.seeded], [0, 255, true]);
    assert.deepEqual([r.farSeed.left, r.farSeed.right, r.farSeed.seeded], [255, 0, false]);
  });
});

test('v100 empty or missing masks reveal nothing and never throw', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      const empty = window.__qa.privacyPersonComponent(new Float32Array(12), 4, 3, { x: 0.5, y: 0.5 });
      const state = window.__qa.privacySegState();
      return { empty, state };
    });
    assert.equal(r.empty, null);
    assert.equal(r.state.mask, null);
    assert.equal(r.state.failed, false);
  });
});

test('v100 privacy toggle still works and the person layer draws onto the calibration canvas', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => { window.__qa.selectLevel('5'); window.__qa.selectActivity('dimsum'); });
    await page.click('[data-testid="button-affected-left"]');
    const label = await page.textContent('#btnPrivacyBlur');
    assert.equal(label, '背景模糊：開');
    // Without a camera the layer cannot draw (no video frame) but must not throw.
    const drew = await page.evaluate(() => window.__qa.setPrivacyPersonMask(new Uint8Array(12).fill(255), 4, 3));
    assert.equal(typeof drew, 'boolean');
    const st = await page.evaluate(() => window.__qa.privacySegState());
    assert.deepEqual([st.mask.w, st.mask.h, st.mask.hasAlpha], [4, 3, true]);
  });
});
