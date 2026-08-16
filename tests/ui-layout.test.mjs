/**
 * Layout regression tests for the Level 3–4 inline GIF demonstrations and
 * the single in-game prompt safe strip.
 *
 * These guard the fixes for the therapist report that instruction text
 * overlapped / blocked the view on portrait iPhone and iPad:
 *
 *   1. Level 3–4 render direct 16:9 looping GIFs inside their cards;
 *   2. Level 5–6 expose no instruction-video controls;
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
  test(`inline Level 3–4 GIF layout — ${vp.name}`, async (t) => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(vp, async (page) => {
      const result = await page.evaluate(() => {
        const rect = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        return {
          gifs: ['3', '4'].map(level => {
            const img = document.querySelector(`[data-testid="gif-level-${level}"]`);
            return {
              level,
              rect: rect(`[data-testid="gif-level-${level}"]`),
              src: img?.getAttribute('src') || '',
              alt: img?.getAttribute('alt') || '',
            };
          }),
          videoButtons: document.querySelectorAll('.instruction-play,[data-video-src]').length,
          instructionVideoElements: document.querySelectorAll(
            '#instructionVideo,.video-modal video,[data-testid="video-instruction"]'
          ).length,
        };
      });
      for (const gif of result.gifs) {
        assert.ok(gif.rect, `Level ${gif.level} GIF is present`);
        assert.ok(gif.src.endsWith('.gif'), `Level ${gif.level} uses a GIF`);
        assert.ok(gif.alt.length > 0, `Level ${gif.level} GIF has alt text`);
        assert.ok(Math.abs(gif.rect.width / gif.rect.height - 16 / 9) < 0.03,
          `Level ${gif.level} GIF should be 16:9`);
      }
      assert.equal(result.videoButtons, 0, 'no instruction-video buttons remain');
      assert.equal(result.instructionVideoElements, 0, 'no instruction-video players remain');
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
        'gif-level-3', 'gif-level-4',
        'gif-level-6-clothes-peg', 'gif-level-6-chopsticks',
        'panel-safety-pause', 'panel-stop-confirm', 'panel-compensation',
        'button-game-rest', 'button-game-stop', 'button-pilot-rest-resume',
        'button-compensation-observe',
      ];
      return ids.filter(id => !document.querySelector(`[data-testid="${id}"]`));
    });
    assert.deepEqual(found, [], `missing test IDs: ${found.join(', ')}`);
  });
});

test('Level 4 safety gate uses the approved three-item wording', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    const copy = await page.evaluate(() => {
      openSafetyGate('4', () => {}, () => {});
      return {
        title: document.getElementById('safetyTitle')?.textContent.trim(),
        items: [...document.querySelectorAll('#safetyChecklist > li')]
          .filter(el => !el.hidden)
          .map(el => el.textContent.trim()),
        supervisionHidden: document.getElementById('safetySupervision')?.hidden,
        noteHidden: document.getElementById('safetyLevelNote')?.hidden,
      };
    });
    assert.equal(copy.title, '開始前安全確認（FTHUE Level 4）');
    assert.deepEqual(copy.items, [
      '治療師全程監督，疼痛／手緊／代償 → 立即停止。',
      '坐穩，患手放在滑板上（離身 10–15 cm，不貼腹），身體保持正中，不聳肩，緩慢向前滑。',
      '先試 3 次，無痛才正式做；動作慢、穩，不追次數，隨時可休息或停止。',
    ]);
    assert.equal(copy.supervisionHidden, true, 'duplicate supervision line is hidden');
    assert.equal(copy.noteHidden, true, 'duplicate Level 4 note is hidden');
  });
});

test('Level 5 safety gate uses the approved five-item wording', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    const copy = await page.evaluate(() => {
      openSafetyGate('5', () => {}, () => {});
      return {
        title: document.getElementById('safetyTitle')?.textContent.trim(),
        items: [...document.querySelectorAll('#safetyChecklist > li')]
          .filter(el => !el.hidden)
          .map(el => el.textContent.trim()),
        supervisionHidden: document.getElementById('safetySupervision')?.hidden,
        noteHidden: document.getElementById('safetyLevelNote')?.hidden,
      };
    });
    assert.equal(copy.title, '開始前安全確認（FTHUE Level 5）');
    assert.deepEqual(copy.items, [
      '坐穩，伸出患手、輕輕合手、張開手。',
      '身體保持正中，避免過度側彎。',
      '先試 3 次，無痛才正式做。',
      '動作慢、穩，不追次數，隨時可休息或停止。',
      '治療師全程監督，疼痛／手緊／代償 → 立即停止。',
    ]);
    assert.equal(copy.supervisionHidden, true, 'duplicate supervision line is hidden');
    assert.equal(copy.noteHidden, true, 'duplicate Level 5 note is hidden');
  });
});

test('final FTHUE Level 3–7 movement wording is consistent', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    const copy = await page.evaluate(() => ({
      headings: [...document.querySelectorAll('.level-card h3')].map(el => el.textContent.trim()),
      level3: window.SAFETY_LEVEL_NOTES?.['3'] || '',
      level4: window.SAFETY_LEVEL_NOTES?.['4'] || '',
      level5: window.SAFETY_LEVEL_NOTES?.['5'] || '',
      level67: window.SAFETY_LEVEL_NOTES?.['67'] || '',
    }));

    assert.deepEqual(copy.headings, [
      '雙手外側滑動',
      '患手向前滑動',
      '患手握放練習',
      '患手捏放練習',
    ]);
    assert.match(copy.level3, /好手帶動患手.*向患側/);
    assert.match(copy.level3, /肩外展及外側滑動/);
    assert.match(copy.level3, /毛巾須隨手移動/);
    assert.match(copy.level3, /軀幹保持正中/);
    assert.match(copy.level4, /患手放在.*滑板/);
    assert.match(copy.level4, /避免聳肩/);
    assert.match(copy.level5, /伸出患手、輕輕合手、張開手/);
    assert.match(copy.level5, /避免過度側彎/);
    assert.match(copy.level67, /伸出患手、手指輕捏、張開手指/);
    assert.match(copy.level67, /避免過度側彎/);
  });
});
