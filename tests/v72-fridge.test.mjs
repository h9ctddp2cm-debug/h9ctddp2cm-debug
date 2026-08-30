import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v72 Level 5 雪櫃收納遊戲 regression tests (30 Aug 2026 user request):
//   1. New Level 5 theme「雪櫃收納」: after grocery shopping, put 12 foods
//      (叉燒飯、排骨、豆腐、蝦、肉丸、菠菜、菜心、黃芽白、南瓜、牛奶、魚、荷蘭豆)
//      one by one from a grocery bag (bottom of screen) into a large open
//      fridge photo (top of screen).
//   2. The player may place each food ANYWHERE inside the fridge interior,
//      but placing on top of an already-placed food "crashes" and is rejected
//      (no score penalty — spatial planning is part of the training).
//   3. Completing all 12 foods triggers applause + Cantonese praise, then a
//      new shuffled round starts automatically while the session timer runs.
//   4. Research pilot mode is never routed into this game.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contract: assets & theme wiring ---------------- */

test('fridge photo assets are preloaded (fridge + 12 foods)', () => {
  for(const name of ['open', 'charsiu_rice', 'ribs', 'tofu', 'shrimp', 'meatball',
    'spinach', 'choysum', 'napa', 'pumpkin', 'milk', 'fish', 'snowpea']){
    assert.match(publicSource, new RegExp(`img/fridge_${name}\\.png`));
  }
});

test('fridge theme is registered and gated to public Level 5 only', () => {
  assert.match(publicSource, /id:'fridge', title:'雪櫃收納'/);
  assert.match(publicSource, /'dimsum','laundry','fridge','cards'/);
  assert.match(publicSource, /if\(themeId === 'fridge'\) return level === '5';/);
});

test('fridge order defs cover all 12 requested foods', () => {
  const defsStart = publicSource.indexOf('const FRIDGE_ORDER_DEFS');
  const defsEnd = publicSource.indexOf('];', defsStart);
  const defs = publicSource.slice(defsStart, defsEnd);
  for(const label of ['叉燒飯', '排骨', '豆腐', '蝦', '肉丸', '菠菜',
    '菜心', '黃芽白', '南瓜', '牛奶', '魚', '荷蘭豆']){
    assert.match(defs, new RegExp(label));
  }
  assert.equal((defs.match(/type:'fridge_/g) || []).length, 12);
  // Foods render as real photos through drawDimsumPhoto (aspect preserving).
  assert.match(publicSource, /if\(isFridgeGame\(\)\)\{[\s\S]{0,400}drawDimsumPhoto\(ctx,x,y,r,im\)/);
});

/* ---------------- Source contract: layout & rendering ---------------- */

test('fridge target sits at the top, grocery bag spawn at the bottom', () => {
  assert.match(publicSource, /type:'fridge', label:'雪櫃', img:imgFridgeOpen[\s\S]{0,120}style:'fridge', x:cw \/ 2, y:th \/ 2 \+ ch \* \(portrait \? 0\.115 : 0\.13\)/);
  assert.match(publicSource, /if\(t\.style === 'fridge'\)\{ drawFridgeTarget\(ctx, t\); continue; \}/);
  assert.match(publicSource, /function fridgeBagSpot\(cw, ch, r\)\{[\s\S]{0,200}ch - r - \(portrait \? 96 : 56\)/);
  // Placed foods are drawn inside the fridge so the patient sees progress.
  assert.match(publicSource, /for\(const p of fridgePlacedFoods\)\{/);
});

test('banner, exclusion islands and lifecycle hooks are wired', () => {
  assert.match(publicSource, /drawFridgeOrderBanner\(ctx, cw, ch\);/);
  assert.match(publicSource, /if\(isFridgeGame\(\) && fridgeBannerRect\) islands\.push\(fridgeBannerRect\);/);
  assert.match(publicSource, /resetFridgeGame\(\);/);
  assert.match(publicSource, /if\(isFridgeGame\(\)\) newFridgeRound\(\);/);
  assert.match(publicSource, /if\(isFridgeGame\(\) && state\.running\) newFridgeRound\(\);/);
  assert.match(publicSource, /fridgeGame: \(isFridgeGame\(\) && fridgeQueue\.length\)/);
});

/* ---------------- Source contract: drop paths & scoring ---------------- */

test('both drop paths route fridge drops through fridgeTryPlace', () => {
  assert.match(publicSource, /const fridgeDrop = isFridgeGame\(\) && onPlate\.type === 'fridge';[\s\S]{0,300}fridgeTryPlace\(heldItem, cursorX, cursorY, onPlate\)/);
  assert.match(publicSource, /const dwellFridgeDrop = isFridgeGame\(\) && onPlate\.type === 'fridge';[\s\S]{0,400}fridgeTryPlace\(heldItem, heldPoint\.x, heldPoint\.y, onPlate\)/);
});

test('a crash/out-of-bounds rejection never deducts score or feeds wrongStreak', () => {
  for(const branch of [/else if\(fridgeDrop\)\{[\s\S]{0,300}?\} else \{/, /else if\(dwellFridgeDrop\)\{[\s\S]{0,300}?\} else \{/]){
    const m = publicSource.match(branch);
    assert.ok(m, 'fridge reject branch exists before the score-penalty else');
    assert.doesNotMatch(m[0].split('} else {')[0], /score -=|wrongStreak\+\+|adaptiveNoteTrial/);
  }
});

test('deadlock guard keeps exactly the next required food available', () => {
  const block = publicSource.slice(publicSource.indexOf('// 雪櫃收納模式：畫面上唯一嗰樣食物必須係「下一樣」'));
  assert.match(block, /f\.targetType === def\.type/);
  assert.match(block, /foods\.push\(spawnDimSum\(foods\)\)/);
});

test('research pilot scenarios never include the fridge theme', () => {
  const pilotStart = publicSource.indexOf('PILOT_TRAINING_SCENARIOS');
  const pilotEnd = publicSource.indexOf('];', pilotStart);
  assert.doesNotMatch(publicSource.slice(pilotStart, pilotEnd), /fridge/);
});

/* ---------------- Behavioural: fridge module ---------------- */

function makeFridgeModule(opts = {}){
  const start = publicSource.indexOf('const FRIDGE_ORDER_DEFS');
  const end = publicSource.indexOf('let level3RoundVariant');
  assert.ok(start > 0 && end > start, 'fridge module not found in index.html');
  const code = publicSource.slice(start, end);
  const calls = {speak: [], applause: 0, timeouts: [], ensure: 0};
  const state = Object.assign({level: '5', theme: 'fridge', running: true}, opts.state);
  const research = Object.assign({active: false}, opts.research);
  const rng = opts.random || (() => 0.5);
  const fakeMath = Object.create(Math);
  fakeMath.random = rng;
  const imgNames = ['imgFridgeCharsiuRice', 'imgFridgeRibs', 'imgFridgeTofu',
    'imgFridgeShrimp', 'imgFridgeMeatball', 'imgFridgeSpinach', 'imgFridgeChoysum',
    'imgFridgeNapa', 'imgFridgePumpkin', 'imgFridgeMilk', 'imgFridgeFish', 'imgFridgeSnowpea'];
  const fn = new Function(
    'state', 'research', 'foods', 'ensureFoodCount', 'speakCantonese',
    'playApplauseSound', 'nowMs', 'setTimeout', 'clearTimeout', 'Math', 'isPortrait',
    'gameCanvas',
    ...imgNames,
    code + `
return {isFridgeGame, resetFridgeGame, newFridgeRound, fridgeCurrentDef,
  fridgeTryPlace, fridgeInteriorRect, fridgePlacedRadius, fridgeBagSpot,
  FRIDGE_ORDER_DEFS,
  get queue(){ return fridgeQueue; },
  get queueIndex(){ return fridgeQueueIndex; },
  get placed(){ return fridgePlacedFoods; },
  get roundsCompleted(){ return fridgeRoundsCompleted; },
  get celebrateUntil(){ return fridgeCelebrateUntil; },
  get crashUntil(){ return fridgeCrashUntil; },
  get crashMsg(){ return fridgeCrashMsg; }};`);
  const mod = fn(
    state, research, opts.foods || [],
    () => { calls.ensure++; },
    (text) => { calls.speak.push(text); },
    () => { calls.applause++; },
    () => 100000,
    (cb, ms) => { calls.timeouts.push({cb, ms}); return calls.timeouts.length; },
    () => {},
    fakeMath,
    () => true,
    opts.gameCanvas || {width: 800, height: 1200},
    ...imgNames.map(id => ({id})),
  );
  return {mod, calls, state, research};
}

// A fake fridge target with no image: interior rect = plain w×h box.
// rect: x0=200 y0=130 rw=600 rh=340; pr = min(340*.135, 600*.075) = 45.
const T = {x: 500, y: 300, w: 600, h: 340, img: null};
const item = (def) => ({targetType: def.type, label: def.label, img: null});

test('gate: fridge game only for public Level 5 fridge theme', () => {
  assert.equal(makeFridgeModule().mod.isFridgeGame(), true);
  assert.equal(makeFridgeModule({research: {active: true}}).mod.isFridgeGame(), false);
  assert.equal(makeFridgeModule({state: {level: '67'}}).mod.isFridgeGame(), false);
  assert.equal(makeFridgeModule({state: {theme: 'dimsum'}}).mod.isFridgeGame(), false);
});

test('a new round shuffles all 12 foods and speaks the Cantonese intro', () => {
  const {mod, calls} = makeFridgeModule();
  const queue = mod.newFridgeRound();
  assert.equal(queue.length, 12);
  assert.deepEqual([...queue].sort((a, b) => a - b), [...Array(12).keys()]);
  assert.equal(calls.speak.length, 1);
  assert.match(calls.speak[0], /買完餸返嚟喇/);
  assert.equal(mod.fridgeCurrentDef(), mod.FRIDGE_ORDER_DEFS[queue[0]]);
});

test('placing the current food inside the fridge succeeds and advances the queue', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  const def = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(def), 500, 300, T), true);
  assert.equal(mod.queueIndex, 1);
  assert.equal(mod.placed.length, 1);
  assert.ok(Math.abs(mod.placed[0].fx - 0.5) < 1e-9);
  assert.ok(Math.abs(mod.placed[0].fy - 0.5) < 1e-9);
});

test('wrong food, distractors and finished queues are rejected', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  const wrongIdx = mod.queue[1];
  assert.equal(mod.fridgeTryPlace(item(mod.FRIDGE_ORDER_DEFS[wrongIdx]), 500, 300, T), false);
  assert.equal(mod.fridgeTryPlace({targetType: 'distractor', label: '雜物'}, 500, 300, T), false);
  assert.equal(mod.placed.length, 0);
});

test('placing outside the interior crashes with a bounds reminder, no placement', () => {
  const {mod, calls} = makeFridgeModule();
  mod.newFridgeRound();
  const def = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(def), 210, 300, T), false);
  assert.equal(mod.placed.length, 0);
  assert.equal(mod.queueIndex, 0);
  assert.ok(mod.crashUntil > 100000);
  assert.match(mod.crashMsg, /要放入雪櫃入面/);
  assert.ok(calls.speak.some(s => /要放入雪櫃入面/.test(s)));
});

test('placing on an occupied spot crashes and names the blocking food', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  const first = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(first), 500, 300, T), true);
  const second = mod.fridgeCurrentDef();
  // Same spot → crash; nearby-but-clear spot → success (pr=45, min gap 82.8px).
  assert.equal(mod.fridgeTryPlace(item(second), 510, 300, T), false);
  assert.match(mod.crashMsg, new RegExp(first.label));
  assert.equal(mod.queueIndex, 1);
  assert.equal(mod.fridgeTryPlace(item(second), 590, 300, T), true);
  assert.equal(mod.queueIndex, 2);
});

test('finishing all 12 foods triggers applause, praise and an auto next round', () => {
  const {mod, calls} = makeFridgeModule();
  mod.newFridgeRound();
  const spots = [];
  for(let i = 0; i < 12; i++) spots.push({x: 260 + (i % 6) * 90, y: 190 + Math.floor(i / 6) * 130});
  for(let i = 0; i < 12; i++){
    const def = mod.fridgeCurrentDef();
    assert.equal(mod.fridgeTryPlace(item(def), spots[i].x, spots[i].y, T), true, `food ${i}`);
  }
  assert.equal(mod.placed.length, 12);
  assert.equal(mod.fridgeCurrentDef(), null);
  assert.equal(mod.roundsCompleted, 1);
  assert.equal(calls.applause, 1);
  assert.ok(calls.speak.some(s => /好叻呀！全部餸菜都放入雪櫃喇/.test(s)));
  assert.ok(mod.celebrateUntil > 100000);
  assert.equal(calls.timeouts.length, 1);
  assert.equal(calls.timeouts[0].ms, 2600);
  // The queued callback starts the next round while the session is running.
  calls.timeouts[0].cb();
  assert.equal(mod.queueIndex, 0);
  assert.equal(mod.placed.length, 0);
  assert.equal(mod.queue.length, 12);
});

test('reset clears every piece of fridge round state', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  const def = mod.fridgeCurrentDef();
  mod.fridgeTryPlace(item(def), 500, 300, T);
  mod.resetFridgeGame();
  assert.equal(mod.queue.length, 0);
  assert.equal(mod.queueIndex, 0);
  assert.equal(mod.placed.length, 0);
  assert.equal(mod.celebrateUntil, 0);
  assert.equal(mod.isFridgeGame(), true);
});

test('placed-food radius allows all 12 foods to fit with planning', () => {
  const {mod} = makeFridgeModule();
  const rect = mod.fridgeInteriorRect(T);
  const pr = mod.fridgePlacedRadius(rect);
  assert.ok(Math.abs(pr - 45) < 1e-9);
  // 6×2 grid with 90/130px spacing stays inside the interior margins.
  assert.ok(260 - pr * 0.6 >= rect.left && 710 + pr * 0.6 <= rect.right);
  assert.ok(190 - pr * 0.6 >= rect.top && 320 + pr * 0.6 <= rect.bottom);
});
