import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v71 衣夾晾衫「晾衫單」revamp regression tests (30 Aug 2026 user request):
//   1. The two 曬衫竹笆 boxes are gone in public Level 6/7 — replaced by ONE large
//      white drying rack (real photo) shown at the bottom centre.
//   2. Items are REAL clothes photos supplied by the user: 恤衫×2 designs、孖煙通、
//      牛仔褲、半截裙、底衫、襪 (no virtual peg drawn — the patient holds a real peg).
//   3. The game is order-driven like the v69 dim sum game: the screen asks e.g.
//      「晾衫訓練：請將3件恤衫放上晾衫架」, hung clothes accumulate visually ON the
//      rack, completing an order triggers applause + Cantonese「好叻呀」, then a new
//      order starts, repeating until the session timer ends.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contract: real clothes photos ---------------- */

test('real clothes photo assets are preloaded', () => {
  for(const name of ['rack', 'shirt1', 'shirt2', 'boxers', 'jeans', 'skirt', 'vest', 'socks']){
    assert.match(publicSource, new RegExp(`img/laundry_${name}\\.png`));
  }
});

test('laundry order defs cover all six categories with two shirt designs', () => {
  const defsStart = publicSource.indexOf('const LAUNDRY_ORDER_DEFS');
  const defsEnd = publicSource.indexOf('];', defsStart);
  const defs = publicSource.slice(defsStart, defsEnd);
  assert.equal((defs.match(/laundry_shirt'/g) || []).length, 2, 'two shirt designs share one category');
  for(const type of ['laundry_boxers', 'laundry_jeans', 'laundry_skirt', 'laundry_vest', 'laundry_socks']){
    assert.match(defs, new RegExp(type));
  }
  // Items render as real photos through drawDimsumPhoto (aspect-ratio preserving).
  assert.match(publicSource, /if\(isLaundryRackGame\(\)\)\{[\s\S]{0,400}drawDimsumPhoto\(ctx,x,y,r,im\)/);
});

/* ---------------- Source contract: one large rack target ---------------- */

test('both laundry modes use a single central large rack instead of two boxes', () => {
  assert.match(publicSource, /if\(isLaundryRackGame\(\)\)\{[\s\S]{0,1500}type:'laundry_rack'[\s\S]{0,220}style:'rack', x:cw \* 0\.50/);
  assert.match(publicSource, /if\(t\.style === 'rack'\)\{ drawLaundryRackTarget\(ctx, t\); continue; \}/);
  // Hung clothes are drawn ON the rack so the patient can see progress.
  assert.match(publicSource, /for\(const c of laundryRackContents\)\{/);
});

/* ---------------- Source contract: order-driven matching ---------------- */

test('both drop paths route through basic-or-complex rack matching', () => {
  const graspPath = /const laundryOrderDrop = isLaundryRackGame\(\) && onPlate\.type === 'laundry_rack';[\s\S]{0,300}laundryRackAccepts\(heldItem\)/;
  const dwellPath = /const dwellLaundryOrderDrop = isLaundryRackGame\(\) && onPlate\.type === 'laundry_rack';[\s\S]{0,300}laundryRackAccepts\(heldItem\)/;
  assert.match(publicSource, graspPath);
  assert.match(publicSource, dwellPath);
  assert.match(publicSource, /else if\(laundryOrderDrop\) laundryRackPlace\(heldItem\);/);
  assert.match(publicSource, /else if\(dwellLaundryOrderDrop\) laundryRackPlace\(heldItem\);/);
});

test('order mode is fail-safe against spawn deadlocks', () => {
  assert.match(publicSource, /isLaundryOrderGame\(\) && laundryOrder && !laundryOrder\.done/);
  const block = publicSource.slice(publicSource.indexOf('// 晾衫單模式：確保畫面上至少有一件仍然需要嘅衣物'));
  assert.match(block, /const sacrifice = foods\.find\(f=>!f\.removed && !f\.held && isDimSum\(f\) && !needed\.includes\(f\.targetType\)\);/);
});

test('order lifecycle is wired into init, reset, banner and completion', () => {
  assert.match(publicSource, /if\(isLaundryOrderGame\(\)\) newLaundryOrder\(\);/);
  assert.match(publicSource, /resetLaundryOrderGame\(\);/);
  assert.match(publicSource, /drawLaundryOrderBanner\(ctx, cw, ch\);/);
  assert.match(publicSource, /if\(isLaundryOrderGame\(\) && laundryOrderBannerRect\) islands\.push\(laundryOrderBannerRect\);/);
  // Applause + Cantonese praise + auto next order gated on the game still running.
  assert.match(publicSource, /if\(isLaundryOrderGame\(\) && state\.running\) newLaundryOrder\(\);/);
});

test('research pilot track is not affected by either public laundry mode', () => {
  assert.match(publicSource, /function isLaundryRackGame\(\)\{[\s\S]{0,160}return state\.level === '67' && state\.theme === 'peg_laundry' && !research\.active;/);
});

/* ---------------- Behavioural: laundry order module ---------------- */

function makeOrderModule(opts = {}){
  const start = publicSource.indexOf('const LAUNDRY_ORDER_MENU');
  const end = publicSource.indexOf('let level3RoundVariant');
  assert.ok(start > 0 && end > start, 'laundry order module not found in index.html');
  const code = publicSource.slice(start, end);
  const calls = {speak: [], applause: 0, timeouts: [], ensure: 0};
  const state = Object.assign({
    level: '67',
    theme: 'peg_laundry',
    laundryDifficulty: 'complex',
    running: true,
  }, opts.state);
  const research = Object.assign({active: false}, opts.research);
  const rng = opts.random || (() => 0.5);
  const fakeMath = {random: rng, floor: Math.floor, max: Math.max};
  const imgNames = ['imgLaundryShirt1', 'imgLaundryShirt2', 'imgLaundryBoxers',
    'imgLaundryJeans', 'imgLaundrySkirt', 'imgLaundryVest', 'imgLaundrySocks'];
  const fn = new Function(
    'state', 'research', 'foods', 'ensureFoodCount', 'speakCantonese',
    'playApplauseSound', 'nowMs', 'setTimeout', 'clearTimeout', 'Math',
    ...imgNames,
    code + `
return {isLaundryOrderGame, isLaundryBasicGame, resetLaundryOrderGame, newLaundryOrder, laundryOrderText,
  laundryOrderAccepts, laundryOrderPlace, laundryOrderLineFor, laundryBasicPlace, laundryRackPlace,
  LAUNDRY_RACK_CAPACITY, LAUNDRY_RACK_SLOTS, LAUNDRY_RACK_CLEAR_DELAY_MS,
  get order(){ return laundryOrder; },
  get rack(){ return laundryRackContents; },
  get completed(){ return laundryOrdersCompleted; },
  get batches(){ return laundryBatchesCompleted; },
  get clearTimer(){ return laundryRackClearTimerId; },
  get celebrateUntil(){ return laundryOrderCelebrateUntil; }};`);
  const mod = fn(
    state, research, opts.foods || [],
    () => { calls.ensure++; },
    (text) => { calls.speak.push(text); },
    () => { calls.applause++; },
    () => 100000,
    (cb, ms) => { calls.timeouts.push({cb, ms}); return calls.timeouts.length; },
    () => {},
    fakeMath,
    ...imgNames.map(id => ({id})),
  );
  return {mod, calls, state, research};
}

test('gate: order mode only for public level 67 peg laundry theme', () => {
  assert.equal(makeOrderModule().mod.isLaundryOrderGame(), true);
  assert.equal(makeOrderModule({research: {active: true}}).mod.isLaundryOrderGame(), false);
  assert.equal(makeOrderModule({state: {level: '5'}}).mod.isLaundryOrderGame(), false);
  assert.equal(makeOrderModule({state: {theme: 'chopstick_dimsum'}}).mod.isLaundryOrderGame(), false);
});

test('the first order asks for exactly one clothes type, three pieces', () => {
  for(const r of [0.0, 0.31, 0.62, 0.99]){
    const {mod, calls} = makeOrderModule({random: () => r});
    const order = mod.newLaundryOrder();
    assert.equal(order.lines.length, 1, 'first order keeps it simple: one type only');
    assert.equal(order.lines[0].need, 3);
    assert.equal(order.lines[0].placed, 0);
    // The order is spoken aloud in Cantonese and shown via laundryOrderText.
    assert.equal(calls.speak.length, 1);
    assert.match(calls.speak[0], /^請將3[件條對][^。]+放上晾衫架。$/);
    assert.equal(calls.speak[0], mod.laundryOrderText());
  }
});

test('later orders mix 2-3 distinct types, 1-3 pieces each, within the six rack slots', () => {
  for(const r of [0.0, 0.31, 0.62, 0.99]){
    const {mod} = makeOrderModule({random: () => r});
    // Complete the first (single-line) order to unlock mixed orders.
    const first = mod.newLaundryOrder();
    for(let i = 0; i < first.lines[0].need; i++) mod.laundryOrderPlace({targetType: first.lines[0].type});
    const order = mod.newLaundryOrder();
    assert.ok(order.lines.length >= 2 && order.lines.length <= 3, `line count: ${order.lines.length}`);
    const types = order.lines.map(l => l.type);
    assert.equal(new Set(types).size, types.length, 'no duplicate types in one order');
    let total = 0;
    for(const line of order.lines){
      assert.ok(line.need >= 1 && line.need <= 3, `need out of range: ${line.need}`);
      total += line.need;
    }
    assert.ok(total <= 6, 'v101: total pieces never exceed the six rack hanging slots');
    assert.match(mod.laundryOrderText(), /^請將\d[件條對].+放上晾衫架。$/);
  }
});

test('measure words match Cantonese usage (件/條/對)', () => {
  const {mod} = makeOrderModule();
  mod.newLaundryOrder();
  const menuStart = publicSource.indexOf('const LAUNDRY_ORDER_MENU');
  const menu = publicSource.slice(menuStart, publicSource.indexOf('];', menuStart));
  assert.match(menu, /'恤衫',\s*unit:'件'/);
  assert.match(menu, /'孖煙通',\s*unit:'條'/);
  assert.match(menu, /'牛仔褲',\s*unit:'條'/);
  assert.match(menu, /'半截裙',\s*unit:'條'/);
  assert.match(menu, /'底衫',\s*unit:'件'/);
  assert.match(menu, /'襪',\s*unit:'對'/);
});

test('placement counts toward the order and hangs the item on the rack', () => {
  const {mod} = makeOrderModule();
  const order = mod.newLaundryOrder();
  const line = order.lines[0];
  const img = {id: 'photo'};
  assert.equal(mod.laundryOrderAccepts({targetType: line.type}), true);
  mod.laundryOrderPlace({targetType: line.type, img});
  assert.equal(line.placed, 1);
  assert.equal(mod.rack.length, 1);
  assert.equal(mod.rack[0].img, img, 'the hung visual uses the item\'s own photo');
  assert.ok(Number.isFinite(mod.rack[0].fx));
  // A type not on the order is rejected.
  const offMenu = ['laundry_shirt', 'laundry_boxers', 'laundry_jeans', 'laundry_skirt',
    'laundry_vest', 'laundry_socks'].find(t => t !== line.type);
  assert.equal(mod.laundryOrderAccepts({targetType: offMenu}), false);
});

test('excess pieces of a completed line are rejected (cognitive counting)', () => {
  const {mod} = makeOrderModule();
  const order = mod.newLaundryOrder();
  const line = order.lines[0];
  for(let i = 0; i < line.need; i++) mod.laundryOrderPlace({targetType: line.type});
  assert.equal(line.placed, line.need);
  assert.equal(mod.laundryOrderAccepts({targetType: line.type}), false);
});

test('completing the order applauds, praises 好叻呀 and schedules the next order', () => {
  const {mod, calls} = makeOrderModule();
  const order = mod.newLaundryOrder();
  for(const line of order.lines){
    for(let i = 0; i < line.need; i++) mod.laundryOrderPlace({targetType: line.type});
  }
  assert.equal(mod.order.done, true);
  assert.equal(mod.completed, 1);
  assert.equal(calls.applause, 1);
  assert.ok(mod.celebrateUntil > 100000);
  assert.ok(calls.speak.some(t => t.includes('好叻呀')));
  assert.equal(calls.timeouts.length, 1);
  assert.equal(calls.timeouts[0].ms, 2600);
  // The scheduled callback starts a fresh order while the game is running...
  calls.timeouts[0].cb();
  assert.equal(mod.order.done, false);
  assert.equal(mod.rack.length, 0, 'the rack is cleared for the next order');
});

test('the scheduled next order does not fire after the session stops', () => {
  const {mod, calls, state} = makeOrderModule();
  const order = mod.newLaundryOrder();
  for(const line of order.lines){
    for(let i = 0; i < line.need; i++) mod.laundryOrderPlace({targetType: line.type});
  }
  state.running = false;
  const doneOrder = mod.order;
  calls.timeouts[0].cb();
  assert.equal(mod.order, doneOrder, 'no new order after the session timer ends');
});

test('reset clears all order state', () => {
  const {mod} = makeOrderModule();
  mod.newLaundryOrder();
  mod.laundryOrderPlace({targetType: mod.order.lines[0].type});
  mod.resetLaundryOrderGame();
  assert.equal(mod.order, null);
  assert.equal(mod.rack.length, 0);
  assert.equal(mod.completed, 0);
  assert.equal(mod.celebrateUntil, 0);
});

/* ---------------- v101: one garment at a time, six-garment rack cycle ---------------- */

test('v101 source: Level 6 laundry shows one garment at a time from a centred lower slot', () => {
  assert.match(publicSource, /if\(isLaundryRackGame\(\)\) return 1;/);
  assert.match(publicSource, /if\(isLaundryRackGame\(\) && dimSumTargetCount\(\) === 1 && activeCount === 0\)\{[\s\S]{0,260}cw \* 0\.50[\s\S]{0,120}portrait \? 0\.80 : 0\.78/);
  assert.match(publicSource, /const LAUNDRY_RACK_SLOTS = \[-0\.375, -0\.225, -0\.075, 0\.075, 0\.225, 0\.375\];/);
  assert.match(publicSource, /const LAUNDRY_RACK_CAPACITY = 6;/);
  assert.match(publicSource, /const railW = Math\.min\(rw, cw \* 0\.96\);[\s\S]{0,200}const railY = Math\.max\(t\.y - rh \* 0\.42, hudSafeTop\);[\s\S]{0,400}const maxW = railW \* 0\.13;/);
  assert.match(publicSource, /laundryRack: isLaundryRackGame\(\) \? \{[\s\S]{0,200}capacity: LAUNDRY_RACK_CAPACITY/);
});

test('v101 basic mode: the sixth garment fills the rack, then one light timer clears it and announces new laundry', () => {
  const {mod, calls, state} = makeOrderModule({state: {laundryDifficulty: 'basic'}});
  assert.equal(mod.isLaundryBasicGame(), true);
  const item = {targetType: 'laundry_shirt', img: {id: 'imgLaundryShirt1'}};
  for(let i = 0; i < 5; i++) mod.laundryRackPlace(item);
  assert.equal(mod.rack.length, 5);
  assert.equal(calls.applause, 0);
  assert.equal(calls.timeouts.length, 0);
  mod.laundryRackPlace(item);
  // Rack stays visibly full for the celebration; exactly one timer is scheduled.
  assert.equal(mod.rack.length, 6);
  assert.deepEqual(mod.rack.map(c => c.fx), mod.LAUNDRY_RACK_SLOTS);
  assert.equal(calls.applause, 1);
  assert.equal(mod.batches, 1);
  assert.equal(calls.timeouts.length, 1);
  assert.equal(calls.timeouts[0].ms, mod.LAUNDRY_RACK_CLEAR_DELAY_MS);
  assert.ok(!calls.speak.some(t => /又有新衫要晾喇/.test(t)), 'announcement waits for the clear');
  calls.timeouts[0].cb();
  assert.equal(mod.rack.length, 0, 'rack cleared');
  assert.equal(calls.speak[calls.speak.length - 1], '又有新衫要晾喇！');
  assert.equal(mod.celebrateUntil, 0);
  // The cycle repeats indefinitely.
  for(let i = 0; i < 6; i++) mod.laundryRackPlace(item);
  assert.equal(mod.batches, 2);
  assert.equal(calls.timeouts.length, 2);
  // Stopping the session before the timer fires leaves the rack untouched and silent.
  state.running = false;
  const spoken = calls.speak.length;
  calls.timeouts[1].cb();
  assert.equal(mod.rack.length, 6);
  assert.equal(calls.speak.length, spoken);
});

test('v101 basic mode: hanging a seventh garment before the timer fires clears the rack immediately', () => {
  const {mod, calls} = makeOrderModule({state: {laundryDifficulty: 'basic'}});
  const item = {targetType: 'laundry_vest', img: null};
  for(let i = 0; i < 6; i++) mod.laundryRackPlace(item);
  assert.equal(mod.rack.length, 6);
  mod.laundryRackPlace(item);
  assert.equal(mod.rack.length, 1, 'old batch cleared, new garment is first on the rail');
  assert.equal(mod.rack[0].fx, mod.LAUNDRY_RACK_SLOTS[0]);
  assert.equal(mod.clearTimer, null);
  assert.equal(calls.applause, 1);
});

test('v101 complex mode: orders after the first are announced with 又有新衫要晾喇 and never exceed six pieces', () => {
  for(const r of [0.0, 0.5, 0.99]){
    const {mod, calls} = makeOrderModule({random: () => r});
    const first = mod.newLaundryOrder();
    assert.doesNotMatch(calls.speak[0], /又有新衫要晾喇/);
    for(let i = 0; i < first.lines[0].need; i++) mod.laundryOrderPlace({targetType: first.lines[0].type});
    const second = mod.newLaundryOrder();
    assert.match(calls.speak[calls.speak.length - 1], /^又有新衫要晾喇！請將/);
    assert.ok(second.lines.reduce((sum, l) => sum + l.need, 0) <= 6);
    assert.ok(second.lines.every(l => l.need >= 1));
  }
});

test('v101 reset clears the basic-mode batch counter and pending clear timer', () => {
  const {mod} = makeOrderModule({state: {laundryDifficulty: 'basic'}});
  for(let i = 0; i < 6; i++) mod.laundryRackPlace({targetType: 'laundry_socks', img: null});
  assert.ok(mod.clearTimer);
  mod.resetLaundryOrderGame();
  assert.equal(mod.rack.length, 0);
  assert.equal(mod.batches, 0);
  assert.equal(mod.clearTimer, null);
});
