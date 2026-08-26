import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');

function harness(theme) {
  let now = 0;
  const runtime = {
    clamp01:v=>Math.max(0,Math.min(1,Number(v)||0)), now:()=>now, theme:()=>theme,
    isBowling:()=>theme==='bowling', isMahjongWash:()=>theme==='mahjongwash', isBusPay:()=>theme==='buspay',
    addScore:()=>{}, mahjongClack:()=>true, beepTap:()=>true,
    drawCameraBackdrop:()=>false, roundedRect:()=>{}, drawVerticalReachGuide:()=>{}, cursor:()=>({detected:false}),
  };
  const window = { __level4GameRuntime:Object.freeze(runtime) };
  vm.runInNewContext(source, { window, Math, Object, Number, Array, Uint8Array, console });
  const motion = (generation, progress, extra={}) => ({
    calibrated:true, gameReady:true, newFrame:true, frameGeneration:generation,
    progress, engaged:progress>=.2, reachGate:progress>=.70, returnReady:progress<=.18,
    arcCalibrated:true, arcActive:(extra.abductionProgress||0)>=.12,
    arcProgress:extra.abductionProgress||0, abductionProgress:extra.abductionProgress||0,
    ...extra,
  });
  return { qa:window.__level4MiniGamesQA, motion, advance:ms=>{now+=ms;} };
}

function dimSumHarness() {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const start=html.indexOf('const level4DimSumCycle = {');
  const end=html.indexOf('function level4MarkFogPoint',start);
  const context=vm.createContext({isLevel4StandardTransportGame:()=>true});
  vm.runInContext(html.slice(start,end)+';globalThis.cycle=level4DimSumCycle;',context);
  return context.cycle;
}

function wipeHarness() {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const start=html.indexOf('const level4Wipe = {');
  const end=html.indexOf('function level4PosePointUsable',start);
  let now=0;
  const level4Reach={reachGate:false};
  const context=vm.createContext({
    Uint8Array, Math, Number,
    clamp01:v=>Math.max(0,Math.min(1,Number(v)||0)),
    nowMs:()=>now, level4Reach,
    isLevel4WipeGame:()=>true,
    level4PathGateOpen:motion=>motion?.pathReady===true,
    updateHUD:()=>{}, triggerFeedback:()=>{}, researchLog:()=>{}, adaptiveNoteTrial:()=>{},
    research:{active:false},
  });
  vm.runInContext(html.slice(start,end)+';globalThis.wipe=level4Wipe;globalThis.update=updateLevel4Wipe;',context);
  return {
    wipe:context.wipe,
    update(nx,ny,motion){ context.level4Reach.reachGate=!!motion.reachGate; context.update(nx,ny,motion); },
    advance(ms){now+=ms;},
  };
}

test('bowling is elbow-only: one forward throw, then a distinct flexed return before re-arm', () => {
  const h=harness('bowling'); const g=h.qa.state.bowling;
  h.qa.bowling(h.motion(1,0)); assert.equal(g.phase,'forward');
  h.qa.bowling(h.motion(2,.85,{abductionProgress:1})); assert.equal(g.phase,'rolling');
  const rollAt=g.rollStartedAt;
  h.qa.bowling(h.motion(2,.85,{abductionProgress:0})); assert.equal(g.rollStartedAt,rollAt,'duplicate generation cannot restart');
  h.qa.bowling({calibrated:true,gameReady:false,frameGeneration:3,newFrame:true}); assert.equal(g.phase,'rolling','stale/lost input does not undo a committed roll');
  g.phase='await-return';
  h.qa.bowling(h.motion(4,.85,{abductionProgress:1})); assert.equal(g.phase,'await-return','horizontal range cannot re-arm bowling');
  h.qa.bowling(h.motion(5,0)); assert.equal(g.phase,'forward','fresh flexed return re-arms bowling');
});

test('mahjong blocks clockwise wash until elbow forward phase, then admits only forward horizontal sweep', () => {
  const h=harness('mahjongwash'); const g=h.qa.state.mahjong;
  h.qa.mahjong(h.motion(1,0,{abductionProgress:.8}),.74,.84);
  assert.equal(g.phase,'forward'); assert.equal(g.progress,0,'early lateral movement cannot wash');
  h.qa.mahjong(h.motion(2,.85,{abductionProgress:.2}),.10,.40);
  assert.equal(g.phase,'sweep');
  h.qa.mahjong(h.motion(3,.85,{abductionProgress:.25}),.11,.40);
  h.qa.mahjong(h.motion(4,.85,{abductionProgress:.50}),.38,.40);
  assert.ok(g.progress>0 && g.clockwiseAngle>0,'left-to-right sweep advances clockwise wash');
  const before=g.progress;
  h.qa.mahjong(h.motion(4,.85,{abductionProgress:.8}),.70,.40);
  assert.equal(g.progress,before,'duplicate decoded generation cannot advance wash');
  h.qa.mahjong({calibrated:false,gameReady:false,newFrame:true,frameGeneration:5},.8,.4);
  assert.equal(g.progress,0,'pose loss clears uncommitted wash credit');
});

test('bus is ordered forward pay then horizontal return plus flexed return before another payment', () => {
  const h=harness('buspay'); const g=h.qa.state.bus;
  h.qa.bus(h.motion(1,0,{abductionProgress:1}),.9,.4); assert.equal(g.phase,'forward');
  h.qa.bus(h.motion(2,.85,{abductionProgress:.1}),.1,.43); assert.equal(g.phase,'pay');
  for(let i=3;i<=6;i++) h.qa.bus(h.motion(i,.85,{abductionProgress:.1}),.1,.43);
  assert.equal(g.hitCount,1); assert.equal(g.phase,'return-horizontal');
  h.qa.bus(h.motion(6,.85,{abductionProgress:1}),.9,.43); assert.equal(g.hitCount,1,'duplicate cannot repay');
  h.qa.bus(h.motion(7,.85,{abductionProgress:.9}),.82,.43); assert.equal(g.phase,'return-horizontal','extension alone cannot begin round two');
  h.qa.bus(h.motion(8,0,{abductionProgress:.9}),.82,.84); assert.equal(g.phase,'forward','horizontal return plus fresh flexed return re-arms');
});

test('dim sum is elbow-only and requires a distinct fresh flexed return between placements', () => {
  const cycle=dimSumHarness();
  const packet=(generation,progress)=>({
    calibrated:true,gameReady:true,newFrame:true,frameGeneration:generation,
    progress,
    reachGate:progress>=.7,returnReady:progress<=.18,
  });
  cycle.update(packet(1,0)); assert.equal(cycle.phase,'forward');
  cycle.update(packet(2,.9)); assert.equal(cycle.phase,'await-return');
  cycle.update(packet(2,0)); assert.equal(cycle.phase,'await-return','duplicate decoded generation cannot re-arm');
  cycle.update(packet(3,.9)); assert.equal(cycle.phase,'await-return','held extension cannot create a second placement');
  cycle.update({calibrated:false,gameReady:false,newFrame:true,frameGeneration:4});
  assert.equal(cycle.phase,'await-return','pose loss leaves a committed placement waiting for returned start');
  cycle.update(packet(5,0)); assert.equal(cycle.phase,'forward');
});

test('wipe blocks early lateral traces, accepts a left-to-right sweep only after forward reach, and requires return', () => {
  const h=wipeHarness(); const m=(generation,progress,extra={})=>({
    calibrated:true,gameReady:true,newFrame:true,frameGeneration:generation,
    progress,
    engaged:progress>=.2,reachGate:progress>=.7,returnReady:progress<=.18,
    abductionProgress:extra.abductionProgress||0,pathReady:extra.pathReady===true,
    arcCalibrated:true,arcActive:(extra.abductionProgress||0)>=.12,arcProgress:extra.abductionProgress||0,
  });
  h.update(.85,.40,m(1,.1,{abductionProgress:.9,pathReady:true}));
  assert.equal(h.wipe.phase,'forward'); assert.equal(h.wipe.cleaned,0,'early horizontal movement cannot clean');
  h.update(.10,.40,m(2,.9,{abductionProgress:.2,pathReady:true}));
  assert.equal(h.wipe.phase,'sweep');
  h.update(.10,.40,m(3,.9,{abductionProgress:.2,pathReady:true}));
  h.update(.22,.40,m(4,.9,{abductionProgress:.4,pathReady:true}));
  h.update(.34,.40,m(5,.9,{abductionProgress:.6,pathReady:true}));
  assert.ok(h.wipe.cleaned>0,'forward elbow reach followed by rightward sweep cleans');
  const credit=h.wipe.cleaned;
  h.update(.46,.40,m(5,.9,{abductionProgress:.9,pathReady:true}));
  assert.equal(h.wipe.cleaned,credit,'duplicate generation cannot advance the sweep');
  h.update(.26,.40,m(6,.9,{abductionProgress:.50,pathReady:true}));
  assert.equal(h.wipe.cleaned,credit,'a fresh right-to-left/reduced screen-X frame cannot clean');
  h.update(.42,.40,m(7,.9,{abductionProgress:.80,pathReady:true}));
  assert.ok(h.wipe.cleaned>credit,'a distinct fresh increasing screen-X generation still cleans');
  h.update(.40,.84,m(8,.05));
  assert.equal(h.wipe.phase,'forward','fresh flexed return closes the sweep before another repetition');
  h.update(.40,.84,{calibrated:false,gameReady:false,newFrame:true,frameGeneration:9});
  assert.equal(h.wipe.cleaned,0,'pose loss clears uncommitted wipe credit');
});
