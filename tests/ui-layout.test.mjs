/**
 * Layout regression tests for the Level 3–4 paired SVG demonstrations and
 * the single in-game prompt safe strip.
 *
 * These guard the fixes for the therapist report that instruction text
 * overlapped / blocked the view on portrait iPhone and iPad:
 *
 *   1. Level 3–4 render paired active / active-assisted SVG demonstrations;
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
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const PAGE_SOURCE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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
  test(`inline Level 3–4 demonstration layout — ${vp.name}`, async (t) => {
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
          level2: (() => {
            const img = document.querySelector('[data-testid="gif-level-2"]');
            return {
              rect: rect('[data-testid="gif-level-2"]'),
              src: img?.getAttribute('src') || '',
              alt: img?.getAttribute('alt') || '',
            };
          })(),
          demos: ['3', '4'].flatMap(level => ['active', 'assisted'].map(kind => {
            const selector = `[data-testid="demo-level-${level}-${kind}"]`;
            const img = document.querySelector(selector);
            return {
              level,
              kind,
              rect: rect(selector),
              src: img?.getAttribute('src') || '',
              alt: img?.getAttribute('alt') || '',
            };
          })),
          videoButtons: document.querySelectorAll('.instruction-play,[data-video-src]').length,
          instructionVideoElements: document.querySelectorAll(
            '#instructionVideo,.video-modal video,[data-testid="video-instruction"]'
          ).length,
        };
      });
      // v102：Level 2 卡片暫時收埋（hidden），圖片仍在 DOM 但唔佈局
      assert.ok(result.level2.rect, 'Level 2 image still exists in the DOM (archived, not deleted)');
      assert.equal(result.level2.rect.width, 0, 'Level 2 card is hidden in v102');
      assert.ok(/\.(gif|png)$/.test(result.level2.src), 'Level 2 keeps its instructional image');
      assert.ok(result.level2.alt.length > 0, 'Level 2 image keeps alt text');
      for (const demo of result.demos) {
        assert.ok(demo.rect, `Level ${demo.level} ${demo.kind} demonstration is present`);
        if (demo.level === '3' && demo.kind === 'active') {
          assert.ok(/level3_therapist_shoulder_30_60\.gif$/.test(demo.src), 'Level 3 active uses the therapist cartoon GIF (v102)');
        } else {
          assert.ok(/\.svg$/.test(demo.src), `Level ${demo.level} ${demo.kind} uses deterministic SVG`);
        }
        assert.ok(demo.alt.length > 0, `Level ${demo.level} ${demo.kind} has alt text`);
        assert.ok(Math.abs(demo.rect.width / demo.rect.height - 220 / 190) < 0.03,
          `Level ${demo.level} ${demo.kind} demonstration keeps its stable aspect ratio`);
      }
      for (const level of ['3', '4']) {
        const active = result.demos.find(item => item.level === level && item.kind === 'active');
        const assisted = result.demos.find(item => item.level === level && item.kind === 'assisted');
        assert.ok(active.rect.left < assisted.rect.left,
          `Level ${level} active demonstration stays to the left of active-assisted demonstration`);
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
        'demo-level-3-active', 'demo-level-3-assisted',
        'demo-level-4-active', 'demo-level-4-assisted',
        'gif-level-6-clothes-peg', 'gif-level-6-chopsticks',
        'button-mode-trial-3', 'button-mode-training-3',
        'button-mode-trial-4', 'button-mode-training-4',
        'button-mode-trial-5', 'button-mode-training-5',
        'button-mode-trial-67', 'button-mode-training-67',
        'panel-safety-pause', 'panel-stop-confirm', 'panel-compensation',
        'button-game-rest', 'button-game-stop', 'button-session-rest-resume',
        'button-compensation-observe',
        'indicator-silent-recording', 'panel-movement-review',
        'video-movement-review', 'button-download-movement-video',
        'button-delete-movement-video',
      ];
      return ids.filter(id => !document.querySelector(`[data-testid="${id}"]`));
    });
    assert.deepEqual(found, [], `missing test IDs: ${found.join(', ')}`);
  });
});


test('Level 2 renders one outward-slide activity and never shows elbow calibration', async (t) => {
  assert.match(PAGE_SOURCE, /id="level4ShoulderAbductionReading" hidden/);
  assert.match(PAGE_SOURCE, /\.level4-reading\[hidden\]\{\s*display:none !important;\s*\}/);
  assert.match(PAGE_SOURCE, /const active = \(usesLegacyLevel4Reach\(\) \|\| isShoulderFlexionLevel\(\)\)/);
  assert.match(PAGE_SOURCE, /if\(timingCard\) timingCard\.hidden=level2HorizontalAbduction;/);
  if (!browser) return t.skip('playwright unavailable');

  await withPage(VIEWPORTS[2], async (page) => {
      const patientState = await page.evaluate(() => {
        window.__qa.startGame({level:'2', theme:'mahjongwash', affectedSide:'right', duration:300});
        const row = document.getElementById('level4ShoulderAbductionReading');
        const bar = document.getElementById('level4CalibBar');
        const themes = window.__qa.themes('2');
        window.__qa.showRules();
        return {
          theme:window.__qa.state().theme,
          themes,
          hidden: row.hidden,
          display: getComputedStyle(row).display,
          barVisible:bar.classList.contains('show'),
          rules:document.getElementById('rulesContent').innerText,
        };
      });
      assert.equal(patientState.theme,'bilateral');
      assert.deepEqual(patientState.themes.map(theme=>theme.id),['bilateral']);
      assert.equal(patientState.hidden,true);
      assert.equal(patientState.display,'none');
      assert.equal(patientState.barVisible,false);
      assert.match(patientState.rules,/桌面肩水平外展/);
      assert.match(patientState.rules,/向患側外滑/);
      assert.match(patientState.rules,/返回中線/);
      assert.doesNotMatch(patientState.rules,/屈肘|伸肘|拿取|抓|放手|畫圈|前伸/);
  });
});

test('every FTHUE level offers trial and training modes with accessible controls', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  for (const vp of VIEWPORTS) {
    await withPage(vp, async (page) => {
      const controls = await page.evaluate(() => (
        [...document.querySelectorAll('[data-session-level][data-session-mode]')].map(button => {
          const rect = button.getBoundingClientRect();
          return {
            level: button.dataset.sessionLevel,
            mode: button.dataset.sessionMode,
            label: button.textContent.trim(),
            aria: button.getAttribute('aria-label') || '',
            width: rect.width,
            height: rect.height,
          };
        })
      ));
      assert.equal(controls.length, 10, `${vp.name}: five level entries should each have trial and training controls`);
      for (const level of ['2', '3', '4', '5', '67']) {
        assert.deepEqual(
          controls.filter(control => control.level === level).map(control => control.mode).sort(),
          ['training', 'trial'],
          `${vp.name}: Level ${level} should provide both modes`
        );
      }
      for (const control of controls) {
        if (control.mode === 'trial') {
          assert.ok(control.aria.includes('不錄影'), `${vp.name}: trial aria label states no recording`);
        } else {
          assert.ok(control.aria.includes('錄影'), `${vp.name}: training aria label states recording`);
        }
        if (control.level === '2') {
          // v102：Level 2 卡片收埋（hidden），控制鍵仍在 DOM 但唔佈局
          assert.equal(control.width, 0, `${vp.name}: archived Level 2 ${control.mode} control is not laid out`);
          continue;
        }
        assert.ok(control.width >= 44 && control.height >= 44,
          `${vp.name}: ${control.level}/${control.mode} remains a 44px touch target`);
      }
    });
  }
});

test('trial entry is visibly identified and bypasses recording/review code paths', async (t) => {
  assert.match(PAGE_SOURCE, /function beginSessionMode\(levelId, mode\)/);
  assert.match(PAGE_SOURCE, /state\.sessionMode\s*=\s*mode === 'trial' \? 'trial' : 'training'/);
  assert.match(PAGE_SOURCE, /selectLevel\(levelId\)/);
  assert.match(PAGE_SOURCE, /aria-label="FTHUE Level 5 試玩，不錄影及不提示治療師"/);
  assert.match(PAGE_SOURCE, /aria-label="FTHUE Level 5 訓練，錄影及提示治療師"/);
  assert.match(PAGE_SOURCE, /if\(isTrialMode\(\)\)\{[\s\S]*?clearMovementRecording\(\);[\s\S]*?trialModeIndicator[\s\S]*?classList\.add\('show'\)/);
  assert.match(PAGE_SOURCE, /if\(isTrialMode\(\)\)\{[\s\S]*?clearMovementRecording\(\);[\s\S]*?stopCamera\(\);[\s\S]*?\}else\{[\s\S]*?stopMovementRecording\(true\)/);

  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    await page.locator('[data-testid="button-mode-trial-5"]').click();
    await page.waitForSelector('#screen-library.active');
    const visibleState = await page.evaluate(() => ({
      label: document.getElementById('libraryLevelLabel')?.textContent.trim(),
      active: document.getElementById('screen-library')?.classList.contains('active'),
    }));
    assert.equal(visibleState.active, true);
    assert.match(visibleState.label, /FTHUE Level 5/);
  });
});

test('live camera is bright and movement recording is local, silent and downloadable', () => {
  assert.match(PAGE_SOURCE, /#screen-game\{\s*padding:0;\s*background:#eef3f1/);
  assert.match(PAGE_SOURCE, /\.game-stage video\{[\s\S]*?object-fit:cover;[\s\S]*?opacity:1;/);
  assert.match(PAGE_SOURCE, /new MediaRecorder\(privacyStream/);
  assert.match(PAGE_SOURCE, /videoBitsPerSecond:\s*650000/);
  assert.match(PAGE_SOURCE, /RECORDING_HEAD_EXCLUSION_RATIO\s*=\s*0\.30/);
  assert.match(PAGE_SOURCE, /canvas\.captureStream\(20\)/);
  assert.match(PAGE_SOURCE, /drawImage\(videoEl,\s*0,\s*cropTop/);
  assert.match(PAGE_SOURCE, /不錄頭部/);
  assert.match(PAGE_SOURCE, /navigator\.share/);
  assert.match(PAGE_SOURCE, /link\.download\s*=\s*filename/);
  assert.match(PAGE_SOURCE, /URL\.revokeObjectURL/);
  assert.match(PAGE_SOURCE, /audio:\s*false/);
  assert.doesNotMatch(PAGE_SOURCE, /movementRecording[\s\S]{0,120}(localStorage|sessionStorage|indexedDB)/);
});

test('participant flows skip the standalone safety interstitial for every level', () => {
  const level3Flow = PAGE_SOURCE.slice(
    PAGE_SOURCE.indexOf("document.getElementById('btnLevel3')"),
    PAGE_SOURCE.indexOf('/* Research Mode now routes')
  );
  const calibrationFlow = PAGE_SOURCE.slice(
    PAGE_SOURCE.indexOf("document.getElementById('btnGoCalib')"),
    PAGE_SOURCE.indexOf("document.getElementById('btnBackFromCalib')")
  );
  const retryFlow = PAGE_SOURCE.slice(
    PAGE_SOURCE.indexOf("document.getElementById('btnRetry')"),
    PAGE_SOURCE.indexOf("// Home：返回級別選擇畫面")
  );

  assert.doesNotMatch(level3Flow, /openSafetyGate/);
  assert.match(level3Flow, /beginSessionMode\('3', 'training'\)/);
  assert.doesNotMatch(level3Flow, /level3-bilateral\/index\.html/);
  assert.doesNotMatch(calibrationFlow, /openSafetyGate/);
  assert.match(calibrationFlow, /await enterCalibrationFlow\(\)/);
  assert.doesNotMatch(retryFlow, /openSafetyGate/);
  assert.match(retryFlow, /await enterCalibrationFlow\(\)/);
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
    assert.equal(copy.title, '開始前確認（FTHUE Level 4）');
    assert.deepEqual(copy.items, [
      '治療師全程監督。',
      '坐穩，患臂離桌，抬至目標。',
      '先試 3 次；慢、穩。',
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
    assert.equal(copy.title, '開始前確認（FTHUE Level 5）');
    assert.deepEqual(copy.items, [
      '坐穩；伸手、輕合、張手。',
      '身體保持正中。',
      '先試 3 次。',
      '慢、穩；可休息。',
      '治療師全程監督。',
    ]);
    assert.equal(copy.supervisionHidden, true, 'duplicate supervision line is hidden');
    assert.equal(copy.noteHidden, true, 'duplicate Level 5 note is hidden');
  });
});

test('Level 6 safety gate uses no angle-selection wording and keeps tool supervision', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    const copy = await page.evaluate(() => {
      openSafetyGate('67', () => {}, () => {});
      return {
        title: document.getElementById('safetyTitle')?.textContent.trim(),
        items: [...document.querySelectorAll('#safetyChecklist > li')]
          .filter(el => !el.hidden)
          .map(el => el.textContent.trim()),
        supervisionHidden: document.getElementById('safetySupervision')?.hidden,
        noteHidden: document.getElementById('safetyLevelNote')?.hidden,
      };
    });
    assert.equal(copy.title, '開始前確認（FTHUE Level 6）');
    assert.deepEqual(copy.items, [
      '坐穩；患手三指張開、輕捏拿起、移動，再張開放下。',
      '先選擇功能活動；筷子點心或衣夾晾衫才使用真實工具。',
      '先試 3 次。',
      '慢、穩；可休息。',
      '治療師全程監督；如使用實體工具，確認拿法正確。',
    ]);
    assert.equal(copy.supervisionHidden, true, 'duplicate supervision line is hidden');
    assert.equal(copy.noteHidden, true, 'duplicate Level 6 note is hidden');
  });
});

test('final FTHUE Level 2–7 movement wording is consistent', async (t) => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(VIEWPORTS[1], async (page) => {
    const copy = await page.evaluate(() => ({
      headings: [...document.querySelectorAll('.level-card h3')].map(el => el.textContent.trim()),
      clinical: [...document.querySelectorAll('.level-card .lv-clinical')].map(el => el.textContent.trim()),
      level2: window.SAFETY_LEVEL_NOTES?.['2'] || '',
      level3: window.SAFETY_LEVEL_NOTES?.['3'] || '',
      level4: window.SAFETY_LEVEL_NOTES?.['4'] || '',
      level5: window.SAFETY_LEVEL_NOTES?.['5'] || '',
      level67: window.SAFETY_LEVEL_NOTES?.['67'] || '',
    }));

    // v102：卡片 h3 改為港式神功名稱；臨床名稱移到 .lv-clinical（Level 2 卡片收埋但仍在 DOM）
    assert.deepEqual(copy.headings, [
      '桌面承托訓練',
      '佛光初現',
      '大鵬展翅',
      '如來神掌',
      '萬佛朝宗',
    ]);
    assert.deepEqual(copy.clinical, [
      '膊頭屈曲 30–60°',
      '膊頭屈曲 60° 或以上',
    ]);
    assert.match(copy.level2, /手臂放桌面/);
    assert.match(copy.level2, /肩、肘、腕及路徑入鏡/);
    assert.match(copy.level3, /患臂離桌/);
    assert.match(copy.level3, /軀幹及全臂入鏡/);
    assert.match(copy.level4, /患臂離桌/);
    assert.match(copy.level4, /軀幹及全臂入鏡/);
    assert.match(copy.level5, /伸手、輕合、張手/);
    assert.match(copy.level67, /患手三指張開、輕捏拿起、移動，再張開放下/);
    assert.doesNotMatch(copy.level67, /量角器|60–120|角度|肩|肘|抬高手臂/);
  });
});

for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  test(`Level 4 hands-free calibration panel is usable and unclipped — ${vp.name}`, async (t) => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(vp, async (page) => {
      await page.evaluate(() => {
        // Stage the visible countdown state without depending on the app's
        // IIFE-private QA variables. The click/state contract is covered by
        // level4-auto-calibration.test.mjs; this test is specifically the
        // responsive patient-facing layout at its densest state.
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        document.getElementById('screen-game').classList.add('active');
        document.getElementById('level4CalibBar').classList.add('show');
        document.getElementById('level4AutoProgress').hidden = false;
        document.getElementById('level4AutoProgress').textContent = '請等候 3 秒 · 治療師請退後，病人保持承托屈肘';
        document.getElementById('btnLevel4AutoCancel').hidden = false;
      });
      const view = await page.evaluate(() => {
        const r = id => { const x=document.getElementById(id).getBoundingClientRect(); return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}; };
        const bar=r('level4CalibBar'); const stage=document.querySelector('.game-stage').getBoundingClientRect();
        const details=document.querySelector('[data-testid="details-level4-therapist"]');
        return {
          bar, stage, auto:r('btnLevel4AutoCancel'), progress:r('level4AutoProgress'),
          readings:[...document.querySelectorAll('.level4-reading')].filter(card => getComputedStyle(card).display !== 'none').map(card => {
            const x = card.getBoundingClientRect();
            return {left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height};
          }),
          progressText:document.getElementById('level4AutoProgress').textContent.trim(),
          detailsOpen:details.open, cancelHidden:document.getElementById('btnLevel4AutoCancel').hidden,
          xOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      assert.ok(view.bar.width > 0 && view.bar.left >= view.stage.left && view.bar.right <= view.stage.right + .5);
      assert.ok(view.auto.height >= 44, 'large cancel touch target while automatic calibration runs');
      assert.ok(view.progress.height >= 36 && /請等候/.test(view.progressText), 'plain withdrawal countdown is visible');
      assert.equal(view.readings.length, 2, 'generic/unselected Level 4 hides path-only horizontal reading'); assert.ok(view.readings.every(x=>x.height >= 38));
      assert.equal(view.detailsOpen, false); assert.equal(view.cancelHidden, false); assert.equal(view.xOverflow, false);
    });
  });
}

for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  test(`public Level 5 choices are separated and inside the canvas — ${vp.name}`, async (t) => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(vp, async (page) => {
      const layouts=await page.evaluate(
        ({width,height})=>window.__qa.level5LayoutProbe(width,height),vp
      );

      const inside=box=>box.left>=-.5 && box.top>=-.5
        && box.right<=layouts.width+.5 && box.bottom<=layouts.height+.5;
      const assertSeparated=(boxes,label)=>{
        assert.ok(boxes.every(inside),`${label} choices stay inside canvas`);
        for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++)
          assert.equal(overlaps(boxes[i],boxes[j]),false,`${label} ${i}/${j} must not overlap`);
      };
      assertSeparated(layouts.cardBoxes,'cards');
      assertSeparated(layouts.mahjongBoxes,'Mahjong');
      assertSeparated(layouts.steamerBoxes,'steamers');
      assertSeparated(layouts.laundryBoxes,'laundry baskets');
    });
  });
}
