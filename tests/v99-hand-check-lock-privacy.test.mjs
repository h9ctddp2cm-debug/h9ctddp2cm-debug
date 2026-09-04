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

test('v99 hand lock constants and public-only scope', () => {
  assert.match(html, /const HAND_LOCK_SIZE_MIN_RATIO = 0\.55;/);
  assert.match(html, /const HAND_LOCK_SIZE_MAX_RATIO = 1\.90;/);
  assert.match(html, /const HAND_LOCK_FAR_DIST = 0\.30;/);
  assert.match(html, /const HAND_LOCK_REACQUIRE_MS = 400;/);
  assert.match(html, /const HAND_LOCK_SIZE_FORGET_MS = 3000;/);
  assert.match(functionSource('handLockEnabled'), /affectedHandContinuityEnabled\(\)/);
  assert.match(functionSource('handednessCheckOff'), /handLockEnabled\(\) && state\.handednessCheck === false/);
  // Default ON on every page load.
  assert.match(html, /\n  handednessCheck: true,/);
  // Camera start/stop clears the lock; a new round keeps it.
  assert.match(functionSource('waitForLiveCameraFrame'), /resetHandAdmissionAndLock\(\);/);
  assert.match(functionSource('startCamera'), /waitForLiveCameraFrame\(videoEl\)/);
  assert.match(functionSource('stopCamera'), /resetHandAdmissionAndLock\(\);/);
  assert.match(functionSource('initGame'), /resetHandFrameAdmission\(\);/);
  assert.doesNotMatch(functionSource('initGame'), /resetHandAdmissionAndLock\(\);/);
});

test('v99 handedness-check switch lives in the affected-side card and is Level 5/6 only', () => {
  assert.match(html, /id="handCheckBlock" hidden/);
  assert.match(html, /data-testid="button-handcheck-on"/);
  assert.match(html, /data-testid="button-handcheck-off"/);
  assert.match(functionSource('handCheckSettingAvailable'), /state\.level === '5' \|\| state\.level === '67'/);
  assert.match(functionSource('renderHandCheckSettings'), /block\.hidden = !handCheckSettingAvailable\(\);/);
});

test('v99 calibration privacy blur is canvas-based and default on', () => {
  assert.match(html, /\n  privacyBlur:true,/);
  assert.match(html, /id="btnPrivacyBlur"/);
  assert.match(html, /\.calib-wrap\.privacy-blur video\{ opacity:0; \}/);
  assert.match(html, /const PRIVACY_BLUR_SMALL_W = 40;/);
  const blur = functionSource('drawPrivacyBlurredVideo');
  assert.match(blur, /sctx\.drawImage\(video, 0, 0, sw, sh\);/);
  assert.match(blur, /if\(state\.mirrorX\)\{ ctx\.translate\(rectW, 0\); ctx\.scale\(-1, 1\); \}/);
  const win = functionSource('drawPrivacySharpWindow');
  assert.match(win, /ctx\.clip\(\);/);
  assert.match(win, /const u = state\.mirrorX \? \(1 - p\.x\) : p\.x;/);
  const loop = functionSource('startCalibLoop');
  assert.match(loop, /if\(privacyOn\) drawPrivacyBlurredVideo\(ctx, video, rectW, rectH\);/);
  assert.match(loop, /drawPrivacySharpWindow\(ctx, video, rectW, rectH, privacyWindowPts\);/);
  // Pose levels use only the affected shoulder/elbow/wrist as the hand window / seed.
  assert.match(loop, /privacyWindowPts = \[res\.lm\[left \? 11 : 12\], res\.lm\[left \? 13 : 14\], res\.lm\[left \? 15 : 16\]\];/);
  // v100: person segmentation keeps the participant sharp; see tests/v100-privacy-person-mask.test.mjs.
  assert.match(loop, /drawPrivacyPersonLayer\(ctx, video, rectW, rectH\);/);
});

/* ---------- browser behaviour ---------- */

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    browser = null;
    console.warn('playwright unavailable; v99 tests skipped:', error.message);
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

// Hands carry a wrist->middle-MCP span so the size gate can be exercised.
const probeScript = `
  window.__p = (() => {
    const point = (x=0.5, y=0.5, span=0.12) => {
      const lm = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
      lm[9] = { x, y: y + span, z: 0 };
      lm[5] = { x: x + span * 0.3, y: y + span * 0.9, z: 0 };
      return lm;
    };
    const hand = (label, score, x=0.5, y=0.5, span=0.12) => ({
      lm: point(x, y, span),
      hd: label === null ? [] : [{ categoryName: label, score }],
    });
    const results = (...hands) => ({
      landmarks: hands.map(h => h.lm),
      handednesses: hands.map(h => h.hd),
    });
    return { point, hand, results,
      pick: (res, side) => window.__qa.gestureProbe.affectedHand(res, side).index,
      diag: () => window.__qa.handLock() };
  })();
`;

test('v99 setup: the handedness switch is visible for Level 5 and 6 only and defaults to ON', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const visibility = await page.evaluate(() => {
      const out = {};
      const themes = { '3': 'dimsum', '4': 'dimsum', '5': 'dimsum', '67': 'flowers' };
      for(const level of ['3', '4', '5', '67']){
        window.__qa.selectLevel(level);
        window.__qa.selectActivity(themes[level]);
        out[level] = !document.getElementById('handCheckBlock').hidden;
      }
      return out;
    });
    assert.deepEqual(visibility, { '3': false, '4': false, '5': true, '67': true });
    await page.evaluate(() => { window.__qa.selectLevel('5'); window.__qa.selectActivity('dimsum'); });
    assert.equal(await page.getAttribute('[data-testid="button-handcheck-on"]', 'aria-pressed'), 'true');
    await page.click('[data-testid="button-handcheck-off"]');
    assert.equal(await page.getAttribute('[data-testid="button-handcheck-off"]', 'aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__qa.state().handednessCheck), false);
    const note = await page.textContent('[data-testid="text-handcheck-note"]');
    assert.match(note, /治療師在旁監督/);
    await page.click('[data-testid="button-handcheck-on"]');
    assert.equal(await page.evaluate(() => window.__qa.state().handednessCheck), true);
  });
});

test('v99 check OFF admits a confidently opposite-labelled hand at once, and keeps following the locked hand', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left', handednessCheck: false }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick, diag } = window.__p;
      const out = {};
      out.oppositeAlone = pick(results(hand('Right', 0.99, 0.3, 0.5)), 'left');
      out.pathAfterFirst = diag().diag.path;
      out.check = diag().diag.check;
      // A second hand enters far away with a confident "Left" label: the locked
      // hand at (0.3,0.5) is still the one followed.
      window.advanceTime(100);
      out.withIntruder = pick(results(hand('Right', 0.99, 0.31, 0.5), hand('Left', 0.99, 0.85, 0.5)), 'left');
      // Locked hand leaves; the far intruder is alone but far from the lock and
      // the track is still fresh -> nearest-to-track fails, lone admits.
      window.advanceTime(100);
      out.intruderAlone = pick(results(hand('Left', 0.99, 0.85, 0.5)), 'left');
      return out;
    });
    assert.equal(r.oppositeAlone, 0);
    assert.equal(r.pathAfterFirst, 'lone');
    assert.equal(r.check, 'off');
    assert.equal(r.withIntruder, 0);
    assert.equal(r.intruderAlone, 0);
  });
});

test('v99 check ON: a strict-labelled hand far from the tracked hand does not steal the cursor while the tracked hand is still there', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick, diag } = window.__p;
      const out = {};
      out.first = pick(results(hand('Left', 0.95, 0.4, 0.5)), 'left');
      window.advanceTime(100);
      // Label flips to ambiguous on the tracked hand while a passer-by's hand
      // with a confident Left label appears on the far side.
      out.keepNear = pick(results(hand('Right', 0.60, 0.41, 0.5), hand('Left', 0.97, 0.9, 0.2)), 'left');
      out.path = diag().diag.path;
      window.advanceTime(100);
      // Same again with the tracked hand still labelled Left but weaker: strict
      // picks the stronger far hand, the lock overrides back to the near one.
      out.keepNearWeaker = pick(results(hand('Left', 0.60, 0.42, 0.5), hand('Left', 0.97, 0.9, 0.2)), 'left');
      // v98 behaviour preserved: a confidently opposite near hand is not kept.
      window.advanceTime(100);
      out.confidentOppositeNear = pick(results(hand('Right', 0.95, 0.42, 0.5), hand('Left', 0.97, 0.9, 0.2)), 'left');
      return out;
    });
    assert.equal(r.first, 0);
    assert.equal(r.keepNear, 0);
    assert.equal(r.path, 'continuity');
    assert.equal(r.keepNearWeaker, 0);
    assert.equal(r.confidentOppositeNear, 1);
  });
});

test('v99 size gate rejects a much smaller background hand and forgets the size after 3 s without any admissible hand', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick, diag } = window.__p;
      const out = {};
      // Establish the lock size (span 0.12) over a few frames.
      for(let i = 0; i < 5; i++){ pick(results(hand('Left', 0.95, 0.4, 0.5, 0.12)), 'left'); window.advanceTime(50); }
      out.lockSize = diag().size;
      // Patient hand gone; a tiny far-away hand (span 0.03 = 25 %) with a
      // perfect Left label must not be admitted.
      window.advanceTime(1600);
      out.tinyAlone = pick(results(hand('Left', 0.99, 0.8, 0.2, 0.03)), 'left');
      out.tinyPath = diag().diag.path;
      // A hand of comparable size at the old place is admitted.
      out.normalBack = pick(results(hand('Left', 0.9, 0.42, 0.5, 0.11)), 'left');
      // Only tiny hands for 3 s -> size forgotten, then admitted (lone).
      window.advanceTime(1600);
      for(let tms = 0; tms <= 3200; tms += 400){
        out.lastTiny = pick(results(hand('Left', 0.99, 0.8, 0.2, 0.03)), 'left');
        out.lastTinyPath = diag().diag.path;
        window.advanceTime(400);
      }
      // The size is forgotten at 3 s, but the hand is far from the lock, so the
      // 400 ms re-acquisition debounce still applies once before admission.
      out.tinyAfterDebounce = pick(results(hand('Left', 0.99, 0.8, 0.2, 0.03)), 'left');
      return out;
    });
    assert.ok(Math.abs(r.lockSize - 0.12) < 0.01, `lock size ${r.lockSize}`);
    assert.equal(r.tinyAlone, -1);
    assert.equal(r.tinyPath, 'size');
    assert.equal(r.normalBack, 0);
    assert.equal(r.lastTiny, -1);
    assert.equal(r.lastTinyPath, 'far');
    assert.equal(r.tinyAfterDebounce, 0);
  });
});

test('v99 re-acquisition: after the tracked hand is lost, a hand far from the lock must persist 400 ms; near the lock it is immediate', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const r = await page.evaluate(() => {
      const { hand, results, pick, diag } = window.__p;
      const out = {};
      pick(results(hand('Left', 0.95, 0.4, 0.5)), 'left');
      window.advanceTime(2000);   // track stale, lock still remembered
      out.farFirst = pick(results(hand('Left', 0.95, 0.9, 0.9)), 'left');
      out.farPath = diag().diag.path;
      window.advanceTime(200);
      out.farAt200 = pick(results(hand('Left', 0.95, 0.9, 0.9)), 'left');
      window.advanceTime(250);
      out.farAt450 = pick(results(hand('Left', 0.95, 0.9, 0.9)), 'left');
      // Lost again; re-appearing near the lock is admitted on the first frame.
      window.advanceTime(2000);
      out.nearFirst = pick(results(hand('Left', 0.95, 0.88, 0.9)), 'left');
      return out;
    });
    assert.equal(r.farFirst, -1);
    assert.equal(r.farPath, 'far');
    assert.equal(r.farAt200, -1);
    assert.equal(r.farAt450, 0);
    assert.equal(r.nearFirst, 0);
  });
});

test('v99 lock survives a new round and is cleared by the QA reset; research strata stay strict', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' }));
    await page.evaluate(probeScript);
    const afterRound = await page.evaluate(() => {
      const { hand, results, pick, diag } = window.__p;
      pick(results(hand('Left', 0.95, 0.4, 0.5)), 'left');
      const before = diag();
      window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'left' });
      const after = diag();
      window.__qa.resetHandTrack();
      const reset = diag();
      return { before: before.x, after: after.x, afterSize: after.size, reset: reset.x, resetSize: reset.size };
    });
    assert.equal(afterRound.before, 0.4);
    assert.equal(afterRound.after, 0.4);
    assert.ok(Number.isFinite(afterRound.afterSize));
    assert.equal(Number.isNaN(afterRound.reset), true);
    assert.equal(Number.isNaN(afterRound.resetSize), true);
    // Check OFF does nothing outside public Level 5/6: Level 4 default page stays strict.
    const strict = await page.evaluate(() => {
      window.__qa.setHandednessCheck(false);
      const { hand, results, pick } = window.__p;
      const out = {};
      out.level5Off = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      window.__qa.selectLevel('4');
      out.level4Off = pick(results(hand('Right', 0.99, 0.2, 0.2)), 'left');
      return out;
    });
    // Level 5 with check OFF admitted the opposite-labelled lone hand.
    assert.equal(strict.level5Off, 0);
    assert.equal(strict.level4Off, -1);
  });
});

test('v99 privacy blur toggle is exposed on the calibration screen and through QA', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      const wrap = document.getElementById('calibOverlay').parentElement;
      const btn = document.getElementById('btnPrivacyBlur');
      const out = {};
      out.defaultOn = wrap.classList.contains('privacy-blur');
      out.defaultLabel = btn.textContent;
      btn.click();
      out.afterClickOn = wrap.classList.contains('privacy-blur');
      out.afterClickLabel = btn.textContent;
      out.qaOn = window.__qa.setPrivacyBlur(true);
      out.qaClass = wrap.classList.contains('privacy-blur');
      return out;
    });
    assert.equal(r.defaultOn, true);
    assert.equal(r.defaultLabel, '背景模糊：開');
    assert.equal(r.afterClickOn, false);
    assert.equal(r.afterClickLabel, '背景模糊：關');
    assert.equal(r.qaOn, true);
    assert.equal(r.qaClass, true);
  });
});
