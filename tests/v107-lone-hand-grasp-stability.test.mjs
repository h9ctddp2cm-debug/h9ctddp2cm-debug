// v107 — bedside report (HP ProBook 440 G8, 720p webcam, participant inside
// 1 m, 30 fps): the Level 5 cursor vanished for seconds and the ✋/✊ cue
// flickered. The ?perf=1 overlay showed the ONLY visible hand being rejected
// by the v99 size/far gates. v107 (public Level 5/6 only):
//   - a lone hand uses a wide size window (0.40–2.50) and forgets the locked
//     size after 1 s instead of 3 s;
//   - a lone hand with a confident affected label skips the 400 ms far debounce;
//   - the detector-miss grace keeps the last cursor for 1.5 s (was 0.75 s);
//   - the Level 5 open/closed cue needs 180 ms (~6 frames) before flipping.
// Research mode keeps every previous value.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const pageUrl = pathToFileURL(htmlPath).href;

function functionSource(name){
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} exists`);
  let depth = 0, i = html.indexOf('{', start);
  for(; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

/* ---------- source-level contracts ---------- */

test('v107 constants: lone-hand window, lone forget time, grace and grasp confirmation', () => {
  assert.match(html, /const HAND_LOCK_SIZE_LONE_MIN_RATIO = 0\.40;/);
  assert.match(html, /const HAND_LOCK_SIZE_LONE_MAX_RATIO = 2\.50;/);
  assert.match(html, /const HAND_LOCK_SIZE_FORGET_LONE_MS = 1000;/);
  assert.match(html, /const PUBLIC_LEVEL56_DETECTION_LOST_GRACE_MS = 1500;/);
  assert.match(html, /const DETECTION_LOST_GRACE_MS = 750;/);
  assert.match(html, /const PUBLIC_LEVEL5_GRASP_CONFIRM_MS = 180;/);
  assert.match(html, /const GESTURE_CONFIRM_MS = 60;/);
  // The crowded-frame (>= 2 hands) window is unchanged from v99.
  assert.match(html, /const HAND_LOCK_SIZE_MIN_RATIO = 0\.55;/);
  assert.match(html, /const HAND_LOCK_SIZE_MAX_RATIO = 1\.90;/);
  assert.match(html, /const HAND_LOCK_REACQUIRE_MS = 400;/);
  assert.match(html, /const HAND_LOCK_SIZE_FORGET_MS = 3000;/);
});

test('v107 research isolation: every relaxation is behind !research.active', () => {
  const grace = functionSource('detectionLostGraceMs');
  assert.match(grace, /!research\.active && \(state\.level === '5' \|\| state\.level === '67'\)/);
  assert.match(grace, /PUBLIC_LEVEL56_DETECTION_LOST_GRACE_MS/);
  assert.match(grace, /: DETECTION_LOST_GRACE_MS/);
  const stab = functionSource('stabiliseDetectedGesture');
  assert.match(stab, /!research\.active && mode === 'grasp' && state\.level === '5'\s*\?\s*PUBLIC_LEVEL5_GRASP_CONFIRM_MS/);
  // The lone-hand size window and far-debounce skip live inside the lock,
  // which is only enabled by affectedHandContinuityEnabled() (public 5/6).
  const select = functionSource('selectedAffectedHandIndex');
  assert.match(select, /const loneHand = allLandmarks\.length === 1;/);
  assert.match(select, /handSizeAdmissible\(allLandmarks\[index\], loneHand\)/);
  assert.match(select, /loneHand \? HAND_LOCK_SIZE_FORGET_LONE_MS : HAND_LOCK_SIZE_FORGET_MS/);
  assert.match(select, /const loneStrict = loneHand && admitPath === 'strict';/);
  assert.match(select, /&& !loneStrict && !trackFresh/);
  assert.match(functionSource('handLockEnabled'), /affectedHandContinuityEnabled\(\)/);
  assert.match(functionSource('affectedHandContinuityEnabled'),
    /!research\.active && \(state\.level === '5' \|\| state\.level === '67'\)/);
  // The tracking loop reads the level-aware grace, not the raw constant.
  assert.match(html, /\(now - lastDetectedAt\) < detectionLostGraceMs\(\)/);
});

/* ---------- browser behaviour ---------- */

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(err){
    browser = null;
  }
});
after(async () => { await browser?.close(); });

async function withPage(fn){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  try{
    await fn(page);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
}

// Whole-hand landmark factory: wrist at (wx, wy), MCPs 0.10 above, fingertips
// either 0.20 above (open, tip/MCP ratio 2.0) or 0.12 above (closed, 1.2).
const graspHandScript = `
  window.__g = (() => {
    const make = (closed, wx=0.5, wy=0.7, label='Right', score=0.95) => {
      const lm = Array.from({ length: 21 }, () => ({ x: wx, y: wy, z: 0 }));
      const mcp = [2, 5, 9, 13, 17], tip = [4, 8, 12, 16, 20];
      mcp.forEach((i, k) => { lm[i] = { x: wx + (k - 2) * 0.02, y: wy - 0.10, z: 0 }; });
      tip.forEach((i, k) => { lm[i] = { x: wx + (k - 2) * 0.02, y: wy - (closed ? 0.12 : 0.20), z: 0 }; });
      [1, 3, 6, 7, 10, 11, 14, 15, 18, 19].forEach(i => { lm[i] = { x: wx, y: wy - 0.14, z: 0 }; });
      return { landmarks: [lm], handednesses: [[{ categoryName: label, score }]], worldLandmarks: [lm] };
    };
    return { make, probe: res => window.__qa.interpretHand(res, false) };
  })();
`;

test('v107 public Level 5: the open/closed cue flips only after ~180 ms of consistent posture, and raw flicker never flips it', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    await page.evaluate(() => window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'right' }));
    await page.evaluate(graspHandScript);
    const r = await page.evaluate(() => {
      const { make, probe } = window.__g;
      // Keep a QA hand present so the game loop (driven by advanceTime) does
      // not treat the frame as "hand lost" and reset the gesture stabiliser.
      const item = window.__qa.state().items[0];
      window.__qa.setHandAt(item.x, item.y, false, true);
      const out = { open: [], closing: [], flicker: [] };
      for(let i = 0; i < 6; i++){ out.open.push(probe(make(false)).isGrasping); window.advanceTime(34); }
      // Steady closed posture: sampled every 34 ms from the first closed frame.
      for(let i = 0; i < 8; i++){
        const res = probe(make(true));
        out.closing.push({ t: i * 34, grasping: res.isGrasping, detected: res.detected });
        window.advanceTime(34);
      }
      // Alternating frames (the bedside "不停轉換") must not move the stable state.
      for(let i = 0; i < 12; i++){ out.flicker.push(probe(make(i % 2 === 0)).isGrasping); window.advanceTime(34); }
      return out;
    });
    assert.ok(r.open.every(v => v === false), JSON.stringify(r.open));
    assert.ok(r.closing.every(f => f.detected), 'the hand is detected on every frame');
    // 0, 34, 68, 102, 136, 170 ms -> still open; 204 ms -> closed.
    const flipAt = r.closing.find(f => f.grasping)?.t;
    assert.equal(flipAt, 204, JSON.stringify(r.closing));
    assert.ok(r.flicker.every(v => v === true), `stable closed state survives raw flicker: ${JSON.stringify(r.flicker)}`);
  });
});

test('v107 public Level 5: a detector miss keeps the cursor for 1.5 s (not 0.75 s); interactions stay paused meanwhile', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'right' });
      const item = window.__qa.state().items[0];
      window.__qa.snapCursor();
      window.__qa.setHandAt(item.x, item.y, false, true);
      window.advanceTime(300);
      const before = window.__qa.state();
      window.__qa.clearHand();
      window.advanceTime(900);            // > old 750 ms grace
      const at900 = window.__qa.state();
      window.advanceTime(500);            // 1400 ms: still inside the 1.5 s grace
      const at1400 = window.__qa.state();
      window.advanceTime(300);            // 1700 ms: grace over
      const at1700 = window.__qa.state();
      return { before, at900, at1400, at1700 };
    });
    assert.equal(r.before.handDetected, true);
    assert.equal(r.at900.detectionHeldGrace, true, 'cursor still held at 900 ms');
    assert.equal(r.at900.handDetected, true);
    assert.ok(r.at900.cursor.x >= 0 && r.at900.cursor.y >= 0);
    assert.equal(r.at1400.detectionHeldGrace, true, 'cursor still held at 1400 ms');
    assert.equal(r.at1700.detectionHeldGrace, false, 'grace released after 1.5 s');
    assert.equal(r.at1700.handDetected, false);
    assert.equal(r.at1700.cursor.x, -1);
    assert.equal(r.at1700.held, null, 'nothing was picked up during the grace');
  });
});

test('v107 Level 4 (non-grasp level) keeps the 750 ms grace', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      window.__qa.startGame({ level: '4', theme: 'dimsum', duration: 60, affectedSide: 'right' });
      return { grace: window.__qa.detectionLostGraceMs() };
    });
    assert.equal(r.grace, 750);
    const l5 = await page.evaluate(() => {
      window.__qa.startGame({ level: '5', theme: 'dimsum', duration: 60, affectedSide: 'right' });
      return window.__qa.detectionLostGraceMs();
    });
    assert.equal(l5, 1500);
    const l6 = await page.evaluate(() => {
      window.__qa.startGame({ level: '67', level6Task: 'flowers', theme: 'flowers', duration: 60, affectedSide: 'right' });
      return window.__qa.detectionLostGraceMs();
    });
    assert.equal(l6, 1500);
  });
});
