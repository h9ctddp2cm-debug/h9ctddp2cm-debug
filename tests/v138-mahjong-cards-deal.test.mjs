import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v138 — therapist feedback (23 Nov): in Level 3/4 the mahjong and playing-card
// scenes were boring — a single tile / card rose to a slot and nothing else
// happened. The two scenes are now a "deal table" (public patient mode only):
//   麻雀: every lift that reaches the set angle draws one tile into a hand that
//         was built as a valid winning hand (4 sets + a pair, 2 sets pre-dealt);
//         a finished set gets a small celebration, the last tile is 自摸食糊 with
//         the simplified training fan names, then a new hand starts.
//   啤牌: every lift reveals one of five cards; the fifth shows the hand name.
// It is a visual / audio reward layer only (same pattern as the v73 bowling and
// v125 supermarket scenes): the shoulder controller, the target decision, the
// score and the v137 re-arm rules are untouched, and nothing is made stricter.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');
const controllerSrc = readFileSync(path.join(root, 'shoulder-flexion-controller.js'), 'utf8');

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
function constSource(name){
  const start = html.indexOf('\nconst ' + name + ' = ');
  assert.ok(start >= 0, 'const ' + name + ' exists');
  return html.slice(start + 1, html.indexOf(';\n', start) + 1);
}
const sandbox = new Function([
  constSource('MJ_WINDS'), constSource('MJ_DRAGONS'), constSource('MJ_FAN_CAP'),
  constSource('CARD_DEAL_TYPES'),
  fnSource('mjIsHonor'), fnSource('mjSuit'), fnSource('mjDecompose'), fnSource('mjScoreCombo'), fnSource('mjEvaluate'),
  fnSource('buildMahjongDealHand'), fnSource('cardDealClassify'), fnSource('buildCardDealHand'),
  'return { buildMahjongDealHand, buildCardDealHand, cardDealClassify, mjEvaluate, CARD_DEAL_TYPES };',
].join('\n'))();

function rng(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('every generated mahjong hand is a valid 14-tile winning hand', () => {
  const seenNames = new Set();
  for(let seed = 1; seed <= 3000; seed++){
    const hand = sandbox.buildMahjongDealHand(rng(seed));
    assert.equal(hand.sets.length, 4);
    const tiles = [];
    hand.sets.forEach(set => {
      assert.ok(set.kind === 'chow' || set.kind === 'pung');
      assert.equal(set.tiles.length, 3);
      if(set.kind === 'pung') assert.ok(set.tiles.every(t => t === set.t));
      else{
        const suit = set.tiles[0][0], n = Number(set.tiles[0].slice(1));
        assert.ok('psw'.includes(suit) && n >= 1 && n <= 7);
        assert.deepEqual(set.tiles, [suit + n, suit + (n + 1), suit + (n + 2)]);
      }
      tiles.push(...set.tiles);
    });
    tiles.push(hand.pair, hand.pair);
    assert.equal(tiles.length, 14);
    const counts = {};
    tiles.forEach(t => {
      assert.match(t, /^(?:[psw][1-9]|[ESWNCFB])$/);
      counts[t] = (counts[t] || 0) + 1;
    });
    Object.values(counts).forEach(n => assert.ok(n <= 4, 'no more than four copies of a tile'));
    assert.ok(sandbox.mjEvaluate(tiles), 'independent evaluator accepts the hand (seed ' + seed + ')');
    assert.ok(hand.result.fan >= 1 && hand.result.fan <= 13);
    assert.ok(hand.result.names.length >= 1);
    hand.result.names.forEach(name => { assert.match(name, /^\S+ \d+番$/); seenNames.add(name.split(' ')[0]); });
  }
  // variety: the patient should meet small and big hands, not the same one every time
  ['雞糊', '平糊', '對對糊', '混一色', '清一色', '小三元', '大三元'].forEach(name =>
    assert.ok(seenNames.has(name), name + ' appears'));
});

test('a broken random source still returns a valid hand (no endless loop)', () => {
  [() => 0, () => 0.999999, () => 0.5].forEach(r => {
    const hand = sandbox.buildMahjongDealHand(r);
    const tiles = [].concat(...hand.sets.map(s => s.tiles), [hand.pair, hand.pair]);
    assert.ok(sandbox.mjEvaluate(tiles));
    const cards = sandbox.buildCardDealHand(r);
    assert.equal(cards.cards.length, 5);
    assert.equal(sandbox.cardDealClassify(cards.cards), cards.type.id);
  });
});

test('every generated card hand is five distinct cards matching its announced type', () => {
  const seen = {};
  for(let seed = 1; seed <= 4000; seed++){
    const hand = sandbox.buildCardDealHand(rng(seed));
    assert.equal(hand.cards.length, 5);
    const keys = new Set(hand.cards.map(c => {
      assert.ok('SHDC'.includes(c.s) && c.s.length === 1);
      assert.ok(Number.isInteger(c.r) && c.r >= 0 && c.r <= 12);
      return c.s + c.r;
    }));
    assert.equal(keys.size, 5, 'no duplicated card');
    assert.equal(sandbox.cardDealClassify(hand.cards), hand.type.id);
    seen[hand.type.id] = (seen[hand.type.id] || 0) + 1;
  }
  sandbox.CARD_DEAL_TYPES.forEach(t => assert.ok(seen[t.id] > 0, t.zh + ' appears'));
  // there is always a named hand — never "nothing" — and common hands stay common
  assert.equal(seen.high, undefined);
  assert.ok(seen.pair > seen.fullhouse && seen.fullhouse > seen.straightflush);
});

test('card classification covers the standard hand types', () => {
  const c = (s, r) => ({s, r});
  const cls = sandbox.cardDealClassify;
  assert.equal(cls([c('S',0),c('H',0),c('D',5),c('C',8),c('S',11)]), 'pair');
  assert.equal(cls([c('S',0),c('H',0),c('D',5),c('C',5),c('S',11)]), 'twopair');
  assert.equal(cls([c('S',3),c('H',3),c('D',3),c('C',5),c('S',11)]), 'trips');
  assert.equal(cls([c('S',3),c('H',3),c('D',3),c('C',5),c('S',5)]), 'fullhouse');
  assert.equal(cls([c('S',3),c('H',3),c('D',3),c('C',3),c('S',5)]), 'quads');
  assert.equal(cls([c('S',3),c('H',4),c('D',5),c('C',6),c('S',7)]), 'straight');
  assert.equal(cls([c('S',9),c('H',10),c('D',11),c('C',12),c('S',0)]), 'straight'); // 10 J Q K A
  assert.equal(cls([c('H',1),c('H',4),c('H',6),c('H',9),c('H',12)]), 'flush');
  assert.equal(cls([c('H',3),c('H',4),c('H',5),c('H',6),c('H',7)]), 'straightflush');
  assert.equal(cls([c('S',0),c('H',2),c('D',5),c('C',8),c('S',11)]), 'high');
});

test('the deal table is a public Level 3/4 reward layer only', () => {
  assert.match(html, /function isDealTableTheme\(\)\{\s*return isShoulderFlexionLevel\(\)&&!research\.active&&\(state\.theme==='mahjong'\|\|state\.theme==='cards'\);\s*\}/);
  // scene takes over drawing; the generic target panel and lone item are not used
  assert.match(html, /if\(isDealTableTheme\(\)\)\{ drawDealTableScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(isDealTableTheme\(\)\)\{ targets=\[\]; return; \}/);
  assert.match(html, /if\(isDealTableTheme\(\)\) continue;/);
  // a draw starts exactly where the existing reward cycle starts, and ends with it
  assert.match(fnSource('startShoulderRewardCycle'), /if\(shoulderRewardCycle\.active\) return;\s*if\(isDealTableTheme\(\)\)startDealTableDraw\(\);[^\n]*\n\s*const started=nowMs\(\);/);
  assert.match(html, /return Math\.max\(SHOULDER_REWARD_MIN_MS,dealTableRewardMs\(\)\);/);
  assert.match(fnSource('finishShoulderRewardCycle'), /finishDealTableDraw\(\);/);
  assert.match(html, /resetDealTable\(\);\s+\/\/ v138/);
  // two sets are already on the rack, so a win comes about every eight lifts
  assert.match(html, /const MJ_DEAL_PREDEALT_SETS = 2;/);
});

test('the scene never feeds back into detection, scoring or the v137 re-arm rules', () => {
  const start = html.indexOf('/* ==================== v138 牌局場景');
  const end = html.indexOf('\nfunction drawShoulderFlexionGuide(');
  assert.ok(start > 0 && end > start);
  const block = html.slice(start, end);
  // read-only use of the shoulder state: progress + whether a reward is running
  assert.doesNotMatch(block, /shoulderFlexionState\.\w+\s*=[^=]/);
  assert.doesNotMatch(block, /shoulderFlexionController/);
  assert.doesNotMatch(block, /shoulderRewardCycle\.(?:active|repetitionReady|finishAtMs|startedMs)\s*=[^=]/);
  assert.doesNotMatch(block, /\bscore\s*(?:\+=|-=|=[^=])/);
  assert.doesNotMatch(block, /correctCount|grabCount|setTarget\(|triggerFeedback\(/);
  // no penalty wording / no degree figures in the patient scene
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /扣分|錯|輸|°/);
  // controller file itself is unchanged by this release (v137 rules stay)
  assert.match(controllerSrc, /patientRearmDropDeg/);
  assert.doesNotMatch(controllerSrc, /dealTable|v138/);
});

test('the centre tick no longer covers the revealed tile; the chime stays', () => {
  assert.match(fnSource('triggerFeedback'), /if\(correct\)\{ playCorrectSound\(\); if\(!isDealTableTheme\(\)\) showFeedback\(true\); \}/);
});

test('release markers are v138', () => {
  const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
  assert.match(html, /const LEVEL_APP_BUILD = "v140-20261125-cursor-stays";/);
  assert.match(html, /perf v140/);
  assert.match(sw, /^const CACHE_VERSION = "fthue-rehab-v140-20261125-cursor-stays";/);
  assert.match(manifest, /v140-20261125-cursor-stays/);
});

test('every new on-canvas and spoken string has an English counterpart', () => {
  const start = html.indexOf('/* ==================== v138 牌局場景');
  const end = html.indexOf('\nfunction drawShoulderFlexionGuide(');
  const block = html.slice(start, end);
  // canvas text is drawn through dealText(zh,en) / data tables with en fields
  const fillCalls = block.match(/ctx\.(?:fillText|strokeText)\(([^,]+),/g) || [];
  assert.ok(fillCalls.length >= 6);
  fillCalls.forEach(call => assert.doesNotMatch(call, /[\u3400-\u9fff]/, call));
  assert.match(block, /function dealText\(zh,en\)\{ return window\.YCHLanguage\?window\.YCHLanguage\.text\(zh,en\):zh; \}/);
  sandbox.CARD_DEAL_TYPES.forEach(t => {
    assert.ok(t.en && t.subEn && !/[\u3400-\u9fff]/.test(t.en + t.subEn));
  });
  ['字一色','清一色','混一色','大三元','小三元','大四喜','小四喜','對對糊','平糊','雞糊'].forEach(name =>
    assert.ok(block.includes("'" + name + "':'"), name + ' has an English fan name'));
  assert.ok(localization.includes("'每舉一下摸一隻牌，摸齊就食糊':'Each lift draws one tile. Complete the hand to win.'"));
  assert.ok(localization.includes("'每舉一下揭一張牌，五張睇牌型':'Each lift reveals one card. Five cards show the hand.'"));
});

test('activity cards and the result screen describe the new play', () => {
  assert.match(html, /shoulderGoal:'每舉一下摸一隻牌，摸齊就食糊'/);
  assert.match(html, /shoulderGoal:'每舉一下揭一張牌，五張睇牌型'/);
  assert.match(html, /const goalText = \(isShoulderFlexionLevel\(\) && th\.shoulderGoal\) \|\| th\.goal;/);
  assert.match(html, /<p id="dealResultSummary" hidden /);
  assert.match(html, /const dealLine=isDealTableTheme\(\)\?dealTableSummaryText\(\):'';/);
  // the summary only reports this session — no comparison with earlier sessions
  assert.doesNotMatch(fnSource('dealTableSummaryText'), /上次|比較|進步|退步|last time|previous/i);
});

test('other Level 3/4 scenes and Level 5/6 mahjong / cards are not rerouted', () => {
  assert.match(html, /if\(state\.theme==='bowlinglane'\)\{ drawBowlingAlleyScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(state\.theme==='supermarket'\)\{ drawSupermarketScene\(ctx,cw,ch\); return; \}/);
  // Level 5/6 advanced modules keep their own goals
  assert.match(html, /goal:'選一組牌食糊',/);
  assert.match(html, /goal:'收集相同花色的啤牌',/);
  assert.match(html, /gameType:'dwell'/);
});
