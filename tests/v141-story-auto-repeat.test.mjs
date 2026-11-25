import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v141 — therapist request (25 Nov): the three "story" games ended as soon as
// the patient finished the story once (most patients need about two minutes),
// although the therapist had chosen a longer session time (5 / 10 / 15 min).
//   Level 3/4 「去超市買餸」, Level 3/4 「洗衫晾衫」, Level 6 「煮蛋炒飯」
// Now a finished story starts again by itself while session time is left; the
// score and repetition counts keep adding up and the result page says how many
// rounds were completed. With only a few seconds left the game ends on the
// closing scene exactly as before. Nothing about detection changes.

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

test('release markers (current build)', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v142-20261125-story-rotate";/);
  assert.match(manifest, /index\.html\?build=v142-20261125-story-rotate/);
  assert.match(html, /const LEVEL_APP_BUILD = "v142-20261125-story-rotate";/);
  assert.match(html, /perf v142 {2}/);
});

test('a new round starts only while the game runs and enough session time is left', () => {
  const make = new Function('state', 'research', 'timeLeft',
    lineConst('STORY_REPEAT_MIN_LEFT_S') + '\n' + fnSource('storyRoundCanRepeat') + '\nreturn { can: storyRoundCanRepeat(), min: STORY_REPEAT_MIN_LEFT_S };');
  assert.equal(make({ running: true }, { active: false }, 180).min, 8);
  assert.equal(make({ running: true }, { active: false }, 180).can, true);
  assert.equal(make({ running: true }, { active: false }, 8).can, true);
  assert.equal(make({ running: true }, { active: false }, 7).can, false);   // a few seconds left → end as before
  assert.equal(make({ running: false }, { active: false }, 180).can, false);
  assert.equal(make({ running: true }, { active: true }, 180).can, false);
});

test('supermarket: the closing scene restarts the story, or ends the game when time is nearly up', () => {
  const update = fnSource('updateSupermarketStory');
  assert.match(update, /if\(s\.end\)\{\s*if\(storyRoundCanRepeat\(\)\)\{ restartSupermarketRound\(\); return; \}\s*shopStory\.ended=true;\s*if\(state\.running\) endGame\(\);\s*return;\s*\}/);
  // the finished round is counted when the last item is put away (applause moment)
  assert.match(fnSource('updateSupermarketAction'), /if\(nxt&&nxt\.kind==='scene'&&nxt\.end\)\{ shopStory\.rounds\+\+; shopStory\.repsDone=0; playApplauseSound\(\); \}/);   // v142: applause only
  // a fresh game clears the round count; a restart keeps it
  assert.match(fnSource('resetSupermarketStory'), /shopStory\.rounds=0; shopStory\.repsDone=0;/);
  assert.match(fnSource('restartSupermarketRound'), /beginSupermarketStory\(shopStory\.rounds\);/);
  assert.match(fnSource('beginSupermarketStory'), /shopStory\.steps=buildShopSteps\(shopStory\.list,shopStory\.rounds\+1\);/);
});

test('supermarket: later rounds say which round it is; the story itself is the same', () => {
  const make = new Function([
    html.slice(html.indexOf('\nconst SHOP_ITEMS = {') + 1, html.indexOf('};', html.indexOf('\nconst SHOP_ITEMS = {')) + 2).replace(/img:\(\)=>[A-Za-z0-9]+,/g, 'img:null,'),
    lineConst('SHOP_LIST_SIZES'), lineConst('SHOP_LIST_POOL'),
    fnSource('buildShopList'), fnSource('buildShopSteps'),
    'return { buildShopList, buildShopSteps };',
  ].join('\n'));
  const m = make();
  const r1 = m.buildShopSteps(m.buildShopList('medium'));
  const r2 = m.buildShopSteps(m.buildShopList('medium'), 2);
  const r3 = m.buildShopSteps(m.buildShopList('medium'), 3);
  assert.equal(r1[0].text, '行入超市'); assert.equal(r1[0].sub, '今日要買餸');
  assert.equal(r2[0].text, '再去超市買餸'); assert.match(r2[0].sub, /^第 2 轉/);
  assert.match(r3[0].sub, /^第 3 轉/);
  assert.equal(r2.length, r1.length);
  assert.deepEqual(r2.slice(1), r1.slice(1));   // same lifts, same order, same scene times
  assert.match(html, /drawShopBanner\(ctx,cw,g,step\?step\.text:'行入超市',step\?step\.sub:'今日要買餸'\);/);
});

test('supermarket: result line counts the finished rounds (nothing shown before the first one)', () => {
  const make = shopStory => new Function('shopStory', fnSource('shopStorySummaryText') + '\nreturn shopStorySummaryText();')(shopStory);
  assert.equal(make({ rounds: 0, repsDone: 5 }), '');
  assert.equal(make({ rounds: 1, repsDone: 0 }), '去超市買餸：今次完成咗 1 轉（由入超市買餸到返屋企收好）。');
  assert.equal(make({ rounds: 2, repsDone: 3 }), '去超市買餸：今次完成咗 2 轉（由入超市買餸到返屋企收好），第 3 轉做到一半，下次繼續。');
});

test('laundry: the closing scene restarts the story, later rounds are labelled, the rest is identical', () => {
  assert.match(fnSource('updateLaundryStory'), /if\(s\.end\)\{\s*if\(storyRoundCanRepeat\(\)\)\{ restartLaundryRound\(\); return; \}\s*laundryStory\.ended=true;/);
  assert.match(fnSource('updateLaundryStoryAction'), /laundryStory\.completed=true; laundryStory\.rounds\+\+; playApplauseSound\(\);/);
  assert.match(fnSource('resetLaundryStory'), /laundryStory\.rounds=0;/);
  assert.match(fnSource('restartLaundryRound'), /beginLaundryStory\(laundryStory\.rounds\);/);
  assert.match(fnSource('beginLaundryStory'), /laundryStory\.steps=buildLaundrySteps\(laundryStory\.list,laundryStory\.rounds\+1\);/);
  const m = new Function([
    lineConst('LAUNDRY_LOAD_SIZES'), lineConst('LAUNDRY_STORY_POOL'), lineConst('LAUNDRY_WASH_MS'), lineConst('LAUNDRY_SUN_MS'),
    fnSource('buildLaundryList'), fnSource('buildLaundrySteps'), 'return { buildLaundryList, buildLaundrySteps };',
  ].join('\n'))();
  const r1 = m.buildLaundrySteps(m.buildLaundryList('short'));
  const r2 = m.buildLaundrySteps(m.buildLaundryList('short'), 2);
  assert.equal(r1[0].text, '今日要洗衫');
  assert.equal(r2[0].text, '又有一籃污糟衫'); assert.equal(r2[0].en, 'Another basket of laundry');
  assert.match(r2[0].sub, /^第 2 轉 · /); assert.match(r2[0].subEn, /^Round 2: /);
  assert.equal(r2[0].cut, 'intro'); assert.equal(r2[0].ms, r1[0].ms);
  assert.deepEqual(r2.slice(1), r1.slice(1));
});

test('laundry: result line names the rounds and how far the unfinished one got', () => {
  const LAUNDRY_STAGES = [
    { zh: '入機', en: 'Load' }, { zh: '洗衫', en: 'Wash' }, { zh: '晾衫', en: 'Hang' }, { zh: '晒乾', en: 'Dry' },
    { zh: '收衫', en: 'Collect' }, { zh: '摺衫', en: 'Fold' }, { zh: '入櫃', en: 'Store' } ];
  const make = (st, en) => new Function('laundryStory', 'LAUNDRY_STAGES', 'dealText',
    fnSource('laundryStorySummaryText') + '\nreturn laundryStorySummaryText();')(
    Object.assign({ list: ['a', 'b', 'c'], repsDone: 0, rounds: 0, completed: false, stage: 0 }, st), LAUNDRY_STAGES, (zh, e) => en ? e : zh);
  assert.equal(make({}), '');
  // first round unfinished / just finished: the v139 sentences are unchanged
  assert.equal(make({ repsDone: 4, stage: 2 }), '洗衫晾衫：今次做到「晾衫」呢一步，下次繼續。');
  assert.equal(make({ repsDone: 19, rounds: 1, completed: true, stage: 7 }), '洗衫晾衫：今次 3 件衫由洗衫、晾衫、摺衫到放入衣櫃，全部做齊。');
  assert.equal(make({ rounds: 1 }), '洗衫晾衫：今次 3 件衫由洗衫、晾衫、摺衫到放入衣櫃，全部做齊。');   // round 2 only just started
  // second round under way
  assert.equal(make({ rounds: 1, repsDone: 5, stage: 2 }), '洗衫晾衫：今次做齊 1 轉（每轉 3 件衫，由洗衫到入衣櫃），第 2 轉做到「晾衫」呢一步。');
  assert.equal(make({ rounds: 2, repsDone: 19, completed: true, stage: 7 }), '洗衫晾衫：今次做齊 2 轉，每轉 3 件衫由洗衫、晾衫、摺衫到放入衣櫃。');
  assert.match(make({ rounds: 1, repsDone: 5, stage: 2 }, true), /^Laundry: 1 full round\(s\) today .* round 2 reached the "Hang" step\.$/);
  // still only this session — no comparison with earlier sessions
  assert.doesNotMatch(fnSource('laundryStorySummaryText'), /上次|比較|進步|退步|last time|previous/i);
});

test('cooking: a finished dish starts the next one after the celebration when time is left', () => {
  assert.match(html, /const COOK_REPEAT_MIN_LEFT_S = 15;/);
  const adv = fnSource('cookAdvance');
  assert.match(adv, /cook\.done = true;\s*cook\.idx = total - 1;\s*cook\.rounds\+\+;/);
  assert.match(adv, /const again = !research\.active && !!state\.running && timeLeft >= COOK_REPEAT_MIN_LEFT_S;/);
  assert.match(adv, /autoMs:6500,\s*onContinue: again \? cookStartNextRound : null,/);
  // a new game starts from dish 0; reset() between dishes keeps the count
  assert.match(html, /cook\.active = true; cook\.rounds = 0; cook\.reset\(\);/);
  const resetBody = html.slice(html.indexOf('  reset(){', html.indexOf('\nconst cook = {')), html.indexOf('  step(){ return COOK_STEPS'));
  assert.doesNotMatch(resetBody, /rounds/);
});

test('cooking: the next dish keeps the learnt relaxed-hand baseline (detection unchanged)', () => {
  const calls = [];
  const cook = {
    done: true, idx: 11, reps: 3, rounds: 1, introUntil: 0, readyAt: 0, announceAt: 0,
    digi: { hist: [1, 2], base: [0.3], baseline: 0.33, peak: 0.6, squeezing: true, rise: 0.05, level: 0.4, animAt: 99 },
    reset(){ this.idx = 0; this.reps = 0; this.done = false; this.digi = { hist: [], base: [], baseline: null, peak: 0, squeezing: false }; },
  };
  const run = (advCurrent, state) => new Function('cook', 'advCurrent', 'state', 'nowMs', 'cookLayout', 'isLevel6DigiflexTask', 'cookRenderPanel', 'speakCantonese', 'setActionPrompt', 'cookAnnounce',
    fnSource('cookStartNextRound') + '\ncookStartNextRound();')(cook, advCurrent, state, () => 1000, () => ({ ok: 1 }), () => true,
    () => calls.push('panel'), t => calls.push('say:' + t), a => calls.push('prompt:' + a), () => calls.push('announce'));
  run('mahjong', { running: true }); assert.equal(cook.done, true);       // not the cooking game → nothing
  run('cooking', { running: false }); assert.equal(cook.done, true);      // game already over → nothing
  run('cooking', { running: true });
  assert.equal(cook.done, false); assert.equal(cook.idx, 0); assert.equal(cook.reps, 0);
  assert.equal(cook.rounds, 1);
  assert.equal(cook.digi.baseline, 0.33); assert.deepEqual(cook.digi.base, [0.3]); assert.equal(cook.digi.rise, 0.05);
  assert.equal(cook.digi.squeezing, false); assert.deepEqual(cook.digi.hist, []); assert.equal(cook.digi.peak, 0);
  assert.equal(cook.introUntil, 3600); assert.equal(cook.readyAt, 4000); assert.equal(cook.announceAt, 3200);
  assert.deepEqual(calls, ['panel', 'say:做得好，再煮多一碟蛋炒飯。', 'prompt:揸實']);
  // the opening banner of a later dish
  assert.match(html, /再煮多一碟蛋炒飯！/);
});

test('cooking: result line counts the finished dishes', () => {
  const make = cook => new Function('cook', fnSource('cookRoundSummaryText') + '\nreturn cookRoundSummaryText();')(cook);
  assert.equal(make({ rounds: 0, done: false, idx: 4, reps: 1 }), '');
  assert.equal(make({ rounds: 1, done: true, idx: 11, reps: 0 }), '煮蛋炒飯：今次煮好 1 碟。');
  assert.equal(make({ rounds: 1, done: false, idx: 0, reps: 0 }), '煮蛋炒飯：今次煮好 1 碟。');
  assert.equal(make({ rounds: 2, done: false, idx: 4, reps: 1 }), '煮蛋炒飯：今次煮好 2 碟，第 3 碟做到第 5 步，下次繼續。');
  assert.match(html, /const roundLine=isSupermarketTheme\(\)\?shopStorySummaryText\(\):\(isLevel6DigiflexTask\(\)\?cookRoundSummaryText\(\):''\);/);
});

test('detection settings and the session timer are untouched', () => {
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /runningMode:\s*"VIDEO"/);
  assert.match(html, /PUBLIC_GAME_WORK_INTERVAL_MS\s*=\s*1000\s*\/\s*30/);
  assert.match(html, /PUBLIC_CANVAS_MAX_EDGE\s*=\s*1600/);
  // the session timer is still the only thing that ends a repeating game
  assert.match(html, /timeLeft--;\s*updateHUD\(\);\s*researchMaybeAdvancePhase\(\);\s*if\(timeLeft <= 0\)\{\s*endGame\(\);\s*\}/);
  assert.match(html, /timeLeft = state\.duration;/);
  // the repeat helpers never touch the shoulder controller or the squeeze thresholds
  for(const name of ['storyRoundCanRepeat', 'restartSupermarketRound', 'restartLaundryRound', 'shopStorySummaryText', 'cookRoundSummaryText']){
    assert.doesNotMatch(fnSource(name), /shoulderFlexionState|DIGIFLEX_|graspScore|personalGrasp/);
  }
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

for(const [theme, key, level] of [['supermarket', 'shopStory', '3'], ['supermarket', 'shopStory', '4'], ['laundry', 'laundryStory', '3'], ['laundry', 'laundryStory', '4']]){
  test(`Level ${level} ${theme} e2e: finishes → starts round 2 by itself → real lifts still score → ends on the closing scene when time is nearly up`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const { context, page, errors } = await openGame({ level, theme, duration: 300, affectedSide: 'right', shoulderTargetDeg: level === '3' ? 30 : 60, dwellMs: 0, laundryLoadSize: 'short', shopListSize: 'short' });
    try{
      const out = await page.evaluate(([key, level]) => {
        const qa = window.__qa, S = () => qa[key].state();
        const isEnd = s => s.step && s.step.kind === 'scene' && (s.step.cut === 'done' || s.step.scene === 'done');
        const toDone = () => { for(let i = 0; i < 300; i++){ const s = S(); if(isEnd(s)) return s; if(s.step && s.step.kind === 'scene') qa[key].skipScene(); else { qa[key].trigger(); qa[key].finishAnim(); } } return null; };
        const pose = (deg, frames) => { const L = .26, sh = { x: .42, y: .42 }, r = deg * Math.PI / 180;
          for(let i = 0; i < frames; i++){ window.advanceTime(33, 1); qa.setLevel4Pose({ shoulder: sh, elbow: { x: sh.x + Math.sin(r) * L * .5, y: sh.y + Math.cos(r) * L * .5 }, wrist: { x: sh.x + Math.sin(r) * L, y: sh.y + Math.cos(r) * L }, frames: 1 }); } };
        const o = {};
        pose(0, 40);                                       // resting arm (also the camera zero point)
        const d1 = toDone(); o.round1 = d1 && { rounds: d1.rounds, summary: d1.summary };
        window.advanceTime(3400, 68);                      // closing scene (3.2 s) runs out
        const s2 = S(); o.round2 = { rounds: s2.rounds, idx: s2.idx, text: s2.step && s2.step.text, ended: s2.ended, screen: qa.state().screen, running: qa.state().running, timeLeft: s2.timeLeft };
        // real lifts in round 2 still count (camera path, not the QA trigger)
        const before = qa.state().correctCount, scoreBefore = qa.state().score;
        for(let k = 0; k < 3; k++){ pose(0, 40); pose(130, 40); window.advanceTime(1500, 45); }
        const s3 = S(); o.lifts = { gained: qa.state().correctCount - before, scoreGained: qa.state().score - scoreBefore, repsDone: s3.repsDone, rounds: s3.rounds };
        // finish round 2 with 6 s left → no round 3, game ends on the closing scene
        pose(0, 40);
        toDone(); qa.setTimeLeft(6);
        window.advanceTime(3400, 68);
        const s4 = S(); o.end = { rounds: s4.rounds, ended: s4.ended, screen: qa.state().screen };
        const el = document.getElementById('dealResultSummary'); o.line = el ? { hidden: el.hidden, text: el.textContent } : null;
        return o;
      }, [key, level]);
      assert.deepEqual(errors, []);
      assert.equal(out.round1.rounds, 1);
      assert.equal(out.round2.rounds, 1); assert.equal(out.round2.idx, 0); assert.equal(out.round2.ended, false);
      assert.equal(out.round2.screen, 'game'); assert.equal(out.round2.running, true);
      assert.equal(out.round2.text, theme === 'laundry' ? '又有一籃污糟衫' : '再去超市買餸');
      assert.ok(out.lifts.gained >= 1, 'real lifts keep scoring in round 2: ' + JSON.stringify(out.lifts));
      assert.ok(out.lifts.scoreGained > 0);
      assert.ok(out.lifts.repsDone >= 1);
      assert.equal(out.end.rounds, 2); assert.equal(out.end.ended, true); assert.equal(out.end.screen, 'result');
      assert.equal(out.line.hidden, false);
      assert.match(out.line.text, theme === 'laundry' ? /^洗衫晾衫：今次做齊 2 轉/ : /^去超市買餸：今次完成咗 2 轉/);
    } finally { await context.close(); }
  });
}

test('Level 6 cooking e2e: dish 1 → celebration → dish 2 by itself with the same baseline → no dish 3 when time is nearly up', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openGame({ level: '67', level6Task: 'cooking', duration: 300, affectedSide: 'right' });
  try{
    const out = await page.evaluate(() => {
      const qa = window.__qa, o = {};
      const squeezeStep = () => { let s; for(let i = 0; i < 12; i++){ s = qa.cook.squeeze(); if(s.idx > 0) break; } return s; };
      const finish = () => { for(let i = 0; i < 14; i++){ if(qa.cook.step().done) break; qa.cook.completeStep(); } return qa.cook.step(); };
      const a = squeezeStep(); o.first = { idx: a.idx, baseline: a.baseline };
      const scoreAfterStep1 = qa.state().score;
      const d1 = finish(); o.dish1 = { done: d1.done, rounds: d1.rounds, reward: d1.reward, auto: document.getElementById('rwAuto').textContent };
      const scoreDish1 = qa.state().score;
      qa.closeReward();
      const r2 = qa.cook.step(); o.round2 = { idx: r2.idx, done: r2.done, rounds: r2.rounds, baseline: r2.baseline, reward: r2.reward, screen: qa.state().screen };
      const b = squeezeStep(); o.second = { idx: b.idx, summary: b.summary, scoreGained: qa.state().score - scoreDish1, perStep: scoreAfterStep1 };
      qa.setTimeLeft(10);
      const d2 = finish(); o.dish2 = { done: d2.done, rounds: d2.rounds, auto: document.getElementById('rwAuto').textContent, sub: document.getElementById('rwSub').textContent };
      qa.closeReward();
      const e = qa.cook.step(); o.after = { idx: e.idx, done: e.done, rounds: e.rounds, screen: qa.state().screen };
      window.advanceTime(11000, 220);
      const el = document.getElementById('dealResultSummary'); o.end = { screen: qa.state().screen, hidden: el.hidden, text: el.textContent };
      return o;
    });
    assert.deepEqual(errors, []);
    assert.equal(out.first.idx, 1); assert.ok(Number.isFinite(out.first.baseline));
    assert.deepEqual(out.dish1, { done: true, rounds: 1, reward: true, auto: '稍後自動繼續' });
    assert.equal(out.round2.idx, 0); assert.equal(out.round2.done, false); assert.equal(out.round2.rounds, 1);
    assert.equal(out.round2.reward, false); assert.equal(out.round2.screen, 'game');
    assert.equal(out.round2.baseline, out.first.baseline);            // same relaxed-hand baseline
    assert.equal(out.second.idx, 1);                                  // real squeezes count again
    assert.equal(out.second.scoreGained, out.second.perStep);         // and score the same as in dish 1
    assert.equal(out.second.summary, '煮蛋炒飯：今次煮好 1 碟，第 2 碟做到第 2 步，下次繼續。');
    assert.equal(out.dish2.rounds, 2); assert.equal(out.dish2.auto, '完成畫面會自動關閉');
    assert.match(out.dish2.sub, /^第 2 碟 · 12 \/ 12 步全部完成/);
    assert.deepEqual(out.after, { idx: 11, done: true, rounds: 2, screen: 'game' });   // stays finished, as before
    assert.deepEqual(out.end, { screen: 'result', hidden: false, text: '煮蛋炒飯：今次煮好 2 碟。' });
  } finally { await context.close(); }
});
