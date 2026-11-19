// v122: the calibration sharp window ("selfie" rectangle) is larger so the
// thumb / index / middle fingers and the peg stay visible even when the hand
// model fits its 21 points to a small part of the hand.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

test('v122 release markers', () => {
  assert.match(html, /const LEVEL_APP_BUILD = "v131-20261119-digiflex-cooking";/);
  assert.match(html, /perf v131/);
  assert.match(sw, /^const CACHE_VERSION = "fthue-rehab-v131-20261119-digiflex-cooking";/);
  assert.match(manifest, /v131-20261119-digiflex-cooking/);
});

test('v122 sharp window constants: 50% padding, minimum side 45% of the canvas short side', () => {
  assert.match(html, /const PRIVACY_WINDOW_PAD = 0\.50;/);
  assert.match(html, /const PRIVACY_WINDOW_MIN = 0\.45;/);
  // Geometry unchanged: padding is the larger of box-relative pad, min-side fill and 18 px.
  assert.match(html, /const minSide = Math\.min\(rectW, rectH\) \* PRIVACY_WINDOW_MIN;/);
  assert.match(html, /const padX = Math\.max\(\(x1 - x0\) \* PRIVACY_WINDOW_PAD, \(minSide - \(x1 - x0\)\) \/ 2, 18\);/);
});

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    browser = null;
    console.warn('playwright unavailable; v122 browser tests skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

test('v122 a tiny 21-point cluster still opens a window of at least 45% of the canvas short side', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qa && typeof window.__qa.privacySharpWindow === 'function');
  const r = await page.evaluate(async () => {
    // Feed the calibration <video> from a canvas stream so readyState >= 2 without a camera.
    const src = document.createElement('canvas'); src.width = 640; src.height = 480;
    const sctx = src.getContext('2d'); sctx.fillStyle = '#888'; sctx.fillRect(0, 0, 640, 480);
    const video = document.getElementById('calibVideo');
    video.srcObject = src.captureStream(15);
    video.muted = true;
    await video.play().catch(() => {});
    for(let i = 0; i < 60 && video.readyState < 2; i++){ sctx.fillRect(0, 0, 1, 1); await new Promise(r => setTimeout(r, 50)); }
    const canvas = document.getElementById('calibOverlay');
    canvas.width = 845; canvas.height = 632;
    const tiny = Array.from({ length: 21 }, (_, i) => ({ x: 0.62 + (i % 3) * 0.01, y: 0.42 + Math.floor(i / 3) * 0.004 }));
    const hand = Array.from({ length: 21 }, (_, i) => ({ x: 0.45 + (i % 7) * 0.05, y: 0.30 + Math.floor(i / 7) * 0.12 }));
    return { ready: video.readyState, tiny: window.__qa.privacySharpWindow(tiny), hand: window.__qa.privacySharpWindow(hand) };
  });
  await context.close();
  assert.deepEqual(errors.map(String), []);
  assert.ok(r.ready >= 2, 'video did not become ready');
  assert.ok(r.tiny && typeof r.tiny === 'object', 'window rect returned');
  const minSide = Math.min(r.tiny.canvasW, r.tiny.canvasH) * 0.45;
  assert.ok(r.tiny.w >= minSide - 1 && r.tiny.h >= minSide - 1, `tiny cluster window ${r.tiny.w}x${r.tiny.h} < ${minSide}`);
  // A real-size hand box (30% x 24% of the frame) grows by 50% padding on each side.
  assert.ok(r.hand.w > r.tiny.w, 'hand window wider than tiny-cluster window');
});
