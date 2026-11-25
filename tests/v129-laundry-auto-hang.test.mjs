import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v129 — therapist request (19 Nov): in the public 晾衫 game patients did not
// understand that they had to release the peg at the rack. The garment now
// hangs itself once the cursor has stayed over a rack for 400 ms (then the
// usual 220 ms drop dwell runs); releasing the peg at the rack still works.
// The release gesture is practised at the basket: the next pick-up still
// requires an opened hand first.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v129 source wiring: auto-hang constant, gate, releasing, resets, prompts', () => {
  assert.match(src, /const LAUNDRY_AUTO_HANG_MS = 400;/);
  assert.match(src, /function laundryAutoHangEnabled\(\)\{\n\s*return !research\.active && typeof isLaundryRackGame === 'function' && isLaundryRackGame\(\);/);
  assert.match(src, /const overRack = laundryAutoHangEnabled\(\) && !!onPlate\n\s*&& laundryAutoHangOver\(onPlate, heldItem \? heldItem\.r : 60\);/);
  // the garment must really be up on the rack: centre inside the rack's own box,
  // upper half for the single large rack (its legs reach down to the basket)
  assert.match(src, /function laundryAutoHangOver\(t, garmentR\)\{/);
  assert.match(src, /if\(isLaundryBasicGame\(\)\) return cursorY <= t\.y;/);
  assert.match(src, /const promptOnTarget = laundryAutoHangEnabled\(\) \? overRack : !!onPlate;/);
  assert.match(src, /const laundryAutoHang = overRack && nowMs\(\) - laundryAutoHangSince >= LAUNDRY_AUTO_HANG_MS;/);
  // whichever comes first: auto-hang OR the existing gesture release paths
  assert.match(src, /const releasing = laundryAutoHang \|\| \(isLevel6ToolGestureTask\(\)\n\s*\? \(publicPegReleaseRelaxationEnabled\(\) \? \(!isGrasping \|\| pegRelativeOpen\) : handOpenPrep\)\n\s*: \(isPinchMode\(\) \? handOpenPrep : !isGrasping\)\);/);
  // timer cleared on pick-up and after a drop
  assert.match(src, /pegRelativeHoldReset\(\);\n\s*laundryAutoHangSince = 0;\n\s*updatePublicPatientVoiceGuide\(\{phase:'pickup'/);
  assert.match(src, /pegRelativeHoldReset\(\);\n\s*laundryAutoHangSince = 0;\n\s*\} else \{/);
  // patient-facing wording: no release instruction at the rack
  assert.match(src, /if\(key === 'carry'\) return '舉高去衣架';/);
  assert.match(src, /return '對準衣架，自動掛上';/);
  assert.match(src, /if\(isLevel6Peg\(\)\) return laundryAutoHangEnabled\(\) \? '停住' : '放手';/);
  assert.match(src, /actionCue:'鬆開衣夾 → 揸實拿起 → 舉高到衣架 → 停住自動掛上'/);
  // next pick-up still needs a positively opened hand (unchanged)
  assert.match(src, /const openPrep = isLevel6ToolGestureTask\(\) \? handOpenPrep/);
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

async function walk(page, script){
  return page.evaluate(({ cal, SCALE, script }) => {
    const gap = r => r * SCALE;
    window.__qa.startGame({ level: '67', level6Task: 'peg', shoulderTargetDeg: 90, duration: 60, affectedSide: 'right' });
    window.__qa.setLevel6PersonalToolCalibration({ pinch: cal });
    const l = window.__qa.level67Layout();
    const item = l.items[0], target = l.targets.find(v => v.type === 'laundry_rack');
    const pos = {
      item: { nx: item.x / l.canvas.width, ny: item.y / l.canvas.height },
      target: { nx: target.x / l.canvas.width, ny: target.y / l.canvas.height },
      rackLegs: { nx: target.x / l.canvas.width, ny: (target.y + target.h * 0.4) / l.canvas.height },
      between: { nx: 0.5 * (item.x + target.x) / l.canvas.width, ny: 0.5 * (item.y + target.y) / l.canvas.height },
    };
    const out = {};
    for(const [tag, near, far, count, where] of script){
      let st;
      for(let i = 0; i < count; i++){
        window.__qa.setLevel6ToolFrame({ gesture: 'open', stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'],
          ...pos[where], apertures: { index: gap(near), middle: gap(far) } });
        st = window.__qa.level6ToolState();
      }
      // patient mode renders the status bar as an empty element; the chosen
      // prompt text is kept in data-action-render-key
      out[tag] = { held: st.held, grab: st.grabCount, correct: st.correctCount, grasping: st.isGrasping,
        openPrep: st.handOpenPrep, prompt: document.getElementById('statusBar')?.dataset.actionRenderKey || '' };
    }
    return out;
  }, { cal: CAL, SCALE, script });
}

test('laundry e2e: a squeezed peg held over the rack hangs the garment by itself; a brief pass does not', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const log = await walk(page, [
      ['approach', 0.45, 0.48, 10, 'item'],
      ['squeeze', 0.26, 0.29, 15, 'item'],
      ['holdAtBasket', 0.26, 0.29, 30, 'item'],  // ~1 s squeezed at the basket (touching the rack legs' padded box)
      ['carry', 0.26, 0.29, 20, 'between'],
      ['rackLegs', 0.26, 0.29, 30, 'rackLegs'],  // ~1 s on the lower legs of the rack: not "up on the rack"
      ['rackBrief', 0.26, 0.29, 9, 'target'],     // ~300 ms over the rack: below 400 ms
      ['away', 0.26, 0.29, 10, 'between'],
      ['rackHold', 0.26, 0.29, 25, 'target'],     // ~825 ms squeezed over the rack
      ['backSqueezed', 0.26, 0.29, 20, 'item'],   // still squeezed over a garment
      ['openAtBasket', 0.50, 0.53, 15, 'item'],   // past the 47% re-arm point, ~500 ms
      ['squeezeAgain', 0.26, 0.29, 15, 'item'],
    ]);
    assert.equal(log.squeeze.grab, 1, 'squeeze picks up');
    assert.ok(log.holdAtBasket.held, 'a squeezed peg resting at the basket does not hang (rack legs reach the basket)');
    assert.match(log.holdAtBasket.prompt, /舉高去衣架/);
    assert.ok(log.carry.held, 'carrying between basket and rack keeps the garment');
    assert.match(log.carry.prompt, /舉高去衣架/);
    assert.ok(log.rackLegs.held, 'the lower legs of the big rack are not the hanging surface');
    assert.ok(log.rackBrief.held, 'a brief pass over the rack does not hang');
    assert.ok(log.away.held, 'timer reset when leaving the rack');
    assert.match(log.rackBrief.prompt, /對準衣架，自動掛上/);
    assert.equal(log.rackHold.held, null, 'squeezed peg held over the rack → garment hangs itself');
    assert.equal(log.rackHold.correct, 1, 'counted as hung on the rack');
    assert.equal(log.rackHold.grasping, true, 'the hand never opened');
    assert.equal(log.backSqueezed.grab, 1, 'still-squeezed hand over a garment does not re-grab');
    assert.equal(log.openAtBasket.openPrep, true, 'opening at the basket arms the next pick-up');
    assert.equal(log.squeezeAgain.grab, 2, 'release gesture practised at the basket, then squeeze picks up again');
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});

test('laundry e2e: releasing the peg at the rack still hangs the garment (whichever comes first)', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const log = await walk(page, [
      ['approach', 0.45, 0.48, 10, 'item'],
      ['squeeze', 0.26, 0.29, 15, 'item'],
      ['carry', 0.26, 0.29, 20, 'between'],
      ['releaseAtRack', 0.40, 0.43, 14, 'target'],  // relaxed well above the release points, ~460 ms
    ]);
    assert.equal(log.squeeze.grab, 1);
    assert.equal(log.releaseAtRack.held, null, 'gesture release at the rack drops before the 400 ms auto-hang');
    assert.equal(log.releaseAtRack.correct, 1);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});

// ---- v129: the same rule for public Level 6 flowers / playing cards / mahjong
// (carrier module). Staying with the object centre inside the target zone for
// 400 ms places it; opening the hand there still works; the next pick-up needs
// an opened hand first.

test('v129 source wiring: Level 6 carrier auto-place', () => {
  assert.match(src, /const LEVEL6_AUTO_PLACE_MS = 400;/);
  assert.match(src, /const LEVEL6_AUTO_PLACE_THEMES = \['flowers','cards','mahjong'\];/);
  assert.match(src, /function level6AutoPlaceEnabled\(\)\{\n\s*return !research\.active && typeof isLevel6 === 'function' && isLevel6\(\)\n\s*&& isGraspStyleMode\(\) && !isLevel6RealToolTask\(\)\n\s*&& LEVEL6_AUTO_PLACE_THEMES\.includes\(state\.theme\);/);
  // object centre inside the zone (negative margin removes the radius padding)
  assert.match(src, /heldItemTouchesZone\(carriedItem, z, -\(\(carriedItem && carriedItem\.r\) \|\| 0\)\)/);
  assert.match(src, /if\(now - this\.autoPlaceStart >= LEVEL6_AUTO_PLACE_MS\)\{\n\s*ev\.drop = this\.heldId; ev\.zone = zAuto;/);
  assert.match(src, /this\.postReleaseOpenStart=0; this\.autoPlaceStart=0;\n\s*this\.arriveId=null; this\.arriveStart=0; this\.arriveArmed=false; \},/);   // v136 adds the arrival fields
  // picker module (cards / mahjong): cursor inside the 放牌區 box
  assert.match(src, /if\(releaseZone && level6AutoPlaceEnabled\(\) && pointInsideZone\(cursorX, cursorY, releaseZone\)\)\{/);
  assert.match(src, /this\.postReleaseOpenStart=0;\n\s*this\.autoPlaceStart=0; this\.arriveId=null; this\.arriveStart=0; this\.arriveArmed=false;\n\s*this\.sqId=null; this\.sqStart=0;\n\s*\},/);   // v136 adds the arrival fields, v140 the squeeze-rest fields
  // wording
  assert.match(src, /setActionPrompt\(level6AutoPlaceEnabled\(\) \? '移到目標停住' : \(isGrasping \? '保持揸住' : '張開手放低'\), ''\);/);
  assert.match(src, /'已拿住 · 移到放牌區，停住自動放低'/);
  assert.match(src, /'已拿住 · 移到花盤，停住自動放低'/);
  assert.match(src, /if\(level6AutoPlaceEnabled\(\)\) return '停住';/);
  // Level 5 keeps its own rule: the gate requires isLevel6()
  assert.match(src, /function isLevel6\(\)\{ return !research\.active && state\.level === '67'; \}/);
});

async function carrierWalk(page, start, steps){
  return page.evaluate(({ start, steps }) => {
    window.__qa.startGame({ ...start, duration: 60, affectedSide: 'right' });
    const l = window.__qa.level67Layout();
    const W = l.canvas.width, H = l.canvas.height;
    // first item that counts as correct (cards: the asked-for suit, not 'card_other')
    const item = l.items.find(it => it.type !== 'card_other') || l.items[0];
    const zone = l.targets[0];
    const pos = {
      item: { x: item.x, y: item.y },
      zone: { x: zone.x, y: zone.y },
      // touches the zone (within the item radius) but the centre stays outside:
      // below the full-width vase strip, or left of the side 放牌區
      zoneEdge: zone.w >= W
        ? { x: zone.x, y: zone.y + zone.h / 2 + item.r * 0.6 }
        : { x: zone.x - zone.w / 2 - item.r * 0.6, y: zone.y },
      between: { x: 0.5 * (item.x + zone.x), y: 0.5 * (item.y + zone.y) },
    };
    const out = {};
    for(const [tag, where, gesture, frames] of steps){
      let p = pos[where];
      if(where === 'nextItem'){
        const now = window.__qa.level67Layout();
        const nxt = now.items.find(it => it.type !== 'card_other' && !it.gone) || now.items[0];
        p = { x: nxt.x, y: nxt.y };
      }
      let st;
      for(let i = 0; i < frames; i++){
        window.__qa.setLevel6ToolFrame({ gesture, stepMs: 33, poseMissing: ['shoulder', 'elbow', 'wrist'],
          nx: p.x / W, ny: p.y / H });
        st = window.__qa.level6ToolState();
      }
      out[tag] = { held: st.held, grasping: st.isGrasping, openPrep: st.handOpenPrep,
        correct: st.correctCount, placed: st.advancedPlaced, prompt: st.prompt };
    }
    return { out, zone, item, state: window.__qa.state() };
  }, { start, steps });
}

for(const start of [
  { level: '67', level6Task: 'flowers' },
  { level: '67', level6Task: 'cards' },
  { level: '67', level6Task: 'mahjong' },
]){
  test(`Level 6 ${start.level6Task} e2e: held object placed by staying on the target; brief pass / zone edge do not`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    try{
      const { out, state } = await carrierWalk(page, start, [
        ['arm', 'item', 'open', 12],
        ['grasp', 'item', 'closed', 12],
        ['holdAtItem', 'item', 'closed', 30],       // ~1 s closed at the pick-up spot
        ['carry', 'between', 'closed', 20],
        ['zoneEdge', 'zoneEdge', 'closed', 30],     // touching the zone but centre outside → no auto-place
        ['zoneBrief', 'zone', 'closed', 6],         // ~200 ms: below 400 ms
        ['away', 'between', 'closed', 10],
        ['zoneHold', 'zone', 'closed', 20],         // ~660 ms closed on the target
        ['stillClosed', 'nextItem', 'closed', 25],
        ['openAtItem', 'nextItem', 'open', 45],     // open at the object (also lets any celebration finish)
        ['graspAgain', 'nextItem', 'closed', 15],
      ]);
      assert.ok(out.grasp.held, 'pinch over the object picks it up');
      assert.ok(out.holdAtItem.held, 'holding at the pick-up spot keeps it');
      assert.ok(out.carry.held, 'carrying keeps it');
      assert.ok(out.zoneEdge.held, 'merely touching the zone edge does not place it');
      assert.ok(out.zoneBrief.held, 'a brief pass over the zone does not place it');
      assert.ok(out.away.held, 'timer resets when leaving the zone');
      assert.equal(out.zoneHold.held, null, 'staying on the target places the object with the hand still closed');
      assert.equal(out.zoneHold.grasping, true, 'the hand never opened');
      assert.equal(out.zoneHold.correct, 1, 'counted as a correct placement');
      // v140: in cards a squeezing hand resting on the next card picks it up
      // without letting go first; flowers keep the earlier rule (mahjong is
      // paused by its celebration here).
      if(start.level6Task === 'cards') assert.ok(out.stillClosed.held, 'cards: a squeezing hand resting on the next card picks it up');
      else assert.equal(out.stillClosed.held, null, 'a still-closed hand over an object does not re-grab');
      // mahjong opens its 和牌 celebration after a placed group (play is paused
      // while it shows), so the re-pick-up is asserted for flowers and cards.
      if(start.level6Task !== 'mahjong') assert.ok(out.graspAgain.held, 'open at the object, then pinch → next pick-up');
      assert.equal(state.level, '67');
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}

test('Level 5 flowers e2e (unchanged): a closed hand resting on the vase never places the flower', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  try{
    const out = await page.evaluate(() => {
      window.__qa.startGame({ level: '5', theme: 'flowers', duration: 60, affectedSide: 'right' });
      const l = window.__qa.level67Layout();
      const item = l.items[0], zone = l.targets[0];
      const out = {};
      const step = (tag, p, grasping, openPrep, ms) => {
        window.__qa.setHandAt(p.x, p.y, grasping, openPrep);
        window.__qa.snapCursor();
        window.advanceTime(ms);
        const st = window.__qa.level6ToolState();
        out[tag] = { held: st.held, correct: st.correctCount };
      };
      step('arm', item, false, true, 400);
      step('grasp', item, true, false, 400);
      step('zoneHold', zone, true, false, 1500);
      step('open', zone, false, true, 600);
      return out;
    });
    assert.ok(out.grasp.held);
    assert.ok(out.zoneHold.held, 'Level 5 keeps the deliberate release');
    assert.equal(out.open.held, null, 'opening the hand releases');
    assert.equal(out.open.correct, 1);
    assert.deepEqual(errors, []);
  }finally{
    await context.close();
  }
});
