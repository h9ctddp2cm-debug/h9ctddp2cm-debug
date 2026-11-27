import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v146 — therapist feedback (27 Nov): a patient did not understand the game
// instructions. The spoken sentences were too long and not colloquial enough.
//   1. Every Level 3–6 game opens with two or three short colloquial lines:
//      one action per line, about ten characters, no therapist wording. The big
//      text on the rules screen is the same text that is read aloud.
//   2. The same instruction is not spoken a second time when the game starts.
//   3. Short spoken lines while playing (holding an item, praise, cooking steps).
//   4. Cards: a wrong card that is put down in the collecting area is taken away
//      instead of jumping back to where it was.
// Detection, scoring and the game steps are unchanged; the other flow keeps its
// own standard wording.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');
const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');

const cjk = s => (String(s).match(/[\u4e00-\u9fff]/g) || []).length;
const MAX_LINE = 12;
const BANNED = /[→（）()\[\]【】°·]|治療師|患側|患手|相機|鏡頭|中線|目標|請|然後|並且|以及/;
const hasEnglish = zh => localization.includes("'" + zh + "':'");

test('release markers', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v147-20261127-detect-box";/);
  assert.match(html, /const LEVEL_APP_BUILD = "v147-20261127-detect-box";/);
  assert.match(manifest, /"start_url": "\.\/index\.html\?build=v147-20261127-detect-box"/);
  assert.match(html, /perf v147/);
});

// ---- the start-line builder, run on its own with every setting combination ----
const blockStart = html.indexOf('/* ==================== v146 病人版開局指示');
const blockEnd = html.indexOf('// 根據目前活動（theme）及級別更新規則文字');
assert.ok(blockStart > 0 && blockEnd > blockStart, 'v146 block is present');
const blockSrc = html.slice(blockStart, blockEnd);

function builder(){
  const sandbox = {
    state: { level: '3', theme: 'bowlinglane', shoulderExerciseMode: 'cup', level6Task: 'flowers', dimsumDifficulty: 'basic', laundryPegStory: true },
    research: { active: false },
    teahouse: true, fridgeZone: false, itemWord: '物件',
    window: {}, String, Object,
  };
  sandbox.getTheme = () => ({ itemWord: sandbox.itemWord });
  sandbox.isTeahouseDimsumMode = () => sandbox.teahouse;
  sandbox.isFridgeZoneMode = () => sandbox.fridgeZone;
  vm.createContext(sandbox);
  vm.runInContext(blockSrc + '\nthis.api={plainStartLines,plainStartSpeech,plainRulesHtml,plainSay,storySay,PLAIN_TAIL,PLAIN_SHOULDER_DO};', sandbox);
  return sandbox;
}

function everyStartScreen(){
  const sb = builder();
  const out = [];
  const push = label => out.push({ label, lines: sb.api.plainStartLines().slice(), speech: sb.api.plainStartSpeech() });
  for(const level of ['3', '4']){
    for(const mode of ['cup', 'assisted-stick']){
      for(const theme of ['bowlinglane', 'basketball', 'supermarket', 'tsuenwan', 'laundry', 'cards', 'mahjong']){
        Object.assign(sb.state, { level, theme, shoulderExerciseMode: mode });
        push(`L${level} ${mode} ${theme}`);
      }
      for(const teahouse of [true, false]){
        Object.assign(sb.state, { level, theme: 'dimsum', shoulderExerciseMode: mode }); sb.teahouse = teahouse;
        push(`L${level} ${mode} dimsum teahouse=${teahouse}`);
      }
    }
  }
  sb.state.level = '5';
  for(const theme of ['dimsum', 'laundry', 'flowers', 'cards', 'mahjong']){ sb.state.theme = theme; push('L5 ' + theme); }
  for(const zone of [false, true]){ sb.state.theme = 'fridge'; sb.fridgeZone = zone; push('L5 fridge zone=' + zone); }
  sb.state.level = '67';
  for(const task of ['flowers', 'cards', 'mahjong', 'cooking']){ sb.state.level6Task = task; push('L6 ' + task); }
  for(const d of ['basic', 'complex']){ sb.state.level6Task = 'chopsticks'; sb.state.dimsumDifficulty = d; push('L6 chopsticks ' + d); }
  for(const story of [true, false]){ sb.state.level6Task = 'peg'; sb.state.laundryPegStory = story; push('L6 peg story=' + story); }
  return out;
}

test('every start screen: two or three short lines, one action each, plain wording', () => {
  const screens = everyStartScreen();
  assert.ok(screens.length >= 45, 'all setting combinations are covered');
  for(const s of screens){
    assert.ok(s.lines.length >= 2 && s.lines.length <= 3, s.label + ' has 2–3 lines');
    for(const line of s.lines){
      assert.ok(cjk(line) >= 3 && cjk(line) <= MAX_LINE, `${s.label}: 「${line}」 is at most ${MAX_LINE} characters`);
      assert.doesNotMatch(line, BANNED, `${s.label}: 「${line}」 uses plain wording`);
      assert.ok((line.match(/，/g) || []).length <= 1, `${s.label}: 「${line}」 has at most one pause`);
      assert.doesNotMatch(line, /[。！？]/, 'lines carry no sentence marks; they are joined when spoken');
    }
  }
});

test('what is read aloud is exactly the lines on the screen plus one closing line', () => {
  const sb = builder();
  assert.equal(sb.api.PLAIN_TAIL, '慢慢嚟，唔使急');
  for(const s of everyStartScreen()){
    assert.equal(s.speech, s.lines.concat(['慢慢嚟，唔使急']).join('。') + '。', s.label);
    assert.ok(cjk(s.speech) <= 40, s.label + ' whole spoken instruction stays under 40 characters');
  }
  Object.assign(sb.state, { level: '5', theme: 'laundry' });
  const page = sb.api.plainRulesHtml('衣物分類');
  for(const line of sb.api.plainStartLines()) assert.ok(page.includes('>' + line + '</span>'), line + ' is shown on the rules screen');
  assert.ok(page.includes('慢慢嚟，唔使急'));
});

test('every start line and the closing line has an English entry', () => {
  const seen = new Set();
  for(const s of everyStartScreen()) for(const line of s.lines) seen.add(line);
  seen.add('慢慢嚟，唔使急');
  for(const line of seen) assert.ok(hasEnglish(line), 'English entry for 「' + line + '」');
});

test('the other flow keeps its own wording', () => {
  const sb = builder();
  assert.equal(sb.api.plainSay('短句', '標準字句'), '短句');
  assert.equal(sb.api.storySay('抬高手，攞購物車'), '舉高隻手，攞購物車');
  sb.research.active = true;
  assert.equal(sb.api.plainSay('短句', '標準字句'), '標準字句');
  assert.equal(sb.api.storySay('抬高手，攞購物車'), '抬高手，攞購物車');
  // the standard sentences are still in the source for that flow
  assert.ok(html.includes("'先張開手，輕輕合手拿起物件（不用大力握實）。移到相同目標，再張開手放下。'"));
  assert.ok(html.includes("'攞住咗。移到患側外方放牌區停住，就會自動放低。'"));
  assert.match(html, /speakCantonese\(research\.active \? text : plainHeldSpeech\(\)\);/);
  assert.match(html, /if\(!research\.active && state\.level !== '2'\) cantoneseMsg = '';/);
});

test('short spoken lines while playing have English entries', () => {
  // sentences the page puts together from a short head and the place to go
  const built = [
    '攞住喇，擺去收牌區。', '攞住喇，擺去放牌區。', '攞住喇，擺去花盤。',
    '攞住喇。擺去收牌區，打開隻手。', '攞住喇。擺去放牌區，打開隻手。', '攞住喇。擺入花瓶，打開隻手。',
    '攞住喇。擺入同色嘅籃，打開隻手。', '攞住喇。擺過去，打開隻手。',
  ];
  for(const line of built){
    assert.ok(hasEnglish(line), 'English entry for 「' + line + '」');
    for(const part of line.split(/[。！]/).filter(Boolean)) assert.ok(cjk(part) <= MAX_LINE, '「' + part + '」 is short');
  }
  assert.match(html, /if\(level6AutoPlaceEnabled\(\)\) return '攞住喇，' \+ plainHeldWhere\(\) \+ '。';/);
  assert.match(html, /return '攞住喇。' \+ plainHeldWhere\(\) \+ '，打開隻手。';/);
  const lines = [
    '夾住喇，擺去衫架。', '夾住喇，擺過去。',
    '做得好！', '好準呀！', '好穩陣！', '好叻呀！', '好嘢！',
    '食糊！', '新一局。揀一組牌，砌到食糊。', '完成一輪，升級喇！', '將件衫放入同色嘅籃。', '未放入籃，再試過。',
    '將枝花插入花瓶。', '插好喇，好靚！', '舉高啲，停住。', '舉住唔好放。', '有動物阻住，搬開佢。', '蛋炒飯煮好喇！好叻呀！',
  ];
  for(const line of lines){
    assert.ok(html.includes(line), '「' + line + '」 is used by the page');
    assert.ok(hasEnglish(line), 'English entry for 「' + line + '」');
    for(const part of line.split(/[。！]/).filter(Boolean)) assert.ok(cjk(part) <= MAX_LINE, '「' + part + '」 is short');
  }
  assert.match(html, /const ENCOURAGE_PLAIN = \['做得好！','好準呀！','好穩陣！','好叻呀！','好嘢！'\];/);
});

test('cards: a wrong card that is put down is taken away (source)', () => {
  const at = html.indexOf("adaptiveNoteTrial('cards_place', 'failure', {reason:'wrong_suit'});");
  assert.ok(at > 0);
  const branch = html.slice(at, at + 520);
  assert.match(branch, /if\(!research\.active\)\{ c\.gone = true; fxRing\(c\.x, c\.y\); \}/);
  assert.match(branch, /speakCantonese\('呢張係' \+ CARD_SUIT_NAME\[c\.suit\] \+ '。要揀' \+ CARD_SUIT_NAME\[cards\.suit\] \+ '。'\);/);
});

test('cards: letting go outside the collecting area still returns the card (unchanged)', () => {
  assert.match(html, /if\(hit === '__invalid__'\)\{\n\s*cards\.msg = '請將牌移到' \+ affectedDirectionLabel\(\) \+ '的放牌區再放手。';\n\s*cardsPanel\(\);\n\s*return;/);
});

// ---------------------------- in the browser ----------------------------
let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(e){ browser = null; }
});
after(async () => { if(browser) await browser.close(); });

async function openPage(){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await context.addInitScript(() => {
    window.__said = [];
    try{
      const s = window.speechSynthesis;
      s.speak = u => { window.__said.push(u.text); setTimeout(() => { try{ u.onend && u.onend({}); }catch(e){} }, 0); };
      s.cancel = () => {};
    }catch(e){}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  return { context, page, errors };
}

test('rules screen of every game on the page: title, short numbered lines, closing line', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    let games = 0;
    for(const level of ['3', '4', '5', '67']){
      const themes = await page.evaluate(lv => window.__qa.themes(lv).map(x => x.id), level);
      for(const theme of themes){
        const r = await page.evaluate(o => window.__qa.rulesFor(o), { level, theme });
        games++;
        const label = `L${level} ${theme}`;
        assert.ok(r.rules.length >= 4 && r.rules.length <= 5, label + ' shows a title, 2–3 lines and the closing line');
        assert.equal(r.rules[0], r.title, label + ' title first');
        assert.equal(r.rules[r.rules.length - 1], '慢慢嚟，唔使急');
        const lines = r.rules.slice(1, -1).map((x, i) => {
          assert.ok(x.startsWith(String(i + 1)), label + ' lines are numbered');
          return x.slice(1);
        });
        for(const line of lines){
          assert.ok(cjk(line) <= MAX_LINE, `${label}: 「${line}」 is short`);
          assert.doesNotMatch(line, BANNED, `${label}: 「${line}」 uses plain wording`);
        }
        assert.equal(r.tts, lines.concat(['慢慢嚟，唔使急']).join('。') + '。', label + ' reads what is shown');
      }
    }
    assert.ok(games >= 28, 'all games were checked');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('starting a game does not repeat the instruction or speak the old long sentences', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const cases = [['3', 'bowlinglane'], ['4', 'supermarket'], ['5', 'dimsum'], ['5', 'laundry'], ['5', 'fridge'], ['5', 'cards'], ['67', 'flowers'], ['67', 'cards'], ['67', 'cooking']];
  for(const [level, theme] of cases){
    const { context, page, errors } = await openPage();
    try{
      const said = await page.evaluate(async o => {
        const info = window.__qa.rulesFor(o);
        window.__said.length = 0;
        window.__qa.startGame({ level: o.level, theme: o.theme, duration: 600, affectedSide: 'right', dwellMs: 0 });
        await new Promise(r => setTimeout(r, 1800));
        return { said: window.__said.slice(), tts: info.tts };
      }, { level, theme });
      const label = `L${level} ${theme}`;
      for(const line of said.said){
        assert.doesNotMatch(line, /遊戲開始|張開手，輕輕合手|前臂放在桌面|患側|不用大力握實/, label + ' old sentence is gone: ' + line);
        assert.notEqual(line, said.tts, label + ' start instruction is not read twice');
        for(const part of line.split(/[。！？]/).filter(Boolean)) assert.ok(cjk(part) <= 14, `${label}: 「${part}」 is short`);
      }
      assert.ok(said.said.length <= 1, label + ' at most one spoken line at the start');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('cards (Level 5 and Level 6): a wrong card disappears, the round can still be finished', async t => {
  if(!browser) return t.skip('playwright unavailable');
  for(const level of ['5', '67']){
    const { context, page, errors } = await openPage();
    try{
      const r = await page.evaluate(async level => {
        const q = window.__qa;
        q.startGame({ level, theme: 'cards', duration: 600, affectedSide: 'right', dwellMs: 0 });
        await new Promise(r => setTimeout(r, 300));
        window.advanceTime(800, 24);
        const before = q.cards.state();
        const wrongBefore = before.field.filter(c => c.suit !== before.suit);
        const rightBefore = before.field.filter(c => c.suit === before.suit).length;
        window.__said.length = 0;
        const afterWrong = q.cards.place(false);          // carried into the collecting area and put down
        const said = window.__said.slice();
        const stillThere = afterWrong.field.some(c => c.id === afterWrong.cardId);
        const rightAfter = afterWrong.field.filter(c => c.suit === afterWrong.suit).length;
        let done = afterWrong;
        for(let i = 0; i < before.need; i++) done = q.cards.place(true) || done;
        return { fieldBefore: before.field.length, fieldAfter: afterWrong.field.length, stillThere, rightBefore, rightAfter,
          wrongCount: wrongBefore.length, got: afterWrong.got, need: afterWrong.need, said, rounds0: before.rounds, rounds1: done.rounds };
      }, level);
      const label = 'Level ' + level;
      assert.equal(r.fieldAfter, r.fieldBefore - 1, label + ': one card fewer on the table');
      assert.equal(r.stillThere, false, label + ': the wrong card is gone');
      assert.equal(r.rightAfter, r.rightBefore, label + ': wanted cards are untouched');
      assert.ok(r.rightAfter >= r.need, label + ': enough wanted cards remain');
      assert.equal(r.got, 0, label + ': a wrong card is not counted');
      assert.ok(r.said.some(x => /^呢張係.+。要揀.+。$/.test(x)), label + ': the short reminder is spoken');
      assert.equal(r.rounds1, r.rounds0 + 1, label + ': the round can still be finished');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});
