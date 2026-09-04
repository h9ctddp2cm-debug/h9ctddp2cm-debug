import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const api=require(path.join(root,'shoulder-flexion-controller.js'));

function pose(angle,{side='right',hike=0,trunkDx=0,hipDx=0,missingSelected=false}={}){
  const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.05}));
  const left=side==='left';
  const si=left?11:12,ei=left?13:14,wi=left?15:16,oi=left?12:11;
  const shoulder={x:.50+trunkDx,y:.30-hike,visibility:missingSelected?0:1};
  const rad=angle*Math.PI/180;
  lm[si]=shoulder;
  lm[ei]={x:shoulder.x+.20*Math.sin(rad),y:shoulder.y+.20*Math.cos(rad),visibility:missingSelected?0:1};
  lm[wi]={x:shoulder.x+.38*Math.sin(rad),y:shoulder.y+.38*Math.cos(rad),visibility:missingSelected?0:1};
  lm[oi]={x:.68+trunkDx,y:.30,visibility:1};
  lm[left?23:24]={x:shoulder.x+hipDx,y:.72,visibility:1};
  lm[left?24:23]={x:.68+trunkDx+hipDx,y:.72,visibility:1};
  return lm;
}
function feed(controller,angle,start,frames=1,options={}){
  let snap;
  for(let i=0;i<frames;i++){
    const generation=options.generation ?? start+i;
    snap=controller.update({lm:pose(angle,options),side:options.side||'right',imageAspect:1,
      worldLm:Number.isFinite(options.worldAngle)?pose(options.worldAngle,options):undefined,
      frameFresh:options.fresh!==false,frameGeneration:generation,
      patientAssist:options.patientAssist===true,
      nowMs:Number.isFinite(options.nowMs)
        ? options.nowMs+i*(Number.isFinite(options.stepMs)?options.stepMs:33)
        : undefined,
      frame:{fresh:options.fresh!==false,generation,ageMs:options.fresh===false?900:10,
        reason:options.fresh===false?'frame-stale':'fresh-decoded-frame'}});
  }
  return snap;
}
function calibrate(level,target,options={}){
  const c=api.createController({level,...options});
  c.setTarget(target,level);
  const start=c.snapshot().selectedStartDeg;
  const ready=feed(c,25,1,14);
  return {c,ready,start};
}
function rawForEstimated(estimated,baseline=25){
  return baseline+estimated*(180-baseline)/180;
}
function acquireStart(controller,start,generation){
  return feed(controller,rawForEstimated(start),generation,3);
}

test('selected anatomical affected arm is invariant under mirror display',()=>{
  const lm=pose(40,{side:'left'});
  assert.equal(api.selectedArm(lm,'left').shoulder,lm[11]);
  assert.equal(api.selectedArm(lm,'left').elbow,lm[13]);
  assert.equal(api.selectedArm(lm,'left').wrist,lm[15]);
});

test('selected side locks on the first admitted frame and never changes',()=>{
  const c=api.createController({level:'3'});
  const right=feed(c,25,1,14,{side:'right'});
  assert.equal(right.side,'right');
  assert.equal(right.gameReady,true);
  const beforeProgress=right.progress;
  const mismatch=feed(c,80,30,1,{side:'left'});
  assert.equal(mismatch.side,'right');
  assert.equal(mismatch.reason,'selected-side-mismatch');
  assert.equal(mismatch.gameReady,false);
  assert.equal(mismatch.progress,beforeProgress);
});

test('shoulder angle uses trunk-to-upper-arm geometry: arm by side is 0 and forward elevation increases',()=>{
  assert.ok(Math.abs(api.shoulderFlexion2D(api.selectedArm(pose(0),'right'),1)-0)<1e-6);
  assert.ok(Math.abs(api.shoulderFlexion2D(api.selectedArm(pose(45),'right'),1)-45)<1e-6);
  assert.ok(Math.abs(api.shoulderFlexion2D(api.selectedArm(pose(75),'right'),1)-75)<1e-6);
});

test('Level 3 auto-starts hands-free from fixed zero',()=>{
  const {c,ready,start}=calibrate('3',50);
  assert.equal(ready.calibrated,true);
  assert.equal(ready.gameReady,true);
  assert.equal(ready.trainingMin,start);
  assert.equal(ready.trainingMax,50);
  assert.ok(Math.abs(ready.baseline-25)<.01);
  assert.ok(Math.abs(ready.estimatedAngle)<.01);
  assert.equal(ready.selectedTargetDeg,50);
  assert.equal(start,0);
  const middle=feed(c,60,60,6);
  assert.ok(middle.progress>0&&middle.progress<1);
});

test('Level 4 auto-starts from fixed zero and maps toward the selected 60-or-above target',()=>{
  const {c,ready,start}=calibrate('4',80,{smoothAlpha:1});
  assert.equal(ready.calibrated,true);
  assert.equal(ready.trainingMin,start);
  assert.equal(ready.trainingMax,80);
  assert.equal(start,0);
  acquireStart(c,start,30);
  assert.equal(feed(c,rawForEstimated(80),60,8).targetReady,true);
});

test('stale, duplicate and selected-arm-loss packets fail closed or add no credit',()=>{
  const c=api.createController({level:'3'});
  const first=feed(c,18,1,5);
  const duplicate=feed(c,18,1,5,{generation:5});
  assert.equal(duplicate.phase,'anchor');
  const stale=feed(c,18,6,1,{fresh:false});
  assert.equal(stale.gameReady,false);
  assert.equal(stale.reason,'frame-stale');
  const lost=feed(c,18,7,1,{missingSelected:true});
  assert.equal(lost.gameReady,false);
  assert.equal(lost.reason,'selected-arm-lost');
  assert.equal(first.calibrated,false);
});

test('older generations cannot add endpoint dwell credit or change the locked side',()=>{
  const {c}=calibrate('3',50);
  const admitted=feed(c,70,30,1);
  const credit=admitted.targetStableFrames;
  const older=feed(c,90,29,4,{generation:29,side:'left'});
  assert.equal(older.side,'right');
  assert.equal(older.targetStableFrames,credit);
  assert.equal(older.targetReady,false);
  assert.equal(older.newFrame,false);
});

test('camera-visible shoulder rise is reported without freezing valid elevation',()=>{
  const {c}=calibrate('3',50);
  const guarded=feed(c,40,80,7,{hike:.06});
  assert.equal(guarded.gameReady,true);
  assert.equal(guarded.compensation,'shoulder-hike-observed');
  assert.equal(guarded.reason,'ready');
});

test('target options preserve the clinical sets while every repetition starts at zero',()=>{
  const c=api.createController({level:'3'});
  assert.deepEqual(c.startChoices('3',30),[0]);
  assert.deepEqual(c.startChoices('3',50),[0]);
  assert.equal(c.setTarget(60,'3'),true);
  assert.deepEqual(c.startChoices('4',60),[0]);
  assert.equal(c.setTarget(35,'3'),false);
  assert.equal(c.setTarget(180,'4'),true);
  const {c:cycle,start}=calibrate('3',50,{smoothAlpha:1});
  acquireStart(cycle,start,30);
  feed(cycle,rawForEstimated(50),40,8);
  feed(cycle,rawForEstimated(start),60,8);
  const after=cycle.snapshot();
  assert.equal(after.repetitions,1);
  assert.equal(start,0);
  assert.equal(after.selectedStartDeg,0);
});

test('a stable 25-degree camera offset calibrates automatically without requiring raw zero',()=>{
  const c=api.createController({level:'3'});
  c.setTarget(50,'3');
  const ready=feed(c,25,1,14);
  assert.equal(ready.gameReady,true);
  assert.ok(Math.abs(ready.baseline-25)<.001);
  assert.equal(ready.estimatedAngle,0);
  assert.equal(ready.signalSource,'image-2d-relative');
});

test('target and return gates use normalized relative progress and latch the endpoint',()=>{
  const c=api.createController({level:'3',smoothAlpha:1});
  c.setTarget(50,'3');
  const start=c.snapshot().selectedStartDeg;
  feed(c,25,1,14);
  acquireStart(c,start,20);
  const below=feed(c,rawForEstimated(46),30,4);
  assert.equal(below.targetReady,false);
  const reached=feed(c,rawForEstimated(48),40,3);
  assert.equal(reached.targetReady,true);
  const slightDrop=feed(c,rawForEstimated(40),50,1);
  assert.equal(slightDrop.targetReady,true);
  const returned=feed(c,rawForEstimated(start),60,3);
  assert.equal(returned.repetitions,1);
  assert.equal(returned.targetReady,false);
});

test('no-hold target path proceeds directly to return and scores only after return',()=>{
  const {c,start}=calibrate('3',50,{smoothAlpha:1,targetFeedbackMs:100});
  assert.equal(c.setHoldDuration(0),true);
  acquireStart(c,start,20);
  const reached=feed(c,rawForEstimated(50),30,3,{nowMs:1000,stepMs:20});
  assert.equal(reached.phase,'await-return');
  assert.equal(reached.targetReady,true);
  assert.equal(reached.repetitions,0);
  const away=feed(c,rawForEstimated(30),40,3,{nowMs:1300,stepMs:20});
  assert.equal(away.repetitions,0);
  const returned=feed(c,rawForEstimated(start),50,3,{nowMs:1500,stepMs:20});
  assert.equal(returned.repetitions,1);
});

test('each allowed 1–5 second target hold shows feedback then a one-number countdown and scores after return',()=>{
  for(const seconds of [1,2,3,4,5]){
    const {c,start}=calibrate('3',50,{smoothAlpha:1,targetFeedbackMs:100});
    assert.equal(c.setHoldDuration(seconds),true);
    acquireStart(c,start,20);
    let generation=30;
    let snap=feed(c,rawForEstimated(50),generation,3,{nowMs:1000,stepMs:20});
    generation+=3;
    assert.equal(snap.phase,'target-hold');
    assert.equal(snap.holdFeedbackActive,true);
    assert.equal(snap.holdRemainingSec,seconds);
    snap=feed(c,rawForEstimated(50),generation++,1,{nowMs:1140});
    assert.equal(snap.holdCountdownActive,true);
    assert.equal(snap.holdRemainingSec,seconds);
    for(let elapsed=1;elapsed<seconds;elapsed++){
      snap=feed(c,rawForEstimated(50),generation++,1,{nowMs:1140+elapsed*1000});
      assert.equal(snap.phase,'target-hold');
      assert.equal(snap.holdRemainingSec,seconds-elapsed);
      assert.equal(snap.repetitions,0);
    }
    snap=feed(c,rawForEstimated(50),generation++,1,{nowMs:1140+seconds*1000});
    assert.equal(snap.phase,'await-return');
    assert.equal(snap.holdComplete,true);
    assert.equal(snap.repetitions,0);
    snap=feed(c,rawForEstimated(start),generation,3,{nowMs:1300+seconds*1000,stepMs:20});
    assert.equal(snap.repetitions,1);
  }
});

test('dropping below target and stale or duplicate frames reset hold without advancing it',()=>{
  const {c,start}=calibrate('4',70,{smoothAlpha:1,targetFeedbackMs:100});
  assert.equal(c.setHoldDuration(3),true);
  acquireStart(c,start,20);
  let snap=feed(c,rawForEstimated(70),30,3,{nowMs:1000,stepMs:20});
  snap=feed(c,rawForEstimated(70),33,1,{nowMs:1140});
  snap=feed(c,rawForEstimated(70),34,1,{nowMs:2240});
  assert.equal(snap.holdRemainingSec,2);
  snap=feed(c,rawForEstimated(55),35,1,{nowMs:2300});
  assert.equal(snap.holdInterrupted,true);
  assert.equal(snap.holdCountdownActive,false);
  assert.equal(snap.holdRemainingSec,null);
  snap=feed(c,rawForEstimated(70),36,1,{nowMs:5000});
  assert.equal(snap.holdRestartCount,1);
  assert.equal(snap.holdFeedbackActive,true);
  snap=feed(c,rawForEstimated(70),37,1,{nowMs:5100});
  assert.equal(snap.holdRemainingSec,3);
  const duplicate=feed(c,rawForEstimated(70),37,1,{generation:37,nowMs:9000});
  assert.equal(duplicate.newFrame,false);
  assert.equal(duplicate.holdRemainingSec,3);
  const stale=feed(c,rawForEstimated(70),38,1,{fresh:false,nowMs:10000});
  assert.equal(stale.holdInterrupted,true);
  assert.equal(stale.holdRemainingSec,null);
  assert.equal(stale.repetitions,0);
  snap=feed(c,rawForEstimated(70),38,1,{nowMs:11000});
  assert.equal(snap.holdRestartCount,2);
  snap=feed(c,rawForEstimated(70),39,1,{nowMs:11100});
  snap=feed(c,rawForEstimated(70),40,1,{nowMs:14100});
  assert.equal(snap.phase,'await-return');
  assert.equal(snap.repetitions,0);
  snap=feed(c,rawForEstimated(start),41,3,{nowMs:14300,stepMs:20});
  assert.equal(snap.repetitions,1);
});

test('public patient hold tolerates two fresh below-target frames but resets on the third',()=>{
  const {c,start}=calibrate('4',70,{smoothAlpha:1,patientTargetFeedbackMs:150});
  assert.equal(c.setHoldDuration(3),true);
  feed(c,rawForEstimated(start),20,2,{patientAssist:true});
  let snap=feed(c,rawForEstimated(70),30,2,
    {patientAssist:true,nowMs:1000,stepMs:20});
  assert.equal(snap.phase,'target-hold');
  const holdStartedAt=c.state.holdStartedAtMs;

  snap=feed(c,rawForEstimated(0),32,1,{patientAssist:true,nowMs:1100});
  assert.equal(snap.holdAtTarget,true);
  assert.equal(snap.holdInterrupted,false);
  assert.equal(snap.holdBelowTargetFrames,1);
  assert.equal(c.state.holdStartedAtMs,holdStartedAt);

  snap=feed(c,rawForEstimated(0),33,1,{patientAssist:true,nowMs:1130});
  assert.equal(snap.holdAtTarget,true);
  assert.equal(snap.holdBelowTargetFrames,2);

  snap=feed(c,rawForEstimated(0),34,1,{patientAssist:true,nowMs:1160});
  assert.equal(snap.holdAtTarget,false);
  assert.equal(snap.holdInterrupted,true);
  assert.equal(snap.holdRemainingSec,null);
});

test('stale input bypasses public hold grace and returnReady uses the active gate',()=>{
  const {c,start}=calibrate('4',70,{smoothAlpha:1});
  c.setHoldDuration(2);
  feed(c,rawForEstimated(start),20,2,{patientAssist:true});
  let snap=feed(c,rawForEstimated(70),30,2,{patientAssist:true,nowMs:1000,stepMs:20});
  assert.equal(snap.phase,'target-hold');
  snap=feed(c,rawForEstimated(70),32,1,{patientAssist:true,fresh:false,nowMs:1050});
  assert.equal(snap.holdInterrupted,true);
  assert.equal(snap.holdRemainingSec,null);

  c.state.returnStableFrames=2;
  c.state.activeGateStableFrames=2;
  assert.equal(c.snapshot().returnReady,true);
  c.state.activeGateStableFrames=3;
  assert.equal(c.snapshot().returnReady,false);
});

test('whole-patient screen translation does not freeze relative shoulder progress',()=>{
  const c=api.createController({level:'3',smoothAlpha:1});
  c.setTarget(40,'3');
  feed(c,25,1,14);
  const moved=feed(c,60,30,8,{trunkDx:.25});
  assert.equal(moved.reason,'ready');
  assert.equal(moved.gameReady,true);
  assert.ok(moved.progress>.7);
});

test('unstable world-model peaks remain diagnostic and cannot trigger an early endpoint',()=>{
  const c=api.createController({level:'4',smoothAlpha:1});
  c.setTarget(70,'4');
  feed(c,25,1,14,{worldAngle:25});
  acquireStart(c,c.snapshot().selectedStartDeg,20);
  const early=feed(c,45,30,6,{worldAngle:131});
  assert.equal(early.signalSource,'image-2d-relative');
  assert.ok(early.worldAngle>120);
  assert.ok(early.estimatedAngle<30);
  assert.equal(early.targetReady,false);
  const reached=feed(c,rawForEstimated(70),50,3,{worldAngle:80});
  assert.equal(reached.targetReady,true);
});

test('a stable natural seated trunk lean is accepted as the participant baseline',()=>{
  const c=api.createController({level:'3',smoothAlpha:1});
  c.setTarget(40,'3');
  const ready=feed(c,25,1,14,{hipDx:.16});
  assert.equal(ready.calibrated,true);
  assert.equal(ready.gameReady,true);
  assert.equal(ready.reason,'ready');
});

test('the prescribed start must be held before outward target credit is admitted',()=>{
  const {c,start}=calibrate('3',50,{smoothAlpha:1});
  const premature=feed(c,rawForEstimated(50),30,5);
  assert.equal(premature.phase,'await-start');
  assert.equal(premature.targetReady,false);
  acquireStart(c,start,40);
  const reached=feed(c,rawForEstimated(50),50,3);
  assert.equal(reached.targetReady,true);
});

test('an invalid frame clears partial target dwell credit',()=>{
  const {c,start}=calibrate('3',50,{smoothAlpha:1});
  acquireStart(c,start,20);
  const partial=feed(c,rawForEstimated(50),30,2);
  assert.equal(partial.targetStableFrames,2);
  const lost=feed(c,50,32,1,{missingSelected:true});
  assert.equal(lost.targetStableFrames,0);
  const one=feed(c,rawForEstimated(50),33,1);
  assert.equal(one.targetReady,false);
  assert.equal(one.targetStableFrames,1);
});

test('a 180-degree target remains reachable after a non-zero camera baseline',()=>{
  const {c,start}=calibrate('4',180,{smoothAlpha:1});
  acquireStart(c,start,20);
  const reached=feed(c,180,30,3);
  assert.ok(reached.estimatedAngle>=177);
  assert.equal(reached.targetReady,true);
});

test('visible mapping and setup copy distinguish Level 2, Level 3 and Level 4 without automatic assignment or force claims',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/FTHUE Level 2[\s\S]*桌面承托訓練/);
  assert.match(html,/FTHUE Level 3[\s\S]*膊頭屈曲 30–60°/);
  assert.match(html,/FTHUE Level 4[\s\S]*膊頭屈曲 60° 或以上/);
  assert.match(html,/患側前斜約 30–45°/);
  assert.match(html,/並非量角器 ROM/);
  assert.match(html,/相機不量度抓握或捏力/);
  assert.match(html,/const enabled=state\.level==='3'\|\|state\.level==='4'/);
  assert.match(html,/state\.level==='3'\?\[30,40,50,60\][\s\S]{0,80}:Array\.from\(\{length:13\},\(_,index\)=>60\+index\*10\)/);
  assert.doesNotMatch(html,/state\.level==='67'\?\[60,70,80,90,100,110,120\]/);
  assert.match(html,/if\(levelId==='67'\) state\.shoulderTargetDeg=60/);
  assert.match(html,/FTHUE Level 2[\s\S]*img\/advanced\/level4_cartoon_side_forward\.png/);
  // v102：Level 3 主動示範改用治療師卡通 GIF；SVG 檔保留
  assert.match(html,/FTHUE Level 3[\s\S]*img\/advanced\/level3_therapist_shoulder_30_60\.gif[\s\S]*img\/advanced\/shoulder_assisted_30_60\.svg/);
  assert.match(html,/FTHUE Level 4[\s\S]*img\/advanced\/shoulder_active_60_plus\.svg[\s\S]*img\/advanced\/shoulder_assisted_60_plus\.svg/);
  assert.match(html,/患者以患手持杯，在三十至六十度範圍內重複抬高手臂/);
  assert.match(html,/患者雙手持黃色彈性阻力棒，由六十度或以上重複抬高手臂/);
  assert.doesNotMatch(html,/id="shoulderStartOptions"/);
  assert.doesNotMatch(html,/Level 4：[^<\n]*(桌面承托|滑板|向前滑)/);
});

test('Level 3 and 4 gameplay follows live shoulder angle, then latches successful visuals',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/function updateShoulderFlexionGame\(\)/);
  assert.match(html,/if\(isGrossTabletop\(\)\)\{[\s\S]*ensurePoseLandmarker\(\)/);
  assert.match(html,/const visualProgress=shoulderRewardCycle\.active\s*\?\s*1\s*:\s*clamp01\(Number\(shoulderFlexionState\.progress\)\|\|0\)/);
  assert.match(html,/item\.y=bottom-\(bottom-top\)\*visualProgress/);
  assert.match(html,/shoulder_cycle_completed/);
  assert.match(html,/shoulder\.frame\?\.fresh===true/);
  assert.doesNotMatch(html,/const liveAngleReady=[^;]*shoulder\.newFrame/);
  assert.match(html,/querySelectorAll\('\.level4-live-readouts \.level4-reading > span'\)/);
  assert.doesNotMatch(html,/Camera estimate',x,badgeY\+badgeH\/2\+24/);
  assert.doesNotMatch(html,/badgeW=Math\.min\(250/);
  assert.match(html,/if\(labels\[0\]\) labels\[0\]\.textContent='現在'/);
  assert.match(html,/Math\.round\(shoulder\.estimatedAngle\)\+'\u00b0'/);
  assert.match(html,/isShoulderFlexionLevel\(\) \? \(portrait \? 104 : 138\)/);
  assert.match(html,/持續握住治療師選定的物件/);
  assert.match(html,/網頁只追蹤肩屈曲，不偵測抓握或放手/);
});

test('setup exposes distinct exact target-hold choices and aligns v51 source identifiers',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const manifest=fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8');
  const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  const hold=[...html.matchAll(/data-target-hold="(\d+)"/g)].map(match=>Number(match[1]));
  assert.deepEqual(hold,[0,1000,2000,3000,4000,5000]);
  assert.match(html,/id="targetHoldOptions"[\s\S]*不用保持[\s\S]*5秒/);
  assert.match(html,/targetOptions\.hidden=!targetHold/);
  assert.match(html,/dwellOptions\.hidden=targetHold/);
  assert.match(html,/#targetHoldOptions\[hidden\],#dwellOptions\[hidden\]\{\s*display:none !important;/);
  assert.match(html,/button\.setAttribute\('aria-pressed',selected\?'true':'false'\)/);
  assert.match(html,/id="targetHoldOverlay"[\s\S]*id="targetHoldNumber"/);
  assert.match(html,/holdCountdownActive/);
  assert.match(html,/SHOULDER_HOLD_COUNT_CANTONESE/);
  assert.match(html,/v104-20260905-landing-copy-horizontal-cert/);
  assert.match(manifest,/v104-20260905-landing-copy-horizontal-cert/);
  assert.match(worker,/v104-20260905-landing-copy-horizontal-cert/);
  assert.doesNotMatch(html,/v46-20260825-shoulder-detection-repair/);
  assert.doesNotMatch(manifest,/v46-20260825-shoulder-detection-repair/);
  assert.doesNotMatch(worker,/v46-20260825-shoulder-detection-repair/);
});

test('Level 3 and 4 use deterministic side-by-side active and active-assisted demonstrations',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const required=[
    'shoulder_active_30_60.svg','shoulder_assisted_30_60.svg',
    'shoulder_active_60_plus.svg','shoulder_assisted_60_plus.svg'
  ];
  required.forEach(filename=>{
    const file=path.join(root,'img','advanced',filename);
    assert.equal(fs.existsSync(file),true,filename);
    const svg=fs.readFileSync(file,'utf8');
    assert.match(svg,/<animate /);
    assert.match(svg,/repeatCount="indefinite"/);
    assert.doesNotMatch(svg,/therapist|治療師/i);
  });
  assert.match(html,/shoulder-demos[\s\S]*demo-level-3-active[\s\S]*demo-level-3-assisted/);
  assert.match(html,/shoulder-demos[\s\S]*demo-level-4-active[\s\S]*demo-level-4-assisted/);
  assert.match(html,/拿杯 \(active shoulder flexion\)/);
  assert.match(html,/雙手舉棒 \(active-assisted shoulder flexion\)/);
  assert.match(fs.readFileSync(path.join(root,'img','advanced','shoulder_active_30_60.svg'),'utf8'),/cup/i);
  assert.match(fs.readFileSync(path.join(root,'img','advanced','shoulder_assisted_30_60.svg'),'utf8'),/#f2c400/i);
});

test('front-facing bedside camera: calibrated-reference-length normalization tracks true flexion through and past 90 degrees, unlike live-magnitude normalization',()=>{
  // The existing pose() helper above is an idealized rigid-length circular
  // model (elbow-shoulder image distance is a fixed 0.20 regardless of
  // angle) which never exercises real camera perspective. A tablet propped
  // on a table in front of a seated patient (so they can see the game
  // screen) is a genuine perspective projection: real forward flexion
  // happens mostly along the depth axis, so the on-screen elbow-shoulder
  // distance shrinks as flexion approaches 90 degrees (the elbow is closer
  // to the camera) and there is no real left-right (lateral) displacement
  // at all for a pure forward raise directly ahead of the camera.
  function frontPerspectivePose(trueAngleDeg,{D=3,L=1,imageScale=.6}={}){
    const rad=trueAngleDeg*Math.PI/180;
    const depthFromCamera=D-L*Math.sin(rad);
    const heightAboveShoulder=-L*Math.cos(rad); // up positive
    const shoulder={x:.5,y:.30,visibility:1};
    const elbow={
      x:shoulder.x, // pure sagittal flexion: zero lateral component in a
                    // camera placed directly in front of the patient
      y:shoulder.y-imageScale*heightAboveShoulder/depthFromCamera,
      visibility:1,
    };
    const hip={x:shoulder.x,y:.72,visibility:1};
    return {shoulder,elbow,hip,otherShoulder:{x:.68,y:.30,visibility:1}};
  }
  const restRefLen=Math.hypot(
    api.armVector2D(frontPerspectivePose(0),1).ux,
    api.armVector2D(frontPerspectivePose(0),1).uy
  );
  // Old behaviour: normalize by each frame's own (foreshortened) live
  // vector length. With zero lateral component this collapses to a pure
  // direction sign check -- a binary near-0-or-near-180 answer with no
  // ability to track the angle in between, which is the same degeneracy
  // that produces an unstable, badly-wrong intermediate reading (such as
  // the reported ~40 degrees for a genuine >90 degree raise) once ordinary
  // sensor/landmark noise is layered on top.
  const oldBelow90=api.shoulderFlexion2D(frontPerspectivePose(85),1);
  const oldAbove90=api.shoulderFlexion2D(frontPerspectivePose(95),1);
  assert.ok(oldBelow90<5,`old formula should collapse to ~0 at true 85deg, got ${oldBelow90}`);
  assert.ok(oldAbove90>175,`old formula should snap to ~180 at true 95deg, got ${oldAbove90}`);

  // New behaviour: normalize by the patient's own calibrated rest-pose
  // length instead of the live, foreshortened one. This is exact at 90
  // degrees (the unknown camera distance cancels out there) and stays
  // monotonically increasing with the true angle on both sides of it,
  // directly closing the reported gap: a genuine >90 degree raise now
  // reads at or above 90, not a low, unstable value.
  const new80=api.shoulderFlexion2D(frontPerspectivePose(80),1,restRefLen);
  const new90=api.shoulderFlexion2D(frontPerspectivePose(90),1,restRefLen);
  const new100=api.shoulderFlexion2D(frontPerspectivePose(100),1,restRefLen);
  const new130=api.shoulderFlexion2D(frontPerspectivePose(130),1,restRefLen);
  assert.ok(Math.abs(new90-90)<1,`new formula should read ~90 at true 90deg, got ${new90}`);
  assert.ok(new80<new90&&new90<new100&&new100<new130,
    'new formula must increase monotonically with true angle through and past 90 degrees');
  assert.ok(new100>80,`new formula must clearly register a >90deg raise, got ${new100} for true 100deg`);
  assert.ok(new130>90,`new formula must clearly register a >90deg raise, got ${new130} for true 130deg`);
});

test('shoulder-flexion GIFs are generated from the anatomical 0-90-180 degree convention',()=>{
  const generator=fs.readFileSync(path.join(root,'tools/generate_shoulder_flexion_gifs.py'),'utf8');
  const clinicalGenerator=fs.readFileSync(path.join(root,'tools/build_patient_therapist_shoulder_gifs.py'),'utf8');
  assert.match(generator,/Shoulder flexion: 0° down by trunk, 90° forward, 180° overhead/);
  assert.match(generator,/origin\[0\] \+ length \* sin\(radians\)/);
  assert.match(generator,/origin\[1\] \+ length \* cos\(radians\)/);
  assert.match(generator,/sequence\(\[0, 30, 40, 50, 60, 50, 40, 30, 0\]\)/);
  assert.match(generator,/sequence\(\[0, 60, 90, 120, 150, 180, 150, 120, 90, 60, 0\]\)/);
  assert.match(clinicalGenerator,/\[0, 30, 50, 60\]/);
  assert.match(clinicalGenerator,/\[0, 60, 90, 120, 150, 180\]/);
  assert.match(clinicalGenerator,/stepped poses are easier for older patients to read than/);
  for(const filename of [
    'level3_patient_therapist_strip.png',
    'level4_patient_therapist_sprites.png'
  ]){
    const file=path.join(root,'img','advanced',filename);
    assert.equal(fs.existsSync(file),true,filename);
    assert.ok(fs.statSync(file).size>100000,filename+' should contain the patient-and-therapist artwork');
  }
  for(const filename of [
    'level3_shoulder_flexion_30_60.gif',
    'level4_shoulder_flexion_60_plus.gif'
  ]){
    const file=path.join(root,'img','advanced',filename);
    assert.equal(fs.existsSync(file),true,filename);
    assert.ok(fs.statSync(file).size>10000,filename+' should contain an animated clinical diagram');
  }
});
