import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// v125 (18 Nov 2026 user request): Level 3/4 shoulder-flexion story theme
// 「去超市買餸」. Every arm raise advances a story step: get the trolley → take
// each listed item from a high shelf → unload items at the cashier → tap the
// Octopus card → hand over the eco-bag → take the bag back → at home put every
// item away (cold → 雪櫃, dry → 廚櫃, auto-placed, no choosing). The story
// ends the game when the last item is shelved. The shoulder-flexion angle
// controller and award logic are untouched; the theme is a visual layer.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

function functionSource(name){
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for(let i = open; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function constSource(name){
  const start = html.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `missing const ${name}`);
  // Object literals may span lines; stop at the first `;` that follows a `}`
  // or at the line end for one-line constants.
  let i = start;
  let depth = 0;
  for(; i < html.length; i++){
    const c = html[i];
    if(c === '{') depth++;
    else if(c === '}') depth--;
    else if(c === ';' && depth === 0) break;
  }
  return html.slice(start, i + 1);
}

// Evaluate the pure story-builder helpers in isolation (no DOM needed).
function storyBuilder(){
  const src = [
    constSource('SHOP_ITEMS').replace(/img:\(\)=>[A-Za-z]+,/g, 'img:null,'),
    constSource('SHOP_LIST_SIZES'),
    constSource('SHOP_LIST_POOL'),
    functionSource('buildShopList'),
    functionSource('buildShopSteps'),
    functionSource('shopRepCount'),
    'globalThis.__out = { buildShopList, buildShopSteps, shopRepCount, SHOP_ITEMS, SHOP_LIST_SIZES, SHOP_LIST_POOL };',
  ].join('\n');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.__out;
}

/* ---------------- 1. Story script ---------------- */

test('v125 list sizes are 2 / 4 / 6 items and the pool is long enough', () => {
  const {SHOP_LIST_SIZES, SHOP_LIST_POOL, SHOP_ITEMS} = storyBuilder();
  assert.equal(JSON.stringify(SHOP_LIST_SIZES), JSON.stringify({short: 2, medium: 4, long: 6}));
  assert.ok(SHOP_LIST_POOL.length >= 6, 'pool must cover the long list');
  for(const id of SHOP_LIST_POOL) assert.ok(SHOP_ITEMS[id], `pool item ${id} must exist`);
  for(const [id, it] of Object.entries(SHOP_ITEMS)){
    assert.equal(typeof it.cold, 'boolean', `${id} needs cold flag for auto-placement`);
    assert.ok(it.label && it.unit, `${id} needs label + unit`);
  }
});

test('v125 rep counts: short 13, medium 22, long 28 arm raises', () => {
  const {buildShopList, buildShopSteps, shopRepCount} = storyBuilder();
  const counts = {};
  for(const key of ['short', 'medium', 'long']){
    const steps = buildShopSteps(buildShopList(key));
    counts[key] = shopRepCount(steps);
    // Every list ends the game from the story (scene step with end:true).
    const last = steps[steps.length - 1];
    assert.equal(last.kind, 'scene');
    assert.equal(last.end, true);
    assert.equal(last.scene, 'done');
  }
  assert.equal(JSON.stringify(counts), JSON.stringify({short: 13, medium: 22, long: 28}));
});

test('v125 story order follows the therapist script', () => {
  const {buildShopList, buildShopSteps} = storyBuilder();
  const steps = buildShopSteps(buildShopList('short'));
  const scenes = steps.map(s => s.scene);
  // entrance → list → cart → aisle … → cashier → leave → home → done
  assert.equal(scenes[0], 'entrance');
  assert.equal(scenes[1], 'list');
  assert.equal(steps[2].action, 'cart');
  const firstAisle = scenes.indexOf('aisle');
  const walkCashier = scenes.indexOf('walk_cashier');
  const firstCashier = scenes.indexOf('cashier');
  const leave = scenes.indexOf('leave');
  const firstHome = scenes.indexOf('home');
  assert.ok(firstAisle > 2 && firstAisle < walkCashier && walkCashier < firstCashier && firstCashier < leave && leave < firstHome);
  // Cashier action order: unload ×N → octopus → givebag → packing scene → takebag.
  const cashierActions = steps.filter(s => s.scene === 'cashier').map(s => s.action || (s.packing ? 'packing' : 'scene'));
  const unloadCount = cashierActions.filter(a => a === 'unload').length;
  assert.equal(unloadCount, 3, 'short list = 2 apples + 1 soy sauce to unload');
  assert.equal(JSON.stringify(cashierActions.slice(unloadCount)), JSON.stringify(['octopus', 'givebag', 'packing', 'takebag']));
  // Home: every bought item is shelved once, with the destination in the text.
  const shelve = steps.filter(s => s.action === 'shelve');
  assert.equal(shelve.length, 3);
  for(const s of shelve){
    assert.match(s.text, /放入雪櫃|放上櫃/);
  }
  // Apple is a cold item → fridge; soy sauce → cupboard.
  assert.match(shelve.find(s => s.item === 'apple').text, /雪櫃/);
  assert.match(shelve.find(s => s.item === 'soysauce').text, /放上櫃/);
});

test('v125 every rep step has a spoken prompt and the list recheck appears between items', () => {
  const {buildShopList, buildShopSteps} = storyBuilder();
  const steps = buildShopSteps(buildShopList('medium'));
  for(const s of steps){
    assert.ok(s.text, 'every step has text');
    if(s.kind === 'rep') assert.ok(s.prompt, `rep step ${s.action} needs a prompt`);
    else assert.ok(s.ms > 0, 'scene steps auto-advance after ms');
  }
  const rechecks = steps.filter(s => s.scene === 'list' && /再睇/.test(s.text));
  assert.equal(rechecks.length, 3, 'medium list: recheck before items 2, 3, 4');
});

/* ---------------- 2. Theme wiring ---------------- */

test('v125 supermarket theme is registered and only offered on Level 3/4', () => {
  assert.match(html, /supermarket: mkTheme\(\{\s*id:'supermarket',title:'去超市買餸'/);
  assert.match(constSource('THEME_ORDER'), /'basketball','supermarket','flowers'/);
  const avail = functionSource('themeAvailableForLevel');
  assert.match(avail, /if\(themeId === 'supermarket'\) return level === '3' \|\| level === '4';/);
  const order = functionSource('availableThemeOrder');
  assert.match(order, /return \['bowlinglane','basketball','supermarket','tsuenwan','dimsum','laundry','cards','mahjong'\];/);
  // Level 6 and Level 5 lists must not include it.
  assert.doesNotMatch(order, /'peg_laundry'[^\]]*'supermarket'/);
  assert.match(html, /const LEVEL3_THEME_VARIANTS = \{[\s\S]{0,3000}\n  supermarket:\[/);
});

test('v125 supermarket uses the shoulder-flexion controller only (no generic targets, no food targets)', () => {
  assert.match(functionSource('isSupermarketTheme'), /isShoulderFlexionLevel\(\) && state\.theme==='supermarket'/);
  assert.match(functionSource('setupTargets'), /state\.theme==='supermarket'[\s\S]{0,200}targets=\[\];/);
  assert.match(html, /if\(isSupermarketTheme\(\)\) continue;/);
  // Award path: story action is started before the reward cycle so the reward
  // length covers the fly animation + following scene.
  assert.match(html, /if\(isSupermarketTheme\(\)\)startSupermarketAction\(\);[^\n]*\n[\s\S]{0,200}startShoulderRewardCycle\(/);
  assert.match(functionSource('shoulderRewardDurationMs'), /state\.theme==='supermarket'[\s\S]{0,200}Math\.max\(SHOULDER_REWARD_MIN_MS,\s*shopStory\.rewardMs\)/);
  // Game end comes from the story, not from a target count.
  assert.match(functionSource('updateSupermarketStory'), /endGame\(/);
});

test('v125 shoulder-flexion band / angle logic untouched by the theme', () => {
  // The story draw layer must never write to the angle controller state.
  const drawSrc = functionSource('drawSupermarketScene') + functionSource('updateSupermarketStory') + functionSource('updateSupermarketAction');
  assert.doesNotMatch(drawSrc, /shoulderFlexionState\.[a-zA-Z]+\s*=/);
  assert.doesNotMatch(drawSrc, /shoulderFlexionController\.[a-zA-Z]+\s*=/);
  assert.doesNotMatch(drawSrc, /state\.score\s*[+-]?=/);
});

/* ---------------- 3. Therapist setting + QA hooks ---------------- */

test('v125 library shows a shopping-list length bar with approximate rep counts', () => {
  assert.match(html, /bar\.dataset\.shopListBar='1'/);
  assert.match(html, /data-shop-list="'\+k\+'"/);
  assert.match(html, /約 ?'\+[^<]*次抬手|約 \d+ 次抬手|'約 '\+/);
  assert.match(html, /shopListSize:\s*'short'/);
  assert.match(functionSource('shopListSizeKey'), /SHOP_LIST_SIZES\[state\.shopListSize\] \? state\.shopListSize : 'short'/);
});

test('v125 __qa.startGame accepts shopListSize and exposes story hooks', () => {
  assert.match(html, /if\(SHOP_LIST_SIZES\[opts\.shopListSize\]\) state\.shopListSize=opts\.shopListSize;/);
  assert.match(html, /shopStory:\s*\{[\s\S]{0,400}state\(\)/);
  assert.match(html, /initGame[\s\S]{0,3000}resetSupermarketStory\(\);/);
});

test('v125 new supermarket images exist and are referenced', () => {
  const need = ['shop_aisle_bg.jpg','shop_cashier_bg.jpg','shop_home_bg.jpg','shop_cart.png','shop_orange.png','shop_soysauce.png','shop_octopus.png','shop_ecobag.png','shop_rice.png','shop_toiletpaper.png'];
  for(const f of need){
    assert.match(html, new RegExp(`img/${f.replace('.', '\\.')}`), `index.html references ${f}`);
    assert.doesNotThrow(() => readFileSync(path.join(root, 'img', f)), `img/${f} exists`);
  }
});
