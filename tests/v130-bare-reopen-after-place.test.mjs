import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v130 — therapist report (19 Nov, after v129): in Level 6 flowers the red
// "ready" ring took a long time to come back after a flower had placed itself.
// Cause: the hand is still in the pinched posture after an automatic
// placement, and the hysteresis reopen threshold (70% of the calibrated range)
// is hard to reach with the hand raised / turned; the prompt still said 揸實.
// Fix (public Level 6 flowers / cards / mahjong only, nothing held): a posture
// that is merely "not clearly closed" for 300 ms ends the pinch hysteresis, the
// prompt says 先張開手 and the voice says 張開手 until then.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v130 source wiring: idle reopen rule, gate, prompt and voice', () => {
  assert.match(src, /const PUBLIC_BARE_REOPEN_PREP_MS = 300;/);
  assert.match(src, /function level6BareReopenEnabled\(\)\{\n\s*return level6AutoPlaceEnabled\(\) && !level6AnyItemHeld\(\);/);
  // only while nothing is held — release rules while holding are untouched
  assert.match(src, /function level6AnyItemHeld\(\)\{\n\s*return !!\(heldItem/);
  assert.match(src, /const PUBLIC_BARE_IDLE_REOPEN_RANGE = 0\.40;/);
  assert.match(src, /closedNow: bothClearlyClosed \|\| asymmetricLightClose,/);
  // idle mark = calibrated closed + 40% of the calibrated range (range rebuilt from enter/exit)
  assert.match(src, /idleReopenMark: \(enter - 0\.56 \* Math\.max\(0\.025, \(exit - enter\) \/ 0\.14\)\)\n\s*\+ PUBLIC_BARE_IDLE_REOPEN_RANGE \* Math\.max\(0\.025, \(exit - enter\) \/ 0\.14\),/);
  assert.match(src, /const bareReopen = level6BareReopenEnabled\(\) && pinch\.valid === true;/);
  assert.match(src, /const bareIdleOpen = bareReopen && Number\.isFinite\(pinch\.ratio\)\n\s*&& pinch\.ratio >= pinch\.idleReopenMark;/);
  assert.match(src, /if\(bareReopen && pinch\.isPinching && bareUnpinchedSinceMs > 0\n\s*&& nowMs\(\) - bareUnpinchedSinceMs >= PUBLIC_BARE_REOPEN_PREP_MS\)\{\n\s*pinch\.isPinching = false;/);
  // the rule is applied before the shared stabiliser, so the 60 ms confirmation still runs
  assert.match(src, /pinch\.isPinching = false;\n\s*\}\n\s*\/\/ One stabilized state[\s\S]{0,200}const pinchHeld = stabiliseDetectedGesture\(pinch\.isPinching, 'pinch'\);/);
  assert.match(src, /bareUnpinchedSinceMs = 0;\n\s*pegRelativeReset\(\);/);
  // prompt over the next item while the hand is still closed and not armed
  // (v140: not in cards / mahjong, where a squeezing hand resting on the item picks it up)
  assert.match(src, /\? \(level6AutoPlaceEnabled\(\) && !advancedArmed && !level6QuickReadyEnabled\(\) \? '先張開手' : '揸實'\)/);
  assert.match(src, /if\(phase === 'reopen'\) return level6AutoPlaceEnabled\(\) \? '張開手' : '';/);
  assert.match(src, /if\(s\.touching&&isGrasping&&level6AutoPlaceEnabled\(\)&&!level6QuickReadyEnabled\(\)\) return publicPatientVoiceSay\('reopen',itemId,!!s\.silent\);/);
  // peg / chopsticks / Level 5 excluded through level6AutoPlaceEnabled()
  assert.match(src, /function level6AutoPlaceEnabled\(\)\{\n\s*return !research\.active && typeof isLevel6 === 'function' && isLevel6\(\)\n\s*&& isGraspStyleMode\(\) && !isLevel6RealToolTask\(\)/);
});

// synthetic bare hand: scale 0.2597 (see qaToolHandResults); default
// thresholds PINCH_ENTER .58 / PINCH_EXIT .62 / PINCH_OPEN .66 → reconstructed
// range .2857, closed .42, idle reopen mark = .42 + .40 × .2857 = .534
const SCALE = 0.2597;
const RELAXED = 0.55 * SCALE;   // above the 40% idle mark, but still "closed" by the entry threshold (.58)
const SLIGHT = 0.50 * SCALE;    // below the 40% idle mark: still a pinch
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

async function walk(page, start, steps){
  return page.evaluate(({ start, steps, CLOSED, OPEN, RELAXED, SLIGHT }) => {
    window.__qa.startGame({ ...start, duration: 60, affectedSide: 'right' });
    const l = window.__qa.level67Layout();
    const W = l.canvas.width, H = l.canvas.height;
    const item = l.items.find(it => it.type !== 'card_other') || l.items[0];
    const zone = l.targets[0];
    const pos = {
      item: { x: item.x, y: item.y },
      zone: { x: zone.x, y: zone.y },
      between: { x: 0.5 * (item.x + zone.x), y: 0.5 * (item.y + zone.y) },
    };
    const gap = { closed: CLOSED, open: OPEN, relaxed: RELAXED, slight: SLIGHT };
    const out = {};
    for(const [tag, where, posture, frames] of steps){
      let p = pos[where];
      if(where === 'nextItem'){
        const now = window.__qa.level67Layout();
        const nxt = now.items.find(it => it.type !== 'card_other' && !it.gone) || now.items[0];
        p = { x: nxt.x, y: nxt.y };
      }
      let st;
      for(let i = 0; i < frames; i++){
        window.__qa.setLevel6ToolFrame({ gesture: posture === 'open' ? 'open' : 'closed', stepMs: 33,
          poseMissing: ['shoulder', 'elbow', 'wrist'], nx: p.x / W, ny: p.y / H,
          apertures: { index: gap[posture], middle: gap[posture] } });
        st = window.__qa.level6ToolState();
      }
      const bar = document.getElementById('statusBar');
      out[tag] = { held: st.held, grasping: st.isGrasping, openPrep: st.handOpenPrep,
        correct: st.correctCount, wrong: window.__qa.state().totalWrong,
        armed: !!(st.carrier && st.carrier.armed), cursorPct: null,
        prompt: bar ? (bar.dataset.actionRenderKey || bar.textContent) : '' };
    }
    return { out, state: window.__qa.state() };
  }, { start, steps, CLOSED, OPEN, RELAXED, SLIGHT });
}

for(const start of [
  { level: '67', level6Task: 'flowers' },
  { level: '67', level6Task: 'cards' },
]){
  test(`Level 6 ${start.level6Task} e2e: after an automatic placement a relaxed (not clearly closed) hand re-arms once reopened to 40% of range for 0.3 s; prompt says 先張開手 meanwhile`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    try{
      const { out } = await walk(page, start, [
        ['arm', 'item', 'open', 12],
        ['grasp', 'item', 'closed', 12],
        ['carry', 'between', 'closed', 20],
        ['zoneHold', 'zone', 'closed', 20],          // ~660 ms → placed itself, hand still closed
        ['slight', 'nextItem', 'slight', 30],        // 1 s at 50%: below the 40%-of-range mark → still closed
        ['relaxedBrief', 'nextItem', 'relaxed', 4],  // ~130 ms: not yet
        ['relaxedHeld', 'nextItem', 'relaxed', 14],  // ~600 ms total: reopened + armed
        ['graspAgain', 'nextItem', 'closed', 15],
      ]);
      assert.ok(out.grasp.held, 'pinch over the object picks it up');
      assert.equal(out.zoneHold.held, null, 'staying on the target places the object');
      assert.equal(out.zoneHold.grasping, true, 'the hand never opened');
      assert.equal(out.zoneHold.correct, 1);
      assert.equal(out.slight.grasping, true, 'a posture below the idle mark stays a pinch');
      assert.equal(out.slight.openPrep, false);
      if(start.level6Task === 'cards'){
        // v140: in cards the still-squeezing hand resting on the next card picks
        // it up without letting go first, and is never told to open first.
        assert.ok(out.slight.held, 'cards: a squeezing hand resting on the next card picks it up');
        assert.doesNotMatch(String(out.slight.prompt), /先張開手/);
        assert.deepEqual(errors, []);
        return;
      }
      // 130 ms of a relaxed-but-not-open hand: still counted as closed, told to open first
      assert.equal(out.relaxedBrief.grasping, true, 'a brief relaxation is still a closed hand');
      assert.equal(out.relaxedBrief.openPrep, false);
      assert.match(String(out.relaxedBrief.prompt), /先張開手/, 'patient is told to open first, not 揸實');
      // 600 ms: idle reopen rule ends the hysteresis → open preparation → armed
      assert.equal(out.relaxedHeld.grasping, false, 'sustained relaxed hand counts as reopened');
      assert.equal(out.relaxedHeld.openPrep, true);
      assert.match(String(out.relaxedHeld.prompt), /揸實拿起/, 'prompt moves on to the pick-up cue');
      assert.ok(out.graspAgain.held, 'closing again picks up the next object');
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}

test('Level 6 flowers e2e: while HOLDING, a relaxed (not clearly closed) hand never drops the flower (hysteresis unchanged); a clear open still does', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const { out } = await walk(page, { level: '67', level6Task: 'flowers' }, [
      ['arm', 'item', 'open', 12],
      ['grasp', 'item', 'closed', 12],
      ['relaxedCarry', 'between', 'relaxed', 45],  // 1.5 s relaxed off-target
      ['openAway', 'between', 'open', 12],         // clear open → released (off target)
    ]);
    assert.ok(out.grasp.held);
    assert.ok(out.relaxedCarry.held, 'relaxed-but-not-open hand keeps holding (reopen rule is idle-only)');
    assert.equal(out.relaxedCarry.grasping, true);
    assert.equal(out.openAway.held, null, 'a clear open still releases');
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
