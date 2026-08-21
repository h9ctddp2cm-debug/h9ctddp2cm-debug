/* Regression coverage for decoded-frame admission. A browser RAF may run more
   than once for a single decoded camera image; no controller filter, path,
   dwell, transition or score may consume that image more than once. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { calibration, armAtAngle, capture } from './fixtures/level4-two-point-test-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleSource = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadGames(theme){
  let clock = 1000;
  const log = {scores:[], beeps:0};
  const runtime = {
    addScore(points, name, detail){ log.scores.push({points,name,detail}); },
    now(){ return clock; }, clamp01(v){ return Math.max(0, Math.min(1, v)); },
    roundedRect(){}, theme(){ return theme; },
    isBowling(){ return theme === 'bowling'; },
    isMahjongWash(){ return theme === 'mahjongwash'; },
    isBusPay(){ return theme === 'buspay'; },
    beepTap(){ log.beeps += 1; return true; },
    drawVerticalReachGuide(){}, cursor(){ return {detected:false,x:-1,y:-1}; },
  };
  const window = {__level4GameRuntime:runtime};
  vm.runInContext(moduleSource, vm.createContext({window, Math, Number, Object, Array, String, console}));
  return {qa:window.__level4MiniGamesQA, log, advance(ms){ clock += ms; }};
}
function motion(generation, overrides = {}){
  return Object.assign({
    calibrated:true, gameReady:true, newFrame:true, frameGeneration:generation,
    engaged:true, progress:.92, reachGate:true, returnReady:false,
    arcCalibrated:true, arcProgress:.7, arcActive:true,
  }, overrides);
}

test('four duplicate calls for one decoded generation leave the direct angle filter and progress unchanged', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const packet = generation => ({
    arm:armAtAngle(100), side:'right', imageAspect:1, frameFresh:true,
    frameGeneration:generation, frame:{fresh:true,generation,ageMs:18,source:'test',reason:'fresh'},
  });
  controller.update(packet(400));
  const admitted = controller.snapshot();
  for(let i=0; i<4; i++){
    // The changed pose is deliberately impossible for one decoded image. It
    // proves the controller ignores *all* duplicate-generation mutations.
    controller.update({...packet(400), arm:armAtAngle(61.5)});
  }
  const duplicate = controller.snapshot();
  assert.equal(admitted.newFrame, true);
  assert.equal(duplicate.newFrame, false);
  assert.equal(duplicate.rawAngle, admitted.rawAngle);
  assert.equal(duplicate.filteredAngle, admitted.filteredAngle);
  assert.equal(duplicate.filteredProgress, admitted.filteredProgress);
  assert.equal(duplicate.progress, admitted.progress);
  assert.equal(duplicate.arcProgress, admitted.arcProgress);
});

test('bus dwell and score consume one generation once, while four new generations satisfy the dwell', () => {
  const game = loadGames('buspay');
  const target = {x:.50,y:.43};
  game.qa.reset();
  for(let i=0; i<4; i++) game.qa.bus(motion(700), target.x, target.y);
  assert.equal(game.qa.state.bus.holdFrames, 1);
  assert.equal(game.qa.state.bus.hitCount, 0);
  assert.equal(game.log.scores.length, 0);
  for(const generation of [701,702,703]) game.qa.bus(motion(generation), target.x, target.y);
  assert.equal(game.qa.state.bus.hitCount, 1);
  assert.equal(game.log.scores.length, 1);
  assert.equal(game.log.beeps, 1);
});

test('stale or pose-lost admissions reset partial bus and mahjong path credit without endpoint-like game mutation', () => {
  const bus = loadGames('buspay');
  const target = {x:.50,y:.43};
  bus.qa.reset();
  bus.qa.bus(motion(801), target.x, target.y);
  bus.qa.bus(motion(802), target.x, target.y);
  assert.equal(bus.qa.state.bus.holdFrames, 2);
  bus.qa.bus(motion(803, {gameReady:false, newFrame:false}), target.x, target.y);
  assert.equal(bus.qa.state.bus.holdFrames, 0);
  bus.qa.bus(motion(804, {gameReady:false, newFrame:false}), target.x, target.y);
  assert.equal(bus.qa.state.bus.holdFrames, 0);
  assert.equal(bus.qa.state.bus.hitCount, 0);

  const mahjong = loadGames('mahjongwash');
  mahjong.qa.reset();
  mahjong.qa.mahjong(motion(810), .30, .40); // anchor
  mahjong.qa.mahjong(motion(811), .38, .40); // one valid path step
  const progress = mahjong.qa.state.mahjong.progress;
  assert.ok(progress > 0);
  mahjong.qa.mahjong(motion(812, {gameReady:false, newFrame:false}), .46, .40);
  assert.equal(mahjong.qa.state.mahjong.lastPoint, null);
  assert.equal(mahjong.qa.state.mahjong.progress, 0);
  mahjong.qa.mahjong(motion(813), .54, .40); // fresh point re-anchors only
  assert.equal(mahjong.qa.state.mahjong.progress, 0);
});

test('arc updates never change linear progress, and duplicate linear bowling calls do not duplicate a transition or score', () => {
  const controller = calibration.createController();
  capture(controller, 148.5, 61.5);
  const make = (generation, lateral) => ({
    arm:armAtAngle(61.5, lateral), side:'right', imageAspect:1, frameFresh:true,
    frameGeneration:generation, frame:{fresh:true,generation,ageMs:15,source:'test',reason:'fresh'},
  });
  controller.update(make(900, 0));
  const before = controller.snapshot().progress;
  controller.update(make(901, .18));
  assert.equal(controller.snapshot().progress, before);

  const bowling = loadGames('bowling');
  bowling.qa.reset();
  for(let i=0; i<4; i++) bowling.qa.bowling(motion(920, {arcActive:false, arcProgress:0}));
  assert.equal(bowling.qa.state.bowling.phase, 'return');
  assert.equal(bowling.qa.state.bowling.reversalFrames, 0);
  assert.equal(bowling.log.scores.length, 0);
  // A distinct fresh generation containing an actual return makes exactly one release.
  bowling.qa.bowling(motion(921, {progress:.82, arcActive:false, arcProgress:0}));
  assert.equal(bowling.qa.state.bowling.phase, 'rolling');
  for(let i=0; i<4; i++) bowling.qa.bowling(motion(921, {progress:.82, arcActive:false, arcProgress:0}));
  assert.equal(bowling.qa.state.bowling.phase, 'rolling');
  assert.equal(bowling.log.scores.length, 0);
});

test('runtime passes generation and newFrame to every Level 4 game, including dimsum dwell gating', () => {
  assert.match(html, /newFrame:level4Reach\.newFrame/);
  assert.match(html, /frameGeneration:level4Reach\.frame\?\.generation/);
  assert.match(html, /if\(!level4Reach\.newFrame\)\{\s*\/\/ Preserve a valid partial dwell/);
  assert.match(html, /if\(isLevel4BusPayGame\(\)\) updateLevel4BusPay\(level4Motion/);
  assert.match(html, /level4Wipe\.lastConsumedGeneration/);
  assert.match(moduleSource, /function level4AdmitGameGeneration/);
});
