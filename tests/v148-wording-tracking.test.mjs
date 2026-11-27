import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v148 — therapist wording review (27 Nov) plus camera tracking prompts.
//   1. Start lines and spoken sentences use the agreed everyday verbs:
//      hand exerciser「揸一下，放鬆」, peg「捏住衣夾，攞起件衫」, three fingers
//      「捏起」, chopsticks keep「夾」, Level 6 waits with「等一等」.
//   2. Speech order: step instruction > correction > tracking prompt > praise.
//      A lower sentence never cuts a higher one; a correction waits its turn.
//   3. Numbers are spoken the Cantonese way (「做兩次」「第二碟」).
//   4. Cooking: fewer squeezes (13 / 22 / 35), a 20 second rest between plates,
//      the patient squeezes once to start the next plate.
//   5. Dim sum: one order at a time, always shown at the top.
//   6. Tracking prompts T1–T9 with a small chip on screen. They never change
//      scoring, never pause the game and never touch a detection threshold.
//   7. A step instruction is repeated after 10 idle seconds, at most twice.
//   8. A note for the therapist when the device has no Cantonese voice.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');
const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');

const cjk = s => (String(s).match(/[\u4e00-\u9fff]/g) || []).length;

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
function block(name){
  const a = html.indexOf('/* ' + name + ':start */'), b = html.indexOf('/* ' + name + ':end */');
  assert.ok(a > 0 && b > a, name + ' block is present');
  return html.slice(a, b);
}

test('release markers', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v148-20261127-wording";/);
  assert.match(html, /const LEVEL_APP_BUILD = "v148-20261127-wording";/);
  assert.match(manifest, /"start_url": "\.\/index\.html\?build=v148-20261127-wording"/);
  assert.match(html, /perf v148 {2}/);
});

// ---------------------------------------------------------------- start lines
const startBlock = html.slice(html.indexOf('/* ==================== v146 病人版開局指示'), html.indexOf('// 根據目前活動（theme）及級別更新規則文字'));
function builder(){
  const sb = {
    state: { level: '3', theme: 'bowlinglane', shoulderExerciseMode: 'cup', level6Task: 'flowers', dimsumDifficulty: 'basic', laundryPegStory: true },
    research: { active: false }, teahouse: true, fridgeZone: false, itemWord: '物件', window: {}, String, Object,
  };
  sb.getTheme = () => ({ itemWord: sb.itemWord });
  sb.isTeahouseDimsumMode = () => sb.teahouse;
  sb.isFridgeZoneMode = () => sb.fridgeZone;
  vm.createContext(sb);
  vm.runInContext(startBlock + '\nthis.api={plainStartLines,plainStartSpeech};', sb);
  return sb;
}
function startLines(patch, extra){
  const sb = builder();
  Object.assign(sb.state, patch); Object.assign(sb, extra || {});
  return [...sb.api.plainStartLines()];
}
function everyStartScreen(){
  const sb = builder(); const out = [];
  const push = label => out.push({ label, lines: [...sb.api.plainStartLines()], speech: sb.api.plainStartSpeech() });
  for(const level of ['3', '4']){
    for(const mode of ['cup', 'assisted-stick']){
      for(const theme of ['bowlinglane', 'basketball', 'supermarket', 'tsuenwan', 'laundry', 'cards', 'mahjong', 'hktour', 'yumcha']){
        Object.assign(sb.state, { level, theme, shoulderExerciseMode: mode }); push(`L${level} ${mode} ${theme}`);
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

test('start lines: Level 3/4 lift, then lower and go on to the next one', () => {
  for(const level of ['3', '4']){
    for(const theme of ['bowlinglane', 'supermarket', 'laundry', 'hktour', 'yumcha']){
      const cup = startLines({ level, theme, shoulderExerciseMode: 'cup' });
      assert.equal(cup.length, 2, theme + ' single hand has two lines');
      assert.match(cup[0], /^舉高隻手，/);
      assert.equal(cup[1], '放低隻手，再嚟下一個');
      const stick = startLines({ level, theme, shoulderExerciseMode: 'assisted-stick' });
      assert.deepEqual(stick, ['兩隻手揸住支棍', '一齊舉高支棍', '放低支棍，再嚟下一個']);
    }
  }
});

test('start lines: Level 5 and Level 6 use the agreed verbs', () => {
  assert.equal(startLines({ level: '5', theme: 'cards' }).at(-1), '擺去放牌區，打開隻手');
  assert.deepEqual(startLines({ level: '67', level6Task: 'flowers' }), ['三隻手指，捏起枝花', '擺去花瓶', '等一等，就放低']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'cards' }), ['睇上面要邊隻花', '三隻手指，捏起張牌', '擺去放牌區，等一等']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'mahjong' }), ['揀一組牌', '三隻手指，捏起佢', '擺去放牌區，等一等']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'cooking' }), ['揸一下握力器', '再放鬆隻手', '咁就計一次']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'chopsticks', dimsumDifficulty: 'basic' }), ['筷子尖指住點心', '等一等，就夾起', '夾去隻碟，等一等']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'chopsticks', dimsumDifficulty: 'complex' }), ['睇上面要邊款點心', '筷子尖指住佢，等一等', '夾去隻碟，等一等']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'peg', laundryPegStory: true }), ['隻手去着燈嗰度', '捏住衣夾，攞起件衫', '擺到目的地，等一等']);
  assert.deepEqual(startLines({ level: '67', level6Task: 'peg', laundryPegStory: false }), ['捏住衣夾，攞起件衫', '舉高，擺去衫架', '等一等，就掛好']);
});

test('start lines: short, and none of the retired words', () => {
  const screens = everyStartScreen();
  assert.ok(screens.length >= 50, 'every setting combination is covered');
  const RETIRED = /收牌區|花盤|閃燈|閃咭|揸實|停一停|再嚟過/;
  for(const s of screens){
    assert.ok(s.lines.length >= 2 && s.lines.length <= 3, s.label + ' has 2–3 lines');
    for(const line of s.lines){
      assert.ok(cjk(line) <= 12, `${s.label}: 「${line}」 is at most 12 characters`);
      assert.doesNotMatch(line, RETIRED, `${s.label}: 「${line}」`);
    }
    assert.doesNotMatch(s.speech, RETIRED, s.label + ' speech');
    assert.ok(s.speech.startsWith(s.lines.join('。') + '。'), s.label + ': what is read is what is shown');
  }
  // Level 6 waits with「等一等」; Level 3/4 keeps「停住」where it had it
  for(const s of screens.filter(x => x.label.startsWith('L6'))) assert.doesNotMatch(s.speech, /停住/, s.label);
});

test('spoken cue words follow the verb rules', () => {
  assert.match(html, /const PLAIN_VERB_PINCH_HOLD = '捏住'/);
  assert.match(html, /const PLAIN_VERB_PINCH_UP = '捏起'/);
  assert.match(html, /const PLAIN_VERB_CHOPSTICK_HOLD = '夾住'/);
  const phrase = fnSource('publicPatientVoicePhrase');
  for(const word of ['揸拳頭', '打開隻手', '鬆開筷子', '等一等', '舉高隻手']) assert.ok(phrase.includes(word), 'cue word ' + word);
  assert.doesNotMatch(phrase, /停一停|揸實/);
  assert.match(html, /const ENCOURAGE_PLAIN = \['做得好！','手勢好準！','好穩陣！','夠晒力！','師傅級喎！','好嘢！'\];/);
});

// ------------------------------------------------------------------ English
function translator(){
  const win = {}; const doc = { readyState: 'loading', addEventListener(){}, documentElement: {} };
  const ctx = { window: win, document: doc, Node: {}, NodeFilter: {}, MutationObserver: function(){ this.observe = () => {}; }, WeakMap, console,
    localStorage: { getItem(){ return null; }, setItem(){} } };
  vm.createContext(ctx); vm.runInContext(localization, ctx);
  return win.YCHLanguage.translateToEnglish;
}

test('English: every new patient sentence has its own translation', () => {
  const T = translator();
  const pairs = [
    ['擺去放牌區，打開隻手', 'Carry it to the drop area and open your hand'],
    ['擺去放牌區，等一等', 'Carry it to the drop area and wait a moment'],
    ['擺去花瓶', 'Carry it to the vase'],
    ['等一等，就放低', 'Wait a moment and it is put down'],
    ['三隻手指，捏起枝花', 'Use three fingers to pinch a flower'],
    ['三隻手指，捏起張牌', 'Use three fingers to pinch a card'],
    ['揸一下握力器', 'Squeeze the hand exerciser once'],
    ['再放鬆隻手', 'Then relax your hand'],
    ['咁就計一次', 'That counts as one'],
    ['筷子尖指住點心', 'Point the chopstick tips at the dim sum'],
    ['等一等，就夾起', 'Wait a moment to pick it up'],
    ['夾去隻碟，等一等', 'Carry it to the plate and wait a moment'],
    ['睇上面要邊款點心', 'Check the dim sum shown at the top'],
    ['捏住衣夾，攞起件衫', 'Pinch the peg and pick up a garment'],
    ['擺到目的地，等一等', 'Carry it to the place and wait a moment'],
    ['等一等，就掛好', 'Wait a moment and it hangs up'],
    ['放低隻手，再嚟下一個', 'Lower your arm, then on to the next one'],
    ['放低支棍，再嚟下一個', 'Lower the stick, then on to the next one'],
    ['一齊舉高支棍', 'Raise the stick together'],
    ['煮好一碟喇，放鬆隻手，休息一陣。', 'One plate done. Relax your hand and rest.'],
    ['想再煮，就揸一下。攰就休息。', 'To cook again, squeeze once. If you are tired, rest.'],
    ['休息一陣', 'Rest for a moment'],
    ['想再煮？揸一下', 'Cook again? Squeeze once'],
    ['上齊喇，多謝晒！', 'All served. Thank you!'],
    ['擺去着燈嗰個架。', 'Put it on the lit rack.'],
    ['慢慢嚟，先搬開隻動物。', 'Take your time. First, move the animal away.'],
    ['做得好！', 'Well done!'], ['手勢好準！', 'Great aim!'], ['好穩陣！', 'Nice and steady!'],
    ['夠晒力！', 'Good strength!'], ['師傅級喎！', 'Like a master!'], ['好嘢！', 'Great!'],
  ];
  for(const [zh, en] of pairs){
    assert.ok(html.includes(zh), '「' + zh + '」 is used by the page');
    assert.equal(T(zh), en, zh);
  }
});

// ------------------------------------------------------------- speech core
function speechCore(){
  const sb = { performance: { now: () => 0 }, String, Number, Math, Array };
  vm.createContext(sb);
  vm.runInContext(block('v148-speech-core') + '\nthis.api={SPEECH_RANK,speechNow,speechRankOf,speechBusyRank,speechCanSay,speechEstimateMs,cantoNumber,cantoSpokenNumbers,speechHasNumber,enName,SPEECH_WAIT_MAX_MS,SPEECH_WAIT_GAP_MS};', sb);
  return sb.api;
}

test('speech order: step > correction > tracking prompt > praise', () => {
  const s = speechCore();
  assert.deepEqual({ ...s.SPEECH_RANK }, { step: 4, correct: 3, track: 2, praise: 1 });
  assert.equal(s.speechRankOf(undefined), 4, 'a sentence with no priority is a step instruction');
  assert.equal(s.speechRankOf({ priority: 'praise' }), 1);
  // nothing playing → anything may be said
  for(const p of ['step', 'correct', 'track', 'praise']) assert.equal(s.speechCanSay(p, 0), true);
  // a step instruction is playing until t=4000
  Object.assign(s.speechNow, { rank: 4, token: 1, until: 4000 });
  assert.equal(s.speechCanSay('step', 1000), true, 'a new step replaces the old one');
  assert.equal(s.speechCanSay('correct', 1000), false);
  assert.equal(s.speechCanSay('track', 1000), false);
  assert.equal(s.speechCanSay('praise', 1000), false);
  // fallback for devices that never report the end of a sentence
  assert.equal(s.speechCanSay('praise', 4001), true);
  // a tracking prompt is playing
  Object.assign(s.speechNow, { rank: 2, token: 2, until: 9000 });
  assert.equal(s.speechCanSay('praise', 5000), false);
  assert.equal(s.speechCanSay('track', 5000), true);
  assert.equal(s.speechCanSay('correct', 5000), true);
  assert.ok(s.speechEstimateMs('舉高隻手', 0.85) > 900);
  assert.equal(s.SPEECH_WAIT_MAX_MS, 5000);
});

test('numbers are spoken the Cantonese way; the screen keeps digits', () => {
  const { cantoSpokenNumbers: say, cantoNumber } = speechCore();
  assert.equal(say('抓鬆冷飯。揸一下，放鬆，做 2 次。'), '抓鬆冷飯。揸一下，放鬆，做兩次。');
  assert.equal(say('做 1 次'), '做一次');
  assert.equal(say('做 3 次'), '做三次');
  assert.equal(say('第 2 碟'), '第二碟');
  assert.equal(say('第 12 碟'), '第十二碟');
  assert.equal(say('將 2 件恤衫擺上衫架。'), '將兩件恤衫擺上衫架。');
  assert.equal(say('要 10 個'), '要十個');
  assert.equal(say('要 21 個'), '要二十一個');
  assert.equal(say('Level 6'), 'Level 6', 'English and model numbers are left alone');
  assert.equal(say('舉高隻手'), '舉高隻手');
  assert.equal(cantoNumber(2, true), '兩');
  assert.equal(cantoNumber(2, false), '二');
  assert.equal(cantoNumber(20, true), '二十');
  // older iPad Safari: no lookbehind anywhere in the page script
  assert.doesNotMatch(html, /\(\?<[=!]/);
});

test('English item names: singular / plural, unknown items fall back', () => {
  const { enName } = speechCore();
  assert.equal(enName('恤衫', 1), 'shirt');
  assert.equal(enName('恤衫', 2), 'shirts');
  assert.equal(enName('蝦餃', 3), 'har gow');
  assert.equal(enName('紅心'), 'hearts');
  assert.equal(enName('不存在'), '');
});

// --------------------------------------------------------- tracking prompts
function tracker(){
  const sb = { String, Number, Math, Array, Object };
  vm.createContext(sb);
  vm.runInContext(block('v148-tracking-prompts') + '\nthis.api={TRACK_PROMPTS,TRACK_HOLD_MS,TRACK_COOLDOWN_MS,TRACK_ESCALATE_MS,TRACK_MAX_SPOKEN,TRACK_DROP_WINDOW_MS,TRACK_DROP_COUNT,TRACK_CLEAR_MS,trackPromptText,trackPromptNewState,trackPromptStep,STEP_REPEAT_IDLE_MS,STEP_REPEAT_MAX,stepRepeatNewState,stepRepeatStep};', sb);
  return sb.api;
}
// run a condition for a while in 100 ms frames; collect what was spoken and when
// (times in the tests count from when the test starts; the game clock is never 0)
const BASE = 5000;
const stepAt = (api, st, input, t) => api.trackPromptStep(st, input, t + BASE);
function run(api, st, input, fromMs, toMs, said){
  let out = { chip: '', say: '' };
  for(let t = fromMs; t <= toMs; t += 100){
    out = stepAt(api, st, typeof input === 'function' ? input(t) : input, t);
    if(out.say) said.push([out.say, t]);
  }
  return out;
}

test('tracking prompts: the nine sentences, in both languages', () => {
  const t = tracker();
  assert.deepEqual(Object.keys(t.TRACK_PROMPTS), ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']);
  assert.equal(t.TRACK_PROMPTS.T1.say, '鏡頭睇唔到隻手，放返入畫面中間。');
  assert.equal(t.TRACK_PROMPTS.T2.say, '鏡頭睇唔到膊頭，坐返正中間。');
  assert.equal(t.TRACK_PROMPTS.T3.say, '太近鏡頭喇，坐後少少。');
  assert.equal(t.TRACK_PROMPTS.T4.say, '太遠喇，坐近少少。');
  assert.equal(t.TRACK_PROMPTS.T6.say, '鏡頭睇得唔清楚，隻手定住，等一等。');
  assert.equal(t.TRACK_PROMPTS.T7.say, '鏡頭重新連接緊，等一等。');
  assert.equal(t.TRACK_PROMPTS.T8.say, '請姑娘幫手校返個鏡頭。');
  assert.equal(t.TRACK_PROMPTS.T9.say, '見到喇，繼續。');
  assert.deepEqual({ ...t.trackPromptText('T5', 'left') }, { say: '試吓用返左手。', chip: '用左手', en: 'Try using your left hand.', chipEn: 'Use left hand' });
  assert.equal(t.trackPromptText('T5', 'right').say, '試吓用返右手。');
  assert.equal(t.trackPromptText('nope').say, '');
  for(const [code, p] of Object.entries(t.TRACK_PROMPTS)){
    assert.ok(p.en && /^[\x20-\x7e]+$/.test(p.en), code + ' has an English sentence');
    assert.ok(cjk(p.chip) <= 6, code + ' chip is short');
    assert.doesNotMatch(p.say, /錯|扣分|失敗/, code + ' never blames the patient');
  }
  assert.deepEqual([t.TRACK_HOLD_MS, t.TRACK_COOLDOWN_MS, t.TRACK_ESCALATE_MS, t.TRACK_MAX_SPOKEN, t.TRACK_DROP_WINDOW_MS, t.TRACK_DROP_COUNT],
    [3000, 15000, 15000, 2, 3000, 3]);
});

test('tracking prompts: 3 seconds before the first prompt, then help after 15 seconds, at most two sentences', () => {
  const t = tracker(); const st = t.trackPromptNewState(); const said = [];
  let out = run(t, st, { cond: 'T1', ok: false }, 0, 2900, said);
  assert.deepEqual(said, [], 'nothing in the first 3 seconds');
  assert.equal(out.chip, '');
  out = run(t, st, { cond: 'T1', ok: false }, 3000, 3000, said);
  assert.deepEqual(said, [['T1', 3000]]);
  assert.equal(out.chip, 'T1');
  out = run(t, st, { cond: 'T1', ok: false }, 3100, 14900, said);
  assert.equal(said.length, 1, 'the same sentence is not repeated inside 15 seconds');
  assert.equal(out.chip, 'T1');
  out = run(t, st, { cond: 'T1', ok: false }, 15000, 15000, said);
  assert.deepEqual(said[1], ['T8', 15000], '15 seconds after the problem began → ask the therapist');
  assert.equal(out.chip, 'T8');
  out = run(t, st, { cond: 'T1', ok: false }, 15100, 90000, said);
  assert.equal(said.length, 2, 'never more than two spoken sentences per problem');
  assert.equal(out.chip, 'T8', 'only the short text stays on screen');
  // back to normal → chip goes after a short moment and one friendly sentence
  out = run(t, st, { cond: '', ok: true }, 90100, 91200, said);
  assert.equal(said.length, 2);
  out = run(t, st, { cond: '', ok: true }, 91300, 91400, said);
  assert.deepEqual(said[2], ['T9', 91300]);
  assert.equal(out.chip, '');
});

test('tracking prompts: a short blip is ignored, and no "I can see you" unless something was said', () => {
  const t = tracker(); const st = t.trackPromptNewState(); const said = [];
  run(t, st, { cond: 'T1', ok: false }, 0, 2500, said);
  const out = run(t, st, { cond: '', ok: true }, 2600, 9000, said);
  assert.deepEqual(said, []);
  assert.equal(out.chip, '');
  // prompt shown while speech is busy: chip only; recovery then stays silent
  const st2 = t.trackPromptNewState(); const said2 = [];
  let o = run(t, st2, { cond: 'T2', ok: false, canSpeak: false }, 0, 6000, said2);
  assert.equal(o.chip, 'T2'); assert.deepEqual(said2, []);
  o = run(t, st2, { cond: '', ok: true }, 6100, 9000, said2);
  assert.equal(o.chip, ''); assert.deepEqual(said2, [], 'T9 only follows a spoken prompt');
});

test('tracking prompts: frame stall is immediate; three drops in three seconds means "camera adjusting"', () => {
  const t = tracker();
  const st = t.trackPromptNewState(); const said = [];
  let out = stepAt(t, st, { cond: 'T7', ok: true }, 1000);
  assert.deepEqual([out.chip, out.say], ['T7', 'T7']);
  out = run(t, st, { cond: 'T7', ok: true }, 1100, 40000, said);
  assert.equal(out.chip, 'T7', 'a stall never turns into "ask the therapist" by itself');
  // flicker: hand seen / lost / seen … each loss shorter than 3 s
  const st2 = t.trackPromptNewState(); const said2 = [];
  const flicker = ms => (Math.floor(ms / 400) % 2 === 0) ? { cond: '', ok: true } : { cond: 'T1', ok: false };
  const o2 = run(t, st2, flicker, 0, 2900, said2);
  assert.equal(said2.length, 1);
  assert.equal(said2[0][0], 'T6');
  assert.ok(said2[0][1] < 3000, 'spoken before any single loss reached 3 seconds');
  assert.equal(o2.chip, 'T6');
});

test('tracking prompts: suppressed moments reset everything', () => {
  const t = tracker(); const st = t.trackPromptNewState(); const said = [];
  run(t, st, { cond: 'T1', ok: false }, 0, 5000, said);
  assert.equal(said.length, 1);
  const out = stepAt(t, st, { cond: 'T1', ok: false, suppressed: true }, 5100);
  assert.deepEqual([out.chip, out.say], ['', '']);
  assert.equal(st.episodeAt, 0); assert.equal(st.spoken, 0); assert.equal(st.cond, '');
  // after the pause the 3 second count starts again; the 15 second gap for the same sentence still holds
  const o2 = run(t, st, { cond: 'T1', ok: false }, 5200, 8100, said);
  assert.equal(said.length, 1);
  assert.equal(o2.chip, '');
  const o3 = run(t, st, { cond: 'T1', ok: false }, 8200, 8300, said);
  assert.equal(o3.chip, 'T1');
  assert.equal(said.length, 1, 'same sentence stays quiet inside its 15 second gap');
});

test('step repeat: after 10 idle seconds, at most twice, never over a pause or speech', () => {
  const t = tracker();
  assert.deepEqual([t.STEP_REPEAT_IDLE_MS, t.STEP_REPEAT_MAX], [10000, 2]);
  const st = t.stepRepeatNewState();
  assert.equal(t.stepRepeatStep(st, {}, 99999), false, 'nothing to repeat yet');
  st.text = '舉高隻手'; st.at = 0;
  assert.equal(t.stepRepeatStep(st, {}, 9900), false);
  assert.equal(t.stepRepeatStep(st, {}, 10000), true);
  assert.equal(t.stepRepeatStep(st, {}, 15000), false);
  assert.equal(t.stepRepeatStep(st, { moved: true }, 19000), false, 'movement restarts the wait');
  assert.equal(t.stepRepeatStep(st, {}, 28900), false);
  assert.equal(t.stepRepeatStep(st, {}, 29000), true);
  assert.equal(t.stepRepeatStep(st, {}, 99000), false, 'never a third time');
  const st2 = t.stepRepeatNewState(); st2.text = 'x'; st2.at = 0;
  assert.equal(t.stepRepeatStep(st2, { suppressed: true }, 20000), false);
  assert.equal(t.stepRepeatStep(st2, { speaking: true }, 25000), false);
  assert.equal(t.stepRepeatStep(st2, {}, 30000), false, 'the wait restarted while paused / speaking');
  assert.equal(t.stepRepeatStep(st2, {}, 35000), true);
});

test('tracking prompts only watch: no scoring, no pause, no threshold inside the runtime block', () => {
  const rt = block('v148-tracking-runtime');
  assert.doesNotMatch(rt, /wrongCount|score\s*[-+]=|score\s*=[^=]|triggerRecoveryPause|pauseGame|endGame|state\.paused\s*=/);
  assert.doesNotMatch(rt, /minHandDetectionConfidence|minTrackingConfidence|minHandPresenceConfidence|numHands|runningMode/);
  assert.match(rt, /const TRACK_GRACE_MS = 5000;/);
  // prompts are spoken at "track" priority, so they never cut a step or a correction
  assert.match(rt, /speakCantonese\(dealText\(t\.say, t\.en\), \{ priority:'track' \}\);/);
  // the camera set-up itself is untouched
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /runningMode:\s*"VIDEO"/);
  assert.match(html, /const PUBLIC_GAME_WORK_INTERVAL_MS = 1000 \/ 30;/);
  assert.match(html, /const PUBLIC_CANVAS_MAX_EDGE = 1600;/);
});

// ------------------------------------------------------------------ cooking
test('cooking: fewer squeezes, a rest between plates, one sound per step', () => {
  assert.match(html, /const COOK_DIGIFLEX_NEED = \[2,2,2,2,2,1,1,2,2,2,1,3\];/);
  assert.match(html, /const COOK_STEP_SOUNDS = \['rustle','crack','stir','water','chop','ignite','sizzle','sizzleBig','shake','sizzle','click','clang'\];/);
  assert.match(html, /const COOK_REST_MS = 20000;/);
  assert.match(html, /const COOK_REST_SAY = '煮好一碟喇，放鬆隻手，休息一陣。';/);
  assert.match(html, /const COOK_REST_READY_SAY = '想再煮，就揸一下。攰就休息。';/);
  assert.match(html, /const COOK_REPEAT_MIN_LEFT_S = 40;/);
  assert.match(fnSource('cookAdvance'), /timeLeft >= COOK_REPEAT_MIN_LEFT_S/);
  // the completion line the patients like stays
  assert.ok(html.includes('蛋炒飯煮好喇！好叻呀！'));
  // settings page counts in「下」, the patient hears「次」
  assert.ok(html.includes('少（13 下）') && html.includes('中（22 下）') && html.includes('多（35 下）'));
});

// ------------------------------------------------------------------ dim sum
test('dim sum: one order at a time, shown at the top for everyone', () => {
  const banner = fnSource('drawDimsumOrderBanner');
  assert.match(banner, /const line = dimsumOrder\.lines\[0\];/);
  assert.doesNotMatch(banner, /research\.active/);
  assert.match(html, /const DIMSUM_ORDER_DONE_TEXT = '上齊喇，多謝晒！';/);
});

// ------------------------------------------------------------------ in the browser
let chromium = null, browser = null;
before(async () => {
  try{ ({ chromium } = await import('playwright')); browser = await chromium.launch(); }
  catch(_e){ browser = null; }
});
after(async () => { if(browser) await browser.close(); });

async function openPage(viewport, opts){
  const o = opts || {};
  const context = await browser.newContext({ viewport: viewport || { width: 1180, height: 820 } });
  await context.addInitScript(voices => {
    window.__said = [];
    try{
      const s = window.speechSynthesis;
      s.speak = u => { window.__said.push(u.text); setTimeout(() => { try{ u.onend && u.onend({}); }catch(e){} }, 0); };
      s.cancel = () => {};
      if(voices) s.getVoices = () => voices;
    }catch(e){}
  }, o.voices || null);
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { context, page, errors };
}

test('browser: cooking counts, spoken numbers, rest, and the patient starts the next plate', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa, out = {};
    const tick = ms => new Promise(res => setTimeout(res, ms));
    q.startGame({ level: '67', level6Task: 'cooking', duration: 900, affectedSide: 'right' });
    await tick(300); window.advanceTime(800, 24);
    out.totals = q.cook.totals();
    out.first = q.cook.step();
    window.advanceTime(4000, 40); await tick(50);
    out.saidStart = window.__said.slice();
    let guard = 0; while(!q.cook.step().done && guard++ < 20) q.cook.completeStep();
    window.advanceTime(7000, 70); await tick(50);
    if(q.cook.step().reward){ q.closeReward(); window.advanceTime(500, 5); }
    await tick(50);
    out.rest = q.cook.step();
    out.saidRest = window.__said.slice();
    // a squeeze during the rest does not start the plate
    const squeezeNow = () => { for(const curl of [.2, .2, .2, .2, .45, .45, .45, .45, .45, .45, .2, .2, .2, .2, .2, .2, .2, .2]) q.setLevel6ToolFrame({ curl, stepMs: 60, nx: .5, ny: .55 }); };
    squeezeNow();
    out.restAfterSqueeze = q.cook.step();
    window.advanceTime(out.restAfterSqueeze.restLeftMs + 400, 30); await tick(50);
    out.wait = q.cook.step();
    out.saidWait = window.__said.slice();
    squeezeNow(); await tick(30);
    out.next = q.cook.step();
    // under 40 seconds left: the dish ends the game instead of starting another plate
    window.advanceTime(4000, 40);
    q.setTimeLeft(35);
    guard = 0; while(!q.cook.step().done && guard++ < 20) q.cook.completeStep();
    window.advanceTime(7000, 70); await tick(50);
    if(q.cook.step().reward){ q.closeReward(); window.advanceTime(500, 5); }
    out.last = q.cook.step();
    return out;
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(r.totals.need, [2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 1, 3]);
  assert.deepEqual([r.totals.less, r.totals.normal, r.totals.more], [13, 22, 35]);
  assert.equal(r.first.need, 2);
  assert.ok(r.saidStart.some(s => /揸一下，放鬆，做兩次。$/.test(s)), 'the count is spoken as「做兩次」: ' + r.saidStart.join(' | '));
  assert.ok(!r.saidStart.some(s => /\d/.test(s)), 'no digit is handed to the Cantonese voice');
  assert.equal(r.rest.rest, 'rest');
  assert.equal(r.rest.rounds, 1);
  assert.ok(r.rest.restLeftMs > 15000 && r.rest.restLeftMs <= 20000);
  assert.ok(r.saidRest.includes('煮好一碟喇，放鬆隻手，休息一陣。'));
  assert.equal(r.restAfterSqueeze.rest, 'rest', 'squeezing during the rest does not start the plate');
  assert.equal(r.restAfterSqueeze.reps, 0);
  assert.equal(r.wait.rest, 'wait');
  assert.ok(r.saidWait.includes('想再煮，就揸一下。攰就休息。'));
  assert.equal(r.next.rest, '', 'one squeeze starts the next plate');
  assert.equal(r.next.idx, 0);
  assert.equal(r.next.reps, 0, 'the starting squeeze is not counted');
  assert.equal(r.next.rounds, 1);
  assert.equal(r.last.rounds, 2);
  assert.equal(r.last.rest, '', 'no new plate with under 40 seconds left');
});

test('browser: dim sum shows a single order', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa;
    const start = () => q.startGame({ level: '67', level6Task: 'chopsticks', duration: 300, affectedSide: 'right' });
    start();   // the difficulty buttons only answer once the chopsticks game is the chosen one
    document.querySelector('#dimsumDifficultyOptions [data-dimsum-difficulty="complex"]').click();
    window.__said.length = 0;
    start();
    await new Promise(res => setTimeout(res, 300)); window.advanceTime(800, 24);
    await new Promise(res => setTimeout(res, 100));
    return { order: q.level67Layout().dimsumOrder, said: window.__said.slice() };
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.ok(r.order, 'the order strip is on');
  assert.equal(r.order.lines.length, 1);
  assert.ok(!r.said.some(s => /\d/.test(s)), 'spoken order uses Cantonese numbers');
});

test('browser: dim sum never stacks under the order strip (laptop, tablet, small landscape, portrait)', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  for(const viewport of [{ width: 1413, height: 653 }, { width: 1180, height: 820 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }]){
    const { context, page, errors } = await openPage(viewport);
    const rounds = await page.evaluate(async () => {
      const q = window.__qa; const out = [];
      const start = () => q.startGame({ level: '67', level6Task: 'chopsticks', duration: 300, affectedSide: 'right' });
      start();
      document.querySelector('#dimsumDifficultyOptions [data-dimsum-difficulty="complex"]').click();
      const hits = (i, b) => { const nx = Math.max(b.left, Math.min(i.x, b.right)), ny = Math.max(b.top, Math.min(i.y, b.bottom)); return Math.hypot(i.x - nx, i.y - ny) < i.r; };
      for(let k = 0; k < 4; k++){
        start();
        await new Promise(res => setTimeout(res, 250)); window.advanceTime(1200, 36);
        await new Promise(res => setTimeout(res, 80));
        const top0 = q.level67Layout().dimsumOrder.strip.top;
        window.advanceTime(2000, 60); await new Promise(res => setTimeout(res, 60));
        const L = q.level67Layout(); const it = L.items; let gap = 1e9;
        for(let a = 0; a < it.length; a++) for(let b = a + 1; b < it.length; b++) gap = Math.min(gap, Math.hypot(it[a].x - it[b].x, it[a].y - it[b].y) - it[a].r - it[b].r);
        const plate = L.targets[0];
        out.push({ count: it.length, gap, strip: !!L.dimsumOrder.strip,
          drift: Math.abs(L.dimsumOrder.strip.top - top0), low: L.dimsumOrder.strip.bottom / L.canvas.height,
          spots: it.map(i => Math.round(i.x) + ',' + Math.round(i.y)).sort().join(' '),
          onStrip: it.some(i => hits(i, L.dimsumOrder.strip)),
          onPlate: it.some(i => hits(i, { left: plate.x - plate.w / 2, right: plate.x + plate.w / 2, top: plate.y - plate.h / 2, bottom: plate.y + plate.h / 2 })),
          inside: it.every(i => i.x - i.r >= 0 && i.x + i.r <= L.canvas.width && i.y - i.r >= 0 && i.y + i.r <= L.canvas.height) });
      }
      return out;
    });
    await context.close();
    assert.deepEqual(errors, []);
    const where = viewport.width + '×' + viewport.height;
    for(const r of rounds){
      assert.equal(r.count, 3, where);
      assert.ok(r.strip, where + ': the strip is drawn');
      assert.ok(r.gap >= 12, where + ': dim sum keep a visible gap (' + Math.round(r.gap) + ')');
      assert.ok(!r.onStrip, where + ': nothing under the strip');
      assert.ok(!r.onPlate, where + ': nothing on the plate at the start');
      assert.ok(r.inside, where + ': everything is on screen');
      assert.ok(r.drift < 1, where + ': the strip stays where it is');
      assert.ok(r.low < 0.30, where + ': the strip stays at the top');
      assert.equal(r.spots, rounds[0].spots, where + ': the same three places every time');
    }
  }
});

test('browser: the pause after repeated mistakes shows exactly what it reads', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa, out = {};
    q.startGame({ level: '5', theme: 'dimsum', duration: 600, affectedSide: 'right', dwellMs: 0 });
    await new Promise(res => setTimeout(res, 300)); window.advanceTime(800, 24);
    window.__said.length = 0;
    out.pause = q.recoveryPause('lotusrice');
    await new Promise(res => setTimeout(res, 200));
    out.said = window.__said.slice();
    out.animal = q.recoverySentence(0, null);
    return out;
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(r.pause.active, true);
  const [sentence, foot] = r.pause.text.split('\n');
  // the steamers carry the same name as the dim sum, so the sentence says "the matching steamer"
  assert.equal(sentence, '慢慢嚟，先將糯米雞放去同款嗰籠。');
  assert.ok(cjk(sentence) <= 18, 'one short sentence: ' + sentence);
  assert.equal(foot, '讀完提示自動繼續');
  assert.ok(r.said.includes(sentence), 'spoken = shown: ' + r.said.join(' | '));
  assert.doesNotMatch(r.pause.text, /錯|失敗|扣/);
});

test('browser: in the chopsticks order game the pause names the dim sum on the order, not the one just misplaced', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa;
    const start = () => q.startGame({ level: '67', level6Task: 'chopsticks', duration: 300, affectedSide: 'right' });
    start();
    document.querySelector('#dimsumDifficultyOptions [data-dimsum-difficulty="complex"]').click();
    start();
    await new Promise(res => setTimeout(res, 300)); window.advanceTime(800, 24);
    const wanted = q.level67Layout().dimsumOrder.lines[0].type;
    const wrong = ['chop_hargau', 'chop_siumai', 'chop_beefball'].find(x => x !== wanted);
    window.__said.length = 0;
    const pause = q.recoveryPause(wrong);
    await new Promise(res => setTimeout(res, 200));
    return { wanted, wrong, text: pause.text, said: window.__said.slice() };
  });
  await context.close();
  assert.deepEqual(errors, []);
  const names = { chop_hargau: '蝦餃', chop_siumai: '燒賣', chop_beefball: '牛肉球' };
  const sentence = r.text.split('\n')[0];
  assert.equal(sentence, '慢慢嚟，先將' + names[r.wanted] + '放去大碟。');
  assert.ok(!sentence.includes(names[r.wrong]));
  assert.ok(r.said.includes(sentence), 'spoken = shown');
});

test('browser: tracking chip and prompts in a running game (hand lost → help → back)', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa, out = {};
    const tick = ms => new Promise(res => setTimeout(res, ms));
    q.startGame({ level: '67', level6Task: 'flowers', duration: 600, affectedSide: 'right' });
    await tick(300);
    const feed = async (spec, n) => {
      for(let i = 0; i < n; i++){ q.setLevel6ToolFrame({ stepMs: 100, ...spec }); q.trackPromptTick(); if(i % 10 === 9) await tick(5); }
      return q.trackPromptSnapshot();
    };
    q.trackPrompt('live');
    let s = await feed({ noHand: true }, 40);
    out.grace = [s.chip, s.suppressed, s.log.length];
    q.trackPromptSkipGrace();
    s = await feed({ gesture: 'open', nx: .5, ny: .6 }, 20);
    out.ok = [s.chip, s.code, s.hand.present];
    const before = q.state();
    window.__said.length = 0;
    s = await feed({ noHand: true }, 25); out.at2500 = [s.chip, s.code];
    s = await feed({ noHand: true }, 10); out.at3500 = [s.chip, s.code]; out.said1 = window.__said.slice();
    s = await feed({ noHand: true }, 125); out.at16s = [s.chip, s.code]; out.said2 = window.__said.slice();
    s = await feed({ noHand: true }, 200); out.at36s = [s.chip, s.code]; out.said3 = window.__said.slice();
    const mid = q.state();
    s = await feed({ gesture: 'open', nx: .5, ny: .6 }, 20); out.back = [s.chip, s.code]; out.said4 = window.__said.slice();
    out.unchanged = [before.score === mid.score, before.wrongCount === mid.wrongCount, mid.running === true, mid.paused === false];
    // chip geometry against the HUD buttons
    q.trackPrompt('manual', { cond: 'T1', ok: false });
    for(let i = 0; i < 35; i++){ window.advanceTime(100, 1); q.trackPromptTick(); }
    const chip = document.getElementById('trackChip').getBoundingClientRect();
    const boxes = Array.from(document.querySelectorAll('#screen-game button'))
      .map(b => b.getBoundingClientRect()).filter(b => b.width > 0 && b.height > 0);
    out.chipBox = { w: chip.width, h: chip.height, top: chip.top, left: chip.left, right: chip.right, vw: innerWidth };
    out.overlaps = boxes.filter(b => !(b.right <= chip.left || b.left >= chip.right || b.bottom <= chip.top || b.top >= chip.bottom)).length;
    out.buttons = boxes.length;
    q.trackPrompt('off');
    out.offHidden = document.getElementById('trackChip').hidden;
    return out;
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(r.grace, ['', true, 0], 'nothing in the first 5 seconds of a game');
  assert.deepEqual(r.ok, ['', '', true]);
  assert.deepEqual(r.at2500, ['', ''], 'not yet at 2.5 seconds');
  assert.deepEqual(r.at3500, ['睇唔到隻手', 'T1']);
  assert.deepEqual(r.said1, ['鏡頭睇唔到隻手，放返入畫面中間。']);
  assert.deepEqual(r.at16s, ['請叫姑娘', 'T8']);
  assert.deepEqual(r.said2, ['鏡頭睇唔到隻手，放返入畫面中間。', '請姑娘幫手校返個鏡頭。']);
  assert.deepEqual(r.said3, r.said2, 'no third sentence however long it lasts');
  assert.deepEqual(r.at36s, ['請叫姑娘', 'T8']);
  assert.deepEqual(r.back, ['', '']);
  assert.equal(r.said4.at(-1), '見到喇，繼續。');
  assert.deepEqual(r.unchanged, [true, true, true, true], 'a prompt never scores, counts a mistake or pauses');
  assert.ok(r.chipBox.w > 40 && r.chipBox.h > 20, 'chip is visible');
  assert.ok(r.chipBox.left >= 0 && r.chipBox.right <= r.chipBox.vw, 'chip stays on screen');
  assert.ok(r.buttons >= 5, 'the game buttons were found');
  assert.equal(r.overlaps, 0, 'chip does not cover a button (' + r.buttons + ' checked)');
  assert.ok(r.chipBox.top < 90, 'chip sits in the top row, not at the bottom');
  assert.equal(r.offHidden, true);
});

test('tracking chip: finds the free place nearest the middle of the top row', () => {
  const body = html.slice(html.indexOf('function trackChipFreeSlot('), html.indexOf('function trackChipDomObstacles('));
  const slot = vm.runInNewContext(body + '; trackChipFreeSlot');
  assert.deepEqual({ ...slot(10, 1170, 180, 590, []) }, { centre: 590, fits: true, room: 1160 }, 'nothing in the way: the middle');
  // tablet landscape: numbers on the left, buttons from 633
  let r = slot(10, 1170, 180, 590, [[-5, 240], [633, 1180]]);
  assert.equal(r.fits, true); assert.equal(r.centre, 543, 'pushed left until it clears the buttons');
  // portrait order game: the picture strip is in the middle → the nearer side that is wide enough
  r = slot(10, 810, 180, 410, [[237, 568]]);
  assert.equal(r.fits, true); assert.equal(r.centre, 658, 'both sides fit: the one nearer the middle');
  r = slot(10, 810, 180, 410, [[237, 568], [735, 820]]);
  assert.equal(r.centre, 147, 'the right side is too narrow, so the left side');
  // nowhere wide enough: report the widest gap so the caller can shrink the text
  r = slot(10, 500, 300, 250, [[100, 200], [380, 500]]);
  assert.equal(r.fits, false); assert.equal(r.room, 180); assert.equal(r.centre, 290);
  // overlapping obstacles are merged
  r = slot(0, 1000, 100, 520, [[300, 600], [550, 700]]);
  assert.equal(r.centre, 750);
});

test('browser: the tracking chip sits in the top row and covers nothing (buttons, numbers, step label, picture strip)', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const games = [
    ['L3 supermarket', { level: '3', theme: 'supermarket', shoulderTargetDeg: 40 }, 'T2'],
    ['L5 cards', { level: '5', theme: 'cards' }, 'T1'],
    ['L6 flowers', { level: '67', theme: 'flowers' }, 'T1'],
    ['L6 dim sum order', { level: '67', theme: 'chopstick_dimsum' }, 'T8', 'complex'],
    ['L6 cooking', { level: '67', theme: 'cooking' }, 'T1'],
    ['L6 peg story', { level: '67', theme: 'peg_laundry' }, 'T6'],
  ];
  for(const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 1413, height: 653 }, { width: 1024, height: 768 }]){
    for(const [name, start, code, pre] of games){
      const { context, page, errors } = await openPage(viewport);
      const r = await page.evaluate(async ([start, code, pre]) => {
        const q = window.__qa;
        if(pre === 'complex'){ q.rulesFor(start); document.querySelector('#dimsumDifficultyOptions [data-dimsum-difficulty="complex"]').click(); }
        q.startGame({ duration: 600, affectedSide: 'left', ...start });
        await new Promise(res => setTimeout(res, 300)); window.advanceTime(2500, 30);
        q.trackPrompt('manual', { cond: code, ok: false });
        for(let i = 0; i < 35; i++){ window.advanceTime(100, 1); q.trackPromptTick(); }
        await new Promise(res => setTimeout(res, 120));
        q.trackChipPlace();
        const o = q.trackChipObstacles();
        const el = document.getElementById('trackChip');
        return { ...o, text: el.textContent, clipped: el.scrollWidth > el.clientWidth + 1 };
      }, [start, code, pre || '']);
      await context.close();
      const where = name + ' ' + viewport.width + '×' + viewport.height;
      assert.deepEqual(errors, [], where);
      assert.ok(r.text.length >= 2, where + ': chip shown');
      const c = r.chip;
      const hit = o => !(o.right <= c.left || o.left >= c.right || o.bottom <= c.top || o.top >= c.bottom);
      assert.equal(r.dom.filter(hit).length, 0, where + ': covers no button, number or panel');
      assert.equal(r.canvas.filter(hit).length, 0, where + ': covers no step label or picture strip');
      assert.ok(c.left >= 0 && c.right <= r.stage.width && c.top >= 0, where + ': on screen');
      assert.ok(c.bottom <= r.stage.height * 0.2, where + ': in the top part of the screen (bottom ' + Math.round(c.bottom) + ')');
      assert.ok(r.font >= 18, where + ': text not smaller than 18px (' + r.font + ')');
      assert.equal(r.clipped, false, where + ': the whole text is visible');
      if(name === 'L6 dim sum order') assert.equal(r.canvas.length, 1, where + ': the picture strip was taken into account');
      if(name === 'L6 cooking') assert.equal(r.canvas.length, 1, where + ': the step label was taken into account');
    }
  }
});

test('browser: "use the other hand" needs a confident label and can be switched off; never in two-hand mode', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const { context, page, errors } = await openPage();
  const r = await page.evaluate(async () => {
    const q = window.__qa, out = {};
    const tick = ms => new Promise(res => setTimeout(res, ms));
    q.startGame({ level: '67', level6Task: 'flowers', duration: 600, affectedSide: 'right', handednessCheck: true });
    await tick(300);
    q.trackPrompt('live'); q.trackPromptSkipGrace();
    const cond = spec => { q.setLevel6ToolFrame({ stepMs: 100, gesture: 'open', nx: .5, ny: .6, ...spec }); return q.trackHandCondition().cond; };
    out.own = cond({ handSide: 'right', handednessConfidence: .98 });
    out.otherSure = cond({ handSide: 'left', handednessConfidence: .98 });
    out.otherUnsure = cond({ handSide: 'left', handednessConfidence: .60 });
    q.setHandednessCheck(false);
    out.checkOff = cond({ handSide: 'left', handednessConfidence: .98 });
    // Level 3/4 pose rule
    const pose = (mineDeg, otherDeg) => {
      const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .99 }));
      const arm = (sx, deg, s, e, w) => {
        const rad = deg * Math.PI / 180;
        lm[s] = { x: sx, y: .35, z: 0, visibility: .99 };
        lm[e] = { x: sx + .15 * Math.sin(rad), y: .35 + .15 * Math.cos(rad), z: 0, visibility: .99 };
        lm[w] = { x: sx + .30 * Math.sin(rad), y: .35 + .30 * Math.cos(rad), z: 0, visibility: .99 };
      };
      arm(.40, mineDeg, 12, 14, 16); arm(.60, otherDeg, 11, 13, 15);
      return lm;
    };
    out.poseOther = q.trackPoseCondition(pose(5, 80), { targetDeg: 60 }).cond;
    out.poseBoth = q.trackPoseCondition(pose(5, 80), { targetDeg: 60, bothHands: true }).cond;
    out.poseMine = q.trackPoseCondition(pose(70, 5), { targetDeg: 60 }).cond;
    out.poseHalf = q.trackPoseCondition(pose(35, 80), { targetDeg: 60 }).cond;
    out.poseNone = q.trackPoseCondition(null, { targetDeg: 60 }).cond;
    return out;
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(r.own, '');
  assert.equal(r.otherSure, 'T5');
  assert.notEqual(r.otherUnsure, 'T5', 'an unsure left/right label never asks to change hands');
  assert.notEqual(r.checkOff, 'T5', 'with the side check off the prompt is never used');
  assert.equal(r.poseOther, 'T5');
  assert.equal(r.poseBoth, '', 'never while both hands hold the stick');
  assert.equal(r.poseMine, '');
  assert.equal(r.poseHalf, '', 'the affected arm is already trying');
  assert.equal(r.poseNone, 'T2');
});

test('browser: praise and prompts never cut a step; a correction waits and is read right after', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  // this mock keeps each sentence "playing" for 600 ms
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await context.addInitScript(() => {
    window.__said = [];
    try{
      const s = window.speechSynthesis;
      s.speak = u => { window.__said.push(u.text); setTimeout(() => { try{ u.onend && u.onend({}); }catch(e){} }, 600); };
      s.cancel = () => {};
    }catch(e){}
  });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const q = window.__qa, out = {};
    const tick = ms => new Promise(res => setTimeout(res, ms));
    q.startGame({ level: '5', theme: 'laundry', duration: 600, affectedSide: 'right' });
    await tick(1500); window.__said.length = 0;
    q.stepSay('舉高隻手');
    out.busy = q.speech().busy;
    out.praise = q.say('做得好！', 'praise');
    out.track = q.say('見到喇，繼續。', 'track');
    out.correct = q.say('要揀恤衫。', 'correct');
    out.waiting = q.speech().waiting;
    out.during = window.__said.slice();
    await tick(1500);
    out.afterStep = window.__said.slice();
    out.waitingAfter = q.speech().waiting;
    await tick(900);
    // praise is cut by nothing lower, but a step replaces praise
    q.say('好嘢！', 'praise');
    out.stepOverPraise = q.say('放低隻手', undefined);
    await tick(900);
    out.end = window.__said.slice();
    return out;
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.equal(r.busy, 4);
  assert.equal(r.praise, false);
  assert.equal(r.track, false);
  assert.equal(r.waiting, '要揀恤衫。', 'the correction is kept, not dropped');
  assert.deepEqual(r.during, ['舉高隻手'], 'nothing cuts the step instruction');
  assert.deepEqual(r.afterStep, ['舉高隻手', '要揀恤衫。'], 'the correction follows the step');
  assert.equal(r.waitingAfter, '');
  assert.equal(r.stepOverPraise, true);
  assert.deepEqual(r.end.slice(-2), ['好嘢！', '放低隻手']);
});

test('browser: the therapist is told when the device has no Cantonese voice', async t => {
  if(!browser){ t.skip('Playwright is not available'); return; }
  const noCanto = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'zh-CN', name: 'Tingting' }];
  const canto = [{ lang: 'en-US', name: 'Samantha' }, { lang: 'zh-HK', name: 'Sinji' }];
  const a = await openPage(null, { voices: noCanto });
  const without = await a.page.evaluate(v => window.__qa.voiceWarning(v, false), noCanto);
  const english = await a.page.evaluate(v => window.__qa.voiceWarning(v, true).missing, noCanto);
  const empty = await a.page.evaluate(() => window.__qa.voiceWarning([], false).missing);
  await a.context.close();
  const b = await openPage(null, { voices: canto });
  const withVoice = await b.page.evaluate(v => window.__qa.voiceWarning(v, false), canto);
  await b.context.close();
  assert.deepEqual(a.errors.concat(b.errors), []);
  assert.equal(without.missing, true);
  assert.equal(without.shown, true);
  assert.equal(without.hidden, false);
  assert.equal(without.text, '提提姑娘：呢部機搵唔到廣東話語音，指示可能會用其他語音讀出。');
  assert.equal(english, false, 'not needed in English mode');
  assert.equal(empty, false, 'no warning before the voice list has loaded');
  assert.equal(withVoice.missing, false);
  assert.equal(withVoice.hidden, true);
});
