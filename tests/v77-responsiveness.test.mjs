import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');

function functionSource(name){
  const start=html.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} exists`);
  const open=html.indexOf('{',start);
  let depth=0;
  for(let i=open;i<html.length;i++){
    if(html[i]==='{') depth++;
    else if(html[i]==='}' && --depth===0) return html.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('hand inference is cached only for one fresh decoded generation and video session',()=>{
  const resetSource=functionSource('resetHandFrameAdmission');
  const detectSource=functionSource('detectWrist');
  const makeHarness=new Function(`
    let lastAcceptedToolHandGeneration=-1;
    let handFrameCache={video:null,generation:null,result:null};
    let calls=0;
    const handLandmarker={detectForVideo(){ calls++; return {interpreted:{detected:true,call:calls}}; }};
    const nextTs=()=>1;
    const interpretHandResults=results=>results?.interpreted || {detected:false};
    ${resetSource}
    ${detectSource}
    return {detectWrist,calls:()=>calls,cache:()=>handFrameCache};
  `);
  const h=makeHarness();
  const videoA={readyState:2};
  const videoB={readyState:2};
  const first=h.detectWrist(videoA,{fresh:true,generation:1});
  const duplicate=h.detectWrist(videoA,{fresh:true,generation:1});
  assert.equal(h.calls(),1);
  assert.equal(duplicate,first,'same fresh generation reuses the interpreted object');

  assert.equal(h.detectWrist(videoA,{fresh:false,generation:1}).reason,'hand-frame-stale');
  h.detectWrist(videoA,{fresh:true,generation:1});
  assert.equal(h.calls(),2,'a stale admission boundary invalidates the cache');

  h.detectWrist(videoA,{fresh:true,generation:2});
  assert.equal(h.calls(),3);
  assert.equal(h.detectWrist(videoA,{fresh:true,generation:1}).reason,'hand-frame-stale');
  assert.equal(h.calls(),3,'an older generation cannot invoke inference');

  h.detectWrist(videoB,{fresh:true,generation:2});
  assert.equal(h.calls(),4,'a different video/session cannot reuse the cache');
  assert.equal(h.detectWrist(videoB,{fresh:true,generation:NaN}).reason,'hand-frame-stale');
});

test('hand cache resets on game and camera session boundaries without weakening hand filters',()=>{
  const detector=functionSource('detectWrist');
  assert.match(html,/function waitForLiveCameraFrame[\s\S]*?resetHandFrameAdmission\(\)/);
  assert.match(html,/function stopCamera[\s\S]*?resetHandFrameAdmission\(\)/);
  assert.match(functionSource('initGame'),/resetHandFrameAdmission\(\)/);
  assert.match(detector,/!frame\?\.fresh \|\| !Number\.isFinite\(generation\)/);
  assert.match(html,/if\(selectedHandIndex < 0\) return \{ detected:false, reason:'affected-hand-not-detected' \}/);
  assert.match(html,/if\(!hasFiniteHandLandmarks\(lm, required\)\)/);
  assert.match(html,/confidence < 0\.55/);
  assert.match(html,/return selected;/);
});

test('action prompt suppresses identical DOM writes and keys rendered mode, language, gesture, and content',()=>{
  const source=functionSource('setActionPrompt');
  assert.match(source,/const patientMode = isPatientVisualCueMode\(\)/);
  assert.match(source,/const languageKey = document\.documentElement\.lang/);
  assert.match(source,/\[patientMode, languageKey, gestureCue, main,isLevel6\(\)\?activeAffectedSide\(\):''\]/);
  assert.match(source,/\[patientMode, languageKey, gestureCue, main, detail \|\| ''\]/);
  assert.match(source,/if\(statusBar\.dataset\.actionRenderKey === renderKey\) return/);
  assert.ok(source.indexOf('actionRenderKey === renderKey')<source.indexOf('statusBar.innerHTML'));
  assert.match(html,/delete statusBar\.dataset\.actionRenderKey/);
});

test('public loop admits at most one work pass per new frame near 30 fps and fails closed once on stale',()=>{
  const resetSource=functionSource('resetPublicGameWorkAdmission');
  const admitSource=functionSource('admitPublicGameWork');
  const makeHarness=new Function(`
    const PUBLIC_GAME_WORK_INTERVAL_MS=1000/30;
    let publicGameWork={at:-Infinity,generation:null,fresh:null,staleKey:''};
    ${resetSource}
    ${admitSource}
    return {admitPublicGameWork,resetPublicGameWorkAdmission};
  `);
  const h=makeHarness();
  assert.equal(h.admitPublicGameWork(0,{fresh:true,generation:1}),true);
  assert.equal(h.admitPublicGameWork(8,{fresh:true,generation:1}),false,'duplicate RAF is suppressed');
  assert.equal(h.admitPublicGameWork(15,{fresh:true,generation:2}),false,'new frame waits for frame budget');
  assert.equal(h.admitPublicGameWork(34,{fresh:true,generation:3}),true,'latest fresh frame is admitted');
  assert.equal(h.admitPublicGameWork(35,{fresh:true,generation:3}),false);
  assert.equal(h.admitPublicGameWork(36,{fresh:false,generation:3,reason:'frame-stale'}),true);
  assert.equal(h.admitPublicGameWork(70,{fresh:false,generation:3,reason:'frame-stale'}),false);
  const loop=functionSource('gameLoop');
  assert.match(loop,/if\(research\.active \|\| state\.qaMode \|\| admitPublicGameWork/);
  assert.match(loop,/updateTracking\(publicFrame\)/);
});

test('privacy recording draw is capped at 20 fps and skips duplicate decoded frames',()=>{
  const source=functionSource('createHeadExcludedRecordingStream');
  assert.match(source,/const PRIVACY_DRAW_INTERVAL_MS = 1000 \/ 20/);
  assert.match(source,/getVideoPlaybackQuality\?\.\(\)/);
  assert.match(source,/videoEl\.currentTime/);
  assert.match(source,/const intervalReady = tick - lastDrawAt >= PRIVACY_DRAW_INTERVAL_MS/);
  assert.match(source,/const decodedAdvanced = frameKey == null \|\| frameKey !== lastDecodedFrameKey/);
  assert.match(source,/if\(intervalReady && decodedAdvanced && videoEl\.readyState >= 2\)/);
  assert.match(source,/canvas\.captureStream\(20\)/);
});

test('public tracking is more responsive while research retains its original filter',()=>{
  assert.match(html,/const RESEARCH_TRACKING_MEDIAN_FRAMES = 5/);
  assert.match(html,/const PUBLIC_TRACKING_MEDIAN_FRAMES = 3/);
  assert.match(functionSource('trackingMedianFrames'),
    /research\.active \? RESEARCH_TRACKING_MEDIAN_FRAMES : PUBLIC_TRACKING_MEDIAN_FRAMES/);
  const tracking=functionSource('updateTracking');
  assert.match(tracking,/research\.active[\s\S]*?0\.46 : 0\.28[\s\S]*?0\.34 : 0\.20[\s\S]*?0\.18 : 0\.11/);
  assert.match(tracking,/movement > 70 \? 0\.45 : \(movement > 24 \? 0\.32 : 0\.20\)/);
  assert.match(html,/const TRACKING_DEAD_ZONE_PX = 3/);
});

test('public grasp timings and release continuity preserve research and safety gates',()=>{
  const basic=functionSource('updateGraspLogic');
  assert.match(basic,/research\.active \? 220 : 100/);
  assert.match(basic,/research\.active \? 360 : 120/);
  assert.match(basic,/research\.active \? 650 : 220/);
  assert.match(basic,/RELEASE_CONTINUITY_GRACE_MS = research\.active \? 0 : 100/);
  assert.match(basic,/releaseDwellStart \+= now - releaseDwellPauseAt/);
  assert.match(basic,/if\(!releaseDwellPauseAt\) releaseDwellPauseAt = now/);
  assert.match(html,/const GESTURE_CONFIRM_MS = 60/);
  assert.match(html,/isOpenPrep:!pinchHeld && pinch\.isSeparated/);
  assert.match(html,/const bothReopened = nearRatio >= t\.nearExit && farRatio >= t\.farExit/);

  assert.match(html,/const GRASP_ARM_MS = 420/);
  assert.match(html,/const GRASP_HOLD_MS = 480/);
  assert.match(html,/const RELEASE_HOLD_MS = 1000/);
  assert.match(html,/const PUBLIC_GRASP_ARM_MS = 100/);
  assert.match(html,/const PUBLIC_GRASP_HOLD_MS = 120/);
  assert.match(html,/const PUBLIC_RELEASE_HOLD_MS = 220/);
  assert.match(html,/const PUBLIC_RELEASE_CONTINUITY_GRACE_MS = 100/);
  assert.match(html,/this\.relStart \+= now - this\.relPauseAt/);
});

function boxesOverlap(a,b){
  return Math.abs(a.x-b.x)<(a.w+b.w)/2-0.01
    && Math.abs(a.y-b.y)<(a.h+b.h)/2-0.01;
}

test('390x844 public Level 5 card, Mahjong, steamer, and laundry choices stay separated and in bounds',()=>{
  const cw=390,ch=844;

  // Cards: six choices form two rows of three below the preserved top zone.
  const count=6,cols=3,rows=2,top=ch*.59,bottom=ch*.94;
  let cardW=Math.max(118,Math.min(172,(cw*.88-34)/cols-14));
  cardW=Math.min(cardW,Math.max(72,(bottom-top)/rows-14)*132/184);
  const cardH=cardW*184/132,rowH=(bottom-top)/rows;
  const cards=Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/cols),col=i%cols;
    const rowCount=Math.min(cols,count-row*cols);
    return {x:cw*.5+(col-(rowCount-1)/2)*cardW*1.18,
      y:top+rowH*(row+.5),w:cardW,h:cardH};
  });
  for(const box of cards){
    assert.ok(box.x-box.w/2>=0 && box.x+box.w/2<=cw);
    assert.ok(box.y-box.h/2>=0 && box.y+box.h/2<=ch);
  }
  for(let i=0;i<cards.length;i++) for(let j=i+1;j<cards.length;j++)
    assert.equal(boxesOverlap(cards[i],cards[j]),false,`cards ${i}/${j} overlap`);

  // Three public Mahjong choices occupy two explicitly separated rows.
  const tileW=Math.min(Math.max(72,Math.min(92,(cw-32)/5-4)),Math.max(40,ch*.075));
  const tileH=tileW*176/132,handTop=ch*.40,handBottom=handTop+2*(tileH+8)+tileH/2;
  const groupCount=3,mjCols=2,mjRows=2,gh=Math.min(104,ch*.125);
  const gw=Math.min(210,(cw*.92-24)/mjCols-12);
  const baseY=Math.max(handBottom+12+gh/2,
    Math.min(ch*.78,ch-12-gh/2-(mjRows-1)*(gh+16)));
  const groups=Array.from({length:groupCount},(_,i)=>{
    const row=Math.floor(i/mjCols),col=i%mjCols;
    const rowCount=Math.min(mjCols,groupCount-row*mjCols);
    return {x:cw/2+(col-(rowCount-1)/2)*(gw+22),y:baseY+row*(gh+16),w:gw,h:gh};
  });
  for(const box of groups){
    assert.ok(box.x-box.w/2>=0 && box.x+box.w/2<=cw);
    assert.ok(box.y-box.h/2>=0 && box.y+box.h/2<=ch);
  }
  for(let i=0;i<groups.length;i++) for(let j=i+1;j<groups.length;j++)
    assert.equal(boxesOverlap(groups[i],groups[j]),false,`Mahjong ${i}/${j} overlap`);

  const steamerW=cw*.36;
  assert.ok(cw*.30+steamerW/2<cw*.70-steamerW/2,'steamers have a visible gap');
  const basketH=Math.min(ch*.27,(cw/2*.52)*.72,ch*.14);
  const basketGap=basketH+Math.max(12,ch*.02);
  assert.ok(basketGap>basketH,'laundry rows have a positive gap');

  // The reported 1330x759 landscape view uses the 2x wide-screen multiplier.
  const wideCw=1330,wideCh=759;
  const compactWideH=Math.min(wideCh*.27,(wideCw/2*.52)*.72,wideCh*.14);
  const formerSafeW=(compactWideH*.80)/(.92*(198/300));
  const wideBasketW=Math.min(wideCw/2*.52,formerSafeW*2);
  const wideBasketH=Math.min(wideCh*.24,wideBasketW*(198/300));
  const wideBasketGap=wideBasketH+Math.max(12,wideCh*.02);
  assert.ok(wideBasketW>=formerSafeW*1.99,
    'wide-screen laundry baskets are twice the former safe width');
  assert.ok(wideBasketGap>wideBasketH,
    'the enlarged wide-screen basket rows retain a positive gap');

  assert.match(html,/Math\.min\(standardTw, cw \* 0\.36\)/);
  assert.match(html,/maxCardHeight = Math\.max\(72, \(bottom-top\)\/rows - 14\)/);
  assert.match(html,/Math\.min\(104, ch\*\.125\)/);
  assert.match(html,/const sizeMultiplier = patientLarge && cw >= 900 \? 2 : 1/);
  assert.match(html,/basketRowGap = bh \+ Math\.max\(12,ch\*\.02\)/);
  assert.match(html,/isPublicSideCardGame\(\)/);
});
