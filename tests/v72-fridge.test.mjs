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
//   2. The player may place each food ANYWHERE inside the fridge interior.
//      Accepted foods are automatically rearranged into a clear non-overlapping
//      layout, while their generous interaction hitboxes remain unchanged.
//   3. Completing all 12 foods triggers applause + Cantonese praise, then a
//      new shuffled round starts automatically while the session timer runs.
//   4. Research pilot mode is never routed into this game.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------------- Source contract: assets & theme wiring ---------------- */

test('fridge photo assets are preloaded (fridge + 13 foods, v101 apple replaces tofu, durian added)', () => {
  for(const name of ['open', 'charsiu_rice', 'ribs', 'apple', 'shrimp', 'meatball',
    'spinach', 'choysum', 'napa', 'pumpkin', 'milk', 'fish', 'snowpea', 'durian']){
    assert.match(publicSource, new RegExp(`img/fridge_${name}\\.png`));
  }
  assert.doesNotMatch(publicSource, /imgFridgeTofu|fridge_tofu/);
});

test('fridge theme is registered and gated to public Level 5 only', () => {
  assert.match(publicSource, /id:'fridge', title:'雪櫃收納'/);
  assert.match(publicSource, /'dimsum','laundry','fridge','cards'/);
  assert.match(publicSource, /if\(themeId === 'fridge'\) return level === '5';/);
});

test('fridge order defs cover all 13 requested foods', () => {
  const defsStart = publicSource.indexOf('const FRIDGE_ORDER_DEFS');
  const defsEnd = publicSource.indexOf('];', defsStart);
  const defs = publicSource.slice(defsStart, defsEnd);
  for(const label of ['叉燒飯', '排骨', '蘋果', '蝦', '肉丸', '菠菜',
    '菜心', '黃芽白', '南瓜', '牛奶', '魚', '荷蘭豆', '榴槤']){
    assert.match(defs, new RegExp(label));
  }
  assert.doesNotMatch(defs, /豆腐/);
  assert.equal((defs.match(/type:'fridge_/g) || []).length, 13);
  assert.match(publicSource, /const FRIDGE_ROUND_SIZE = 6;/);
  // Foods render as real photos through drawDimsumPhoto (aspect preserving).
  assert.match(publicSource, /if\(isFridgeGame\(\)\)\{[\s\S]{0,400}drawDimsumPhoto\(ctx,x,y,r,im\)/);
});

/* ---------------- Source contract: layout & rendering ---------------- */

test('fridge target sits at the top, grocery bag spawn at the bottom', () => {
  assert.match(publicSource, /const tw = cw;/);
  assert.match(publicSource, /const th = ch\*\(1 - fridgeLaneFrac\(cw, ch\)\);/);
  assert.match(publicSource, /type:'fridge', label:'雪櫃', img:imgFridgeWide[\s\S]{0,160}style:'fridge', x:cw \/ 2, y:th \/ 2, w:tw/);
  assert.match(publicSource, /if\(t\.style === 'fridge'\)\{ drawFridgeTarget\(ctx, t\); continue; \}/);
  assert.match(publicSource, /function fridgeBagSpot\(cw, ch, r\)\{[\s\S]{0,320}y:laneTop \+ 8 \+ vr,/);
  assert.match(publicSource, /function fridgeTrayVisualRadius\(cw, ch, r\)\{[\s\S]{0,260}Math\.min\(r, \(laneH - FRIDGE_TRAY_LABEL_H - 8\) \/ 2\.04\)/);
  assert.match(publicSource, /visualR:isFridgeGame\(\) \? fridgeTrayVisualRadius\(cw, ch, r\) : r/);
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
  const state = Object.assign({level: '5', theme: 'fridge', running: true, fridgeDifficulty: 'basic'}, opts.state);
  const research = Object.assign({active: false}, opts.research);
  const rng = opts.random || (() => 0.5);
  const fakeMath = Object.create(Math);
  fakeMath.random = rng;
  const imgNames = ['imgFridgeCharsiuRice', 'imgFridgeRibs', 'imgFridgeApple',
    'imgFridgeShrimp', 'imgFridgeMeatball', 'imgFridgeSpinach', 'imgFridgeChoysum',
    'imgFridgeNapa', 'imgFridgePumpkin', 'imgFridgeMilk', 'imgFridgeFish', 'imgFridgeSnowpea',
    'imgFridgeDurian'];
  const fn = new Function(
    'state', 'research', 'foods', 'ensureFoodCount', 'speakCantonese',
    'playApplauseSound', 'nowMs', 'setTimeout', 'clearTimeout', 'Math', 'isPortrait',
    'gameCanvas',
    ...imgNames,
    code + `
return {isFridgeGame, resetFridgeGame, newFridgeRound, fridgeCurrentDef,
  fridgeTryPlace, fridgeInteriorRect, fridgePlacedRadius, fridgeBagSpot,
  fridgeTrayVisualRadius, fridgeLaneFrac, fridgeZoneFrac, fridgeZoneBounds, fridgeLitZone, isFridgeZoneMode, fridgeZoneGrid,
  FRIDGE_ORDER_DEFS, FRIDGE_ROUND_SIZE,
  get zoneOrder(){ return fridgeZoneOrder; },
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
// rect: x0=200 y0=130 rw=600 rh=340; portrait pr = min(340*.115, 600*.065) = 39.
const T = {x: 500, y: 300, w: 600, h: 340, img: null};
const item = (def) => ({targetType: def.type, label: def.label, img: null});

test('gate: fridge game only for public Level 5 fridge theme', () => {
  assert.equal(makeFridgeModule().mod.isFridgeGame(), true);
  assert.equal(makeFridgeModule({research: {active: true}}).mod.isFridgeGame(), false);
  assert.equal(makeFridgeModule({state: {level: '67'}}).mod.isFridgeGame(), false);
  assert.equal(makeFridgeModule({state: {theme: 'dimsum'}}).mod.isFridgeGame(), false);
});

test('a new round draws 6 distinct foods from the 13 defs and speaks the Cantonese intro', () => {
  const {mod, calls} = makeFridgeModule();
  const queue = mod.newFridgeRound();
  assert.equal(queue.length, 6);
  assert.equal(new Set(queue).size, 6);
  assert.ok(queue.every(i => i >= 0 && i < 13));
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
  assert.ok(mod.placed[0].fx > 0 && mod.placed[0].fx < 1);
  assert.ok(mod.placed[0].fy > 0 && mod.placed[0].fy < 1);
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

test('overlapping requested drops are accepted and automatically rearranged', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  const first = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(first), 500, 300, T), true);
  const second = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(second), 500, 300, T), true);
  assert.equal(mod.queueIndex, 2);
  assert.equal(mod.placed.length, 2);
  assert.notDeepEqual(
    [mod.placed[0].fx, mod.placed[0].fy],
    [mod.placed[1].fx, mod.placed[1].fy],
  );
});

test('finishing all 6 foods triggers applause, praise and an auto next round', () => {
  const {mod, calls} = makeFridgeModule();
  mod.newFridgeRound();
  const spots = [];
  for(let i = 0; i < 6; i++) spots.push({x: 270 + (i % 3) * 180, y: 200 + Math.floor(i / 3) * 130});
  for(let i = 0; i < 6; i++){
    const def = mod.fridgeCurrentDef();
    assert.equal(mod.fridgeTryPlace(item(def), spots[i].x, spots[i].y, T), true, `food ${i}`);
  }
  assert.equal(mod.placed.length, 6);
  assert.equal(mod.fridgeCurrentDef(), null);
  assert.equal(mod.roundsCompleted, 1);
  assert.equal(calls.applause, 1);
  assert.ok(calls.speak.some(s => /好叻呀！全部食物都放入雪櫃喇/.test(s)));
  assert.ok(mod.celebrateUntil > 100000);
  assert.equal(calls.timeouts.length, 1);
  assert.equal(calls.timeouts[0].ms, 2600);
  // The queued callback starts the next round while the session is running.
  calls.timeouts[0].cb();
  assert.equal(mod.queueIndex, 0);
  assert.equal(mod.placed.length, 0);
  assert.equal(mod.queue.length, 6);
  // v101: the second and later rounds announce new food instead of the shopping intro.
  assert.match(calls.speak[calls.speak.length - 1], /又有新食物要放喇/);
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

test('placed-food radius (v101: 2x) still fits the automatic 6-slot arrangement', () => {
  const {mod} = makeFridgeModule({gameCanvas: {width: 820, height: 1180}});
  // realistic iPad portrait fridge target: full width, 74% height
  const P = {x: 410, y: 1180 * 0.74 / 2, w: 820, h: 1180 * 0.74, img: null};
  const rect = mod.fridgeInteriorRect(P);
  const pr = mod.fridgePlacedRadius(rect);
  // portrait: min(rh*0.150, rw*0.190); at least 2x the v81 value
  assert.ok(Math.abs(pr - Math.min(rect.rh * 0.150, rect.rw * 0.190)) < 1e-9);
  assert.ok(pr >= 2 * Math.min(rect.rh * 0.115, rect.rw * 0.065) - 1e-9);
  // Six placed foods (2×3 portrait grid) never overlap each other.
  mod.newFridgeRound();
  for(let i = 0; i < 6; i++) assert.equal(mod.fridgeTryPlace(item(mod.fridgeCurrentDef()), 410, 400, P), true);
  const pts = mod.placed.map(p => ({x: rect.x0 + p.fx * rect.rw, y: rect.y0 + p.fy * rect.rh}));
  for(let i = 0; i < pts.length; i++) for(let j = i + 1; j < pts.length; j++){
    assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= 2 * pr - 1e-9, `placed ${i}/${j} overlap`);
  }
});

test('landscape placed radius is also 2x v81 and fits a 3 by 2 grid', () => {
  const {mod} = makeFridgeModule({gameCanvas: {width: 1180, height: 820}});
  const L = {x: 590, y: 287, w: 1180, h: 574, img: null};
  const rect = mod.fridgeInteriorRect(L);
  const pr = mod.fridgePlacedRadius(rect);
  assert.ok(Math.abs(pr - Math.min(rect.rh * 0.200, rect.rw * 0.130)) < 1e-9);
  assert.ok(pr >= 2 * Math.min(rect.rh * 0.100, rect.rw * 0.055) - 1e-9);
  assert.deepEqual(mod.fridgeZoneGrid(), {columns: 3, rows: 2});
  // three columns spaced across the interior leave clear gaps between 2*pr photos
  const gap = (rect.right - rect.left) * (0.90 - 2 * 0.055) / 2;
  assert.ok(gap >= 2 * pr, `column spacing ${gap} vs diameter ${2 * pr}`);
});

test('tray food visual radius is capped by the lower lane and never exceeds the pickup radius', () => {
  const {mod} = makeFridgeModule();
  // portrait 820×1180: lane 26% → laneH 306.8 → (306.8-44)/2.04 = 128.8 > r=122 → full 2x of the old r*0.5
  assert.ok(Math.abs(mod.fridgeTrayVisualRadius(820, 1180, 122) - 122) < 1e-9);
  // landscape 1180×820: lane 33% → (270.6-44)/2.04 = 111.1 < r=184 → capped so it never covers the fridge
  const vr = mod.fridgeTrayVisualRadius(1180, 820, 184);
  assert.ok(Math.abs(vr - (820 * 0.33 - 44) / 2.04) < 1e-6);
  for(const [cw, ch, r] of [[1180, 820, 184], [820, 1180, 122], [1024, 768, 170], [768, 1024, 110]]){
    const v = mod.fridgeTrayVisualRadius(cw, ch, r);
    const spot = mod.fridgeBagSpot(cw, ch, r);
    const laneTop = ch * (1 - mod.fridgeLaneFrac(cw, ch));
    assert.ok(spot.y - v >= laneTop - 1e-9, `${cw}x${ch} tray food stays inside the lower lane`);
    // Photo plus the 27px name label (drawn at y + 1.04·v, ~36px tall) must both fit above the canvas bottom.
    assert.ok(spot.y + v * 1.04 + 36 <= ch + 1e-9, `${cw}x${ch} label not clipped`);
  }
});

/* ---------------- v101: 着燈六格 advanced mode ---------------- */

test('zone mode: each round lights the six zones once in random order and only accepts the lit zone', () => {
  const {mod, calls} = makeFridgeModule({state: {fridgeDifficulty: 'zones'}});
  assert.equal(mod.isFridgeZoneMode(), true);
  mod.newFridgeRound();
  assert.equal(mod.zoneOrder.length, 6);
  assert.deepEqual([...mod.zoneOrder].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.match(calls.speak[0], /着燈嗰格/);
  const rect = mod.fridgeInteriorRect(T);
  const lit = mod.fridgeLitZone();
  assert.ok(lit >= 0 && lit <= 5);
  // Releasing in a different zone is rejected without placing, with a zone reminder.
  const other = (lit + 1) % 6;
  const oz = mod.fridgeZoneFrac(other, rect);
  const def = mod.fridgeCurrentDef();
  assert.equal(mod.fridgeTryPlace(item(def), rect.x0 + oz.cx * rect.rw, rect.y0 + oz.cy * rect.rh, T), false);
  assert.equal(mod.placed.length, 0);
  assert.match(mod.crashMsg, /要放喺着燈嗰格/);
  // Releasing inside the lit zone succeeds and the food sits at the zone centre.
  const lz = mod.fridgeZoneFrac(lit, rect);
  assert.equal(mod.fridgeTryPlace(item(def), rect.x0 + (lz.left + 0.01) * rect.rw, rect.y0 + (lz.bottom - 0.01) * rect.rh, T), true);
  assert.equal(mod.placed.length, 1);
  assert.equal(mod.placed[0].zone, lit);
  assert.ok(Math.abs(mod.placed[0].fx - lz.cx) < 1e-9 && Math.abs(mod.placed[0].fy - lz.cy) < 1e-9);
  // The next lit zone is different from the one just filled.
  assert.notEqual(mod.fridgeLitZone(), lit);
  // Complete the round: every zone ends up filled exactly once.
  while(mod.fridgeCurrentDef()){
    const z = mod.fridgeZoneFrac(mod.fridgeLitZone(), rect);
    assert.equal(mod.fridgeTryPlace(item(mod.fridgeCurrentDef()), rect.x0 + z.cx * rect.rw, rect.y0 + z.cy * rect.rh, T), true);
  }
  assert.deepEqual(mod.placed.map(p => p.zone).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(mod.roundsCompleted, 1);
  assert.equal(mod.fridgeLitZone(), -1);
});

test('zone mode: portrait uses 2 by 3, landscape 3 by 2; zones tile the interior exactly', () => {
  const portrait = makeFridgeModule({state: {fridgeDifficulty: 'zones'}}).mod;
  assert.deepEqual(portrait.fridgeZoneGrid(), {columns: 2, rows: 3});
  const landscape = makeFridgeModule({state: {fridgeDifficulty: 'zones'}, gameCanvas: {width: 1180, height: 820}}).mod;
  assert.deepEqual(landscape.fridgeZoneGrid(), {columns: 3, rows: 2});
  for(const mod of [portrait, landscape]){
    let area = 0;
    for(let z = 0; z < 6; z++){
      const f = mod.fridgeZoneFrac(z);
      area += (f.right - f.left) * (f.bottom - f.top);
      assert.ok(f.left >= 0.05 - 1e-9 && f.right <= 0.95 + 1e-9 && f.top >= 0.07 - 1e-9 && f.bottom <= 0.93 + 1e-9);
    }
    assert.ok(Math.abs(area - 0.90 * 0.86) < 1e-9);
  }
});

test('zone mode: with a display rect the top row is pushed below the HUD button band', () => {
  const portrait = makeFridgeModule({state: {fridgeDifficulty: 'zones'}}).mod;
  const landscape = makeFridgeModule({state: {fridgeDifficulty: 'zones'}, gameCanvas: {width: 1180, height: 820}}).mod;
  for(const [mod, cw, ch, hudPx] of [[portrait, 820, 1180, 150], [landscape, 1180, 820, 70]]){
    // Fridge photo occupying the top of the screen (rect top at y=0), as in the real layout.
    const t = {x: cw / 2, y: ch * 0.35, w: cw * 0.9, h: ch * 0.70};
    const rect = mod.fridgeInteriorRect(t);
    const b = mod.fridgeZoneBounds(rect);
    assert.ok(rect.y0 + b.top * rect.rh >= hudPx - 1e-6, `${cw}x${ch} zone top clears HUD`);
    assert.equal(b.bottom, 0.93);
    for(let z = 0; z < 6; z++){
      const f = mod.fridgeZoneFrac(z, rect);
      assert.ok(rect.y0 + f.top * rect.rh >= hudPx - 1e-6);
    }
    // Without a rect (pure interior tiling) the bounds are unchanged.
    assert.equal(mod.fridgeZoneBounds(null).top, 0.07);
  }
});

test('basic mode ignores zones: no zone order, any interior release accepted', () => {
  const {mod} = makeFridgeModule();
  mod.newFridgeRound();
  assert.equal(mod.isFridgeZoneMode(), false);
  assert.equal(mod.fridgeLitZone(), -1);
  assert.deepEqual(mod.zoneOrder, []);
  assert.equal(mod.fridgeTryPlace(item(mod.fridgeCurrentDef()), 500, 300, T), true);
  assert.equal(mod.placed[0].zone, null);
});

test('zone mode wiring: settings card, QA state, drawing and the research gate', () => {
  assert.match(publicSource, /id="fridgeDifficultyCard"/);
  assert.match(publicSource, /data-fridge-difficulty="basic"[\s\S]{0,120}任何位置/);
  assert.match(publicSource, /data-fridge-difficulty="zones"[\s\S]{0,200}着燈六格/);
  assert.match(publicSource, /fridgeDifficulty: 'basic'/);
  assert.match(publicSource, /return isFridgeGame\(\) && state\.fridgeDifficulty === 'zones';/);
  assert.match(publicSource, /if\(isFridgeZoneMode\(\)\) drawFridgeZones\(ctx, rect\);/);
  assert.match(publicSource, /function drawFridgeZones\(ctx, rect\)/);
  assert.match(publicSource, /mode: state\.fridgeDifficulty === 'zones' \? 'zones' : 'basic',\s*litZone: fridgeLitZone\(\),/);
  assert.match(publicSource, /renderFridgeDifficultySettings\(\);/);
  // No animals/distractors are introduced by zone mode.
  const start = publicSource.indexOf('function fridgeZoneGrid');
  const end = publicSource.indexOf('let level3RoundVariant');
  assert.doesNotMatch(publicSource.slice(start, end), /distractor\(|spawnDistractor|animal/i);
});
