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
    console.warn('playwright unavailable; Level 6 interaction tests skipped:', error.message);
  }
});

after(async () => { if (browser) await browser.close(); });

async function withPage(viewport, fn) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', error => { throw error; });
  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));
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

// Every normal-flow Level 6 activity uses the same selected-hand tripod pinch.
const LEVEL6_TASKS = [
  { task: 'flowers', theme: 'flowers', name: 'Flower Arranging', gameType: 'pinch' },
  { task: 'chopsticks', theme: 'chopstick_dimsum', name: 'Chopstick Dim Sum', gameType: 'pinch' },
  { task: 'peg', theme: 'peg_laundry', name: 'Cloth-Peg Laundry', gameType: 'pinch' },
  { task: 'cards', theme: 'cards', name: 'Playing Cards', gameType: 'pinch' },
  { task: 'mahjong', theme: 'mahjong', name: 'Mahjong', gameType: 'pinch' },
  { task: 'cooking', theme: 'cooking', name: 'Cook Egg Fried Rice', gameType: 'pinch' },
];

for (const { task, theme, name, gameType } of LEVEL6_TASKS) {
  test(`Level 6 ${name} task starts on the correct theme and interaction type`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage({ width: 1180, height: 820 }, async page => {
      const result = await page.evaluate((taskId) => {
        window.__qa.startGame({ level: '67', level6Task: taskId, shoulderTargetDeg: 90, duration: 60 });
        return {
          state: window.__qa.state(),
          gameType: window.__qa.state().gameType,
        };
      }, task);
      assert.equal(result.state.level, '67');
      assert.equal(result.state.theme, theme, 'selecting the task syncs the matching theme');
      assert.equal(result.gameType, gameType);
    });
  });
}

test('Level 6 has no shoulder-flexion target dependency', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    const applied = await page.evaluate(() => {
      const out = [];
      for (const deg of [50, 60, 70, 80, 90, 100, 110, 120, 130]) {
        window.__qa.startGame({ level: '67', level6Task: 'chopsticks', shoulderTargetDeg: deg, duration: 60 });
        out.push({
          gameType: window.__qa.state().gameType,
          shoulderGameReady: window.__qa.shoulderFlexionState().gameReady,
        });
      }
      return out;
    });
    assert.ok(applied.every(value => value.gameType === 'pinch'));
    assert.ok(applied.every(value => value.shoulderGameReady === false),
      'Level 6 does not initialize or wait for the shoulder controller');
  });
});

test('Level 6 setup hides the complete angle panel while Levels 3 and 4 retain it', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 820, height: 1180 }, async page => {
    const result = await page.evaluate(() => {
      const inspect = (level) => {
        window.__qa.selectLevel(level);
        window.__qa.selectActivity(level === '67' ? 'flowers' : 'dimsum');
        const card = document.getElementById('shoulderTargetCard');
        const values = [...document.querySelectorAll('#shoulderTargetOptions [data-shoulder-target]')]
          .map(button => Number(button.dataset.shoulderTarget));
        return {
          hidden: card.hidden,
          visible: !card.hidden && getComputedStyle(card).display !== 'none',
          values,
          visibleSetupText: document.getElementById('screen-start').innerText,
        };
      };
      return { level3: inspect('3'), level4: inspect('4'), level6: inspect('67') };
    });
    assert.equal(result.level3.visible, true);
    assert.deepEqual(result.level3.values, [30, 40, 50, 60]);
    assert.equal(result.level4.visible, true);
    assert.deepEqual(result.level4.values, [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180]);
    assert.equal(result.level6.hidden, true);
    assert.doesNotMatch(result.level6.visibleSetupText, /量角器|goniometer|60°|120°/i);
  });
});

test('Level 6 chopstick task renders chopsticks, dim sum and a rice bowl target', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    const layout = await page.evaluate(() => {
      window.__qa.startGame({ level: '67', level6Task: 'chopsticks', shoulderTargetDeg: 90, duration: 60 });
      return window.__qa.level67Layout();
    });
    assert.equal(layout.level, '67');
    assert.equal(layout.theme, 'chopstick_dimsum');
    assert.ok(layout.targets.length >= 1, 'the rice-bowl target is present');
    assert.ok(layout.items.length >= 1, 'a dim-sum item is present');
    assert.equal(layout.insideCanvas, true, 'target and item stay inside the canvas');
  });
});

test('Level 6 peg task renders the laundry theme and a drying-line target', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    const layout = await page.evaluate(() => {
      window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60 });
      return window.__qa.level67Layout();
    });
    assert.equal(layout.level, '67');
    assert.equal(layout.theme, 'peg_laundry');
    assert.ok(layout.targets.length >= 1, 'the drying-line target is present');
    assert.ok(layout.items.length >= 1, 'a garment item is present');
    assert.equal(layout.insideCanvas, true, 'target and item stay inside the canvas');
  });
});

test('Level 6 offers the four restored activities plus two replacements, without legacy duplicates', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    const themes = await page.evaluate(() => {
      window.__qa.startGame({ level: '67', level6Task: 'chopsticks', shoulderTargetDeg: 90, duration: 60 });
      return window.__qa.availableActivityThemes('67');
    });
    assert.deepEqual(themes, ['flowers', 'chopstick_dimsum', 'peg_laundry', 'cards', 'mahjong', 'cooking'],
      'the activity library offers the exact restored Level 6 order');
    assert.ok(!themes.includes('dimsum'), 'the legacy dim-sum theme stays replaced');
    assert.ok(!themes.includes('laundry'), 'the legacy laundry theme stays replaced');

    assert.equal(await page.locator('#level67ToolCard').count(), 0,
      'the duplicate setup task-selector card is removed');
    assert.equal(await page.locator('#screen-start [data-level6-task]').count(), 0,
      'setup contains no hidden or visible Level 6 task buttons');
    assert.equal(await page.locator('#screen-start').getByText('任務', { exact: true }).count(), 0,
      'setup contains no duplicate task summary');
  });
});

for (const language of ['zh-Hant', 'en']) {
  for (const { task, theme, name, gameType } of LEVEL6_TASKS) {
    test(`Level 6 ${name} library card stays locked through setup, calibration and launch — ${language}`, async t => {
      if (!browser) return t.skip('playwright unavailable');
      await withPage({ width: 820, height: 1180 }, async page => {
        await page.evaluate(lang => window.YCHLanguage.setLanguage(lang), language);
        await page.evaluate(() => window.__qa.selectLevel('67'));
        await page.locator(`#activityGrid [data-theme="${theme}"]`).click();
        await page.waitForSelector('#screen-start.active');
        if (language === 'en') {
          await page.waitForFunction(expected =>
            document.getElementById('settingsTitle')?.textContent.trim() === expected, name);
        }

        const setup = await page.evaluate(() => ({
          title: document.getElementById('settingsTitle').textContent.trim(),
          instructions: document.getElementById('settingsContext').textContent.trim(),
          state: window.__qa.state(),
          taskCard: document.getElementById('level67ToolCard'),
          taskButtons: document.querySelectorAll('#screen-start [data-level6-task]').length,
        }));
        assert.equal(setup.state.level6Task, task);
        assert.equal(setup.state.theme, theme);
        assert.equal(setup.state.level6LockedTheme, theme);
        assert.equal(setup.taskCard, null);
        assert.equal(setup.taskButtons, 0);
        assert.match(setup.title, language === 'en' ? new RegExp(name, 'i') : /\S/);
        assert.match(setup.instructions, language === 'en' ? new RegExp(name, 'i') : new RegExp(setup.title));
        assert.doesNotMatch(setup.instructions,
          language === 'en' ? /shoulder|elbow|raise the arm/i : /肩屈曲|手肘|抬高手臂/,
          'normal Level 6 setup contains tripod-pinch instructions only');

        await page.locator('[data-side="right"]').click();
        const afterSide = await page.evaluate(() => window.__qa.state());
        assert.equal(afterSide.level6Task, task, 'affected-side selection cannot change the task');
        assert.equal(afterSide.theme, theme);

        await page.evaluate(() => window.__qa.showScreen('calib'));
        const inCalibration = await page.evaluate(() => window.__qa.state());
        assert.equal(inCalibration.level6Task, task);
        assert.equal(inCalibration.theme, theme);
        await page.locator('#btnBackFromCalib').click();
        assert.equal(await page.locator('#screen-start.active').count(), 1);
        const afterCalibrationBack = await page.evaluate(() => window.__qa.state());
        assert.equal(afterCalibrationBack.level6Task, task);
        assert.equal(afterCalibrationBack.theme, theme);

        await page.locator('#btnBackToLibrary').click();
        await page.locator(`#activityGrid [data-theme="${theme}"]`).click();
        const afterReentry = await page.evaluate(() => window.__qa.state());
        assert.equal(afterReentry.level6Task, task, 'back/re-enter keeps the card-selected task');
        assert.equal(afterReentry.level6LockedTheme, theme);

        const launched = await page.evaluate(() => {
          window.__qa.startGame({ duration: 60, affectedSide: 'right' });
          return window.__qa.state();
        });
        assert.equal(launched.screen, 'game');
        assert.equal(launched.level6Task, task);
        assert.equal(launched.theme, theme, 'game launches the same locked activity');
        assert.equal(launched.level6LockedTheme, theme);
        assert.equal(launched.gameType, gameType);
      });
    });
  }
}

test('difficulty labels are absent from every activity card in Traditional Chinese and English across levels', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    for (const language of ['zh-Hant', 'en']) {
      await page.evaluate(lang => window.YCHLanguage.setLanguage(lang), language);
      for (const level of ['2', '3', '4', '5', '67']) {
        await page.evaluate(levelId => window.__qa.selectLevel(levelId), level);
        const cards = page.locator('#activityGrid .activity-card');
        assert.ok(await cards.count() > 0, `Level ${level} has activity cards`);
        assert.equal(await cards.locator('.ac-meta').count(), 0, `Level ${level} renders no difficulty metadata node`);
        const rendered = await cards.evaluateAll(nodes => nodes.map(node => ({
          text: node.textContent,
          aria: node.getAttribute('aria-label'),
        })));
        for (const card of rendered) {
          assert.doesNotMatch(card.text, /難度|Difficulty/i);
          assert.doesNotMatch(card.aria || '', /難度|Difficulty/i);
        }
      }
    }
  });
});

async function runToolGestureFlow(page, task) {
  return page.evaluate((taskId) => {
    const frame = (gesture, count, extra = {}) => {
      let value;
      for (let index = 0; index < count; index++) {
        value = window.__qa.setLevel6ToolFrame({
          gesture, stepMs: 120, poseMissing:['shoulder','elbow','wrist'], ...extra,
        });
      }
      return value;
    };
    window.__qa.startGame({
      level: '67', level6Task: taskId, shoulderTargetDeg: 90,
      duration: 60, affectedSide: 'right',
    });
    const layout = window.__qa.level67Layout();
    // v69/v71: the chopstick and peg tasks are order-driven — every item goes to
    // the single central target (big plate / drying rack), and only types still
    // needed by the current order score.
    const orderInfo = layout.dimsumOrder
      ? { lines: layout.dimsumOrder.lines, targetType: 'dimsum_plate' }
      : (layout.laundryOrder
        ? { lines: layout.laundryOrder.lines, targetType: 'laundry_rack' }
        : null);
    const neededTypes = orderInfo
      ? orderInfo.lines.filter(l => l.placed < l.need).map(l => l.type)
      : null;
    const pair = layout.items.map(item => ({
      item,
      target: neededTypes
        ? (neededTypes.includes(item.type)
          ? layout.targets.find(value => value.type === orderInfo.targetType)
          : null)
        : layout.targets.find(value => value.type === item.type),
    })).find(value => value.target);
    if (!pair) throw new Error('Level 6 layout has no item matching a visible target');
    const { item, target } = pair;
    const at = point => ({ nx: point.x / layout.canvas.width, ny: point.y / layout.canvas.height });
    frame('open', 5, at(item));
    const prepared = window.__qa.level6ToolState();
    frame('closed', 5, { ...at(item), apertures:{ index:.10, middle:.15 } });
    const pickedUp = window.__qa.level6ToolState();
    frame('closed', 30, { ...at(target), apertures:{ index:.10, middle:.15 } });
    const transported = window.__qa.level6ToolState();
    frame('open', 8, at(target));
    const released = window.__qa.level6ToolState();
    return { prepared, pickedUp, transported, released, target };
  }, task);
}

for (const { task } of LEVEL6_TASKS) {
  test(`Level 6 ${task} requires open → light asymmetric tripod close → hand transport → reopen`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage({ width: 1180, height: 820 }, async page => {
      const result = await runToolGestureFlow(page, task);
      assert.equal(result.prepared.handOpenPrep, true, 'positive open preparation is observed');
      assert.equal(result.pickedUp.grabCount, 1, 'confirmed closure picks up exactly once');
      assert.ok(result.pickedUp.held, 'an item is held after closure');
      assert.ok(Math.hypot(
        result.transported.heldPosition.x - result.target.x,
        result.transported.heldPosition.y - result.target.y,
      ) < 90, 'selected hand position transports the held item to the target');
      assert.equal(result.transported.shoulder.gameReady, false,
        'missing shoulder/elbow/wrist pose cannot block selected-hand transport');
      assert.equal(result.released.held, null, 'confirmed reopening releases the item');
      assert.equal(result.released.correctCount, 1, 'valid target release scores once');
    });
  });

  test(`Level 6 ${task} rejects wrong-hand, stale-frame, partial-landmark, and static-grasp input`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage({ width: 1180, height: 820 }, async page => {
      const result = await page.evaluate((taskId) => {
        const frame = (gesture, count, extra = {}) => {
          let value;
          for (let index = 0; index < count; index++) {
            value = window.__qa.setLevel6ToolFrame({
              gesture, stepMs: 120, ...extra,
            });
          }
          return value;
        };
        const start = () => window.__qa.startGame({
          level: '67', level6Task: taskId, shoulderTargetDeg: 90,
          duration: 60, affectedSide: 'right',
        });

        start();
        frame('open', 5);
        const generation = window.__qa.level6ToolState().frameGeneration;
        frame('closed', 6, { generation });
        const stale = window.__qa.level6ToolState();

        start();
        frame('open', 5);
        frame('closed', 6, { handSide: 'left' });
        const wrongHand = window.__qa.level6ToolState();

        start();
        frame('open', 5);
        frame('closed', 6, { missingHand: [12] });
        const partial = window.__qa.level6ToolState();

        start();
        frame('closed', 24);
        const staticClosed = window.__qa.level6ToolState();
        start();
        frame('open', 5);
        frame('closed', 6, { handSide:'missing' });
        const missingHandedness = window.__qa.level6ToolState();
        start();
        frame('open', 5);
        frame('closed', 6, { handednessConfidence:.30 });
        const uncertainHandedness = window.__qa.level6ToolState();
        return { stale, wrongHand, partial, staticClosed, missingHandedness, uncertainHandedness };
      }, task);

      for (const [name, state] of Object.entries(result)) {
        assert.equal(state.held, null, `${name} cannot pick up an item`);
        assert.equal(state.grabCount, 0, `${name} remains idempotent/fail-closed`);
      }
      assert.equal(result.stale.handDetected, false, 'duplicate generation is rejected as stale');
      assert.equal(result.wrongHand.handDetected, false, 'opposite hand cannot substitute for the selected affected hand');
      assert.equal(result.partial.handDetected, false, 'missing required landmarks fail closed');
      assert.equal(result.staticClosed.handOpenPrep, false, 'static grasp never creates an open preparation');
      assert.equal(result.missingHandedness.handDetected, false, 'missing handedness fails closed');
      assert.equal(result.uncertainHandedness.handDetected, false, 'uncertain handedness fails closed');
    });
  });
}

for (const viewport of [
  { width: 1180, height: 820, name: 'iPad landscape' },
  { width: 820, height: 1180, name: 'iPad portrait' },
  { width: 390, height: 844, name: 'compact portrait cap' },
]) {
  test(`Level 6 chopstick dim-sum layout remains clear — ${viewport.name}`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(viewport, async page => {
      const layout = await page.evaluate(() => {
        window.__qa.startGame({ level: '67', level6Task: 'chopsticks', shoulderTargetDeg: 90, duration: 60 });
        return window.__qa.level67Layout();
      });
      assert.equal(layout.insideCanvas, true, 'every target and item stays inside the canvas');
      assert.equal(layout.targetsDoNotOverlap, true, 'targets do not overlap');
    });
  });

  test(`Level 6 cloth-peg laundry layout remains clear — ${viewport.name}`, async t => {
    if (!browser) return t.skip('playwright unavailable');
    await withPage(viewport, async page => {
      const layout = await page.evaluate(() => {
        window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60 });
        return window.__qa.level67Layout();
      });
      assert.equal(layout.insideCanvas, true, 'every target and item stays inside the canvas');
      assert.equal(layout.targetsDoNotOverlap, true, 'targets do not overlap');
    });
  });
}

test('Home clears safety overlays and result runtime, while Stop remains available', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage({ width: 1180, height: 820 }, async page => {
    await page.evaluate(() => {
      window.__qa.startGame({ level: '67', level6Task: 'chopsticks', shoulderTargetDeg: 90, duration: 60 });
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
      window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60 });
      showSafetyPause('Test safety hold', 'Home must remain actionable here too.');
    });
    await page.locator('#btnSafetyPauseHome').click();
    assert.equal(await page.evaluate(() => window.__qa.state().screen), 'level');
  });
});
