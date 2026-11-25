import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v136 — therapist bedside (19 Nov, after v135): in the peg-held Level 6 games
// the voice kept saying 張開手 although the clothes peg had already been
// relaxed. A real peg only lets the fingers reopen a little, so the posture
// often stays below the calibrated re-arm point. Fix (public Level 6 flowers /
// cards / mahjong and the clothes-peg laundry task, NOTHING held): staying
// over the next item for LEVEL6_ARRIVE_ARM_MS (700 ms) prepares the pick-up by
// itself (while the hand is not squeezing) — the item shows its orange halo —
// and the next squeeze picks it up. A hand parked CLOSED on an item still never
// picks it up by itself (the v78 static-grasp rule is kept). A genuinely opened
// hand still arms at once. Release rules, chopsticks, cooking, Level 5 and
// research mode are untouched.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v136 source wiring: arrival-arm constant, gate, pollers, peg task, halo', () => {
  assert.match(src, /const LEVEL6_ARRIVE_ARM_MS = 700;/);
  assert.match(src, /function level6ArriveArmEnabled\(\)\{\n\s*return !research\.active && isLevel6\(\) && isGraspStyleMode\(\)\n\s*&& \(level6AutoPlaceEnabled\(\) \|\| isLevel6RealToolTask\(\)\) && !level6AnyItemHeld\(\);/);
  // shared poller used by picker (cards / mahjong) and carrier (flowers)
  assert.match(src, /function level6ArriveArmPoll\(ctl, best, now, canArm\)\{\n\s*if\(!best \|\| best\.placed \|\| !level6ArriveArmEnabled\(\)\)\{/);
  assert.equal((src.match(/level6ArriveArmPoll\(this, best, now, !!directContact && !isGrasping\);\s*\/\/ v136/g) || []).length, 2);
  // the dwell arms only while really over the item (not during the contact grace after drifting
  // off) and only while the hand is not squeezing
  assert.match(src, /if\(canArm !== false && !ctl\.armed && now - ctl\.arriveStart >= level6ArriveArmMs\(\)\)\{ ctl\.armed = true; ctl\.arriveArmed = true; \}/);
  // an arrival-prepared pick-up still needs the squeeze itself (both pollers)
  // (v140: the cards / mahjong poller additionally sets the ready-ring value there)
  assert.equal((src.match(/if\(this\.arriveArmed && !isGrasping\)\{ this\.graspStart = 0; this\.graspId = null; return ev; \}/g) || []).length, 1);
  assert.equal((src.match(/if\(this\.arriveArmed && !isGrasping\)\{\n\s*this\.graspStart = 0; this\.graspId = null;\n\s*this\.pct = level6ReadyRingPct\(this, best, now, readyCanArm\);[^\n]*\n\s*return null;\n\s*\}/g) || []).length, 1);
  // a genuine open arm supersedes the arrival arm
  assert.equal((src.match(/this\.armed = true; this\.arriveArmed = false;/g) || []).length, 2);
  // voice: arrival counts as "open for pickup" → 夾住, not 張開手
  assert.match(src, /openForPickup:!!\(isGraspStyleMode\(\)&&\(handReleasedOrOpen\(\)\|\|arrived\)\)/);
  assert.match(src, /openForPickup:!!\(best&&isGraspStyleMode\(\)&&\(handReleasedOrOpen\(\)\|\|arrived\)\)/);
  // peg laundry (foods engine)
  assert.match(src, /let basicArriveId = '', basicArriveStart = 0, basicArriveArmed = false;/);
  assert.match(src, /if\(overFood && level6ArriveArmEnabled\(\)\)\{\n\s*if\(basicArriveId !== nearest\.id\)\{ basicArriveId = nearest\.id; basicArriveStart = now; \}\n\s*if\(directContact && !isGrasping && !basicGraspArmed && now - basicArriveStart >= LEVEL6_ARRIVE_ARM_MS\)\{/);
  assert.match(src, /openForPickup:!!\(voiceNearFood&&\(\(!isGrasping&&openPrep\)\|\|\(basicArriveArmed&&basicGraspArmed\)\)\),/);
  // orange halo on the garment that is ready to be clipped
  assert.match(src, /if\(isLaundryRackGame\(\) && !heldItem && !f\.held && basicGraspArmed && basicGraspCandidate === f\.id\)\{\n\s*ctx\.fillStyle = 'rgba\(224,123,57,0\.30\)';/);
  // v130 idle-reopen rule and v129 auto-place are still present (unchanged)
  assert.match(src, /const PUBLIC_BARE_REOPEN_PREP_MS = 300;/);
  assert.match(src, /const LEVEL6_AUTO_PLACE_MS = 400;/);
});

const SCALE = 0.2597;
const CLOSED = 0.42 * SCALE;
const OPEN = 0.85 * SCALE;
// peg calibration used by the v130 QA walk-through (see /tmp/v130qa.js)
const PEG_CAL = { enter:0.31, nearExit:0.32, farExit:0.35, nearOpen:0.344, farOpen:0.374, scoreOpen:0.5,
  nearClosed:0.25, farClosed:0.28, nearRange:0.20, farRange:0.20, comboClosed:0.26, comboRange:0.20 };

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

async function walkBare(page, start, steps){
  return page.evaluate(({ start, steps, CLOSED, OPEN }) => {
    window.__qa.startGame({ ...start, duration: 60, affectedSide: 'right' });
    const l = window.__qa.level67Layout();
    const W = l.canvas.width, H = l.canvas.height;
    const item = l.items.find(it => it.type !== 'card_other') || l.items[0];
    const zone = l.targets[0];
    const pos = { item: { x: item.x, y: item.y }, zone: { x: zone.x, y: zone.y },
      between: { x: 0.5 * (item.x + zone.x), y: 0.5 * (item.y + zone.y) },
      far: { x: 0.06 * W, y: 0.06 * H } };   // top-left corner: away from every item and the target
    const gap = { closed: CLOSED, open: OPEN };
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
        window.__qa.setLevel6ToolFrame({ gesture: posture, stepMs: 33,
          poseMissing: ['shoulder', 'elbow', 'wrist'], nx: p.x / W, ny: p.y / H,
          apertures: { index: gap[posture], middle: gap[posture] } });
        st = window.__qa.level6ToolState();
      }
      out[tag] = { held: st.held, grasping: st.isGrasping, openPrep: st.handOpenPrep,
        correct: st.correctCount, armed: !!((st.carrier && st.carrier.armed) || (st.picker && st.picker.armed)) };
    }
    return out;
  }, { start, steps, CLOSED, OPEN });
}

for(const start of [
  { level: '67', level6Task: 'flowers' },
  { level: '67', level6Task: 'cards' },
]){
  test(`Level 6 ${start.level6Task} e2e (safety kept): a hand parked CLOSED on the target or on the next item never picks anything up by itself; a reopen + squeeze still does`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    try{
      const out = await walkBare(page, start, [
        ['arm', 'item', 'open', 12],
        ['grasp', 'item', 'closed', 12],
        ['carry', 'between', 'closed', 20],
        ['zoneHold', 'zone', 'closed', 20],          // ~660 ms → placed itself, hand still closed
        ['vaseLinger', 'zone', 'closed', 30],        // ~1 s more at the target: the placed item is NOT re-grabbed
        ['nextParked', 'nextItem', 'closed', 40],    // ~1.3 s parked closed on the next item: NOT picked up
        ['reopen', 'nextItem', 'open', 12],          // a real open arms at once
        ['graspAgain', 'nextItem', 'closed', 12],    // … and the squeeze picks it up
      ]);
      assert.ok(out.grasp.held, 'pinch over the object picks it up');
      assert.equal(out.zoneHold.held, null, 'staying on the target places the object');
      assert.equal(out.zoneHold.grasping, true, 'the hand never opened');
      assert.equal(out.zoneHold.correct, 1);
      assert.equal(out.vaseLinger.held, null, 'a closed hand lingering on the target never re-grabs the placed item');
      assert.equal(out.vaseLinger.correct, 1);
      assert.equal(out.nextParked.held, null, 'a hand parked closed on the next item does not pick it up by itself');
      assert.equal(out.nextParked.grasping, true);
      assert.equal(out.reopen.armed, true, 'a genuine open still arms immediately');
      assert.ok(out.graspAgain.held, 'closing again picks up the next object');
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}

test('Level 6 clothes-peg laundry e2e: a peg relaxed only a little (not separated) over the garment is prepared by arrival (0.7 s); the squeeze then picks it up; squeezing before the dwell or arriving already squeezed does not', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const run = (steps) => page.evaluate(({ steps, cal, S }) => {
      window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60, affectedSide: 'right' });
      window.__qa.setLevel6PersonalToolCalibration({ pinch: cal });
      const l = window.__qa.level67Layout();
      const item = l.items[0], target = l.targets.find(v => v.type === 'laundry_rack');
      const W = l.canvas.width, H = l.canvas.height;
      const pos = { item: { nx: item.x / W, ny: item.y / H },
        between: { nx: (item.x + target.x) / 2 / W, ny: (item.y + target.y) / 2 / H } };
      const out = {};
      for(const [tag, near, far, n, where] of steps){
        let st;
        for(let i = 0; i < n; i++){
          window.__qa.setLevel6ToolFrame({ gesture: 'open', stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'],
            ...pos[where], apertures: { index: near * S, middle: far * S } });
          st = window.__qa.level6ToolState();
        }
        out[tag] = { held: st.held, grasping: st.isGrasping, openPrep: st.handOpenPrep,
          armed: !!(st.basic && st.basic.armed) };
      }
      return out;
    }, { steps, cal: PEG_CAL, S: SCALE });
    // .33/.36 = above the entry threshold (.31) but below the re-arm points (.344/.374):
    // "relaxed a little, not separated" — the posture the therapist described.
    const slow = await run([
      ['halfOpenBrief', 0.33, 0.36, 12, 'item'],     // ~400 ms: not prepared yet
      ['halfOpenHeld', 0.33, 0.36, 15, 'item'],      // ~900 ms total: prepared by arrival
      ['squeeze', 0.26, 0.29, 15, 'item'],           // squeeze → picked up
    ]);
    assert.equal(slow.halfOpenBrief.openPrep, false, 'the small reopen is not a separated hand');
    assert.equal(slow.halfOpenBrief.armed, false, '400 ms is below the arrival dwell');
    assert.equal(slow.halfOpenHeld.armed, true, 'staying over the garment prepares the pick-up');
    assert.equal(slow.halfOpenHeld.held, null, 'preparation alone never picks up');
    assert.ok(slow.squeeze.held, 'the squeeze then picks the garment up');
    const quick = await run([
      ['halfOpenBrief', 0.33, 0.36, 12, 'item'],
      ['squeezeEarly', 0.26, 0.29, 6, 'item'],       // ~600 ms over the garment in total: under the dwell
    ]);
    assert.equal(quick.squeezeEarly.held, null, 'squeezing before the dwell (and without a separated hand) does not pick up');
    const parked = await run([
      ['squeezedParked', 0.26, 0.29, 45, 'item'],    // ~1.5 s arriving and staying squeezed: never picks up by itself
    ]);
    assert.equal(parked.squeezedParked.armed, false, 'a squeezed hand is not prepared by arrival');
    assert.equal(parked.squeezedParked.held, null, 'a hand parked squeezed on the garment never picks it up');
    const open = await run([
      ['separated', 0.45, 0.48, 6, 'item'],          // a genuinely opened peg arms at once (~200 ms)
      ['squeeze', 0.26, 0.29, 15, 'item'],
    ]);
    assert.equal(open.separated.armed, true, 'a separated hand still arms immediately');
    assert.ok(open.squeeze.held);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
