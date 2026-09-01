import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('public action cue is vertical, right-aligned, large, and skin toned', () => {
  assert.match(html, /\.game-stage\.patient-simple-hud \.prompt-zone\{[\s\S]*?right:12px;[\s\S]*?transform:translateY\(-50%\)/);
  assert.match(html, /width:1\.15em; writing-mode:horizontal-tb; text-orientation:mixed/);
  assert.match(html, /word-break:break-all; overflow-wrap:anywhere/);
  assert.match(html, /const emoji = gestureCue === 'open' \? '✋🏻' : '✊🏻';/);
  assert.match(html, /const handEmoji = isGrasping \? '✊🏻' : '✋🏻';/);
  assert.match(html, /const closedHandSize=Math\.max\(210,Math\.min\(280,/);
  assert.match(html, /const handSize=isGrasping \? closedHandSize : closedHandSize\*1\.5;/);
  assert.match(html, /data-gesture-cue="open"\] \.action-emoji\{ font-size:132px; \}/);
  assert.match(html, /data-gesture-cue="close"\] \.action-emoji\{ font-size:88px; \}/);
});

test('public large emoji cursor has no surrounding circle', () => {
  const standard = html.slice(
    html.indexOf('// 游標：Level 5–6 以大型膚色手勢'),
    html.indexOf('// Preserve the pre-v76 research grasp/pinch cursor exactly.'),
  );
  const advancedStart = html.indexOf('function advDrawCursor(ctx, pct)');
  const advanced = html.slice(
    advancedStart,
    html.indexOf('// Preserve the pre-v76 research grasp/pinch cursor exactly.', advancedStart),
  );
  for(const branch of [standard, advanced]){
    assert.match(branch, /✊🏻/);
    assert.doesNotMatch(branch, /ctx\.arc\(/);
    assert.doesNotMatch(branch, /ctx\.stroke\(\)/);
  }
});

test('fridge bag drawing is removed but the lower pickup point remains', () => {
  const draw = html.slice(
    html.indexOf('function drawFridgeTarget('),
    html.indexOf('function drawFridgeOrderBanner('),
  );
  assert.doesNotMatch(draw, /買餸袋|const bagR|const bagFont/);
  assert.match(html, /function fridgeBagSpot\(cw, ch, r\)/);
  assert.match(html, /const spot = fridgeBagSpot\(cw, ch, r\)/);
});

test('laundry rack is in the upper half and enlarged clothes use lower-half slots', () => {
  assert.match(html, /Math\.min\(cw \* 0\.88, 980\)[\s\S]*?Math\.min\(cw \* 0\.92, 1220\)/);
  assert.match(html, /state\.theme === 'peg_laundry' \? 1\.70 : 1\.16/);
  assert.match(html, /\[\[0\.20,0\.66\],\[0\.80,0\.66\],\[0\.50,0\.88\]\]/);
  assert.match(html, /\[\[0\.18,0\.78\],\[0\.46,0\.78\],\[0\.72,0\.78\]\]/);
  assert.match(html, /if\(isLaundryOrderGame\(\)\)\{[\s\S]*?const freeLaundrySlot=existingFoods\.every[\s\S]*?if\(freeLaundrySlot\) return createFood\(x, y\);/);
  assert.match(html, /ctx\.fillStyle='rgba\(218,232,238,0\.88\)'/);
});

test('camera-view games start white and expose an explicit selfie toggle', () => {
  assert.match(html, /id="btnSelfieBackground"[\s\S]*?data-testid="button-selfie-background" hidden>自拍<\/button>/);
  assert.match(html, /selfieMode:false/);
  assert.match(html, /function usesCameraViewBackground\(\)\{[\s\S]*?if\(research\.active\) return false;[\s\S]*?if\(isTeahouseDimsumMode\(\)\) return false;/);
  assert.match(html, /\['tsuenwan','dimsum','laundry','flowers','chopstick_dimsum',[\s\S]*?'peg_laundry','cooking'\]\.includes\(state\.theme\)/);
  assert.match(html, /stage\.classList\.toggle\('white-game-background',eligible&&!state\.selfieMode\)/);
  assert.match(html, /stage\.classList\.toggle\('selfie-game-background',eligible&&state\.selfieMode\)/);
  assert.match(html, /button\.textContent=state\.selfieMode\?'白色背景':'自拍'/);
});

test('calibration selfie occupies two thirds of the screen', () => {
  assert.match(html,
    /\.calib-wrap\{[\s\S]*?width:min\(66\.667vw,calc\(66\.667vh \* 4 \/ 3\)\); max-width:none; aspect-ratio:4\/3;/);
});

test('public gameplay hides technical prose and sentence panels', () => {
  assert.match(html, /gameStage\.classList\.toggle\('public-clean-hud', !research\.active\)/);
  assert.match(html, /\.game-stage\.public-clean-hud \.prompt-slot,[\s\S]*?\.adv-panel,[\s\S]*?\.therapist-btn\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.public-clean-hud:not\(\.patient-simple-hud\) \.status-bar\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.public-clean-hud\.patient-simple-hud \.action-copy\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.public-clean-hud\.patient-simple-hud \.status-bar\{[\s\S]*?background:transparent/);
  assert.match(html, /Math\.round\(shoulder\.estimatedAngle\)\+'\u00b0' : '\u2014'/);
  for(const fn of ['drawDimsumOrderBanner','drawLaundryOrderBanner','drawFridgeOrderBanner']){
    const start = html.indexOf(`function ${fn}`);
    const body = html.slice(start, start + 420);
    assert.match(body, /if\(!research\.active\)\{/);
  }
});

test('public mahjong keeps tiles and target but hides explanatory canvas text', () => {
  const start = html.indexOf('function mjRender(ctx)');
  const end = html.indexOf('function mjUpdate()', start);
  const render = html.slice(start, end);
  assert.match(render, /if\(!isPatientVisualCueMode\(\)\)\{[\s\S]*?你的牌/);
  assert.match(render, /if\(!L\.narrow && !isPatientVisualCueMode\(\)\)\{[\s\S]*?揀一組牌/);
  assert.match(render, /if\(!isPatientVisualCueMode\(\)\)\{[\s\S]*?g\.ref\.tiles\.map\(mjLabel\)/);
  assert.match(render, /if\(!L\.narrow && !isPatientVisualCueMode\(\)\)\{[\s\S]*?和牌/);
  assert.match(render, /drawAffectedSelectionZone\(ctx, '放牌區'\)/);
});

test('public cards and mahjong restore one short upper-left instruction', () => {
  assert.match(html, /classList\.toggle\('patient-card-instruction',[\s\S]*?isPublicSideCardGame\(\)/);
  assert.match(html, /\.game-stage\.public-clean-hud\.patient-card-instruction \.adv-panel\{[\s\S]*?left:14px; right:auto; top:14px;/);
  assert.match(html, /patient-card-instruction \.adv-panel > :not\(\.ap-text\)\{[\s\S]*?display:none !important/);
  assert.match(html, /const isSideCardGame = isPublicSideCardGame\(\)/);
  assert.match(html, /const side = activeAffectedSide\(\) === 'right' \? '右邊' : '左邊'/);
});

test('public Level 5 and Level 6 cards and mahjong use affected-side drop zones', () => {
  assert.match(html, /function isPublicSideCardGame\(\)\{[\s\S]*?state\.level === '5' \|\| state\.level === '67'[\s\S]*?state\.theme === 'cards' \|\| state\.theme === 'mahjong'/);
  assert.match(html, /const largePublicCardZone = isPublicSideCardGame\(\)/);
  assert.match(html, /x:affectedSideSign\(\) > 0 \? cw \* \(largePublicCardZone \? 0\.875 : 0\.86\)[\s\S]*?cw \* \(largePublicCardZone \? 0\.125 : 0\.14\)/);
  assert.doesNotMatch(html, /const level5TopZone/);
});

test('public photo game uses equal-size separated upper and lower photos', () => {
  assert.match(html, /drawIcon:\(ctx,x,y,s\)=>drawTsuenWanPhotoCard\(ctx,photo\.img,x,y,s\*1\.80\)/);
  assert.match(html, /style,x:laneX,y:photoLarge\?ch\*\.28:ch\*\.32/);
  assert.match(html, /state\.theme==='tsuenwan'&&!research\.active\?\.75:\.72/);
});

test('public flower game uses the wide patterned planter while research keeps its vase', () => {
  assert.match(html, /V75_IMG_SRC\['v77_wide_pot'\] = 'img\/flower_pot_user\.jpeg'/);
  assert.match(html, /vaseH = patientLarge[\s\S]*?\? ch\*0\.25/);
  assert.match(html, /w:patientLarge\?cw:vaseH\*0\.68/);
  assert.match(html, /isPublicLevel5VerticalFlow\(\) \|\| \(isLevel6\(\)&&state\.theme==='flowers'\)\) \? ch\*0\.53/);
  assert.match(html, /ctx\.drawImage\(pot, vase\.x-vase\.w\*0\.5, vase\.y-vase\.h\*0\.5, vase\.w, vase\.h\)/);
  assert.match(html, /drawSprite\(ctx, advImg\('v75_vase'\), vase\.x, vase\.y, vase\.h/);
});

test('public mahjong keeps no more than three choices and research retains full shuffle', () => {
  const start = html.indexOf('function mjStartRound(');
  const end = html.indexOf('function mjLayout(', start);
  const roundSetup = html.slice(start, end);
  assert.match(roundSetup, /if\(isPatientVisualCueMode\(\)\)\{[\s\S]*?gs\.splice\(3\);[\s\S]*?\}else\{[\s\S]*?Math\.floor\(mjRand\(\) \* \(i \+ 1\)\)/);
});

test('public basketball centres and doubles the hoop while hiding prose overlays', () => {
  assert.match(html, /const s=Math\.max\(pw\/bgW,\(py1-py0\)\/bgH\)\*2;/);
  assert.match(html, /const dx=laneX-dw\*0\.370,dy=ch\*0\.25-dh\*0\.242;/);
  assert.match(html, /\.game-stage\.patient-shoulder-hud \.prompt-zone\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.patient-shoulder-hud \.level4-selected-arm,[\s\S]*?\.level4-calib-hint,[\s\S]*?\.level4-calib details\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.patient-shoulder-hud \.level4-reading b,[\s\S]*?font-size:44px;/);
});

test('public cards and mahjong use a vertical quarter-screen affected-side zone', () => {
  assert.match(html, /const w = largePublicCardZone \? cw \* 0\.25/);
  assert.match(html, /const h = largePublicCardZone \? ch \* 0\.70/);
  assert.match(html, /largePublicCardZone \? 0\.875/);
  assert.match(html, /largePublicCardZone \? 0\.125/);
  assert.match(html, /patientLarge \? gw \+ 22/);
  assert.match(html, /patientCards \? cardW\*1\.18/);
  assert.match(html, /affectedSideSign\(\)>0\?\.37:\.63/);
});

test('public advanced grasp timings are easier while research timings remain unchanged', () => {
  assert.match(html, /const GRASP_ARM_MS = 420;/);
  assert.match(html, /const GRASP_HOLD_MS = 480;/);
  assert.match(html, /const RELEASE_HOLD_MS = 1000;/);
  assert.match(html, /const PUBLIC_GRASP_ARM_MS = 100;/);
  assert.match(html, /const PUBLIC_GRASP_HOLD_MS = 120;/);
  assert.match(html, /const PUBLIC_RELEASE_HOLD_MS = 220;/);
  assert.match(html, /return isPatientVisualCueMode\(\) \? PUBLIC_GRASP_ARM_MS : GRASP_ARM_MS/);
});

test('advanced interaction ignores stale frames and tolerates brief contact loss', () => {
  const pickerStart = html.indexOf('const picker = {');
  const carrierStart = html.indexOf('const carrier = {');
  const picker = html.slice(pickerStart, carrierStart);
  const carrier = html.slice(carrierStart, html.indexOf('/* ==================================================================', carrierStart));
  assert.match(picker, /if\(detectionHeldGrace\)/);
  assert.match(carrier, /if\(detectionHeldGrace\)/);
  assert.match(carrier, /contactId:null, contactUntil:0/);
  assert.match(carrier, /now \+ advancedContactGraceMs\(\)/);
  assert.match(html, /const PUBLIC_ADV_CONTACT_GRACE_MS = 700;/);
});

test('advanced drops accept held-object overlap instead of cursor-centre-only containment', () => {
  assert.match(html, /function heldItemTouchesZone\(item, zone, margin=0\)/);
  assert.match(html, /heldItemTouchesZone\(held, releaseZone\)/);
  assert.match(html, /heldItemTouchesZone\(carriedItem, zz\)/);
  assert.match(html, /const bothReopened = nearRatio >= t\.nearExit && farRatio >= t\.farExit;/);
});
