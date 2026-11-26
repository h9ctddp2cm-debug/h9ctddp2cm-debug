import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v143 — therapist feedback (26 Nov): the helpers found the setup page had too many
// parameters, and the game screens showed too many rules and words.
//   1. Setup page: only the affected side (plus the target angle for Level 3/4) is on the
//      page. Everything else sits inside one closed 「進階設定（治療師用）」 section, and the
//      scene options moved there from the game-picker page.
//   2. Game time defaults to the longest choice (15 minutes); the patient stops when tired.
//   3. Game screens: one short line and the needed numbers only (the angle readout stays).
//      Celebration screens show the title and the picture, not tier / score explanations.
// Gameplay, scoring and detection are unchanged.

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
const setup = html.slice(html.indexOf('<div id="screen-start" class="screen">'), html.indexOf('<p id="goCalibError"'));
const advanced = setup.slice(setup.indexOf('<details class="advanced-settings" id="advancedSettings"'));
const beforeAdvanced = setup.slice(0, setup.indexOf('<details class="advanced-settings" id="advancedSettings"'));

test('v143 release markers', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v145-20261127-yum-cha";/);
  assert.match(manifest, /index\.html\?build=v145-20261127-yum-cha/);
  assert.match(html, /const LEVEL_APP_BUILD = "v145-20261127-yum-cha";/);
  assert.match(html, /perf v145 {2}/);
});

test('game time defaults to the longest choice; the shorter ones stay available', () => {
  assert.match(html, /\n  duration: 900, {8}\/\/ total seconds/);
  assert.match(setup, /<button class="option-btn" data-duration="300">5 分鐘<\/button>/);
  assert.match(setup, /<button class="option-btn" data-duration="600">10 分鐘<\/button>/);
  assert.match(setup, /<button class="option-btn selected" data-duration="900">15 分鐘<\/button>/);
  assert.match(setup, /id="preview-duration">15 分鐘</);
});

test('setup page: only the affected side, the target angle and the game time sit outside the advanced section', () => {
  assert.match(beforeAdvanced, /<div class="card simple-card" data-accordion="affected-side">/);
  assert.match(beforeAdvanced, /<div class="card simple-card" id="shoulderTargetCard"/);
  assert.match(beforeAdvanced, /<div class="card simple-card" id="durationCard" data-accordion="duration">/);
  assert.equal((beforeAdvanced.match(/<div class="card /g) || []).length, 3);
  assert.ok(beforeAdvanced.includes('id="durationOptions"'), 'game time is chosen on the page itself');
  assert.doesNotMatch(beforeAdvanced, /handCheckBlock/);
  for(const id of ['sceneOptionSlot', 'shoulderExerciseModeCard', 'handCheckBlock', 'laundryDifficultyCard', 'fridgeDifficultyCard',
    'cookSqueezeCard', 'dimsumDifficultyCard', 'modeOptions', 'timingCard', 'fontOptions']){
    assert.ok(advanced.includes('id="' + id + '"'), id + ' is inside the advanced section');
  }
  assert.match(advanced, /<summary><span>進階設定（治療師用）<\/span>/);
  // every card inside starts closed
  assert.equal((advanced.match(/<div class="card collapsible"/g) || []).length, 0);
  assert.match(fnSource('selectActivity'), /advancedSettings\.open=false/);
});

test('Level 4 shows five common angles first; all thirteen stay available', () => {
  assert.match(html, /const SHOULDER_TARGET_COMMON_L4=\[60,90,120,150,180\];/);
  const src = fnSource('renderShoulderTargetSettings');
  assert.match(src, /Array\.from\(\{length:13\},\(_,index\)=>60\+index\*10\)/);
  assert.match(src, /const defaultDeg=state\.level==='3'\?40:60;/);
  assert.match(src, /common\.includes\(value\)\?'':' angle-more'/);
  assert.match(html, /#shoulderTargetOptions:not\(\.show-all\) \.option-btn\.angle-more\{ display:none; \}/);
});

test('scene options are drawn in the advanced section, not on the game-picker page', () => {
  const lib = fnSource('renderActivityLibrary');
  assert.doesNotMatch(lib, /dimsum-mode-bar|appendChild\(bar\)/);
  const bars = fnSource('renderSceneOptionBars');
  assert.equal((bars.match(/slot\.appendChild\(bar\);/g) || []).length, 3);
  assert.match(fnSource('selectActivity'), /renderSceneOptionBars\(\);/);
  // their defaults are unchanged
  assert.match(html, /laundryLoadSize: 'medium',/);
  assert.match(html, /shopListSize: 'medium',/);
  assert.match(html, /dimsumSceneMode: 'teahouse',/);
});

test('simple wording applies to normal play only', () => {
  assert.match(html, /\nfunction simpleScreenText\(\)\{ return !research\.active; \}/);
  assert.match(html, /gameStage\.classList\.toggle\('simple-words', simpleScreenText\(\)\);/);
  assert.match(html, /\.game-stage\.simple-words \.patient-game-instruction\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.simple-words \.adaptive-streak\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.simple-words\.patient-shoulder-hud \.hud-item:nth-child\(-n\+2\)\{ display:none; \}/);
});

test('story banners: the 「抬高手，」 lead-in and the second line are not drawn', () => {
  const main = new Function('simpleScreenText', fnSource('simpleBannerMain') + '\nreturn simpleBannerMain;');
  assert.equal(main(() => true)('抬高手，將衫放入洗衣機'), '將衫放入洗衣機');
  assert.equal(main(() => true)('睇吓購物單'), '睇吓購物單');
  assert.equal(main(() => false)('抬高手，將衫放入洗衣機'), '抬高手，將衫放入洗衣機');
  for(const name of ['drawShopBanner', 'drawLaundryBanner']){
    assert.match(fnSource(name), /if\(simpleScreenText\(\)\)\{ text=simpleBannerMain\(text\); sub=''; \}/, name);
  }
  assert.match(fnSource('drawCookDigiflexBanner'), /if\(simpleScreenText\(\)\) sub='';/);
});

test('mahjong / cards table: the small status line is not drawn on top of the win banner', () => {
  // portrait draws the status line above the table; while the big win banner shows it is skipped
  assert.match(html, /if\(!\(simpleScreenText\(\)&&winning\)\) ctx\.fillText\(simpleScreenText\(\)\?line2:/);
  // landscape: one line only, and not while a banner is showing
  assert.match(html, /\}else if\(!winning&&simpleScreenText\(\)\)\{/);
});

test('held prompt keeps the action words only', () => {
  const shown = new Function('simpleScreenText', fnSource('advHeldPromptShown') + '\nreturn advHeldPromptShown;');
  const s = shown(() => true);
  assert.equal(s('已拿住 · 請張開手放下'), '請張開手放下');
  assert.equal(s('已拿住 · 移到放牌區，停住自動放低'), '移到放牌區');
  assert.equal(s('已夾住 · 請放鬆夾仔'), '請放鬆夾仔');
  assert.equal(s('已捏住 · 請張開三指放下'), '請張開三指放下');
  assert.equal(shown(() => false)('已拿住 · 請張開手放下'), '已拿住 · 請張開手放下');
});

test('celebration screen and toast: the explanation lines are not shown in normal play', () => {
  const big = fnSource('rewardBig');
  assert.match(big, /d\.reward\.classList\.toggle\('simple', simple\);/);
  assert.match(big, /getElementById\('rwTier'\)\.textContent = simple \? '' : \(o\.tier \|\| ''\);/);
  assert.match(big, /getElementById\('rwDetail'\)\.innerHTML = simple \? '' : \(o\.detail \|\| ''\);/);
  assert.match(big, /getElementById\('rwProgLbl'\)\.textContent = simple \? '' : \(o\.progressLabel \|\| ''\);/);
  // timing and what happens next are unchanged
  assert.match(big, /rewardAutoTimer = setTimeout\(\(\)=> rewardClose\(\), o\.autoMs \|\| 4200\);/);
  const small = fnSource('rewardSmall');
  assert.match(small, /\(o\.detail && !simple \? '<small>' \+ o\.detail \+ '<\/small>' : ''\)/);
  assert.match(small, /lastRewardLog\.push\(\{ achievement:o\.achievement \|\| '', detail:o\.detail \|\| '', progress:o\.progressLabel \|\| '' \}\);/);
});

test('detection settings and Level 6 chopsticks dwell are untouched', () => {
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /runningMode:\s*['"]VIDEO['"]/);
  assert.match(html, /PUBLIC_GAME_WORK_INTERVAL_MS\s*=\s*1000\s*\/\s*30/);
  assert.match(html, /PUBLIC_CANVAS_MAX_EDGE\s*=\s*1600/);
  for(const name of ['simpleScreenText', 'simpleBannerMain', 'advHeldPromptShown', 'renderSceneOptionBars']){
    assert.doesNotMatch(fnSource(name), /landmark|Confidence|GRASP_|RELEASE_|addScore/, name + ' does not touch detection or scoring');
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

test('Level 3/4 mahjong: larger tiles in two rows clear of the angle panel; the win banner names the hand', async t => {
  if(!browser) return t.skip('playwright unavailable');
  assert.match(html, /dealMahjongFanText\(dealTable\.result\),'#B3262B',simple\?0\.66:0\.52\)/);
  for(const [vw, vh, minW] of [[1180, 820, 100], [1413, 653, 90]]){
    const { context, page, errors } = await openPage(vw, vh);
    try{
      await page.evaluate(() => { window.__qa.startGame({ level: '3', theme: 'mahjong', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0 }); });
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => {
        const g = window.__qa.dealTable.geometry();
        const panel = document.getElementById('level4ReadoutNote').parentElement.getBoundingClientRect();
        const ys = [...new Set(g.rects.map(r => Math.round(r.y)))];
        return { g, ys, panel: { r: panel.right, b: panel.bottom, w: panel.width }, scale: g.cssScale };
      });
      assert.equal(o.ys.length, 2, 'two rows');
      assert.equal(o.g.rects.length, 14);
      assert.ok(o.g.tileW / o.scale >= minW, 'tile width ' + o.g.tileW);
      // every tile is on the table, below the top buttons, and the drawing lane still has room
      for(const r of o.g.rects){
        assert.ok(r.x - r.w / 2 >= 0 && r.x + r.w / 2 <= o.g.cw && r.y - r.h / 2 >= 90 * o.scale, JSON.stringify(r));
      }
      assert.ok(o.panel.w > 0 && o.panel.w < 320, 'angle panel is on screen');
      for(const r of o.g.rects){   // no tile under the angle panel (top left)
        const under = (r.x - r.w / 2) / o.scale < o.panel.r && (r.y - r.h / 2) / o.scale < o.panel.b;
        assert.equal(under, false, 'tile under the angle panel ' + JSON.stringify(r));
      }
      assert.ok(o.g.laneBottom - o.g.laneTop >= 90 * o.scale, 'lane travel');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

async function openPage(vw = 1180, vh = 820){
  const context = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  return { context, page, errors };
}
const visibleCards = () => {
  // content of a closed <details> keeps its layout box, so check the section state as well
  const vis = e => !!(e.offsetWidth || e.offsetHeight) && !e.closest('details:not([open])');
  return [...document.querySelectorAll('#screen-start .card')].filter(vis).map(c => c.querySelector('h2 span').innerText.trim());
};
const visibleAngles = () => [...document.querySelectorAll('#shoulderTargetOptions [data-shoulder-target]')]
  .filter(b => !!(b.offsetWidth || b.offsetHeight)).map(b => Number(b.dataset.shoulderTarget));

test('Level 4 setup: three cards on the page, five angles, the rest behind 「進階設定」', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    await page.click('[data-testid="button-mode-trial-4"]');
    assert.equal(await page.locator('#screen-library .dimsum-mode-bar').count(), 0, 'game-picker page has cards only');
    await page.click('#activityGrid .activity-card[data-theme="supermarket"]');
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(visibleCards), ['患側方向', '肩屈曲目標', '遊戲時間']);
    assert.deepEqual(await page.evaluate(visibleAngles), [60, 90, 120, 150, 180]);
    await page.click('#shoulderTargetMore');
    assert.equal((await page.evaluate(visibleAngles)).length, 13);
    await page.click('[data-shoulder-target="110"]');
    assert.equal(await page.evaluate(() => window.__qa.state().shoulderTargetDeg), 110);
    assert.equal(await page.evaluate(() => window.__qa.state().duration), 900);
    await page.click('#durationOptions [data-duration="600"]');
    assert.equal(await page.evaluate(() => window.__qa.state().duration), 600);
    assert.equal(await page.textContent('#preview-duration'), '10 分鐘');
    await page.click('#durationOptions [data-duration="900"]');
    assert.equal(await page.evaluate(() => window.__qa.state().duration), 900);
    assert.equal(await page.evaluate(() => document.getElementById('advancedSettings').open), false);
    await page.click('#advancedSettings > summary');
    await page.waitForTimeout(200);
    const cards = await page.evaluate(visibleCards);
    assert.deepEqual(cards, ['患側方向', '肩屈曲目標', '遊戲時間', '訓練方式', '訓練模式', '目標保持', '字體大小']);
    assert.equal(await page.locator('#sceneOptionSlot [data-shop-list]').count(), 3);
    assert.equal(await page.locator('#sceneOptionSlot [data-shop-list].selected').getAttribute('data-shop-list'), 'medium');
    await page.click('#sceneOptionSlot [data-shop-list="long"]');
    assert.equal(await page.evaluate(() => window.__qa.state().shopListSize), 'long');
    // going back and picking a game again closes the advanced section
    await page.click('#btnBackToLibrary');
    await page.click('#activityGrid .activity-card[data-theme="laundry"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.getElementById('advancedSettings').open), false);
    assert.equal(await page.locator('#sceneOptionSlot [data-laundry-load]').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 3 shows its four angles; Level 5 and 6 show the affected side and the game time', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage(1413, 653);
  try{
    const out = await page.evaluate(visible => {
      const cards = new Function('return (' + visible + ')')();
      const res = {};
      for(const [level, theme] of [['3', 'dimsum'], ['5', 'fridge'], ['67', 'cooking']]){
        window.__qa.selectLevel(level); window.__qa.selectActivity(theme);
        res[level] = { cards: cards(), more: !document.getElementById('shoulderTargetMore').hidden,
          angles: [...document.querySelectorAll('#shoulderTargetOptions [data-shoulder-target]')].filter(b => !!(b.offsetWidth || b.offsetHeight)).map(b => Number(b.dataset.shoulderTarget)) };
      }
      return res;
    }, visibleCards.toString());
    assert.deepEqual(out['3'].cards, ['患側方向', '肩屈曲目標', '遊戲時間']);
    assert.deepEqual(out['3'].angles, [30, 40, 50, 60]);
    assert.equal(out['3'].more, false);
    assert.deepEqual(out['5'].cards, ['患側方向', '遊戲時間']);
    assert.deepEqual(out['67'].cards, ['患側方向', '遊戲時間']);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 5 game screen: no rule line, no streak line; toast is one line; mahjong win shows title and tiles only', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    await page.evaluate(() => { window.__qa.startGame({ level: '5', theme: 'laundry', duration: 600, affectedSide: 'right' }); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.advanceTime(800, 24); window.__qa.laundry.sortOne(false); });
    await page.waitForTimeout(200);
    const shown = await page.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return !!(e && (e.offsetWidth || e.offsetHeight)); };
      const toast = document.getElementById('advToast');
      return { instruction: vis('patientGameInstruction'), streak: vis('adaptiveStreakStatus'), time: vis('hudTime'),
        toastShown: toast.classList.contains('show'), toastSmall: toast.querySelectorAll('small').length, toastText: toast.innerText.trim(),
        correct: window.__qa.laundry.state ? 1 : 1 };
    });
    assert.equal(shown.instruction, false);
    assert.equal(shown.streak, false);
    assert.equal(shown.time, true);
    assert.equal(shown.toastShown, true);
    assert.equal(shown.toastSmall, 0);
    assert.match(shown.toastText, /正確/);

    await page.evaluate(() => { window.__qa.startGame({ level: '5', theme: 'mahjong', duration: 600, affectedSide: 'right' }); });
    await page.waitForTimeout(300);
    const win = await page.evaluate(() => {
      const q = window.__qa; window.advanceTime(800, 24);
      for(let r = 0; r < 6 && !q.adv.rewardOpen(); r++){ for(let i = 0; i < 4 && !q.adv.rewardOpen(); i++) q.mj.pick(i); }
      const vis = id => { const e = document.getElementById(id); return !!(e && (e.offsetWidth || e.offsetHeight)); };
      return { open: q.adv.rewardOpen(), title: document.getElementById('rwTitle').textContent, tier: vis('rwTier'), detail: vis('rwDetail'),
        prog: vis('rwProgLbl'), auto: vis('rwAuto'), canvas: vis('rwCanvas'),
        words: document.getElementById('rewardOverlay').innerText.replace(/\s+/g, ' ').trim() };
    });
    assert.equal(win.open, true);
    assert.equal(win.title, '和牌！');
    assert.deepEqual([win.tier, win.detail, win.prog, win.auto], [false, false, false, false]);
    assert.equal(win.canvas, true);
    assert.doesNotMatch(win.words, /累積|下一個目標|並非官方|自動繼續|連勝/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 3/4 game screen keeps the repetition count, the time and the angle readout', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    await page.evaluate(() => { window.__qa.startGame({ level: '4', theme: 'laundry', duration: 600, affectedSide: 'right', shoulderTargetDeg: 60, dwellMs: 0 }); });
    await page.waitForTimeout(400);
    const hud = await page.evaluate(() => {
      const vis = e => !!(e && (e.offsetWidth || e.offsetHeight));
      const el = id => document.getElementById(id);
      return { score: vis(el('hudScore')), correct: vis(el('hudCorrect')), reps: vis(el('hudGrabs')), repsLabel: el('hudGrabsLabel').textContent,
        time: vis(el('hudTime')), target: vis(el('level4ExtendedEndpoint')), targetText: el('level4ExtendedEndpoint').textContent };
    });
    assert.deepEqual([hud.score, hud.correct], [false, false]);
    assert.deepEqual([hud.reps, hud.time, hud.target], [true, true, true]);
    assert.equal(hud.repsLabel, '完成次數');
    assert.match(hud.targetText, /60/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
