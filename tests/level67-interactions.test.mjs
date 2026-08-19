import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

let browser;
let chromium;

before(async () => {
  try {
    ({ chromium } = await import('playwright'));
    browser = await chromium.launch();
  } catch (error) {
    browser = null;
    console.warn('playwright unavailable; Level 6–7 interaction tests skipped:', error.message);
  }
});

after(async () => { if (browser) await browser.close(); });

async function withPage(viewport, fn) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', error => { throw error; });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  try { await fn(page); } finally { await context.close(); }
}

test('peg light press remains hysteretic while accepting a modest calibrated-like movement', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    const probe = await page.evaluate(() => ({
      enter: window.__qa.gestureProbe.peg(0.40, false),
      held: window.__qa.gestureProbe.peg(0.52, true),
      released: window.__qa.gestureProbe.peg(0.60, true),
    }));
    assert.equal(probe.enter.isPressing, true, 'modest finger closure starts a light press');
    assert.equal(probe.held.isPressing, true, 'hysteresis keeps a held press through small reopen');
    assert.equal(probe.released.isPressing, false, 'a clearer reopen releases the press');
    assert.ok(probe.enter.meanGap >= probe.enter.nearGap, 'both visible finger-gap cues contribute');
  });
});

for (const viewport of [
  { width: 1180, height: 820, name: 'iPad landscape' },
  { width: 820, height: 1180, name: 'iPad portrait' },
  { width: 390, height: 844, name: 'compact portrait cap' },
]) {
  test(`Level 6–7 1.5× dim sum layout remains clear — ${viewport.name}`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(viewport, async page => {
      const layout = await page.evaluate(() => {
        window.__qa.startGame({ level: '67', toolMode: 'bare', theme: 'dimsum', duration: 60 });
        return window.__qa.level67Layout();
      });
      assert.equal(layout.insideCanvas, true, 'every target and item stays inside the canvas');
      assert.equal(layout.targetsDoNotOverlap, true, 'the enlarged steamers do not overlap');
      assert.equal(layout.targets.length, 2);
      assert.equal(layout.items.length, 3);
      const [first, second] = layout.targets;
      const horizontalGap = Math.abs(first.x - second.x);
      const verticalGap = Math.abs(first.y - second.y);
      assert.ok(
        horizontalGap >= first.w || verticalGap >= first.h,
        'steamers retain a visible gap on their layout axis',
      );
      if (viewport.width <= 520) {
        assert.ok(verticalGap >= first.h, 'phone portrait stacks targets away from the camera preview');
        assert.ok(first.x + first.w / 2 < viewport.width * 0.55, 'phone targets stay left of the preview lane');
      }
    });
  });
}

test('Home clears safety overlays and result runtime, while Stop remains available', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    await page.evaluate(() => {
      window.__qa.startGame({ level: '67', toolMode: 'bare', theme: 'dimsum', duration: 60 });
      showSafetyPause('Test safety hold', 'This overlay must not trap navigation.');
    });
    await page.locator('#btnSafetyPauseStop').click();
    await page.waitForSelector('#screen-result.active');

    await page.locator('#btnHome').click();
    const afterResultHome = await page.evaluate(() => ({
      screen: window.__qa.state().screen,
      running: window.__qa.state().running,
      safetyPause: document.getElementById('safetyPauseOverlay').classList.contains('show'),
      stopConfirm: document.getElementById('stopConfirmOverlay').classList.contains('show'),
      rest: document.getElementById('pilotRestOverlay').classList.contains('show'),
    }));
    assert.deepEqual(afterResultHome, {
      screen: 'level', running: false, safetyPause: false, stopConfirm: false, rest: false,
    });

    await page.evaluate(() => {
      window.__qa.startGame({ level: '67', toolMode: 'bare', theme: 'dimsum', duration: 60 });
      showSafetyPause('Test safety hold', 'Home must remain actionable here too.');
    });
    await page.locator('#btnSafetyPauseHome').click();
    assert.equal(await page.evaluate(() => window.__qa.state().screen), 'level');
  });
});
