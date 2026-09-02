import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v67 bedside usability regression tests, derived from the 26–28 Aug 2026
// inpatient recordings:
//   1. Level 2 permanent "keep body centred" pause after a small seat shift.
//   2. Level 3/4 repetitions frozen at "slowly return to 0°" when the oblique
//      camera never reports the resting arm below the absolute window.
//   3. Level 6 tripod-pinch calibration never completing because closing the
//      hand momentarily drops the hand landmarker.
//   4. Level 6 release nearly impossible for an asymmetric hemiplegic hand.

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const publicSource=readFileSync(path.join(root,'index.html'),'utf8');

/* ---------------- Level 2: torso gate recovery ---------------- */

const {createController:createLevel2}=require('../level2-horizontal-abduction-controller.js');

function level2Pose(side='right',kind='midline',options={}){
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
  }
  return lm;
}
function level2Admit(controller,side,kind,generation,options){
  return controller.update({landmarks:level2Pose(side,kind,options),affectedSide:side,generation});
}
function level2Calibrate(controller,side='right',start=1,options){
  let state;
  for(let generation=start;generation<start+5;generation++){
    state=level2Admit(controller,side,'midline',generation,options);
  }
  assert.equal(state.calibrated,true);
  return start+5;
}

test('v67 Level 2: a sustained seat shift at midline re-baselines instead of pausing forever',()=>{
  const controller=createLevel2();
  let generation=level2Calibrate(controller);
  // Large sustained trunk translation, wrist resting at (new) midline.
  let state;
  for(let count=0;count<74;count++){
    state=level2Admit(controller,'right','midline',generation++,{trunkShift:.08});
    assert.equal(state.valid,false);
    assert.equal(state.reason,'torso-translation');
  }
  // The 75th consecutive frame triggers the midline re-baseline path.
  state=level2Admit(controller,'right','midline',generation++,{trunkShift:.08});
  assert.equal(state.reason,'hold-at-midline');
  assert.equal(state.calibrated,false);
  // The normal calibration path then re-acquires the new seated position...
  for(let count=0;count<5;count++){
    state=level2Admit(controller,'right','midline',generation++,{trunkShift:.08});
  }
  assert.equal(state.calibrated,true);
  // ...and the outward slide scores again from the new baseline.
  for(let count=0;count<8;count++){
    state=level2Admit(controller,'right','outward',generation++,{trunkShift:.08});
  }
  assert.equal(state.valid,true);
  assert.equal(state.targetHits,1);
});

test('v67 Level 2: slow postural drift at midline is absorbed without unlocking mid-repetition checks',()=>{
  const controller=createLevel2();
  let generation=level2Calibrate(controller);
  let state;
  // Drift outward in small steps, each within the per-frame gate, letting the
  // baseline adapt. The final offset would exceed the gate from the ORIGINAL
  // baseline, so passing proves the baseline adapted.
  for(const shift of [.01,.02,.03,.04,.05,.06]){
    for(let count=0;count<25;count++){
      state=level2Admit(controller,'right','midline',generation++,{trunkShift:shift});
      assert.equal(state.valid,true,`drift step ${shift} frame ${count} should stay valid`);
    }
  }
  for(let count=0;count<8;count++){
    state=level2Admit(controller,'right','outward',generation++,{trunkShift:.06});
  }
  assert.equal(state.valid,true);
  assert.equal(state.targetHits,1);
});

/* ---------------- Level 3/4: adaptive return floor ---------------- */

const shoulderApi=require(path.join(root,'shoulder-flexion-controller.js'));

function flexPose(angle,{side='right',trunkDx=0}={}){
  const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.05}));
  const left=side==='left';
  const si=left?11:12,ei=left?13:14,wi=left?15:16,oi=left?12:11;
  const shoulder={x:.50+trunkDx,y:.30,visibility:1};
  const rad=angle*Math.PI/180;
  lm[si]=shoulder;
  lm[ei]={x:shoulder.x+.20*Math.sin(rad),y:shoulder.y+.20*Math.cos(rad),visibility:1};
  lm[wi]={x:shoulder.x+.38*Math.sin(rad),y:shoulder.y+.38*Math.cos(rad),visibility:1};
  lm[oi]={x:.68+trunkDx,y:.30,visibility:1};
  lm[left?23:24]={x:shoulder.x,y:.72,visibility:1};
  lm[left?24:23]={x:.68+trunkDx,y:.72,visibility:1};
  return lm;
}
function flexFeed(controller,angle,start,frames=1){
  let snap;
  for(let i=0;i<frames;i++){
    const generation=start+i;
    snap=controller.update({lm:flexPose(angle),side:'right',imageAspect:1,
      frameFresh:true,frameGeneration:generation,
      frame:{fresh:true,generation,ageMs:10,reason:'fresh-decoded-frame'}});
  }
  return snap;
}
function rawForEstimated(estimated,baseline=25){
  return baseline+estimated*(180-baseline)/180;
}

test('v67 Level 3/4: a repetition completes at the participant\'s own observed floor',()=>{
  const c=shoulderApi.createController({level:'4',smoothAlpha:1});
  c.setTarget(120,'4');
  let snap=flexFeed(c,25,1,14);
  assert.equal(snap.gameReady,true);
  // Acquire the start near zero, then reach the 120° target.
  snap=flexFeed(c,rawForEstimated(0),20,3);
  snap=flexFeed(c,rawForEstimated(120),30,4);
  assert.equal(snap.phase,'await-return');
  assert.equal(snap.repetitions,0);
  // The bedside camera never reads below ~35°. Descend and settle there.
  snap=flexFeed(c,rawForEstimated(60),40,2);
  assert.equal(snap.repetitions,0,'60° is above the relative cap and must not count');
  snap=flexFeed(c,rawForEstimated(35),50,4);
  assert.equal(snap.repetitions,1,'settling at the observed floor below the cap counts the repetition');
  // Resting at the floor re-arms the next repetition, then a second full
  // cycle also works from the elevated floor.
  snap=flexFeed(c,rawForEstimated(35),55,4);
  snap=flexFeed(c,rawForEstimated(120),60,4);
  assert.equal(snap.phase,'await-return');
  snap=flexFeed(c,rawForEstimated(38),70,5);
  assert.equal(snap.repetitions,2);
});

test('v67 Level 3/4: hovering high above the relative cap never scores a return',()=>{
  const c=shoulderApi.createController({level:'4',smoothAlpha:1});
  c.setTarget(120,'4');
  flexFeed(c,25,1,14);
  flexFeed(c,rawForEstimated(0),20,3);
  let snap=flexFeed(c,rawForEstimated(120),30,4);
  assert.equal(snap.phase,'await-return');
  // 45% of 120° = 54°. Hovering at 70° must never count, however long.
  snap=flexFeed(c,rawForEstimated(70),40,30);
  assert.equal(snap.repetitions,0);
  assert.equal(snap.phase,'await-return');
});

test('v67 Level 3/4: the near-zero absolute return window still works unchanged',()=>{
  const c=shoulderApi.createController({level:'3',smoothAlpha:1});
  c.setTarget(50,'3');
  flexFeed(c,25,1,14);
  flexFeed(c,rawForEstimated(0),20,3);
  let snap=flexFeed(c,rawForEstimated(50),30,3);
  snap=flexFeed(c,rawForEstimated(0),40,3);
  assert.equal(snap.repetitions,1);
});

/* ---------------- Level 6: calibration and release (source contracts) ---------------- */

test('v67 Level 6 calibration: brief landmark dropouts do not reset stage progress',()=>{
  assert.match(publicSource,/const CALIB_DROPOUT_GRACE_MS = 1500/);
  assert.match(publicSource,/lostForMs > CALIB_DROPOUT_GRACE_MS/);
  assert.match(publicSource,/c\.lastSeenAt = now/);
});

test('v67 Level 6 calibration: light-close evidence accumulates instead of demanding one unbroken hold',()=>{
  assert.match(publicSource,/c\.closedHoldMs\s*=\s*\(c\.closedHoldMs \|\| 0\)\s*\+\s*delta/);
  assert.match(publicSource,/Math\.min\(120, now - previousTick\)/);
  assert.match(publicSource,/const requiredClosedHoldMs = isLevel6RealToolTask\(\) \? 280 : 450/);
  assert.match(publicSource,/const requiredClosedSamples = isLevel6RealToolTask\(\) \? 6 : 10/);
  // Only a clear reopen restarts the evidence.
  assert.match(publicSource,/if\(clearlyOpenAgain\) c\.closedHoldMs = 0/);
});

test('v67 Level 6 calibration: checklist items render a visible tick when done',()=>{
  assert.match(publicSource,/function renderCalibCheck\(id, done\)/);
  assert.match(publicSource,/\(done \? '✓ ' : '○ '\) \+ label/);
  assert.match(publicSource,/renderCalibCheck\('calibCloseCheck', c\.closedDone\)/);
});

test('v67 Level 6 release: asymmetric reopen path exists and still needs both digits to move',()=>{
  assert.match(publicSource,/const midReopen = \(enter \+ exit\) \/ 2/);
  assert.match(publicSource,/\(farRatio >= open && nearRatio >= midReopen\)/);
  assert.match(publicSource,/\(farRatio > open && nearRatio >= exit\)/);
  // Symmetric paths are retained.
  assert.match(publicSource,/indexRatio >= exit && middleRatio >= exit/);
  assert.match(publicSource,/indexRatio > open && middleRatio > open/);
});

test('v67 Level 6 release: personal thresholds keep hysteresis ordering with an attainable reopen',()=>{
  assert.match(publicSource,/personalPinchEnter = closedMean \+ gap \* 0\.56/);
  assert.match(publicSource,/personalPinchExit = closedMean \+ gap \* 0\.70/);
  assert.match(publicSource,/closedMean \+ gap \* 0\.80/);
  // The hold-time and release-difficulty safety nets stay in place.
  assert.match(publicSource,/const MAX_HOLD_MS = 5000/);
  assert.match(publicSource,/RELEASE_DIFFICULTY_LIMIT = 3/);
});
