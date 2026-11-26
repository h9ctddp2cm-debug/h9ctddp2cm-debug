import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v139 — therapist feedback (24 Nov): the Level 3/4 laundry scene should be a
// whole household story instead of one garment rising to a pole:
//   put the clothes into the washer one by one → press the button (one lift) →
//   washing (rest) → take them out one by one → hang them one by one →
//   the sun rises and dries them (rest animation) → take them down one by one →
//   fold them one by one → put them into the wardrobe one by one.
// It follows the v125 supermarket approach (full-screen scene + story steps) and
// is a visual / audio reward layer only: the shoulder controller, the target
// decision, the score and the v137 re-arm rules are untouched.

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
function lineConst(name){
  const m = html.match(new RegExp('\\nconst ' + name + ' = ([^;\\n]+);'));
  assert.ok(m, 'const ' + name + ' exists');
  return 'const ' + name + ' = ' + m[1] + ';';
}
const blockStart = html.indexOf('/* ==================== v139 洗衫晾衫故事');
const blockEnd = html.indexOf('/* ==================== v138 牌局場景');
const block = html.slice(blockStart, blockEnd);
const code = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ [^\n]*$/gm, '');

const sandbox = new Function([
  lineConst('LAUNDRY_LOAD_SIZES'), lineConst('LAUNDRY_STORY_POOL'),
  lineConst('LAUNDRY_WASH_MS'), lineConst('LAUNDRY_SUN_MS'), constSource('LAUNDRY_STAGES'),
  fnSource('buildLaundryList'), fnSource('buildLaundrySteps'), fnSource('laundryRepCount'),
  'return { LAUNDRY_LOAD_SIZES, LAUNDRY_STAGES, LAUNDRY_WASH_MS, LAUNDRY_SUN_MS, buildLaundryList, buildLaundrySteps, laundryRepCount };',
].join('\n'))();

test('the block sits before the v138 block and is self-contained', () => {
  assert.ok(blockStart > 0 && blockEnd > blockStart);
  assert.ok(block.length > 8000);
});

test('the story follows the order the therapist described', () => {
  const list = sandbox.buildLaundryList('medium');
  assert.equal(list.length, 4);
  const steps = sandbox.buildLaundrySteps(list);
  const outline = [];
  steps.forEach(s => {
    const key = s.kind === 'rep' ? s.action : 'scene:' + s.cut;
    if(outline[outline.length - 1] !== key) outline.push(key);
  });
  assert.deepEqual(outline, [
    'scene:intro', 'load', 'press', 'scene:washing', 'unload',
    'scene:walk', 'hang', 'scene:sun', 'collect',
    'scene:walk', 'fold', 'store', 'scene:done',
  ]);
  // every garment goes through every stage exactly once, one garment per lift
  ['load', 'unload', 'hang', 'collect', 'fold', 'store'].forEach(action => {
    const items = steps.filter(s => s.kind === 'rep' && s.action === action).map(s => s.item);
    assert.deepEqual(items.slice().sort(), list.slice().sort(), action + ' handles each garment once');
  });
  // the button is a single lift
  assert.equal(steps.filter(s => s.action === 'press').length, 1);
  // only the last step ends the game
  assert.deepEqual(steps.filter(s => s.end).map(s => steps.indexOf(s)), [steps.length - 1]);
});

test('number of lifts is 6 per garment plus the button: 19 / 25 / 37', () => {
  const count = k => sandbox.laundryRepCount(sandbox.buildLaundrySteps(sandbox.buildLaundryList(k)));
  assert.deepEqual(sandbox.LAUNDRY_LOAD_SIZES, { short:3, medium:4, long:6 });
  assert.equal(count('short'), 19);
  assert.equal(count('medium'), 25);
  assert.equal(count('long'), 37);
  assert.match(html, /laundryLoadSize: 'medium',/);
});

test('washing and sun-drying are rest scenes that need no lift', () => {
  const steps = sandbox.buildLaundrySteps(sandbox.buildLaundryList('medium'));
  const washing = steps.find(s => s.cut === 'washing'), sun = steps.find(s => s.cut === 'sun');
  assert.equal(washing.kind, 'scene');
  assert.equal(sun.kind, 'scene');
  assert.equal(washing.ms, sandbox.LAUNDRY_WASH_MS);
  assert.equal(sun.ms, sandbox.LAUNDRY_SUN_MS);
  assert.ok(sun.ms >= 5000 && sun.ms <= 9000, 'the sun animation is a real pause but not a long wait');
  assert.match(washing.text, /休息/);
  assert.match(sun.text, /休息/);
  // the reward cycle covers the animation plus the rest scenes that follow it
  assert.match(fnSource('startLaundryStoryAction'),
    /laundryStory\.rewardMs=Math\.max\(SHOULDER_REWARD_MIN_MS,\s*LAUNDRY_ACTION_MS\+LAUNDRY_SCENE_PAD_MS\+laundrySceneMsUntilNextRep\(laundryStory\.idx\+1\)\);/);
  assert.match(html, /return Math\.max\(SHOULDER_REWARD_MIN_MS,laundryStory\.rewardMs\);/);
});

test('seven progress stages are shown in story order', () => {
  assert.deepEqual(sandbox.LAUNDRY_STAGES.map(s => s.zh), ['入機', '洗衫', '晾衫', '晒乾', '收衫', '摺衫', '入櫃']);
  sandbox.LAUNDRY_STAGES.forEach(s => assert.ok(s.en && !/[\u3400-\u9fff]/.test(s.en)));
  const steps = sandbox.buildLaundrySteps(sandbox.buildLaundryList('long'));
  for(let i = 1; i < steps.length; i++) assert.ok(steps[i].stage >= steps[i - 1].stage, 'stage never goes backwards');
});

test('the story is a public Level 3/4 reward layer hooked like the supermarket', () => {
  assert.match(html, /function isLaundryStoryTheme\(\)\{ return isShoulderFlexionLevel\(\)&&!research\.active&&state\.theme==='laundry'; \}/);
  assert.match(html, /if\(isLaundryStoryTheme\(\)\)\{ drawLaundryStoryScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(isLaundryStoryTheme\(\)\)\{ targets=\[\]; return; \}/);
  assert.match(html, /if\(isLaundryStoryTheme\(\)\) continue;/);
  // the action starts exactly where the supermarket action starts, before the shared reward cycle
  assert.match(html, /if\(isSupermarketTheme\(\)\)startSupermarketAction\(\);[^\n]*\n\s*if\(isLaundryStoryTheme\(\)\)startLaundryStoryAction\(\);[^\n]*\n\s*startShoulderRewardCycle\(\);\n\s*triggerFeedback\(true\);/);
  assert.match(html, /resetLaundryStory\(\);\s+\/\/ v139/);
  // the big centre tick is skipped (it would cover the garment); the chime stays
  assert.match(fnSource('showFeedback'), /if\(correct&&isLaundryStoryTheme\(\)\) return;/);
  assert.match(fnSource('triggerFeedback'), /if\(correct\)\{ playCorrectSound\(\);/);
});

test('the scene never feeds back into detection, scoring or the v137 re-arm rules', () => {
  // read-only use of the shoulder state: progress + whether a reward is running
  assert.doesNotMatch(block, /shoulderFlexionState\.\w+\s*=[^=]/);
  assert.doesNotMatch(block, /shoulderFlexionController/);
  assert.doesNotMatch(block, /shoulderRewardCycle\.(?:active|repetitionReady|finishAtMs|startedMs)\s*=[^=]/);
  assert.doesNotMatch(block, /\bscore\s*(?:\+=|-=|=[^=])/);
  assert.doesNotMatch(block, /correctCount|grabCount|setTarget\(|triggerFeedback\(/);
  // no penalty wording and no degree figures in the patient scene
  assert.doesNotMatch(code, /扣分|錯|輸|°/);
  // the controller file is unchanged by this release
  assert.match(controllerSrc, /patientRearmDropDeg/);
  assert.doesNotMatch(controllerSrc, /laundryStory|v139/);
  // shared detection settings stay exactly as before
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /runningMode:\s*"VIDEO"/);
  assert.match(html, /PUBLIC_GAME_WORK_INTERVAL_MS\s*=\s*1000\s*\/\s*30/);
  assert.match(html, /PUBLIC_CANVAS_MAX_EDGE\s*=\s*1600/);
});

test('the game ends by itself only after the closing scene', () => {
  const update = fnSource('updateLaundryStory');
  // v141: with session time left the closing scene starts another round instead
  assert.match(update, /if\(s\.end\)\{\s*if\(storyRoundCanRepeat\(\)\)\{ restartLaundryRound\(\); return; \}\s*laundryStory\.ended=true;\s*if\(state\.running\) endGame\(\);\s*return;\s*\}/);
  assert.match(fnSource('updateLaundryStoryAction'), /if\(nxt&&nxt\.kind==='scene'&&nxt\.end\)\{ laundryStory\.completed=true;/);
});

test('every on-canvas and spoken string has an English counterpart', () => {
  const fillCalls = block.match(/ctx\.(?:fillText|strokeText)\(([^,]+),/g) || [];
  assert.ok(fillCalls.length >= 3);
  fillCalls.forEach(call => assert.doesNotMatch(call, /[\u3400-\u9fff]/, call));
  const steps = sandbox.buildLaundrySteps(sandbox.buildLaundryList('long'));
  steps.forEach(s => {
    assert.ok(s.en && !/[\u3400-\u9fff]/.test(s.en), s.text);
    assert.ok(localization.includes("'" + s.text + "':'" + s.en + "'"), s.text + ' is in localization.js');
    if(s.kind === 'scene') assert.ok(s.sub && s.subEn && !/[\u3400-\u9fff]/.test(s.subEn));
  });
  ["'洗衫晾衫':'Laundry Day'", "'衫量':'Load size'", "'少（3 件）':'Small (3 garments)'",
    "'中（4 件）':'Medium (4 garments)'", "'多（6 件）':'Large (6 garments)'",
    "'約 19 次抬手':'About 19 lifts'", "'約 25 次抬手':'About 25 lifts'", "'約 37 次抬手':'About 37 lifts'",
    "'洗衫、晾衫、摺衫、入衣櫃，每舉一下做一件':'Wash, hang, fold and store. Each lift handles one garment.'",
  ].forEach(entry => assert.ok(localization.includes(entry), entry));
});

test('activity card, load-size bar and result line describe the new play', () => {
  assert.match(html, /shoulderTitle:'洗衫晾衫'/);
  assert.match(html, /shoulderGoal:'洗衫、晾衫、摺衫、入衣櫃，每舉一下做一件'/);
  assert.match(html, /function themeShownTitle\(th\)\{ return \(isShoulderFlexionLevel\(\)&&!research\.active&&th&&th\.shoulderTitle\)\|\|\(th\?th\.title:''\); \}/);
  assert.match(html, /if\(id==='laundry'&&\(state\.level==='3'\|\|state\.level==='4'\)&&!research\.active\)\{/);
  assert.match(html, /data-laundry-load="'\+k\+'"/);
  assert.match(html, /const laundryLine=isLaundryStoryTheme\(\)\?laundryStorySummaryText\(\):'';/);
  const summary = fnSource('laundryStorySummaryText');
  assert.match(summary, /全部做齊/);
  assert.match(summary, /下次繼續/);
  // the summary only reports this session — no comparison with earlier sessions
  assert.doesNotMatch(summary, /上次|比較|進步|退步|last time|previous/i);
});

test('therapist follow-up: bigger clothes and appliances, small live degree readout', () => {
  const geo = fnSource('laundryStoryGeometry');
  // carried garment is about a third of the short screen edge (was about a fifth)
  assert.match(geo, /const gs=m\*\(portrait\?0\.28:0\.32\);/);
  // landscape: washer and wardrobe grow to most of the screen height beside the banner
  assert.match(geo, /const washerH=portrait\?Math\.min\(ch\*0\.52,room,[^)]*\):Math\.min\(ch\*0\.80,tall,/);
  assert.match(geo, /const wardH=portrait\?Math\.min\(ch\*0\.50,room,[^)]*\):Math\.min\(ch\*0\.80,tall,/);
  assert.match(geo, /washBanner:portrait\?null:\{ x0:g\.panelRight, x1:washer\.x-washerW\/2-sideGap \}/);
  // 現在／目標 is visible again in public mode, compact and labelled as a camera estimate
  assert.match(html, /if\(readouts\) readouts\.hidden=false;\n\s*bar\.classList\.toggle\('public-compact',!research\.active\);/);
  assert.match(html, /\.level4-calib\.public-compact \.level4-reading b,[\s\S]{0,260}\{ font-size:19px; \}/);
  assert.match(html, /id="level4ReadoutNote">相機估算，只供參考</);
  assert.ok(localization.includes("'相機估算，只供參考':'Camera estimate, for reference only'"));
  assert.ok(localization.includes("'完成次數':'Lifts done'"));
  assert.ok(localization.includes("'自拍':'Selfie'"));
  // long banner text wraps instead of shrinking to tiny type
  assert.match(fnSource('drawLaundryBanner'), /lines=\[text\.slice\(0,cut\)\.trim\(\),text\.slice\(cut\)\.trim\(\)\];/);
  // prompts still carry no degree figures and nothing about detection changed
  assert.match(html, /setActionPrompt\('抬高',''\);/);
});

test('new scene pictures are shipped', () => {
  ['laundry_room_bg.jpg', 'laundry_pole_bg.jpg', 'laundry_bedroom_bg.jpg',
    'laundry_washer.png', 'laundry_wardrobe.png', 'laundry_basket.png'].forEach(file => {
    assert.ok(existsSync(path.join(root, 'img', file)), file);
    assert.ok(html.includes("img/" + file), file + ' is referenced');
  });
});

test('other Level 3/4 scenes and the Level 5/6 laundry games are not rerouted', () => {
  assert.match(html, /if\(state\.theme==='bowlinglane'\)\{ drawBowlingAlleyScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(state\.theme==='supermarket'\)\{ drawSupermarketScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /if\(isDealTableTheme\(\)\)\{ drawDealTableScene\(ctx,cw,ch\); return; \}/);
  assert.match(html, /gameType:'dwell'/);
  assert.match(localization, /'衣夾晾衫':'Cloth-Peg Laundry'/);
});

test('release markers are v139', () => {
  const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
  assert.match(html, /const LEVEL_APP_BUILD = "v143-20261126-simple-setup";/);
  assert.match(html, /perf v143/);
  assert.match(sw, /^const CACHE_VERSION = "fthue-rehab-v143-20261126-simple-setup";/);
  assert.match(manifest, /v143-20261126-simple-setup/);
});
