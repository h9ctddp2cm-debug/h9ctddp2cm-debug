import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'index.html'), 'utf8');

test('patient game HUD removes the small right-middle gesture emoji area', () => {
  assert.match(source, /\.game-stage\.public-clean-hud\.patient-simple-hud \.status-bar\{\s*display:none !important;\s*\}/);
  assert.match(source, /function setActionPrompt\(main, detail\)\{[\s\S]{0,1800}if\(patientMode\)\{[\s\S]{0,300}statusBar\.innerHTML = '';/);
});

test('voice coaching says 揸拳頭 near an ungrasped object and 打開隻手 near the target', () => {
  assert.match(source, /if\(phase === 'contact'\) return state\.level === '5' \? '揸拳頭' : '夾住';/);
  assert.match(source, /if\(state\.level === '5'\) return '打開隻手';/);
  assert.match(source, /const voiceMargin = isLaundryRackGame\(\) \? 260 : \(isFridgeGame\(\)\?250:150\);/);
  assert.match(source, /phase !== 'target' &&[\s\S]{0,100}PUBLIC_PATIENT_VOICE_COOLDOWN_MS/);
});

test('fridge is full width with smaller visuals and automatic clear arrangement', () => {
  assert.match(source, /const tw = cw;/);
  assert.match(source, /const th = ch\*0\.80;/);
  assert.match(source, /visualR:isFridgeGame\(\) \? r \* 0\.42 : r/);
  assert.match(source, /function fridgeArrangePlacedFoods\(rect\)/);
  assert.match(source, /fridgePlacedFoods\.push\([\s\S]{0,180}fridgeArrangePlacedFoods\(rect\)/);
});

test('laundry offers basic and complex modes with tremor-tolerant pickup', () => {
  assert.match(source, /id="laundryDifficultyCard"/);
  assert.match(source, /data-laundry-difficulty="basic"[\s\S]{0,180}基本/);
  assert.match(source, /data-laundry-difficulty="complex"[\s\S]{0,180}較複雜/);
  assert.match(source, /laundryDifficulty: 'basic'/);
  assert.match(source, /return isLaundryRackGame\(\) && state\.laundryDifficulty === 'complex';/);
  assert.match(source, /return isLaundryRackGame\(\) && state\.laundryDifficulty !== 'complex';/);
  assert.match(source, /rw \*= 1\.60;\s*rh \*= 1\.60;/);
  assert.match(source, /const pickupMargin = isLaundryRackGame\(\) \? 220 : \(isFridgeGame\(\)\?210:100\);/);
});

test('Tsuen Wan shoulder games use a large non-overlapping puzzle target', () => {
  assert.match(source, /function drawTsuenWanPuzzleTarget\(ctx,t\)/);
  assert.match(source, /function drawTsuenWanPuzzlePiece\(ctx,img,x,y,size\)/);
  assert.match(source, /function tsuenWanPuzzleGeometry\(t\)/);
  assert.match(source, /pieceSw:holeW\/w\*sw/);
  assert.match(source, /style:photoLarge\?'photo-puzzle':style/);
  assert.match(source, /const tw=photoLarge\?Math\.min\(cw\*\.90,1080\):/);
  assert.match(source, /state\.theme === 'tsuenwan' \? 4\.6 :/);
});

test('bowling pins are substantially larger than the previous layout', () => {
  assert.match(source, /const ph=g\.topH\*0\.45,pwid=ph\*0\.3125;/);
  assert.match(source, /const spread=g\.pw\*0\.145;/);
});
