import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v140 — therapist bedside (25 Nov): in the public Level 6 playing-cards and
// mahjong games the hand picture vanished whenever the camera lost the hand
// for longer than the 1.5 s grace, and a card / tile group that had ALREADY
// been picked up was drawn back at its starting place, so patients believed
// the pinch had failed. The hand picture now always stays on screen at the last
// place the hand was seen (a little lighter), and a held card / tile group
// stays with it. Display only: tracking, the grace window, pick-up, release and
// automatic placement are untouched; other Level 6 games and Level 5 keep the
// earlier behaviour.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v140 source wiring: always-shown hand picture is limited to Level 6 cards / mahjong and is display only', () => {
  assert.match(src, /function level6CursorAlwaysShown\(\)\{\n\s*return isLevel6\(\) && isGraspStyleMode\(\) && \(advCurrent === 'cards' \|\| advCurrent === 'mahjong'\);/);
  assert.match(src, /const LEVEL6_LAST_SEEN_CURSOR_ALPHA = \{ pinch:\.62, relaxed:\.54 \};/);
  // a held card / tile group is shown pinched while the hand is not seen
  assert.match(src, /grasping: picker\.heldId \? true : !!\(last && last\.grasping\),/);
  // the pinch picture accepts an explicit posture (default = live gesture, as before)
  assert.match(src, /function drawPublicLevel6ClosedPinchCursor\(ctx,x,y,alpha=\.82,graspingShown=isGrasping\)\{/);
  // cards, mahjong and the held label all use the shared draw point
  assert.equal((src.match(/level6HeldDrawPoint\(\) : null;\s*\/\/ v140: stays with the hand picture/g) || []).length, 2);
  assert.match(src, /const labelAt = level6HeldDrawPoint\(\);/);
  // forgotten at game start and teardown
  assert.equal((src.match(/level6LastSeenCursor = null;\s*\/\/ v140/g) || []).length, 2);
  // tracking is untouched: grace lengths, loss reset and the picker's no-hand guard
  assert.match(src, /const PUBLIC_LEVEL56_DETECTION_LOST_GRACE_MS = 1500;/);
  assert.match(src, /const DETECTION_LOST_GRACE_MS = 750;/);
  assert.match(src, /cursorX = -1; cursorY = -1;\n\s*dotEmaX = -1; dotEmaY = -1;/);
  assert.match(src, /poll\(items, releaseZone\)\{\n\s*this\.pct = 0;\n\s*if\(cursorX < 0 \|\| !handDetected\)\{/);
  assert.match(src, /const LEVEL6_AUTO_PLACE_MS = 400;/);
  assert.match(src, /const LEVEL6_ARRIVE_ARM_MS = 700;/);
});

const SCALE = 0.2597;
const CLOSED = 0.42 * SCALE;
const OPEN = 0.85 * SCALE;

let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    console.warn('playwright unavailable; browser checks skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

/* steps: [tag, where, posture | 'none', frames] — 'none' = the camera returns no hand */
async function walk(page, start, steps){
  return page.evaluate(({ start, steps, CLOSED, OPEN }) => {
    window.__qa.startGame({ ...start, duration: 60, affectedSide: 'right' });
    const l = window.__qa.level67Layout();
    const W = l.canvas.width, H = l.canvas.height;
    const item = l.items.find(it => it.type !== 'card_other') || l.items[0];
    const zone = l.targets[0];
    const pos = { item: { x: item.x, y: item.y }, zone: { x: zone.x, y: zone.y },
      between: { x: 0.5 * (item.x + zone.x), y: 0.5 * (item.y + zone.y) },
      far: { x: 0.06 * W, y: 0.06 * H } };
    const gap = { closed: CLOSED, open: OPEN };
    const out = { canvas: { W, H }, pos };
    for(const [tag, where, posture, frames] of steps){
      const p = pos[where];
      let st;
      for(let i = 0; i < frames; i++){
        const spec = { stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'], nx: p.x / W, ny: p.y / H };
        if(posture === 'none') spec.noHand = true;
        else { spec.gesture = posture; spec.apertures = { index: gap[posture], middle: gap[posture] }; }
        window.__qa.setLevel6ToolFrame(spec);
        st = window.__qa.level6ToolState();
      }
      out[tag] = { held: st.held, grasping: st.isGrasping, handDetected: st.handDetected,
        cursor: st.cursor, correct: st.correctCount, grabs: st.grabCount,
        armed: !!((st.carrier && st.carrier.armed) || (st.picker && st.picker.armed)),
        lastSeen: st.lastSeenCursor, heldShownAt: st.heldShownAt };
    }
    return out;
  }, { start, steps, CLOSED, OPEN });
}

async function open(t){
  if(!browser){ t.skip('playwright unavailable'); return null; }
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;

for(const task of ['cards', 'mahjong']){
  test(`Level 6 ${task} e2e: a picked-up item and the hand picture stay where the hand was last seen when the camera loses the hand; nothing is placed until the hand is seen again`, async t => {
    const env = await open(t); if(!env) return;
    const { context, page, errors } = env;
    try{
      const out = await walk(page, { level: '67', level6Task: task }, [
        ['arm', 'item', 'open', 12],
        ['grasp', 'item', 'closed', 12],
        ['carry', 'between', 'closed', 12],
        ['touchZone', 'zone', 'closed', 3],          // ~100 ms inside the 放牌區: not yet placed (needs 400 ms)
        ['graceLost', 'zone', 'none', 30],           // ~1 s without a hand: still inside the 1.5 s grace
        ['longLost', 'zone', 'none', 90],            // ~3 s more: beyond the grace
        ['back', 'zone', 'closed', 20],              // the hand is seen again on the 放牌區 → placed
      ]);
      assert.ok(out.grasp.held, 'pinch over the item picks it up');
      assert.equal(out.touchZone.correct, 0);
      // inside the grace: unchanged behaviour (cursor kept by the tracker, nothing placed)
      assert.ok(out.graceLost.held);
      assert.equal(out.graceLost.handDetected, true);
      assert.equal(out.graceLost.correct, 0, 'a held grace never places');
      assert.equal(out.graceLost.lastSeen, null, 'the live cursor is still shown during the grace');
      // beyond the grace: tracking is reset exactly as before …
      assert.equal(out.longLost.handDetected, false);
      assert.deepEqual(out.longLost.cursor, { x: -1, y: -1 });
      assert.equal(out.longLost.grasping, false);
      assert.equal(out.longLost.correct, 0, 'an unseen hand never places the item');
      assert.ok(out.longLost.held, 'the item is still held');
      // … but the hand picture and the held item stay on the 放牌區, shown pinched
      assert.ok(out.longLost.lastSeen, 'hand picture still drawn');
      assert.equal(out.longLost.lastSeen.grasping, true);
      assert.ok(near(out.longLost.lastSeen.x, out.pos.zone.x) && near(out.longLost.lastSeen.y, out.pos.zone.y));
      assert.ok(near(out.longLost.heldShownAt.x, out.pos.zone.x) && near(out.longLost.heldShownAt.y, out.pos.zone.y),
        'the held item is not drawn back at its starting place');
      // the hand returns: normal rules continue from there
      assert.equal(out.back.held, null);
      assert.equal(out.back.correct, 1);
      assert.equal(out.back.lastSeen, null);
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}

test('Level 6 cards e2e: with nothing held the relaxed hand picture stays at the last seen place, and an unseen hand never picks up a card', async t => {
  const env = await open(t); if(!env) return;
  const { context, page, errors } = env;
  try{
    const out = await walk(page, { level: '67', level6Task: 'cards' }, [
      ['hover', 'item', 'open', 12],
      ['lost', 'item', 'none', 120],                 // ~4 s without a hand, last seen on a card
      ['reopen', 'item', 'open', 12],
      ['grasp', 'item', 'closed', 12],
    ]);
    assert.equal(out.hover.armed, true);
    assert.equal(out.lost.handDetected, false);
    assert.equal(out.lost.held, null);
    assert.equal(out.lost.armed, false, 'the preparation is dropped while the hand is not seen');
    assert.equal(out.lost.grabs, 0);
    assert.ok(out.lost.lastSeen);
    assert.equal(out.lost.lastSeen.grasping, false, 'relaxed-hand picture');
    assert.ok(near(out.lost.lastSeen.x, out.pos.item.x) && near(out.lost.lastSeen.y, out.pos.item.y));
    assert.equal(out.lost.heldShownAt, null);
    assert.ok(out.grasp.held, 'open then squeeze still picks up');
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});

test('Level 6 mahjong e2e: before the hand is seen for the first time the hand picture waits in the middle of the play area', async t => {
  const env = await open(t); if(!env) return;
  const { context, page, errors } = env;
  try{
    const out = await walk(page, { level: '67', level6Task: 'mahjong' }, [
      ['never', 'item', 'none', 30],
    ]);
    assert.equal(out.never.handDetected, false);
    assert.ok(out.never.lastSeen);
    assert.ok(near(out.never.lastSeen.x, out.canvas.W * 0.5) && near(out.never.lastSeen.y, out.canvas.H * 0.62));
    assert.equal(out.never.lastSeen.grasping, false);
    assert.equal(out.never.held, null);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});

test('Level 6 flowers e2e (unchanged): no always-shown hand picture outside cards / mahjong', async t => {
  const env = await open(t); if(!env) return;
  const { context, page, errors } = env;
  try{
    const out = await walk(page, { level: '67', level6Task: 'flowers' }, [
      ['arm', 'item', 'open', 12],
      ['grasp', 'item', 'closed', 12],
      ['lost', 'between', 'none', 120],
    ]);
    assert.ok(out.grasp.held);
    assert.equal(out.lost.handDetected, false);
    assert.equal(out.lost.lastSeen, null);
    assert.equal(out.lost.heldShownAt, null);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});

test('Level 5 cards e2e (unchanged): the always-shown hand picture is not used', async t => {
  const env = await open(t); if(!env) return;
  const { context, page, errors } = env;
  try{
    const out = await page.evaluate(() => {
      window.__qa.startGame({ level: '5', theme: 'cards', duration: 60, affectedSide: 'right' });
      window.__qa.clearHand();
      window.advanceTime(3000);
      const st = window.__qa.level6ToolState();
      return { handDetected: st.handDetected, lastSeen: st.lastSeenCursor, level: st.level6Task };
    });
    assert.equal(out.handDetected, false);
    assert.equal(out.lastSeen, null);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
