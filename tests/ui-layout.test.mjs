/**
 * Layout regression tests for the instruction-video modal and the single
 * in-game prompt safe strip.
 *
 * These guard the fixes for the therapist report that instruction text
 * overlapped / blocked the view on portrait iPhone and iPad:
 *
 *   1. the instruction video renders in a true 16:9 frame (no baked-in overlay
 *      assumptions) with a compact title and EXACTLY ONE short caption that
 *      lives outside and below the video;
 *   2. on portrait viewports the dialog does not become a mostly-black
 *      fullscreen takeover and the close button stays inside the viewport;
 *   3. in-game prompts live in one non-overlapping safe strip (#promptZone),
 *      never stack on each other and never reach the bottom target band;
 *   4. the prompt slot is single-slot: at most one instruction prompt visible.
 *
 * Usage:
 *   NODE_PATH=/home/user/node_modules node --test tests/ui-layout.test.mjs
 *
 * Skips itself (rather than failing the suite) when Playwright/Chromium is not
 * installed in the environment.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 390, height: 844 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
];

let chromium = null;
let browser = null;

before(async () => {
  try {
    ({ chromium } = await import('playwright'));
    browser = await chromium.launch();
  } catch (err) {
    browser = null;
    console.warn('playwright unavailable; layout tests skipped:', err.message);
  }
});

after(async () => { if (browser) await browser.close(); });

async function withPage(vp, fn) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  try { await fn(page); } finally { await ctx.close(); }
}

function overlaps(a, b) {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
         a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

for (const vp of VIEWPORTS) {
  test(`instruction video modal layout — ${vp.name}`, async (t) => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(vp, async (page) => {
      await page.click('[data-testid="button-video-level-5"]');
      await page.waitForTimeout(200);

      const box = await page.evaluate(() => {
        const rect = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          frame: rect('.video-frame'),
          video: rect('#instructionVideo'),
          caption: rect('#instructionVideoCaption'),
          close: rect('#instructionVideoClose'),
          dialog: rect('.video-dialog'),
          captionCount: document.querySelectorAll('.video-dialog .video-caption').length,
          captionText: document.getElementById('instructionVideoCaption').textContent.trim(),
          title: document.getElementById('instructionVideoTitle').textContent.trim(),
          playsinline: document.getElementById('instructionVideo').hasAttribute('playsinline'),
          viewportH: window.innerHeight,
          viewportW: window.innerWidth,
        };
      });

      // 16:9 frame, playsinline, no overlay text assumptions inside the frame.
      assert.ok(box.frame, 'video frame present');
      assert.ok(Math.abs(box.frame.width / box.frame.height - 16 / 9) < 0.03,
        `frame should be 16:9, got ${(box.frame.width / box.frame.height).toFixed(3)}`);
      assert.ok(box.playsinline, 'video must be playsinline');

      // Exactly one caption, outside and below the video, never overlapping it.
      assert.equal(box.captionCount, 1, 'exactly one caption element');
      assert.ok(box.captionText.length > 0 && box.captionText.length <= 30,
        `caption must be short, got ${box.captionText.length} chars`);
      assert.ok(box.caption.top >= box.video.bottom - 0.5, 'caption sits below the video');
      assert.ok(!overlaps(box.caption, box.video), 'caption never overlays the video');

      // Compact title.
      assert.ok(box.title.length <= 20, `title must stay compact, got "${box.title}"`);

      // Close button always reachable inside the viewport.
      assert.ok(box.close.top >= -0.5 && box.close.bottom <= box.viewportH + 0.5,
        'close button inside viewport vertically');
      assert.ok(box.close.right <= box.viewportW + 0.5, 'close button inside viewport horizontally');
      assert.ok(box.close.width >= 44 && box.close.height >= 44, 'close button >= 44px touch target');

      // Portrait: the dialog should hug the video, not become a black takeover.
      if (vp.height > vp.width) {
        assert.ok(box.dialog.height <= box.viewportH * 0.9,
          'portrait dialog should not fill the whole screen');
        assert.ok(box.dialog.top <= box.viewportH * 0.25, 'portrait dialog is top-aligned');
      }
    });
  });

  test(`in-game prompt safe strip — ${vp.name}`, async (t) => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(vp, async (page) => {
      const res = await page.evaluate(() => {
        // The app code lives inside an IIFE, so activate the game screen via the DOM.
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById('screen-game').classList.add('active');
        document.getElementById('pilotCogPanel').classList.add('show');
        document.getElementById('pilotPhaseHud').classList.add('show');
        setPromptSlot('rules');
        const rect = (id) => {
          const el = document.getElementById(id);
          if (!el || getComputedStyle(el).display === 'none') return null;
          const r = el.getBoundingClientRect();
          return { id, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        const zone = rect('promptZone');
        const stage = document.querySelector('.game-stage').getBoundingClientRect();
        const items = ['statusBar', 'promptSlot', 'pilotCogPanel', 'pilotPhaseHud']
          .map(rect).filter(Boolean);
        // Single-slot check.
        setPromptSlot('intro');
        const introOnly = {
          banner: getComputedStyle(document.getElementById('levelIntroBanner')).display,
          rules: getComputedStyle(document.getElementById('persistentRules')).display,
        };
        setPromptSlot('rules');
        const rulesOnly = {
          banner: getComputedStyle(document.getElementById('levelIntroBanner')).display,
          rules: getComputedStyle(document.getElementById('persistentRules')).display,
        };
        return { zone, items, introOnly, rulesOnly, stageH: stage.height, stageTop: stage.top };
      });

      assert.ok(res.zone, 'prompt zone rendered on the game screen');

      // No prompt overlaps another prompt.
      for (let i = 0; i < res.items.length; i++) {
        for (let j = i + 1; j < res.items.length; j++) {
          assert.ok(!overlaps(res.items[i], res.items[j]),
            `${res.items[i].id} must not overlap ${res.items[j].id}`);
        }
      }

      // The strip stays clear of the bottom target/basket band (targets are
      // placed at >= 0.62 of the stage height by setupTargets()).
      const limit = res.stageTop + res.stageH * 0.62;
      for (const item of res.items) {
        assert.ok(item.bottom <= limit,
          `${item.id} must stay above the target band (${item.bottom.toFixed(0)} > ${limit.toFixed(0)})`);
      }

      // Single-slot container: never two instruction prompts at once.
      assert.equal(res.introOnly.rules, 'none', 'rule line hidden while intro banner shows');
      assert.notEqual(res.introOnly.banner, 'none', 'intro banner visible when requested');
      assert.equal(res.rulesOnly.banner, 'none', 'intro banner hidden while rule line shows');
      assert.notEqual(res.rulesOnly.rules, 'none', 'rule line visible when requested');
    });
  });
}

test('critical test IDs and safety hooks preserved', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[0], async (page) => {
    const found = await page.evaluate(() => {
      const ids = [
        'button-video-level-3', 'button-video-level-4', 'button-video-level-5',
        'button-video-level-6', 'button-close-instruction-video', 'video-instruction',
        'panel-safety-pause', 'panel-stop-confirm', 'panel-compensation',
        'button-game-rest', 'button-game-stop', 'button-pilot-rest-resume',
        'button-compensation-observe',
      ];
      return ids.filter(id => !document.querySelector(`[data-testid="${id}"]`));
    });
    assert.deepEqual(found, [], `missing test IDs: ${found.join(', ')}`);
  });
});
