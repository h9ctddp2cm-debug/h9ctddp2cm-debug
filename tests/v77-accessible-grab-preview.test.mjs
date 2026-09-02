import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('public canvas hand remains large while the duplicate right-side cue is removed', () => {
  assert.match(html, /const handEmoji = isGrasping \? '✊🏻' : '✋🏻';/);
  assert.match(html, /const closedHandSize=isLevel6\(\)[\s\S]{0,150}: Math\.max\(104,Math\.min\(124,/);
  assert.match(html, /const handSize=isGrasping \? closedHandSize : closedHandSize\*1\.5;/);
  assert.match(html, /ctx\.globalAlpha=isGrasping \? \(overlapsObject \? \.92 : \.98\)/);
  assert.match(html, /ctx\.globalAlpha=isGrasping \? \.98 : \.88/);
  assert.match(html, /\.game-stage\.public-clean-hud\.patient-simple-hud \.status-bar\{\s*display:none !important;/);
  assert.match(html, /if\(patientMode && !mustShowOpenArmPrompt\)\{[\s\S]{0,300}statusBar\.innerHTML = '';/);
  assert.match(html, /mustShowOpenArmPrompt[\s\S]{0,220}先張開筷子/);
});

test('Level 5 fist stays smaller than normal iPad pickup objects', () => {
  const canvasMin = 759;
  const fist = Math.max(104, Math.min(124, canvasMin * 0.16));
  const dimsumDiameter = 100 * 1.36 * 2;
  const laundryGarment = 210;
  const flower = 132;
  assert.ok(dimsumDiameter > fist);
  assert.ok(laundryGarment > fist);
  assert.ok(flower > fist);
});

test('Level 5 dim sum uses a tightly cropped sticky-rice image and easier pickup timing', () => {
  const lotusPng = readFileSync(path.join(root, 'img/lotusrice.png'));
  assert.equal(lotusPng.toString('ascii', 1, 4), 'PNG');
  assert.equal(lotusPng.readUInt32BE(16), 423);
  assert.equal(lotusPng.readUInt32BE(20), 378);
  assert.match(html, /const PREP_OPEN_MS = research\.active \? 220 : \(publicLevel5 \? 35 : 100\);/);
  assert.match(html, /const GRASP_HOLD_MS = research\.active \? 360 : \(publicLevel5 \? 45 : 120\);/);
  assert.match(html, /isPublicLevel5DimsumLayout\(\) \? 150 : 100/);
  assert.match(html, /const PUBLIC_LEVEL5_GRASP_ARM_MS = 70;/);
  assert.match(html, /const PUBLIC_LEVEL5_GRASP_HOLD_MS = 90;/);
});

test('public flower game accepts side releases and maps central reach across the planter', () => {
  assert.match(html, /id:'vase', x:vase\.x, y:vase\.y - vase\.h\*0\.30,/);
  assert.match(html, /w:vase\.w\*1\.16, h:vase\.h\*0\.82,/);
  assert.match(html, /\(cursorX - vase\.x\) \/ Math\.max\(1, vase\.w\*0\.30\)/);
  assert.match(html, /p\.x = vase\.x \+ dx \* vase\.w\*0\.43;/);
});

test('public Level 6 tool gestures reject conflicting cues and keep one stable cursor image', () => {
  assert.match(html, /const PUBLIC_LEVEL6_TOOL_GESTURE_CONFIRM_MS = 180;/);
  assert.match(html, /const decisiveFlexState=useChopstickFlex/);
  assert.match(html, /const releaseConfirmed=decisiveFlexState[\s\S]*?decisiveFlexState === 'open'/);
  assert.match(html, /const closeConfirmed=decisiveFlexState[\s\S]*?decisiveFlexState === 'closed'/);
  assert.match(html, /mode === 'pinch' && isLevel6RealToolTask\(\)/);

  const standardCursor = html.slice(
    html.indexOf('// 游標：Level 5–6 以大型膚色手勢'),
    html.indexOf('// Preserve the pre-v76 research grasp/pinch cursor exactly.'),
  );
  const advancedCursorStart = html.indexOf('function advDrawCursor(ctx, pct)');
  const advancedCursor = html.slice(
    advancedCursorStart,
    html.indexOf('// Preserve the pre-v76 research grasp/pinch cursor exactly.', advancedCursorStart),
  );
  for(const cursor of [standardCursor, advancedCursor]){
    assert.match(cursor, /if\(isLevel6\(\)\)\{/);
    assert.match(cursor, /drawPublicLevel6ClosedPinchCursor/);
    assert.doesNotMatch(cursor, /isLevel6\(\) && isGrasping/);
  }
});

test('public Level 5 requires a continuously open hand after every release before re-arming', () => {
  assert.match(html, /const PUBLIC_LEVEL5_POST_RELEASE_OPEN_MS = 650;/);
  assert.match(html, /return !research\.active && state\.level === '5' \? PUBLIC_LEVEL5_POST_RELEASE_OPEN_MS : 0;/);

  const standard = html.slice(
    html.indexOf('function updateGraspLogic()'),
    html.indexOf('/* ---------- 繪製 ---------- */'),
  );
  assert.match(standard, /if\(isGrasping \|\| !openPrep\) basicPostReleaseOpenStart = now;/);
  assert.match(standard, /if\(now - basicPostReleaseOpenStart < postReleaseOpenMs\)\{[\s\S]*?return;/);
  assert.equal(
    (standard.match(/basicPostReleaseOpenStart = level5PostReleaseOpenMs\(\) \? now : 0;/g) || []).length,
    2,
    'both matched-target and parked-item drops start the Level 5 open-hand lock',
  );

  const advanced = html.slice(
    html.indexOf('function level5PostReleaseOpenLocked('),
    html.indexOf('function advDrawBackdrop('),
  );
  assert.match(advanced, /if\(!handReleasedOrOpen\(\)\) controller\.postReleaseOpenStart = now;/);
  assert.match(advanced, /controller\.armed = false; controller\.openStart = 0;/);
  assert.equal(
    (advanced.match(/postReleaseOpenStart = level5PostReleaseOpenMs\(\) \? now : 0;/g) || []).length,
    2,
    'picker and carrier both start the Level 5 open-hand lock after release',
  );
  assert.equal(
    (advanced.match(/level5PostReleaseOpenLocked\(this, now\)/g) || []).length,
    2,
    'picker and carrier both enforce the lock before searching for another item',
  );
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
  assert.match(html, /Math\.min\(cw \* 0\.96, 1320\)/);
  assert.match(html, /Math\.min\(cw \* 0\.88, 980\)[\s\S]*?Math\.min\(cw \* 0\.92, 1220\)/);
  assert.match(html, /state\.theme === 'peg_laundry' \? 1\.70 : 1\.16/);
  assert.match(html, /\[\[0\.20,0\.66\],\[0\.80,0\.66\],\[0\.50,0\.88\]\]/);
  assert.match(html, /\[\[0\.18,0\.78\],\[0\.46,0\.78\],\[0\.72,0\.78\]\]/);
  assert.match(html, /if\(isLaundryRackGame\(\)\)\{[\s\S]*?const freeLaundrySlot=existingFoods\.every[\s\S]*?if\(freeLaundrySlot\) return createFood\(x, y\);/);
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
  assert.match(html, /\.calib-wrap\{[\s\S]*?width:min\(94vw,calc\(56dvh \* 4 \/ 3\)\); max-width:none; aspect-ratio:4\/3;/);
  assert.match(html, /#screen-calib\.active\{[\s\S]*?grid-template-columns:minmax\(0,2fr\) minmax\(270px,1fr\)/);
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

test('public photo game uses a large upper photo and a separate moving puzzle piece', () => {
  assert.match(html, /drawItem:\(ctx,x,y,r\)=>drawTsuenWanPuzzlePiece\(ctx,photo\.img,x,y,r\*1\.25\)/);
  assert.match(html, /style:photoLarge\?'photo-puzzle':style/);
  assert.match(html, /const tw=photoLarge\?Math\.min\(cw\*\.90,1080\)/);
  assert.match(html, /bottom=Math\.min\(ch-pieceHalf-24,ch\*\.84\)/);
  assert.match(html, /top=g\.holeY\+g\.holeH\/2/);
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
  assert.match(html, /const PUBLIC_LEVEL5_GRASP_ARM_MS = 70;/);
  assert.match(html, /const PUBLIC_LEVEL5_GRASP_HOLD_MS = 90;/);
  assert.match(html, /const PUBLIC_LEVEL6_GRASP_HOLD_MS = 80;/);
  assert.match(html, /const PUBLIC_RELEASE_HOLD_MS = 220;/);
  assert.match(html, /return !research\.active && state\.level === '5'[\s\S]*?PUBLIC_LEVEL5_GRASP_ARM_MS/);
  assert.match(html, /return isLevel6\(\) \? PUBLIC_LEVEL6_GRASP_HOLD_MS/);
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
