import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

let browser;

before(async () => {
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  } catch (error) {
    browser = null;
    console.warn('playwright unavailable; Level 5 tracking tests skipped:', error.message);
  }
});

after(async () => { if (browser) await browser.close(); });

async function withPage(fn) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  try {
    await fn(page);
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    await context.close();
  }
}

test('Level 5 selects both anatomical sides correctly from the raw unmirrored camera frame', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const selection = await page.evaluate(() => {
      const point = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      const both = {
        landmarks: [point(), point()],
        handednesses: [
          [{ categoryName: 'Right', score: 0.99 }],
          [{ categoryName: 'Left', score: 0.72 }],
        ],
      };
      return {
        left: window.__qa.gestureProbe.affectedHand(both, 'left'),
        right: window.__qa.gestureProbe.affectedHand(both, 'right'),
      };
    });

    assert.deepEqual(selection.left, { index: 1, anatomical: 'left' });
    assert.deepEqual(selection.right, { index: 0, anatomical: 'right' });
  });
});

test('Level 5 converts handedness only when inference pixels are actually mirrored', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const selection = await page.evaluate(() => {
      const point = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      const mirroredPixels = {
        landmarks: [point(), point()],
        handedness: [
          // A mirrored anatomical right hand appears left to the model, and
          // a mirrored anatomical left hand appears right.
          [{ categoryName: 'Left', score: 0.99 }],
          [{ categoryName: 'Right', score: 0.72 }],
        ],
      };
      return {
        left: window.__qa.gestureProbe.affectedHand(mirroredPixels, 'left', true),
        right: window.__qa.gestureProbe.affectedHand(mirroredPixels, 'right', true),
      };
    });

    assert.deepEqual(selection.left, { index: 1, anatomical: 'left' });
    assert.deepEqual(selection.right, { index: 0, anatomical: 'right' });
  });
});

test('Level 5 selected-side admission fails closed without matching handedness', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const selection = await page.evaluate(() => {
      const point = () => Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      return {
        missing: window.__qa.gestureProbe.affectedHand({ landmarks: [point()] }, 'left'),
        oppositeOnly: window.__qa.gestureProbe.affectedHand({
          landmarks: [point()],
          handednesses: [[{ categoryName: 'Right', score: 0.99 }]],
        }, 'left'),
      };
    });

    assert.deepEqual(selection.missing, { index: -1, anatomical: null });
    assert.deepEqual(selection.oppositeOnly, { index: -1, anatomical: null });
  });
});

test('Level 5 visible two-finger curl and reopen survive a perspective-shifted calibrated score', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const result = await page.evaluate(() => ({
      // An unrealistically high personal enter threshold reproduces the aggregate
      // score shift that used to override two visibly curled fingers.
      enter: window.__qa.gestureProbe.grasp(
        [0.6, 0.6, 1, 1, 1], false, 'any', { enter: 0.99, exit: 0.01 },
      ),
      // A very low personal exit threshold reproduces a foreshortened palm score
      // that remains "closed" despite two visibly reopened major fingers.
      release: window.__qa.gestureProbe.grasp(
        [0.82, 1, 1, 0.82, 0.82], true, 'any', { enter: 0.99, exit: 0.01 },
      ),
    }));

    assert.equal(result.enter.isGrasping, true);
    assert.ok(result.enter.curledCount >= 2);
    assert.equal(result.release.isGrasping, false);
    assert.ok(result.release.openCount >= 2);
  });
});

test('Level 5 accepts a small two-finger close and a small reopen without a full fist', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const result = await page.evaluate(() => ({
      close: window.__qa.gestureProbe.grasp(
        [0.80, 0.80, 1, 1, 1], false, 'any',
      ),
      reopen: window.__qa.gestureProbe.grasp(
        [0.84, 0.84, 1, 1, 1], true, 'any',
      ),
    }));
    assert.equal(result.close.isGrasping, true,
      'a modest affected-finger curl enters grasp');
    assert.equal(result.reopen.isGrasping, false,
      'a modest affected-finger reopen releases grasp');
  });
});

test('Level 5 tracking grace preserves the held object but cannot finish stale release dwell', async t => {
  if (!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const result = await page.evaluate(() => {
      window.__qa.startGame({
        level: '5', theme: 'dimsum', affectedSide: 'right', duration: 60,
      });
      const initial = window.__qa.state();
      const item = initial.items[0];
      const target = initial.targets.find(candidate => candidate.type === item.type);

      window.__qa.snapCursor();
      window.__qa.setHandAt(item.x, item.y, false, true);
      window.advanceTime(420);
      window.__qa.setHandAt(item.x, item.y, true, false);
      window.advanceTime(700);
      const acquired = window.__qa.state();

      window.__qa.snapCursor();
      window.__qa.setHandAt(target.x, target.y, true, false);
      window.advanceTime(100);
      window.__qa.setHandAt(target.x, target.y, false, true);
      window.advanceTime(100);
      window.__qa.clearHand();
      window.advanceTime(700);
      const duringGrace = window.__qa.state();

      window.__qa.setHandAt(target.x, target.y, false, true);
      window.advanceTime(700);
      const afterFreshRelease = window.__qa.state();
      return { acquired, duringGrace, afterFreshRelease };
    });

    assert.notEqual(result.acquired.held, null, 'fresh prepared grasp acquires an item');
    assert.equal(result.duringGrace.detectionHeldGrace, true);
    assert.notEqual(result.duringGrace.held, null, 'stale open state cannot drop the object');
    assert.equal(result.afterFreshRelease.held, null, 'fresh reopen can complete release');
    assert.equal(result.afterFreshRelease.correctCount, 1);
  });
});
