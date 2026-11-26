import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// v145 — therapist feedback (27 Nov): patients said the Level 3 tea house always
// serves the same few dishes. The Level 3/4 simulated tea house becomes a yum cha
// table with the family:
//   an order sheet lists the six dishes of this table → a closed steamer arrives
//   → every lift opens it (which dish it is stays unknown until then) → the dish
//   goes to a family member who reacts → one box on the order sheet is ticked →
//   six ticks = the bill is paid and a new table starts.
// Thirty dishes are served from a shuffled bag, so all thirty appear before any
// repeat. It is a visual / audio reward layer only: the shoulder controller, the
// target decision, the score and the v137 re-arm rules are untouched.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');

const modStart = html.indexOf('/* ==================== v145 茶樓飲茶');
const modEnd = html.indexOf('/* ==================== v73 保齡球場景');
assert.ok(modStart > 0 && modEnd > modStart, 'v145 module is present');
const moduleSrc = html.slice(modStart, modEnd);

function loadModule(opts){
  const o = opts || {};
  let clock = 1000;
  const sandbox = {
    Math,
    Image: function(){ this.complete = false; this.naturalWidth = 0; },
    document: { getElementById: () => null },
    isTeahouseDimsumMode: () => o.teahouse !== false,
    hkCardShuffle: n => {
      const a = []; for(let i = 0; i < n; i++) a.push(i);
      for(let i = n - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    },
    nowMs: () => clock,
    dealText: (zh) => zh,
    Number, Object, Array, JSON,
  };
  vm.createContext(sandbox);
  vm.runInContext(moduleSrc + '\nthis.api={YUM_CHA_LIST,YUM_CHA_DISHES,YUM_CHA_FAMILY,YUM_CHA_PER_TABLE,yumCha,isYumChaTheme,beginYumChaTable,ensureYumChaTable,startYumChaServe,yumChaRewardMs,finishYumChaServe,resetYumCha,yumChaSummaryText,yumChaEatenUnique,yumChaMemberQuota,YC_OPEN_MS,YC_PASS_MS,YC_REACT_MS,YC_TAIL_MS,YC_BILL_MS};', sandbox);
  return { api: sandbox.api, sandbox, tick: ms => { clock += ms; } };
}

test('thirty different dim sum, each with a Chinese name, an English name and a compact local picture', () => {
  const { api } = loadModule();
  assert.equal(api.YUM_CHA_DISHES.length, 30);
  assert.equal(api.YUM_CHA_DISHES.length % api.YUM_CHA_PER_TABLE, 0, 'the bag divides evenly into tables');
  const ids = new Set(), zh = new Set(), en = new Set();
  let total = 0;
  for(const d of api.YUM_CHA_DISHES){
    assert.match(d.id, /^[a-z0-9_]+$/);
    assert.match(d.zh, /^[\u4e00-\u9fff]{2,4}$/);
    assert.match(d.en, /^[A-Za-z][A-Za-z ]+$/);
    ids.add(d.id); zh.add(d.zh); en.add(d.en);
    const file = path.join(root, 'img/dimsum', d.id + '.png');
    assert.equal(existsSync(file), true, 'img/dimsum/' + d.id + '.png');
    const size = statSync(file).size;
    assert.ok(size > 8000 && size < 110000, d.id + ' is compact: ' + size);
    total += size;
  }
  assert.equal(ids.size, 30);
  assert.equal(zh.size, 30);
  assert.equal(en.size, 30);
  assert.ok(total < 2.4 * 1024 * 1024, 'all dishes stay under 2.4 MB: ' + total);
  for(const must of ['蝦餃', '燒賣', '叉燒包', '糯米雞', '鳳爪', '腸粉', '蛋撻', '流沙包', '馬拉糕', '春卷']){
    assert.ok(zh.has(must), must);
  }
});

test('the steamer, its lid, the four family members and the cover picture ship with the scene', () => {
  const { api } = loadModule();
  assert.equal(api.YUM_CHA_FAMILY.length, 4);
  for(const f of api.YUM_CHA_FAMILY){
    const file = path.join(root, 'img/dimsum', f.file + '.png');
    assert.equal(existsSync(file), true, f.file);
    assert.ok(statSync(file).size < 40000);
    assert.equal(f.says.length, 3);
    for(const s of f.says){ assert.equal(s.length, 2); assert.match(s[1], /^[A-Za-z]/); }
  }
  for(const name of ['steamer_closed.png', 'steamer_lid.png', 'yum_cha_thumb.jpg']){
    assert.equal(existsSync(path.join(root, 'img/dimsum', name)), true, name);
  }
  // nothing else is left in the folder (no unused large files)
  const expected = new Set([...api.YUM_CHA_DISHES.map(d => d.id + '.png'), ...api.YUM_CHA_FAMILY.map(f => f.file + '.png'),
    'steamer_closed.png', 'steamer_lid.png', 'yum_cha_thumb.jpg']);
  assert.deepEqual(readdirSync(path.join(root, 'img/dimsum')).filter(n => !expected.has(n)), []);
  // the pictures are drawn by computer, not photos of real food or real people — say so on the credits
  assert.match(html, /img\/dimsum\/）全部係電腦生成圖像/);
});

test('six lifts finish one table: every box is ticked, the bill is paid and a new table starts', () => {
  const { api } = loadModule();
  assert.equal(api.isYumChaTheme(), true);
  api.ensureYumChaTable();
  assert.equal(api.yumCha.tableNo, 1);
  const first = api.yumCha.table.map(d => d.id);
  assert.equal(first.length, 6);
  assert.equal(new Set(first).size, 6);
  const served = [];
  for(let i = 1; i <= 6; i++){
    api.startYumChaServe();
    assert.equal(api.yumCha.anim.phase, 'serve');
    assert.equal(api.yumCha.served, i);
    assert.equal(api.yumCha.anim.done, i === 6);
    assert.equal(api.yumCha.anim.member, (i - 1) % 4, 'the family take turns');
    served.push(api.yumCha.table[api.yumCha.anim.slot].id);
    if(i < 6){
      assert.equal(api.yumChaRewardMs(), api.YC_OPEN_MS + api.YC_PASS_MS + api.YC_REACT_MS + api.YC_TAIL_MS);
      api.finishYumChaServe();
      assert.equal(api.yumCha.ticks.filter(Boolean).length, i);
      assert.equal(api.yumCha.delivered.length, i);
      assert.equal(api.yumCha.bills, 0);
    }
  }
  assert.equal(api.yumChaRewardMs(), api.YC_OPEN_MS + api.YC_PASS_MS + api.YC_REACT_MS + api.YC_BILL_MS);
  assert.deepEqual(served.slice().sort(), first.slice().sort(), 'each dish on the sheet arrives exactly once');
  assert.equal(api.yumCha.bills, 1);
  api.finishYumChaServe();
  assert.equal(api.yumCha.tableNo, 2);
  assert.equal(api.yumCha.served, 0);
  assert.deepEqual(Array.from(api.yumCha.ticks), [false, false, false, false, false, false]);
  assert.equal(api.yumCha.delivered.length, 0);
  for(const d of api.yumCha.table) assert.equal(first.includes(d.id), false, 'the next table has different dishes');
  assert.match(api.yumChaSummaryText(), /食咗 6 籠點心，埋咗 1 次單/);
  assert.equal(api.yumChaMemberQuota(0) + api.yumChaMemberQuota(1) + api.yumChaMemberQuota(2) + api.yumChaMemberQuota(3), 6);
});

test('a second lift during the animation is ignored', () => {
  const { api } = loadModule();
  api.ensureYumChaTable();
  api.startYumChaServe();
  const slot = api.yumCha.anim.slot;
  api.startYumChaServe();
  api.startYumChaServe();
  assert.equal(api.yumCha.served, 1);
  assert.equal(api.yumCha.eaten.length, 1);
  assert.equal(api.yumCha.anim.slot, slot);
  api.finishYumChaServe();
  api.finishYumChaServe(); // finishing twice does nothing either
  assert.equal(api.yumCha.delivered.length, 1);
  assert.equal(api.yumCha.ticks.filter(Boolean).length, 1);
});

test('all thirty dishes are served before any repeat, also across reshuffles, and reset clears everything', () => {
  const { api } = loadModule();
  api.ensureYumChaTable();
  for(let round = 0; round < 3; round++){
    const seen = new Set();
    let lastTable = null;
    for(let tbl = 0; tbl < 5; tbl++){
      const ids = api.yumCha.table.map(d => d.id);
      if(lastTable) for(const id of ids) assert.equal(lastTable.includes(id), false);
      lastTable = ids;
      for(let i = 0; i < 6; i++){ api.startYumChaServe(); seen.add(api.yumCha.table[api.yumCha.anim.slot].id); api.finishYumChaServe(); }
    }
    assert.equal(seen.size, 30, 'round ' + round);
    // the first table after a reshuffle never repeats the table just finished
    for(const d of api.yumCha.table) assert.equal(lastTable.includes(d.id), false);
  }
  assert.equal(api.yumCha.eaten.length, 90);
  assert.equal(api.yumCha.bills, 15);
  assert.equal(api.yumChaEatenUnique().length, 30);
  api.resetYumCha();
  assert.equal(api.yumCha.eaten.length, 0);
  assert.equal(api.yumCha.table.length, 0);
  assert.equal(api.yumCha.bills, 0);
  assert.equal(api.yumChaSummaryText(), '');
});

test('nothing starts outside the simulated tea house (camera view and other levels keep the old game)', () => {
  const { api } = loadModule({ teahouse: false });
  assert.equal(api.isYumChaTheme(), false);
  api.startYumChaServe();
  assert.equal(api.yumCha.anim.phase, 'idle');
  assert.equal(api.yumCha.table.length, 0);
});

test('the scene stays a reward layer on top of the shared detection', () => {
  assert.match(moduleSrc, /function isYumChaTheme\(\)\{ return isTeahouseDimsumMode\(\)&&YUM_CHA_DISHES\.length>=YUM_CHA_PER_TABLE; \}/);
  // it only reads the lift progress; it never writes the controller state or decides a repetition
  assert.doesNotMatch(moduleSrc, /shoulderFlexionState\.[A-Za-z]+\s*=[^=]/);
  assert.doesNotMatch(moduleSrc, /targetReady|shoulderFlexionController|repetitionReady|score\s*[+\-]?=/);
  assert.doesNotMatch(moduleSrc, /ctx\.filter/);
  // canvas text always goes through the language helper first
  for(const m of moduleSrc.matchAll(/ctx\.(?:fillText|strokeText)\(([^,]+),/g)){
    assert.doesNotMatch(m[1], /[\u4e00-\u9fff]/, 'canvas text literal: ' + m[0]);
  }
  assert.match(html, /if\(isYumChaTheme\(\)\)startYumChaServe\(\);/);
  assert.match(html, /return Math\.max\(SHOULDER_REWARD_MIN_MS,yumChaRewardMs\(\)\);/);
  assert.match(html, /finishYumChaServe\(\);/);
  assert.match(html, /resetYumCha\(\);/);
  assert.match(html, /if\(isYumChaTheme\(\)\)\{ drawYumChaScene\(ctx,cw,ch\); return; \}[^\n]*\n\s*if\(isTeahouseDimsumMode\(\)\)\{ drawTeahouseScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(isYumChaTheme\(\)\)\{ targets=\[\]; return; \}/);
  assert.match(html, /if\(correct&&isYumChaTheme\(\)\) return;/);
  // the simulated tea house gate itself is unchanged (public Level 3/4 only), and the camera-view option stays
  assert.match(html, /function isTeahouseDimsumMode\(\)\{return isShoulderFlexionLevel\(\)&&state\.theme==='dimsum'&&state\.dimsumSceneMode==='teahouse'&&!research\.active;\}/);
  assert.match(html, /data-dimsum-mode="camera">看到自己<\/button>/);
});

test('the scene card, the result page and the English text are wired up', () => {
  assert.match(html, /shoulderGoal:'舉手揭蒸籠，睇下今籠係咩點心；同屋企人剔滿點心紙就埋單'/);
  assert.match(html, /shoulderThumbnail:'img\/dimsum\/yum_cha_thumb\.jpg'/);
  assert.match(html, /const yumLine=isYumChaTheme\(\)\?yumChaSummaryText\(\):'';/);
  assert.match(html, /renderYumChaSummary\(\);/);
  assert.match(html, /\.album-card\.dish-card img\{ object-fit:contain;/);
  assert.match(localization, /'舉手揭蒸籠，睇下今籠係咩點心；同屋企人剔滿點心紙就埋單':/);
  for(const en of ['Lift to open', 'What is inside\\?', 'Order sheet', 'Bill, please!', 'to go', 'PAID']){
    assert.match(moduleSrc, new RegExp(en));
  }
});
