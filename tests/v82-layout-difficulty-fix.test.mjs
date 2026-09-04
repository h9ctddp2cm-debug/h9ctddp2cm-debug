import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');

test('release markers are aligned across the source release files',()=>{
  const version='v101-20260904-level56-fridge-laundry-cards';
  assert.match(html,new RegExp(version));
  assert.match(readFileSync(path.join(root,'service-worker.js'),'utf8'),new RegExp(version));
  assert.match(readFileSync(path.join(root,'manifest.webmanifest'),'utf8'),new RegExp(version));
});

test('bowling rack is lowered while keeping the enlarged v81 pins',()=>{
  assert.match(html,/const pinBaseY=ch\*0\.390;/);
  assert.match(html,/const ph=g\.topH\*0\.45,pwid=ph\*0\.3125;/);
});

test('photo puzzle uses one shared rectangular geometry for hole, crop and piece',()=>{
  assert.match(html,/function tsuenWanPuzzleGeometry\(t\)/);
  assert.match(html,/const holeW=w\*\.32,holeH=h\*\.38;/);
  assert.match(html,/pieceSx:sx\+\(holeX-x\)\/w\*sw/);
  assert.match(html,/const w=g\?g\.holeW:size\*1\.46,h=g\?g\.holeH:size\*\.92;/);
  assert.match(html,/ctx\.strokeRect\(x-w\/2,y-h\/2,w,h\)/);
  assert.match(html,/top=g\.holeY\+g\.holeH\/2;/);
});

test('fridge has an upper target and a lower pickup lane (v101: 33%/26% lane, 2x tray food + label inside lane)',()=>{
  assert.match(html,/const th = ch\*\(1 - fridgeLaneFrac\(cw, ch\)\);/);
  assert.match(html,/function fridgeLaneFrac\(cw, ch\)\{ return ch > cw \? 0\.26 : 0\.33; \}/);
  assert.match(html,/y:laneTop \+ 8 \+ vr,/);
  assert.match(html,/visualR:isFridgeGame\(\) \? fridgeTrayVisualRadius\(cw, ch, r\) : r/);
  assert.match(html,/isFridgeGame\(\) \? 210 : \(isPublicLevel5DimsumLayout\(\) \? 150 : 100\)/);
  assert.match(html,/isFridgeGame\(\)\?250:150/);
});

test('therapist can select basic or preserved complex chopsticks gameplay',()=>{
  assert.match(html,/id="dimsumDifficultyCard"/);
  assert.match(html,/data-dimsum-difficulty="basic"[\s\S]{0,160}任何點心/);
  assert.match(html,/data-dimsum-difficulty="complex"[\s\S]{0,180}保留原有玩法/);
  assert.match(html,/dimsumDifficulty: 'basic'/);
  assert.match(html,/return isDimsumBowlGame\(\) && state\.dimsumDifficulty === 'complex';/);
  assert.match(html,/return isDimsumBowlGame\(\) && state\.dimsumDifficulty !== 'complex';/);
  assert.match(html,/isDimsumBasicGame\(\)[\s\S]{0,120}\?\s*!!\(item && DIMSUM_ORDER_MENU/);
});
