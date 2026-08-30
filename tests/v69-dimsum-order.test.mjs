import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v69 筷子點心「落單」revamp regression tests (30 Aug 2026 user request):
//   1. No virtual chopsticks are drawn — the patient holds REAL chopsticks, so the
//      screen shows only real dim sum photos (beef ball uses the user's photo).
//   2. The two identical rice-bowl targets are replaced by ONE central big plate
//      (rooster plate photo).
//   3. The game is order-driven: the screen asks e.g. 「我想食2個牛肉球，3個蝦餃」,
//      placed dim sum appear ON the plate, completing the order triggers applause,
//      then a new different order starts, repeating until the session timer ends.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contract: no virtual chopsticks ---------------- */

test('virtual chopsticks are gone from the chopstick dim sum theme', () => {
  assert.doesNotMatch(publicSource, /drawChopsticksHolding/);
  // Items render as real photos through drawDimsumPhoto, keeping aspect ratio.
  assert.match(publicSource, /function drawDimsumPhoto\(ctx, x, y, r, img\)\{/);
  assert.match(publicSource, /drawItem:\(ctx,x,y,r\)=>drawDimsumPhoto\(ctx,x,y,r,imgBeefballReal\)/);
  assert.match(publicSource, /drawItem:\(ctx,x,y,r\)=>drawDimsumPhoto\(ctx,x,y,r,imgHargau\)/);
  assert.match(publicSource, /drawItem:\(ctx,x,y,r\)=>drawDimsumPhoto\(ctx,x,y,r,imgSiumai\)/);
});

test('item labels no longer mention chopsticks and the beef ball is 牛肉球', () => {
  assert.doesNotMatch(publicSource, /→筷子/);
  assert.doesNotMatch(publicSource, /牛肉丸/);
  assert.match(publicSource, /itemLabel:'牛肉球'/);
  assert.match(publicSource, /itemLabel:'蝦餃'/);
  assert.match(publicSource, /itemLabel:'燒賣'/);
});

test('real photo assets are loaded for the beef ball and the rooster plate', () => {
  assert.match(publicSource, /imgBeefballReal\.src = 'img\/beefball_real\.png'/);
  assert.match(publicSource, /imgRoosterPlate\.src = 'img\/rooster_plate\.png'/);
});

/* ---------------- Source contract: one central big plate ---------------- */

test('order mode uses a single central big-plate target instead of two bowls', () => {
  assert.match(publicSource, /if\(isDimsumOrderGame\(\)\)\{[\s\S]{0,600}type:'dimsum_plate'[\s\S]{0,200}style:'bigplate'[\s\S]{0,200}x:cw \/ 2/);
  assert.match(publicSource, /if\(t\.style === 'bigplate'\)\{ drawBigPlateTarget\(ctx, t\); continue; \}/);
  // Placed dim sum are drawn ON the plate so the patient can see progress.
  assert.match(publicSource, /for\(const p of dimsumPlateContents\)\{/);
  // The chopstick theme no longer references rice bowls in user-facing text.
  assert.doesNotMatch(publicSource, /移到飯碗/);
});

/* ---------------- Source contract: order-driven matching ---------------- */

test('both drop paths use order-quantity matching for the big plate', () => {
  const graspPath = /const dimsumOrderDrop = isDimsumOrderGame\(\) && onPlate\.type === 'dimsum_plate';[\s\S]{0,200}dimsumOrderAccepts\(heldItem\)/;
  const dwellPath = /const dwellDimsumOrderDrop = isDimsumOrderGame\(\) && onPlate\.type === 'dimsum_plate';[\s\S]{0,200}dimsumOrderAccepts\(heldItem\)/;
  assert.match(publicSource, graspPath);
  assert.match(publicSource, dwellPath);
  // Successful order drops are recorded on the plate before scoring.
  assert.match(publicSource, /if\(dimsumOrderDrop\) dimsumOrderPlace\(heldItem\);/);
  assert.match(publicSource, /if\(dwellDimsumOrderDrop\) dimsumOrderPlace\(heldItem\);/);
});

test('order mode is fail-safe against spawn deadlocks', () => {
  // Spawns prefer still-needed dim sum types...
  assert.match(publicSource, /const neededDefs = defs\.filter\(d=>needed\.includes\(d\.type\)\);/);
  // ...and ensureFoodCount guarantees at least one needed item on screen.
  assert.match(publicSource, /const sacrifice = foods\.find\(f=>!f\.removed && !f\.held && isDimSum\(f\) && !needed\.includes\(f\.targetType\)\);/);
});

test('order lifecycle is wired into init, reset and completion', () => {
  assert.match(publicSource, /if\(isDimsumOrderGame\(\)\) newDimsumOrder\(\);/);
  assert.match(publicSource, /resetDimsumOrderGame\(\);/);
  // Applause + Cantonese praise + auto next order gated on the game still running.
  assert.match(publicSource, /playApplauseSound\(\)/);
  assert.match(publicSource, /if\(isDimsumOrderGame\(\) && state\.running\) newDimsumOrder\(\);/);
});

test('research pilot track is not affected by order mode', () => {
  assert.match(publicSource, /return state\.level === '67' && state\.theme === 'chopstick_dimsum' && !research\.active;/);
});

/* ---------------- Behavioural: order module ---------------- */

function makeOrderModule(opts = {}){
  const start = publicSource.indexOf('const DIMSUM_ORDER_MENU');
  const end = publicSource.indexOf('let level3RoundVariant');
  assert.ok(start > 0 && end > start, 'order module not found in index.html');
  const code = publicSource.slice(start, end);
  const calls = {speak: [], applause: 0, timeouts: [], ensure: 0};
  const state = Object.assign({level: '67', theme: 'chopstick_dimsum', running: true}, opts.state);
  const research = Object.assign({active: false}, opts.research);
  const rng = opts.random || (() => 0.5);
  const fakeMath = {random: rng, floor: Math.floor};
  const fn = new Function(
    'state', 'research', 'foods', 'ensureFoodCount', 'speakCantonese',
    'playApplauseSound', 'nowMs', 'setTimeout', 'clearTimeout',
    'imgBeefballReal', 'imgHargau', 'imgSiumai', 'Math',
    code + `
return {isDimsumOrderGame, resetDimsumOrderGame, newDimsumOrder, dimsumOrderText,
  dimsumOrderAccepts, dimsumOrderPlace, dimsumOrderLineFor,
  get order(){ return dimsumOrder; },
  get plate(){ return dimsumPlateContents; },
  get completed(){ return dimsumOrdersCompleted; },
  get celebrateUntil(){ return dimsumOrderCelebrateUntil; }};`);
  const mod = fn(
    state, research, opts.foods || [],
    () => { calls.ensure++; },
    (text) => { calls.speak.push(text); },
    () => { calls.applause++; },
    () => 100000,
    (cb, ms) => { calls.timeouts.push({cb, ms}); return calls.timeouts.length; },
    () => {},
    {id: 'beefball'}, {id: 'hargau'}, {id: 'siumai'},
    fakeMath,
  );
  return {mod, calls, state, research};
}

test('gate: order mode only for public level 67 chopstick theme', () => {
  assert.equal(makeOrderModule().mod.isDimsumOrderGame(), true);
  assert.equal(makeOrderModule({research: {active: true}}).mod.isDimsumOrderGame(), false);
  assert.equal(makeOrderModule({state: {level: '5'}}).mod.isDimsumOrderGame(), false);
  assert.equal(makeOrderModule({state: {theme: 'peg_laundry'}}).mod.isDimsumOrderGame(), false);
});

test('a new order asks for two distinct dim sum types, 2-4 pieces each', () => {
  for(const r of [0.0, 0.31, 0.62, 0.99]){
    const {mod, calls} = makeOrderModule({random: () => r});
    const order = mod.newDimsumOrder();
    assert.equal(order.lines.length, 2);
    assert.notEqual(order.lines[0].type, order.lines[1].type);
    for(const line of order.lines){
      assert.ok(line.need >= 2 && line.need <= 4, `need out of range: ${line.need}`);
      assert.equal(line.placed, 0);
    }
    // The order is spoken aloud in Cantonese and shown via dimsumOrderText.
    assert.equal(calls.speak.length, 1);
    assert.match(calls.speak[0], /^我想食\d個[^，]+，\d個[^。]+。$/);
    assert.equal(calls.speak[0], mod.dimsumOrderText());
  }
});

test('placement counts toward the order and appears on the plate', () => {
  const {mod} = makeOrderModule();
  const order = mod.newDimsumOrder();
  const [a, b] = order.lines;
  const itemA = {targetType: a.type};
  assert.equal(mod.dimsumOrderAccepts(itemA), true);
  mod.dimsumOrderPlace(itemA);
  assert.equal(a.placed, 1);
  assert.equal(mod.plate.length, 1);
  assert.ok(Number.isFinite(mod.plate[0].fx) && Number.isFinite(mod.plate[0].fy));
  // A type not on the order is rejected.
  const offMenu = ['chop_beefball', 'chop_hargau', 'chop_siumai']
    .find(t => t !== a.type && t !== b.type);
  assert.equal(mod.dimsumOrderAccepts({targetType: offMenu}), false);
});

test('excess pieces of a completed line are rejected (cognitive counting)', () => {
  const {mod} = makeOrderModule();
  const order = mod.newDimsumOrder();
  const line = order.lines[0];
  for(let i = 0; i < line.need; i++) mod.dimsumOrderPlace({targetType: line.type});
  assert.equal(line.placed, line.need);
  assert.equal(mod.dimsumOrderAccepts({targetType: line.type}), false);
});

test('completing the whole order applauds, praises and schedules the next order', () => {
  const {mod, calls} = makeOrderModule();
  const order = mod.newDimsumOrder();
  for(const line of order.lines){
    for(let i = 0; i < line.need; i++) mod.dimsumOrderPlace({targetType: line.type});
  }
  assert.equal(mod.order.done, true);
  assert.equal(mod.completed, 1);
  assert.equal(calls.applause, 1);
  assert.ok(mod.celebrateUntil > 100000);
  assert.ok(calls.speak.some(t => t.includes('上齊點心')));
  assert.equal(calls.timeouts.length, 1);
  assert.equal(calls.timeouts[0].ms, 2600);
  // The scheduled callback starts a fresh order while the game is running...
  calls.timeouts[0].cb();
  assert.equal(mod.order.done, false);
  assert.equal(mod.plate.length, 0);
});

test('the scheduled next order does not fire after the session stops', () => {
  const {mod, calls, state} = makeOrderModule();
  const order = mod.newDimsumOrder();
  for(const line of order.lines){
    for(let i = 0; i < line.need; i++) mod.dimsumOrderPlace({targetType: line.type});
  }
  state.running = false;
  const doneOrder = mod.order;
  calls.timeouts[0].cb();
  assert.equal(mod.order, doneOrder, 'no new order after the session timer ends');
});

test('reset clears all order state', () => {
  const {mod} = makeOrderModule();
  mod.newDimsumOrder();
  mod.dimsumOrderPlace({targetType: mod.order.lines[0].type});
  mod.resetDimsumOrderGame();
  assert.equal(mod.order, null);
  assert.equal(mod.plate.length, 0);
  assert.equal(mod.completed, 0);
  assert.equal(mod.celebrateUntil, 0);
});
