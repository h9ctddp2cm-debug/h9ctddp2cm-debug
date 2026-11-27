import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v143 — therapist request: the Level 6 cloth-peg laundry game uses the same
// 洗衫晾衫 picture story as Levels 3–4 (入機 → 洗衫 → 晾衫 → 晒乾 → 收衫 → 摺衫 →
// 入櫃), but each step is "move the hand to the glowing spot, then squeeze the
// peg". Detection follows the Level 6 playing-cards game: the hand picture is
// always on screen (also at the last place the hand was seen), a squeezed hand
// resting on the garment picks it up, and a relaxed hand prepares in 0.3 s.
// Once picked up, the garment never drops when the hand relaxes; staying at
// the destination for 0.4 s puts it down. The earlier rack game is unchanged
// and still reachable from the advanced settings.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v143 source wiring: the peg story is the public default and reuses the shared Level 6 picker', () => {
  assert.match(src, /laundryPegStory: true,/);
  assert.match(src, /function isLaundryPegStoryGame\(\)\{\n\s*return state\.level==='67' && state\.theme==='peg_laundry' && !research\.active && state\.laundryPegStory!==false;/);
  // the earlier rack game only runs when the story layout is switched off
  assert.match(src, /&& state\.laundryPegStory === false;/);
  // pick-up goes through the same picker as the cards game; nothing new is measured
  assert.match(src, /picker\.poll\(\[\{ id, x:pts\.src\.x, y:pts\.src\.y, r:pts\.src\.r, label:'衫' \}\], null\);/);
  assert.match(src, /if\(now-laundryPeg\.stayStart>=LEVEL6_AUTO_PLACE_MS\) laundryPegPlace\(\{ x:cursorX, y:cursorY \}\);/);
  assert.match(src, /const LEVEL6_AUTO_PLACE_MS = 400;/);
  // shared detection settings are untouched
  assert.match(src, /const PUBLIC_LEVEL56_DETECTION_LOST_GRACE_MS = 1500;/);
  assert.match(src, /numHands: ?2/);
  // the settings card offers the story first and keeps every rack option
  for(const id of ['story', 'basic', 'zones2', 'zones', 'sort2', 'sort']){
    assert.ok(src.includes('data-laundry-difficulty="' + id + '"'), id);
  }
});

const SCALE = 0.2597;
const CAL = {
  enter: 0.31, nearExit: 0.32, farExit: 0.35, nearOpen: 0.344, farOpen: 0.374, scoreOpen: 0.5,
  nearClosed: 0.25, farClosed: 0.28, nearRange: 0.20, farRange: 0.20,
  comboClosed: 0.26, comboRange: 0.20,
};
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

async function open(t, viewport = { width: 1180, height: 820 }, start = {}){
  if(!browser){ t.skip('playwright unavailable'); return null; }
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ CAL, SCALE, start }) => {
    window.__qa.startGame({ level: '67', level6Task: 'peg', duration: 900, affectedSide: 'right', ...start });
    window.__qa.setLevel6PersonalToolCalibration({ pinch: CAL });
    // posture: 'sq' squeezed peg, 'rel' relaxed peg (not a wide open hand), 'none' the camera returns no hand
    window.__hand = (pt, posture, frames) => {
      const c = window.__qa.laundryPeg.state();
      for(let i = 0; i < frames; i++){
        const spec = { stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'], nx: pt.x / c.cw, ny: pt.y / c.ch };
        if(posture === 'none') spec.noHand = true;
        else{
          const g = posture === 'sq' ? [0.26, 0.29] : [0.45, 0.48];
          spec.gesture = 'open'; spec.apertures = { index: g[0] * SCALE, middle: g[1] * SCALE };
        }
        window.__qa.setLevel6ToolFrame(spec);
      }
      const tool = window.__qa.level6ToolState();
      return { ...window.__qa.laundryPeg.state(), anim: window.__qa.laundryStory.state().anim,
        handDetected: tool.handDetected, lastSeen: tool.lastSeenCursor, heldShownAt: tool.heldShownAt,
        correct: tool.correctCount };
    };
  }, { CAL, SCALE, start });
  return { page, errors, close: () => context.close() };
}

test('v143 e2e: Level 6 peg laundry starts as the picture story with pinch detection', async t => {
  const h = await open(t); if(!h) return;
  try{
    const r = await h.page.evaluate(() => {
      const s = window.__qa.state(), tool = window.__qa.level6ToolState(), ls = window.__qa.laundryStory.state();
      return { story: s.laundryPegStory, gameType: tool.gameType, task: tool.level6Task, peg: window.__qa.laundryPeg.state(),
        active: ls.active, total: ls.total, reps: ls.reps, first: ls.step && ls.step.cut,
        text: window.render_game_to_text() };
    });
    assert.equal(r.story, true);
    assert.equal(r.peg.story, true);
    assert.equal(r.gameType, 'pinch');
    assert.equal(r.task, 'peg');
    assert.equal(r.active, true);
    assert.equal(r.reps, 24);                 // 4 garments: 6 moves each (v148: the washer starts by itself)
    assert.match(r.text, /advGame=peg_laundry/);
    assert.deepEqual(h.errors, []);
  }finally{ await h.close(); }
});

test('v143 e2e: move to the garment, squeeze, carry, stay at the washer — relaxing on the way never drops it', async t => {
  const h = await open(t); if(!h) return;
  try{
    const r = await h.page.evaluate(() => {
      window.__qa.laundryStory.skipScene();
      const pts = window.__qa.laundryPeg.points(), out = { pts };
      const far = { x: pts.dst.x, y: 40 };
      out.farSqueeze = window.__hand(far, 'sq', 40);            // squeezing away from the garment does nothing
      out.farRelax = window.__hand(far, 'rel', 4);
      out.arrive = window.__hand(pts.src, 'rel', 12);           // relaxed on the garment ~0.4 s → prepared
      out.squeeze = window.__hand(pts.src, 'sq', 12);
      const mid = { x: (pts.src.x + pts.dst.x) / 2, y: (pts.src.y + pts.dst.y) / 2 };
      out.relaxMid = window.__hand(mid, 'rel', 30);             // peg relaxed for 1 s in mid-air
      out.lost = window.__hand(mid, 'none', 70);                // camera loses the hand for 2.3 s
      out.back = window.__hand(mid, 'rel', 3);
      out.brief = window.__hand(pts.dst, 'rel', 6);             // ~0.2 s over the washer: not yet
      out.away = window.__hand(mid, 'rel', 3);
      out.stay = window.__hand(pts.dst, 'rel', 16);             // ~0.5 s: put in by itself
      return out;
    });
    assert.equal(r.farSqueeze.carrying, false);
    assert.equal(r.arrive.carrying, false);
    assert.equal(r.arrive.armed, true, 'a relaxed hand on the garment prepares the pick-up');
    assert.equal(r.squeeze.carrying, true, 'squeezing the peg on the garment picks it up');
    assert.equal(r.relaxMid.carrying, true, 'a relaxed peg in mid-air keeps the garment');
    assert.equal(r.lost.carrying, true, 'a lost hand keeps the garment');
    assert.equal(r.lost.handDetected, false);
    assert.ok(r.lost.heldShownAt, 'the held garment stays with the hand picture');
    const mid = { x: (r.pts.src.x + r.pts.dst.x) / 2, y: (r.pts.src.y + r.pts.dst.y) / 2 };
    assert.ok(Math.hypot(r.lost.heldShownAt.x - mid.x, r.lost.heldShownAt.y - mid.y) < 12, 'at the last place the hand was seen');
    assert.equal(r.brief.anim, 'idle');
    assert.equal(r.brief.carrying, true);
    assert.equal(r.stay.anim, 'fly');
    assert.equal(r.stay.carrying, false);
    assert.equal(r.stay.placed, 1);
    assert.equal(r.stay.score, 10);
    assert.equal(r.stay.correct, 1);
    assert.deepEqual(h.errors, []);
  }finally{ await h.close(); }
});

test('v143 e2e: a squeezed hand that comes to rest on the garment picks it up; the hand picture stays when the hand is lost', async t => {
  const h = await open(t); if(!h) return;
  try{
    const r = await h.page.evaluate(() => {
      window.__qa.laundryStory.skipScene();
      const pts = window.__qa.laundryPeg.points(), out = { pts };
      out.seen = window.__hand(pts.src, 'rel', 4);
      out.lost = window.__hand(pts.src, 'none', 70);            // longer than the 1.5 s grace
      out.arriveSqueezed = window.__hand(pts.src, 'sq', 34);    // never relaxed: resting squeezed on the garment
      return out;
    });
    assert.equal(r.lost.handDetected, false);
    assert.ok(r.lost.lastSeen, 'hand picture stays at the last-seen place');
    assert.ok(Math.hypot(r.lost.lastSeen.x - r.pts.src.x, r.lost.lastSeen.y - r.pts.src.y) < 12);
    assert.equal(r.lost.carrying, false);
    assert.equal(r.arriveSqueezed.carrying, true);
    assert.deepEqual(h.errors, []);
  }finally{ await h.close(); }
});

test('v143 e2e (v148): no washer start step — the washer starts by itself and a whole round takes 24 moves', async t => {
  const h = await open(t); if(!h) return;
  try{
    const r = await h.page.evaluate(() => {
      const seq = []; let guard = 0, press = null;
      while(guard++ < 80){
        const ls = window.__qa.laundryStory.state();
        if(ls.rounds >= 1 || ls.ended) break;
        if(ls.step.kind === 'scene'){ if(ls.step.cut === 'done') break; window.__qa.laundryStory.skipScene(); continue; }
        const pts = window.__qa.laundryPeg.points();
        let st = window.__hand(pts.src, 'sq', 34);
        if(ls.step.action === 'press') press = { hasDst: !!pts.dst, anim: st.anim, carrying: st.carrying };
        else{
          if(!st.carrying){ seq.push(ls.step.action + ':not-picked'); break; }
          st = window.__hand(pts.dst, 'sq', 16);                // still squeezed at the destination: placed anyway
        }
        if(st.anim !== 'fly'){ seq.push(ls.step.action + ':not-placed'); break; }
        seq.push(ls.step.action);
        window.__qa.laundryStory.finishAnim();
      }
      const ls = window.__qa.laundryStory.state();
      return { seq, press, peg: window.__qa.laundryPeg.state(), repsDone: ls.repsDone, completed: ls.completed, rounds: ls.rounds };
    });
    assert.equal(r.press, null);              // the press step no longer exists in the peg story
    assert.equal(r.seq.length, 24, r.seq.join(' '));
    assert.deepEqual([...new Set(r.seq)], ['load', 'unload', 'hang', 'collect', 'fold', 'store']);
    assert.equal(r.peg.placed, 24);
    assert.equal(r.peg.score, 240);
    assert.equal(r.repsDone, 24);
    assert.equal(r.completed, true);
    assert.deepEqual(h.errors, []);
  }finally{ await h.close(); }
});

test('v143 e2e: layout keeps clear of the buttons and the time badge (iPad landscape / portrait)', async t => {
  for(const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }]){
    const h = await open(t, viewport); if(!h) return;
    try{
      const r = await h.page.evaluate(() => {
        window.__qa.laundryStory.skipScene();
        const p = window.__qa.laundryPeg.points();
        const rect = id => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        return { p, stop: rect('btnGameStop') };
      });
      const bannerTop = r.p.bannerY / r.p.cssScale;
      const portrait = viewport.height > viewport.width;
      assert.ok(bannerTop >= r.stop.b, (portrait ? 'portrait' : 'landscape') + ' banner sits under the button row: ' + bannerTop + ' vs ' + r.stop.b);
      assert.ok(r.p.src.x > 0 && r.p.src.x < viewport.width && r.p.dst.x > 0 && r.p.dst.x < viewport.width);
      assert.deepEqual(h.errors, []);
    }finally{ await h.close(); }
  }
  assert.match(src, /const left=isLaundryPegStoryGame\(\)\?104\*L\.g\.cssScale:cw\*0\.02;/);
});

test('v143 e2e: the earlier rack game is still there (advanced settings) and Levels 3–4 keep their own laundry story', async t => {
  const h = await open(t, { width: 1180, height: 820 }, { laundryPegStory: false }); if(!h) return;
  try{
    const rack = await h.page.evaluate(() => {
      const l = window.__qa.level67Layout();
      return { story: window.__qa.state().laundryPegStory, peg: window.__qa.laundryPeg.state().story,
        racks: l.targets.filter(v => v.type === 'laundry_rack').length, items: l.items.length,
        text: window.render_game_to_text() };
    });
    assert.equal(rack.story, false);
    assert.equal(rack.peg, false);
    assert.ok(rack.racks >= 1);
    assert.ok(rack.items >= 1);
    assert.doesNotMatch(rack.text, /advGame=peg_laundry/);

    const card = await h.page.evaluate(() => {
      const click = id => document.querySelector('#laundryDifficultyOptions [data-laundry-difficulty="' + id + '"]').click();
      const sel = () => [...document.querySelectorAll('#laundryDifficultyOptions .selected')].map(b => b.dataset.laundryDifficulty);
      const out = {};
      click('story'); out.story = { on: window.__qa.state().laundryPegStory, sel: sel() };
      click('zones'); out.zones = { on: window.__qa.state().laundryPegStory, sel: sel() };
      click('story'); out.back = { on: window.__qa.state().laundryPegStory, sel: sel() };
      return out;
    });
    assert.deepEqual(card.story, { on: true, sel: ['story'] });
    assert.deepEqual(card.zones, { on: false, sel: ['zones'] });
    assert.deepEqual(card.back, { on: true, sel: ['story'] });

    const l4 = await h.page.evaluate(() => {
      window.__qa.startGame({ level: '4', theme: 'laundry', duration: 900, affectedSide: 'right', shoulderTargetDeg: 90 });
      window.advanceTime(100, 3);
      return { peg: window.__qa.laundryPeg.state().story, active: window.__qa.laundryStory.state().active,
        reps: window.__qa.laundryStory.state().reps };
    });
    assert.equal(l4.peg, false);
    assert.equal(l4.active, true);
    assert.deepEqual(h.errors, []);
  }finally{ await h.close(); }
});
