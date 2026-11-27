import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v142 — therapist follow-up to v141 (25 Nov):
//   1. each repeated round of 「去超市買餸」 / 「洗衫晾衫」 uses the next items instead of the
//      same list again (round 1 is unchanged);
//   2. the 「好波」 cheer is kept for bowling and basketball only (it was also played at the
//      end of the supermarket and laundry stories);
//   3. the fried-rice celebration no longer lists the movements of the old gesture version;
//      the gripper version says what was actually done (squeeze → relax).
// Nothing about detection changes.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');

function fnSource(name){
  const start = html.indexOf('\nfunction ' + name + '(');
  assert.ok(start >= 0, 'function ' + name + ' exists');
  let i = html.indexOf('{', html.indexOf(')', start)), depth = 0;
  for(; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return html.slice(start + 1, i + 1);
}
function lineConst(name){
  const m = html.match(new RegExp('\\nconst ' + name + ' = ([^;\\n]+);'));
  assert.ok(m, 'const ' + name + ' exists');
  return 'const ' + name + ' = ' + m[1] + ';';
}
const shopItemsSrc = html.slice(html.indexOf('\nconst SHOP_ITEMS = {') + 1, html.indexOf('};', html.indexOf('\nconst SHOP_ITEMS = {')) + 2).replace(/img:\(\)=>[A-Za-z0-9]+,/g, 'img:null,');
const shop = new Function([
  shopItemsSrc, lineConst('SHOP_LIST_SIZES'), lineConst('SHOP_LIST_POOL'), lineConst('SHOP_LIST_ROTATION'),
  fnSource('storyRoundPick'), fnSource('buildShopList'), fnSource('buildShopSteps'), fnSource('shopRepCount'),
  'return { SHOP_ITEMS, SHOP_LIST_POOL, SHOP_LIST_ROTATION, storyRoundPick, buildShopList, buildShopSteps, shopRepCount };',
].join('\n'))();
const laundry = new Function([
  lineConst('LAUNDRY_LOAD_SIZES'), lineConst('LAUNDRY_STORY_POOL'), lineConst('LAUNDRY_WASH_MS'), lineConst('LAUNDRY_SUN_MS'),
  fnSource('storyRoundPick'), fnSource('buildLaundryList'), fnSource('buildLaundrySteps'),
  'return { LAUNDRY_STORY_POOL, buildLaundryList, buildLaundrySteps };',
].join('\n'))();
const ids = list => list.map(l => l.id);

test('v142 release markers', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v148-20261127-wording";/);
  assert.match(manifest, /index\.html\?build=v148-20261127-wording/);
  assert.match(html, /const LEVEL_APP_BUILD = "v148-20261127-wording";/);
  assert.match(html, /perf v148 {2}/);
});

test('storyRoundPick walks through the pool round by round and wraps around', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(shop.storyRoundPick(pool, 2, 1), ['a', 'b']);
  assert.deepEqual(shop.storyRoundPick(pool, 2, 2), ['c', 'd']);
  assert.deepEqual(shop.storyRoundPick(pool, 2, 3), ['e', 'a']);
  assert.deepEqual(shop.storyRoundPick(pool, 2, 6), ['a', 'b']);        // comes back round
  assert.deepEqual(shop.storyRoundPick(pool, 5, 1), pool);              // whole pool: order changes instead
  assert.deepEqual(shop.storyRoundPick(pool, 5, 2), ['c', 'd', 'e', 'a', 'b']);
  assert.deepEqual(shop.storyRoundPick(pool, 9, 1), pool);              // never more than the pool
  assert.deepEqual(shop.storyRoundPick(pool, 2, 0), ['a', 'b']);
  assert.deepEqual(shop.storyRoundPick(pool, 2, undefined), ['a', 'b']);
  assert.deepEqual(shop.storyRoundPick([], 2, 1), []);
});

test('supermarket: round 1 list is unchanged; later rounds bring the next items', () => {
  assert.deepEqual(shop.SHOP_LIST_ROTATION.slice(0, shop.SHOP_LIST_POOL.length), shop.SHOP_LIST_POOL);
  for(const id of shop.SHOP_LIST_ROTATION) assert.ok(shop.SHOP_ITEMS[id], 'item exists: ' + id);
  assert.equal(new Set(shop.SHOP_LIST_ROTATION).size, shop.SHOP_LIST_ROTATION.length);
  // round 1 (also what the home-page "約 N 次抬手" buttons count) is exactly as before
  assert.deepEqual(ids(shop.buildShopList('short')), ['apple', 'soysauce']);
  assert.deepEqual(ids(shop.buildShopList('medium')), ['apple', 'soysauce', 'orange', 'milk']);
  assert.deepEqual(ids(shop.buildShopList('long')), ['apple', 'soysauce', 'orange', 'milk', 'choysum', 'eggs']);
  assert.deepEqual(ids(shop.buildShopList('medium', 1)), ids(shop.buildShopList('medium')));
  // later rounds
  assert.deepEqual(ids(shop.buildShopList('short', 2)), ['orange', 'milk']);
  assert.deepEqual(ids(shop.buildShopList('short', 3)), ['choysum', 'eggs']);
  assert.deepEqual(ids(shop.buildShopList('short', 4)), ['rice', 'toiletpaper']);
  assert.deepEqual(ids(shop.buildShopList('short', 5)), ['apple', 'soysauce']);
  assert.deepEqual(ids(shop.buildShopList('medium', 2)), ['choysum', 'eggs', 'rice', 'toiletpaper']);
  assert.deepEqual(ids(shop.buildShopList('medium', 3)), ['apple', 'soysauce', 'orange', 'milk']);   // two lists take turns
  assert.deepEqual(ids(shop.buildShopList('long', 2)), ['rice', 'toiletpaper', 'apple', 'soysauce', 'orange', 'milk']);
  assert.deepEqual(ids(shop.buildShopList('long', 3)), ['choysum', 'eggs', 'rice', 'toiletpaper', 'apple', 'soysauce']);
  // the pale, flat fish picture is hard to see on the shelf, so it is not part of the rotation
  assert.ok(!shop.SHOP_LIST_ROTATION.includes('fish'));
  for(const size of ['short', 'medium', 'long']){
    for(let r = 2; r <= 12; r++){
      const now = ids(shop.buildShopList(size, r)), prev = ids(shop.buildShopList(size, r - 1));
      assert.notDeepEqual(now, prev, size + ' round ' + r + ' differs from the round before');
      assert.equal(new Set(now).size, now.length, 'no item twice in one list');
      assert.equal(now.length, prev.length);
    }
  }
  // fruit still needs two lifts, the rest one; nothing starts as already taken
  for(const l of shop.buildShopList('long', 2)){ assert.equal(l.need, (l.id === 'apple' || l.id === 'orange') ? 2 : 1); assert.equal(l.got, 0); }
  assert.match(fnSource('beginSupermarketStory'), /shopStory\.list=buildShopList\(shopStory\.listSize,shopStory\.rounds\+1\);/);
});

test('supermarket: a later round is the same story built from its own list', () => {
  const list = shop.buildShopList('medium', 2);
  const steps = shop.buildShopSteps(list, 2);
  assert.equal(steps[0].text, '再去超市買餸'); assert.equal(steps[0].sub, '第 2 轉 · 換咗新購物單');
  const need = list.reduce((a, l) => a + l.need, 0);
  assert.equal(shop.shopRepCount(steps), 1 + need * 3 + 3);          // cart + take/unload/shelve + card, give bag, take bag
  for(const action of ['take', 'unload', 'shelve']){
    assert.deepEqual(steps.filter(s => s.action === action).map(s => s.item), ids(list), action + ' follows the list');
  }
  assert.match(steps.find(s => s.action === 'shelve' && s.item === 'rice').text, /放上櫃$/);
  assert.match(steps.find(s => s.action === 'shelve' && s.item === 'eggs').text, /放入雪櫃$/);
  assert.equal(steps[steps.length - 1].end, true);
});

test('laundry: round 1 is unchanged; later rounds bring the next clothes (all six: a new order)', () => {
  assert.deepEqual(laundry.buildLaundryList('short'), ['shirt1', 'jeans', 'vest']);
  assert.deepEqual(laundry.buildLaundryList('medium'), ['shirt1', 'jeans', 'vest', 'skirt']);
  assert.deepEqual(laundry.buildLaundryList('long'), laundry.LAUNDRY_STORY_POOL);
  assert.deepEqual(laundry.buildLaundryList('short', 2), ['skirt', 'shirt2', 'socks']);
  assert.deepEqual(laundry.buildLaundryList('short', 3), ['shirt1', 'jeans', 'vest']);
  assert.deepEqual(laundry.buildLaundryList('medium', 2), ['shirt2', 'socks', 'shirt1', 'jeans']);
  assert.deepEqual(laundry.buildLaundryList('medium', 3), ['vest', 'skirt', 'shirt2', 'socks']);
  assert.deepEqual(laundry.buildLaundryList('long', 2), ['skirt', 'shirt2', 'socks', 'shirt1', 'jeans', 'vest']);
  assert.deepEqual(laundry.buildLaundryList('long', 3), laundry.LAUNDRY_STORY_POOL);
  const r1 = laundry.buildLaundrySteps(laundry.buildLaundryList('medium'), 1);
  const r2 = laundry.buildLaundrySteps(laundry.buildLaundryList('medium', 2), 2);
  assert.equal(r2.length, r1.length);                                 // same number of lifts and rests
  assert.deepEqual(r2.map(s => s.kind + ':' + (s.action || s.cut)), r1.map(s => s.kind + ':' + (s.action || s.cut)));
  assert.deepEqual(r2.filter(s => s.action === 'load').map(s => s.item), ['shirt2', 'socks', 'shirt1', 'jeans']);
  assert.match(fnSource('beginLaundryStory'), /laundryStory\.list=buildLaundryList\(laundryStory\.loadSize,laundryStory\.rounds\+1\);/);
});

test('the 「好波」 cheer is played for bowling and basketball only', () => {
  const calls = html.match(/playHaoboCheer\(\);/g) || [];
  assert.equal(calls.length, 2);
  assert.match(fnSource('updateBowlingStrike'), /playPinCrashSound\(\);playApplauseSound\(\);playHaoboCheer\(\);/);
  assert.match(fnSource('updateBasketballShot'), /playSwishSound\(\);playApplauseSound\(\);playHaoboCheer\(\);/);
  for(const fn of ['updateSupermarketAction', 'updateLaundryStoryAction', 'drawSupermarketScene', 'drawLaundryStoryScene']){
    assert.doesNotMatch(fnSource(fn), /HaoboCheer\(/, fn + ' has no cheer');
  }
  // the stories still get their applause at the closing scene
  assert.match(fnSource('updateSupermarketAction'), /nxt\.end\)\{ shopStory\.rounds\+\+; shopStory\.repsDone=0; playApplauseSound\(\); \}/);
  assert.match(fnSource('updateLaundryStoryAction'), /nxt\.end\)\{ laundryStory\.completed=true; laundryStory\.rounds\+\+; playApplauseSound\(\); \}/);
  assert.match(fnSource('drawBowlingAlleyScene'), /preloadHaoboCheer\(\);/);
  assert.match(fnSource('drawBasketballCourtScene'), /preloadHaoboCheer\(\);/);
});

test('fried-rice celebration: the gripper version names squeeze → relax, not the old gesture list', () => {
  const adv = fnSource('cookAdvance');
  assert.match(adv, /detail: isLevel6DigiflexTask\(\)\s*\? '你完成咗全部 12 個步驟，每一步都係揸一下握力器、再放鬆，一次一次煮出嚟。' \+\s*'<br><small>本活動為虛擬煮食訓練；網頁不識別實體工具，亦不量度握力或捏力。<\/small>'/);
  // the old sentence stays only for the non-gripper branch
  assert.equal((html.match(/手腕畫圈、前臂旋轉估算/g) || []).length, 1);
});

test('detection settings are untouched', () => {
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /runningMode:\s*['"]VIDEO['"]/);
  assert.match(html, /PUBLIC_GAME_WORK_INTERVAL_MS\s*=\s*1000\s*\/\s*30/);
  assert.match(html, /PUBLIC_CANVAS_MAX_EDGE\s*=\s*1600/);
});

// ---------------------------------------------------------------- e2e
let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(e){ browser = null; }
});
after(async () => { if(browser) await browser.close(); });

async function openGame(start){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(start => { window.__qa.startGame(start); }, start);
  await page.waitForTimeout(300);
  return { context, page, errors };
}

for(const [theme, key, level, size, want] of [
  ['supermarket', 'shopStory', '3', 'medium', [['apple', 'soysauce', 'orange', 'milk'], ['choysum', 'eggs', 'rice', 'toiletpaper'], ['apple', 'soysauce', 'orange', 'milk']]],
  ['supermarket', 'shopStory', '4', 'short', [['apple', 'soysauce'], ['orange', 'milk'], ['choysum', 'eggs']]],
  ['laundry', 'laundryStory', '3', 'short', [['shirt1', 'jeans', 'vest'], ['skirt', 'shirt2', 'socks'], ['shirt1', 'jeans', 'vest']]],
  ['laundry', 'laundryStory', '4', 'long', [['shirt1', 'jeans', 'vest', 'skirt', 'shirt2', 'socks'], ['skirt', 'shirt2', 'socks', 'shirt1', 'jeans', 'vest'], ['shirt1', 'jeans', 'vest', 'skirt', 'shirt2', 'socks']]],
]){
  test(`Level ${level} ${theme} (${size}) e2e: three rounds play through with the next items each round`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const { context, page, errors } = await openGame({ level, theme, duration: 600, affectedSide: 'right', shoulderTargetDeg: level === '3' ? 30 : 60, dwellMs: 0, laundryLoadSize: size, shopListSize: size });
    try{
      const out = await page.evaluate(key => {
        const qa = window.__qa, S = () => qa[key].state();
        const isEnd = s => s.step && s.step.kind === 'scene' && (s.step.cut === 'done' || s.step.scene === 'done');
        const toDone = () => { for(let i = 0; i < 400; i++){ const s = S(); if(isEnd(s)) return s; if(s.step && s.step.kind === 'scene') qa[key].skipScene(); else { qa[key].trigger(); qa[key].finishAnim(); } } return null; };
        const listIds = s => s.list.map(l => typeof l === 'string' ? l : l.id);
        const rounds = [];
        for(let r = 0; r < 3; r++){
          const start = S();
          const done = toDone();
          rounds.push({ list: listIds(start), reps: start.reps, done: !!done, rounds: done && done.rounds, shelved: done && done.shelved ? done.shelved.slice().sort() : null });
          window.advanceTime(3400, 68);                    // closing scene runs out → next round
        }
        return { rounds, screen: qa.state().screen, running: qa.state().running };
      }, key);
      assert.deepEqual(errors, []);
      assert.deepEqual(out.rounds.map(r => r.list), want);
      out.rounds.forEach((r, i) => {
        assert.equal(r.done, true, 'round ' + (i + 1) + ' reaches the closing scene');
        assert.equal(r.rounds, i + 1);
      });
      out.rounds.forEach((r, i) => {
        assert.ok(r.reps > 0);
        // supermarket: exactly the things on this round's list end up put away at home (fruit twice)
        if(r.shelved) assert.deepEqual(r.shelved, want[i].flatMap(id => (id === 'apple' || id === 'orange') ? [id, id] : [id]).sort());
      });
      assert.equal(out.screen, 'game'); assert.equal(out.running, true);
    } finally { await context.close(); }
  });
}
