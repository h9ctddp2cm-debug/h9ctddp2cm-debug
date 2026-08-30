import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v74 Level 3/4 點心「模擬茶樓」regression tests (31 Aug 2026 user request):
//   1. Under the dim sum activity for Levels 3/4, a display-mode selection box
//      offers「模擬茶樓」(simulated teahouse — full-scene background, patient
//      does NOT see their own camera image) and「看到自己」(the unchanged
//      original camera view). Current dim sum game preserved as「看到自己」.
//   2. Teahouse mode: dim sum rises from a small plate as the shoulder lifts;
//      at target it flies into a bamboo steamer, steam puffs + spoken praise.
//   3. SAFETY: the scene is a pure visual/audio reward layer. It reads only
//      shoulderFlexionState progress/targetReady. It must not introduce any
//      hand-contact, pickup-dwell, grip or release signal into the L3/L4
//      branch, and must not alter target-reached judgement.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicSource = readFileSync(path.join(root, 'index.html'), 'utf8');
const locSource = readFileSync(path.join(root, 'localization.js'), 'utf8');

function slice(startMarker, endMarker){
  const start = publicSource.indexOf(startMarker);
  assert.ok(start >= 0, 'missing start marker: ' + startMarker);
  const end = publicSource.indexOf(endMarker, start);
  assert.ok(end > start, 'missing end marker: ' + endMarker);
  return publicSource.slice(start, end);
}

const SCENE_START = '/* ==================== v74 模擬茶樓場景';
const SCENE_END = '/* ==================== v73 保齡球場景';

/* ---------------- Source contract: assets & wiring ---------------- */

test('teahouse scene assets are preloaded and shipped', () => {
  assert.match(publicSource, /img\/teahouse_bg\.png/);
  assert.match(publicSource, /img\/steamer_empty\.png/);
  assert.ok(existsSync(path.join(root, 'img', 'teahouse_bg.png')), 'teahouse_bg.png must exist');
  assert.ok(existsSync(path.join(root, 'img', 'steamer_empty.png')), 'steamer_empty.png must exist');
});

test('state defaults to teahouse mode; camera mode preserved as option', () => {
  assert.match(publicSource, /dimsumSceneMode: 'teahouse',/);
  assert.match(publicSource, /data-dimsum-mode="teahouse">模擬茶樓<\/button>/);
  assert.match(publicSource, /data-dimsum-mode="camera">看到自己<\/button>/);
});

test('mode selection bar only renders under the dim sum card on Levels 3/4', () => {
  assert.match(publicSource, /if\(id==='dimsum'&&\(state\.level==='3'\|\|state\.level==='4'\)\)\{/);
  // clicking the bar must not activate the surrounding activity flow
  const bar = slice("if(id==='dimsum'&&(state.level==='3'||state.level==='4')){", 'grid.appendChild(bar);');
  assert.match(bar, /stopPropagation\(\)/);
});

test('isTeahouseDimsumMode gating (functional): L3/L4 + dimsum + teahouse + not research', () => {
  const code = slice('function isTeahouseDimsumMode()', '\nfunction resetTeahouseServe');
  const make = (level, theme, mode, researchActive) => new Function(
    'state', 'research', 'isShoulderFlexionLevel',
    code + '\nreturn isTeahouseDimsumMode();'
  )({theme, dimsumSceneMode: mode, level}, {active: researchActive},
    () => level === '3' || level === '4');
  assert.equal(make('3', 'dimsum', 'teahouse', false), true);
  assert.equal(make('4', 'dimsum', 'teahouse', false), true);
  assert.equal(make('3', 'dimsum', 'camera', false), false, '看到自己 keeps the original path');
  assert.equal(make('3', 'bowlinglane', 'teahouse', false), false);
  assert.equal(make('5', 'dimsum', 'teahouse', false), false);
  assert.equal(make('67', 'dimsum', 'teahouse', false), false);
  assert.equal(make('3', 'dimsum', 'teahouse', true), false, 'research track unaffected');
});

test('teahouse scene replaces guide + generic targets, and only there', () => {
  assert.match(publicSource, /if\(isTeahouseDimsumMode\(\)\)\{ drawTeahouseScene\(ctx,cw,ch\); return; \}/);
  assert.match(publicSource, /if\(state\.theme==='bowlinglane'\|\|state\.theme==='basketball'\|\|isTeahouseDimsumMode\(\)\)\{\s*\/\/ v73[^]{0,120}\s*targets=\[\];\s*return;/);
});

/* ---------------- Safety invariants ---------------- */

test('teahouse scene block admits no hand-contact/grip/release signal', () => {
  const scene = slice(SCENE_START, SCENE_END);
  for(const banned of ['heldItem', 'gripActive', 'dwellTarget', 'releaseItem',
    'handContact', 'pinch', 'grabDistance', 'landmarks']){
    assert.ok(!scene.includes(banned), 'scene block must not reference ' + banned);
  }
  // reward layer reads shoulder state only
  assert.match(scene, /shoulderFlexionState\.selectedTargetDeg/);
});

test('serve starts only from the existing targetReady award point', () => {
  assert.match(publicSource,
    /if\(state\.theme==='bowlinglane'\)startBowlingStrike\(\);\s*if\(state\.theme==='basketball'\)startBasketballShot\(\);\s*if\(isTeahouseDimsumMode\(\)\)startTeahouseServe\(\);/);
  // and is reset with the other per-rep / per-session resets
  assert.match(publicSource, /resetBowlingStrike\(\);\s*resetBasketballShot\(\);\s*resetTeahouseServe\(\);\s*foods=\[\];/);
  assert.match(publicSource, /targets = \[\]; resetBowlingStrike\(\); resetBasketballShot\(\); resetTeahouseServe\(\);/);
});

test('item drawing is skipped while the serve animation owns the dim sum', () => {
  assert.match(publicSource, /if\(isTeahouseDimsumMode\(\) && teahouseServe\.phase!=='idle'\) continue;/);
});

/* ---------------- Functional: serve state machine ---------------- */

function buildServeModule(){
  const scene = slice(SCENE_START, SCENE_END);
  let clock = 0;
  let spoken = [];
  const env = {
    state: {level: '3', theme: 'dimsum', dimsumSceneMode: 'teahouse'},
    research: {active: false},
    foods: [{x: 400, y: 300, removed: false, img: null, label: '燒賣'}],
    gameCanvas: {width: 800, height: 1100},
    shoulderFlexionState: {selectedTargetDeg: 40},
    isShoulderFlexionLevel: () => true,
    isPortrait: () => true,
    nowMs: () => clock,
    speakCantonese: (t) => spoken.push(t),
    clamp01: (v) => Math.max(0, Math.min(1, v)),
    rrPath: () => {},
    // v75: teahouseGeometry reads the user-designed plate/tray sprite ratios
    imgThPlate: {naturalWidth: 852, naturalHeight: 413},
    imgThTray: {naturalWidth: 977, naturalHeight: 447},
  };
  const keys = Object.keys(env);
  const fn = new Function(...keys, scene + `
    return {teahouseServe, TEAHOUSE_FLY_MS, TEAHOUSE_STEAM_MS,
      isTeahouseDimsumMode, resetTeahouseServe, startTeahouseServe,
      updateTeahouseServe, teahouseGeometry};`);
  const mod = fn(...keys.map(k => env[k]));
  return {mod, setClock: (v) => { clock = v; }, spoken: () => spoken};
}

test('serve machine: fly -> steam (praise spoken once) -> rest -> reset', () => {
  const {mod, setClock, spoken} = buildServeModule();
  assert.equal(mod.teahouseServe.phase, 'idle');
  mod.updateTeahouseServe(); // idle no-op
  assert.equal(mod.teahouseServe.phase, 'idle');

  setClock(1000);
  mod.startTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'fly');
  assert.equal(mod.teahouseServe.startedMs, 1000);
  assert.equal(mod.teahouseServe.fromX, 400);
  assert.equal(mod.teahouseServe.label, '燒賣');
  mod.startTeahouseServe(); // double trigger guarded
  assert.equal(mod.teahouseServe.startedMs, 1000);

  setClock(1000 + mod.TEAHOUSE_FLY_MS - 1);
  mod.updateTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'fly');

  setClock(1000 + mod.TEAHOUSE_FLY_MS);
  mod.updateTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'steam');
  assert.equal(spoken().length, 1, 'praise spoken exactly once');
  mod.updateTeahouseServe();
  assert.equal(spoken().length, 1, 'no repeat praise during steam');

  setClock(1000 + mod.TEAHOUSE_FLY_MS + mod.TEAHOUSE_STEAM_MS);
  mod.updateTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'rest');
  mod.updateTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'rest', 'rest holds until rep reset');

  mod.resetTeahouseServe();
  assert.equal(mod.teahouseServe.phase, 'idle');
  assert.equal(mod.teahouseServe.img, null);
});

/* ---------------- Geometry: on-canvas in both iPad orientations ---------------- */

test('teahouse geometry stays on canvas in both orientations and aligns with the item lane', () => {
  const {mod} = buildServeModule();
  for(const [cw, ch] of [[820, 1180], [1180, 820]]){
    const g = mod.teahouseGeometry(cw, ch);
    // v75 user design: big plate + steamer sprite centred near the top,
    // wooden tray hugging the bottom edge, dim sum travels dish → steamer.
    assert.equal(g.laneX, cw * 0.5, `lane centred ${cw}x${ch}`);
    // plate sprite fully on canvas, with headroom for the target-degrees text
    assert.ok(g.laneX - g.plateW / 2 >= 0, `plate left edge on canvas ${cw}x${ch}`);
    assert.ok(g.laneX + g.plateW / 2 <= cw, `plate right edge on canvas ${cw}x${ch}`);
    assert.ok(g.plateY - g.plateH / 2 >= 0, `plate top on canvas ${cw}x${ch}`);
    // steamer landing point stays inside the plate sprite
    assert.ok(Math.abs(g.steamerX - g.laneX) < g.plateW / 2, `steamer inside plate ${cw}x${ch}`);
    assert.ok(g.steamerY > g.plateY - g.plateH / 2 && g.steamerY < g.plateY + g.plateH / 2,
      `steamer vertical inside plate ${cw}x${ch}`);
    // tray pinned to the bottom edge, on canvas horizontally
    assert.ok(Math.abs((g.trayY + g.trayH / 2) - ch) < 1e-6, `tray hugs bottom ${cw}x${ch}`);
    assert.ok(cw / 2 - g.trayW / 2 >= 0, `tray on canvas ${cw}x${ch}`);
    // the small dish (item start) sits on the tray, clearly below the plate,
    // so the rise from dish to steamer keeps a positive travel distance
    assert.ok(g.dishY > g.plateY + g.plateH / 2, `dish below plate ${cw}x${ch}`);
    assert.ok(g.dishY - g.dishW * 0.18 > g.plateY + g.plateH * 0.62,
      `item lane travel positive ${cw}x${ch}`);
  }
  // the item lane override anchors the rising dim sum to this geometry
  assert.match(publicSource, /laneX=tg\.laneX;bottom=tg\.dishY-tg\.dishW\*0\.18;top=tg\.plateY\+tg\.plateH\*0\.62;/);
});

/* ---------------- Localization & untouched siblings ---------------- */

test('EN localization entries exist for the new UI strings', () => {
  assert.match(locSource, /'點心遊戲顯示模式':'Dim sum display mode',/);
  assert.match(locSource, /'模擬茶樓':'Simulated teahouse',/);
  assert.match(locSource, /'看到自己':'See yourself',/);
});

test('L5 fridge and L67 dim sum order games untouched by v74 gating', () => {
  assert.match(publicSource, /function isFridgeGame\(\)/);
  assert.match(publicSource, /function isDimsumOrderGame\(\)/);
  const scene = slice(SCENE_START, SCENE_END);
  assert.ok(!scene.includes('isFridgeGame'), 'teahouse scene must not touch fridge game');
  assert.ok(!scene.includes('isDimsumOrderGame'), 'teahouse scene must not touch L67 order game');
});
