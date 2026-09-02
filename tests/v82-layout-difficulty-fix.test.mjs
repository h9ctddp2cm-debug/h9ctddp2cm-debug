import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');

test('release markers are aligned across the source release files',()=>{
  const version='v87-20260902-level6-tool-sensitivity-clear-fist';
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

test('fridge has an upper 80 percent target and lower 20 percent pickup lane',()=>{
  assert.match(html,/const th = ch\*0\.80;/);
  assert.match(html,/y:Math\.min\(ch-visualR-18,ch\*0\.90\)/);
  assert.match(html,/visualR:isFridgeGame\(\) \? r \* 0\.50 : r/);
  assert.match(html,/isFridgeGame\(\)\?210:100/);
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
