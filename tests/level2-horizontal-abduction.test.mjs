import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {createController}=require('../level2-horizontal-abduction-controller.js');
const html=readFileSync(path.join(root,'index.html'),'utf8');

function pose(side='right',kind='midline',options={}){
  const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.05}));
  const shift=options.trunkShift||0;
  lm[11]={x:.4+shift,y:.3,visibility:1};
  lm[12]={x:.6+shift,y:.3,visibility:1};
  lm[23]={x:.42+shift,y:.72,visibility:1};
  lm[24]={x:.58+shift,y:.72,visibility:1};
  lm[13]={x:.47+shift,y:.52,visibility:1};
  lm[14]={x:.53+shift,y:.52,visibility:1};
  lm[15]={x:.5+shift,y:.68,visibility:1};
  lm[16]={x:.5+shift,y:.68,visibility:1};
  const elbow=side==='left'?13:14;
  const wrist=side==='left'?15:16;
  const direction=side==='left'?-1:1;
  if(kind==='outward'){
    lm[elbow].x=.5+shift+direction*.11;
    lm[wrist].x=.5+shift+direction*.18;
  }else if(kind==='wrist-only'){
    lm[wrist].x=.5+shift+direction*.18;
  }else if(kind==='elbow-only'){
    lm[elbow].x=.5+shift+direction*.18;
  }else if(kind==='opposite-outward'){
    const otherElbow=side==='left'?14:13;
    const otherWrist=side==='left'?16:15;
    lm[otherElbow].x=.5+shift-direction*.11;
    lm[otherWrist].x=.5+shift-direction*.18;
  }
  for(const index of options.missing||[]) lm[index]={x:NaN,y:NaN,visibility:0};
  return lm;
}
function admit(controller,side,kind,generation,options){
  return controller.update({landmarks:pose(side,kind,options),affectedSide:side,generation});
}
function calibrate(controller,side='right',start=1){
  let state;
  for(let generation=start;generation<start+5;generation++){
    state=admit(controller,side,'midline',generation);
  }
  assert.equal(state.calibrated,true);
  return start+5;
}
function reach(controller,side,generation,frames=8){
  let state;
  for(let count=0;count<frames;count++) state=admit(controller,side,'outward',generation++);
  return {state,generation};
}
function withHipShift(landmarks,shift){
  const next=landmarks.map(point=>({...point}));
  next[23].x+=shift;
  next[24].x+=shift;
  return next;
}

test('Level 2 exposes exactly one fail-closed tabletop horizontal-abduction game',()=>{
  assert.match(html,/if\(level === '2'\) return themeId === 'bilateral'/);
  assert.match(html,/if\(level === '2'\)\{\s*return \['bilateral'\]/);
  assert.match(html,/level4SessionThemes:\['bilateral'\]/);
  assert.match(html,/患臂桌面承托｜由中線向患側外滑，再返回/);
  assert.doesNotMatch(html,/level4SessionThemes:\[[^\]]*(mahjongwash|wipewindow|bowling|buspay)/);
});

test('Level 2 guide, object and target share one horizontal affected-side lane',()=>{
  const guide=html.slice(html.indexOf('function level2HorizontalWipeLane'),html.indexOf('// The shared Level 4 reach signal'));
  assert.match(guide,/startX = cw \* 0\.50/);
  assert.match(guide,/endX = startX \+ affectedSideSign\(\) \* cw \* 0\.29/);
  assert.match(guide,/moveTo\(arrowStartX, lane\.y\)/);
  assert.match(guide,/lineTo\(arrowTipX, lane\.y\)/);
  assert.match(guide,/arrowTipX \+ direction \* 20, lane\.y/);
  const setupStart=html.indexOf('function setupTargets');
  const targetBranch=html.slice(setupStart,html.indexOf('if(isShoulderFlexionLevel())',setupStart));
  assert.match(targetBranch,/const lane = level2HorizontalWipeLane\(cw, ch\)/);
  assert.match(targetBranch,/x:lane\.endX, y:lane\.y/);
  const gameBranch=html.slice(html.indexOf('function updateLevel2LateralGame'),html.indexOf('\/\* Levels 3–4 are shoulder-flexion'));
  assert.match(gameBranch,/item\.x=lane\.startX\+\(lane\.endX-lane\.startX\)\*clamp01/);
  assert.match(gameBranch,/item\.y=lane\.y/);
});

test('left and right affected arms produce symmetric normalized progress',()=>{
  const right=createController();
  const left=createController();
  let rightGeneration=calibrate(right,'right');
  let leftGeneration=calibrate(left,'left');
  const rightState=reach(right,'right',rightGeneration,4).state;
  const leftState=reach(left,'left',leftGeneration,4).state;
  assert.ok(rightState.progress>.84);
  assert.ok(Math.abs(rightState.progress-leftState.progress)<1e-12);
});

test('body-size and camera framing scale do not change normalized progress',()=>{
  const full=createController();
  const small=createController();
  const scalePose=landmarks=>landmarks.map(point=>({
    ...point,
    x:.5+(point.x-.5)*.55,
    y:.5+(point.y-.5)*.55,
  }));
  let fullState,smallState;
  for(let generation=1;generation<=5;generation++){
    fullState=full.update({landmarks:pose('right','midline'),affectedSide:'right',generation});
    smallState=small.update({landmarks:scalePose(pose('right','midline')),affectedSide:'right',generation});
  }
  for(let generation=6;generation<=9;generation++){
    fullState=full.update({landmarks:pose('right','outward'),affectedSide:'right',generation});
    smallState=small.update({landmarks:scalePose(pose('right','outward')),affectedSide:'right',generation});
  }
  assert.ok(Math.abs(fullState.progress-smallState.progress)<1e-12);
});

test('display mirror input cannot alter anatomical selection or progress',()=>{
  const a=createController();
  const b=createController();
  let generationA=calibrate(a,'right');
  let generationB=calibrate(b,'right');
  let stateA,stateB;
  for(let count=0;count<4;count++){
    stateA=a.update({landmarks:pose('right','outward'),affectedSide:'right',generation:generationA++,mirrorX:false});
    stateB=b.update({landmarks:pose('right','outward'),affectedSide:'right',generation:generationB++,mirrorX:true});
  }
  assert.equal(stateA.progress,stateB.progress);
  assert.equal(stateA.targetHits,stateB.targetHits);
});

test('torso translation is rejected even though relative wrist geometry is unchanged',()=>{
  const controller=createController();
  const generation=calibrate(controller);
  const state=admit(controller,'right','outward',generation,{trunkShift:.08});
  assert.equal(state.valid,false);
  assert.equal(state.reason,'torso-translation');
  assert.equal(state.targetHits,0);
});

test('an arm away from midline cannot silently bias baseline calibration',()=>{
  const controller=createController();
  let state;
  for(let generation=1;generation<=5;generation++){
    state=admit(controller,'right','outward',generation);
    assert.equal(state.calibrated,false);
    assert.equal(state.reason,'not-at-midline');
    assert.equal(state.baselineSamples.length,0);
  }
  for(let generation=6;generation<=10;generation++){
    state=admit(controller,'right','midline',generation);
  }
  assert.equal(state.calibrated,true);
  assert.equal(state.reason,'ready');
  const result=reach(controller,'right',11);
  assert.equal(result.state.targetHits,1);
});

test('small recording-like torso sway near full outward reach does not block a true endpoint',()=>{
  const controller=createController();
  let generation=calibrate(controller);
  let state;
  for(let count=0;count<8;count++){
    state=controller.update({
      landmarks:withHipShift(pose('right','outward'),.03),
      affectedSide:'right',
      generation:generation++,
    });
  }
  assert.equal(state.valid,true);
  assert.equal(state.targetHits,1);
  assert.equal(state.phase,'return');
});

test('genuine large sustained trunk lean still fails closed',()=>{
  const controller=createController();
  const generation=calibrate(controller);
  const state=controller.update({
    landmarks:withHipShift(pose('right','outward'),.09),
    affectedSide:'right',
    generation,
  });
  assert.equal(state.valid,false);
  assert.equal(state.reason,'torso-lean');
  assert.equal(state.targetHits,0);
});

test('video-shaped flow recovers from a wrong start, calibrates at midline and scores with natural sway',()=>{
  const controller=createController();
  let generation=1;
  let state;
  for(let count=0;count<4;count++){
    state=admit(controller,'right','outward',generation++);
  }
  assert.equal(state.calibrated,false);
  assert.equal(state.reason,'not-at-midline');
  for(let count=0;count<5;count++){
    state=admit(controller,'right','midline',generation++);
  }
  assert.equal(state.calibrated,true);
  for(let count=0;count<8;count++){
    state=controller.update({
      landmarks:withHipShift(pose('right','outward'),.03),
      affectedSide:'right',
      generation:generation++,
    });
  }
  assert.equal(state.valid,true);
  assert.equal(state.targetHits,1);
});

test('recording-like supported slide is not blocked when elbow image displacement is small',()=>{
  const controller=createController();
  let generation=calibrate(controller);
  let state;
  for(let count=0;count<8;count++){
    state=admit(controller,'right','wrist-only',generation++);
  }
  assert.equal(state.valid,true);
  assert.equal(state.targetHits,1);
  assert.equal(state.phase,'return');
});

test('elbow-only movement cannot move the game object or score',()=>{
  const controller=createController();
  const generation=calibrate(controller);
  const before=controller.snapshot();
  const state=admit(controller,'right','elbow-only',generation);
  assert.equal(state.valid,true);
  assert.equal(state.progress,before.progress);
  assert.equal(state.targetHits,0);
});

test('only the selected affected arm can move progress',()=>{
  const controller=createController();
  const generation=calibrate(controller,'right');
  const state=admit(controller,'right','opposite-outward',generation);
  assert.equal(state.progress,0);
  assert.equal(state.targetHits,0);
});

test('missing selected arm or torso landmarks fail closed',()=>{
  for(const index of [12,14,16,11,23,24]){
    const controller=createController();
    const generation=calibrate(controller);
    const state=controller.update({
      landmarks:pose('right','outward',{missing:[index]}),
      affectedSide:'right',
      generation,
    });
    assert.equal(state.valid,false,String(index));
    assert.match(state.reason,/^missing-/,String(index));
    assert.equal(state.targetHits,0,String(index));
  }
});

test('duplicate, stale and out-of-order generations are idempotent',()=>{
  const controller=createController();
  let generation=calibrate(controller);
  const first=admit(controller,'right','outward',generation++);
  const duplicate=admit(controller,'right','outward',generation-1);
  const older=admit(controller,'right','outward',generation-2);
  assert.equal(duplicate.progress,first.progress);
  assert.equal(duplicate.reason,'duplicate-generation');
  assert.equal(older.progress,first.progress);
  assert.equal(older.reason,'out-of-order-generation');
});

test('outward endpoint scores once and return to midline rearms',()=>{
  const controller=createController();
  let generation=calibrate(controller);
  let result=reach(controller,'right',generation);
  generation=result.generation;
  assert.equal(result.state.targetHits,1);
  assert.equal(result.state.phase,'return');
  result=reach(controller,'right',generation,10);
  generation=result.generation;
  assert.equal(result.state.targetHits,1,'holding outward cannot repeat');
  let state;
  for(let count=0;count<8;count++) state=admit(controller,'right','midline',generation++);
  assert.equal(state.phase,'outward');
  result=reach(controller,'right',generation);
  assert.equal(result.state.targetHits,2);
});

test('patient display smoothing does not block a genuine fresh-frame midline rearm',()=>{
  const controller=createController();
  let generation=calibrate(controller);
  let state;
  for(let count=0;count<8;count++){
    state=controller.update({
      landmarks:pose('right','outward'),
      affectedSide:'right',
      patientAssist:true,
      generation:generation++,
    });
  }
  assert.equal(state.targetHits,1);
  assert.equal(state.phase,'return');
  for(let count=0;count<8;count++){
    state=controller.update({
      landmarks:pose('right','midline'),
      affectedSide:'right',
      patientAssist:true,
      generation:generation++,
    });
  }
  assert.equal(state.instantProgress,0);
  assert.ok(state.progress>.20,'display position intentionally remains smoothed');
  assert.equal(state.phase,'outward','measured midline return rearms after fresh endpoint frames');
});

test('Level 2 runtime has no second-hand, grasp, pickup, forward, circle, or elbow-calibration dependency',()=>{
  const branch=html.slice(html.indexOf('function updateLevel2LateralGame'),html.indexOf('/* Levels 3–4 are shoulder-flexion'));
  assert.doesNotMatch(branch,/grabCount\+\+|isGrasping\s*===\s*true|dwellStartTime\s*>|level4Reach|elbowAngle|circle|forward|pickup/i);
  assert.match(html,/usesLegacyLevel4Reach\(\)\s*\?\s*updateLevel4ReachController/);
  assert.match(html,/const active = \(usesLegacyLevel4Reach\(\) \|\| isShoulderFlexionLevel\(\)\)/);
  assert.match(html,/usesLegacyLevel4Reach\(\) && level4Reach && !level4Reach\.calibrated/);
});
