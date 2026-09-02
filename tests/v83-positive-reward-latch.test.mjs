import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');

test('v83 marker and shared Level 3–4 reward latch are present',()=>{
  assert.match(html,/v86-20260902-large-baskets-no-dimsum-overlap/);
  assert.match(html,/const SHOULDER_REWARD_MIN_MS = 2600/);
  assert.match(html,/const SHOULDER_PHOTO_REWARD_MS = 3200/);
  assert.match(html,/const shoulderRewardCycle = \{/);
  assert.match(html,/const visualProgress=shoulderRewardCycle\.active\s*\?\s*1/);
});

test('every Level 3–4 theme is covered by the shared latched update path',()=>{
  assert.match(html,/return \['bowlinglane','basketball','tsuenwan','dimsum','laundry','cards','mahjong'\];/);
  assert.match(html,/function updateShoulderFlexionGame\(\)\{/);
  assert.match(html,/startShoulderRewardCycle\(\)/);
  assert.match(html,/finishShoulderRewardCycle\(\)/);
});

test('successful visuals finish before the next repetition is reset',()=>{
  const updateStart=html.indexOf('function updateShoulderFlexionGame(){');
  const updateEnd=html.indexOf('\nfunction ',updateStart+10);
  const update=html.slice(updateStart,updateEnd);
  assert.match(update,/shoulderRewardCycle\.repetitionReady=true/);
  assert.doesNotMatch(update,/advanceLevel3RoundVariant\(\);[\s\S]{0,120}resetBowlingStrike\(\)/);
  const finishStart=html.indexOf('function finishShoulderRewardCycle(){');
  const finishEnd=html.indexOf('\nlet shoulderHoldSpokenSecond',finishStart);
  const finish=html.slice(finishStart,finishEnd);
  assert.match(finish,/shoulderRewardCycle\.repetitionReady/);
  assert.match(finish,/shoulderRewardVisualFinished\(\)/);
  assert.match(finish,/advanceLevel3RoundVariant\(\)/);
});

test('bowling pins stay down and special animations cannot rewind with the arm',()=>{
  const bowlingStart=html.indexOf('function updateBowlingStrike(){');
  const bowlingEnd=html.indexOf('\nfunction bowlingLaneGeometry',bowlingStart);
  const bowling=html.slice(bowlingStart,bowlingEnd);
  assert.match(bowling,/phase==='impact'[\s\S]*?phase='down'/);
  assert.doesNotMatch(bowling,/resetBowlingStrike\(\)/);
  assert.match(html,/if\(state\.theme==='basketball'\)startBasketballShot\(\)/);
  assert.match(html,/if\(isTeahouseDimsumMode\(\)\)startTeahouseServe\(\)/);
  assert.match(html,/BBALL_FLY_MS\+BBALL_DROP_MS\+900/);
  assert.match(html,/TEAHOUSE_FLY_MS\+TEAHOUSE_STEAM_MS\+900/);
});

test('patient is invited to rest while watching the completed reward',()=>{
  assert.match(html,/好！可以放低休息 · 睇埋動畫/);
  assert.match(html,/The patient's early return[\s\S]{0,160}successful strike/);
});
