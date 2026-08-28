import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const api=require(path.join(root,'shoulder-flexion-controller.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function fullPose({selected='right',selectedVisible=true,oppositeVisible=true}={}){
  const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
  const isLeft=selected==='left';
  const selectedIndices=isLeft?[11,13,15,23]:[12,14,16,24];
  const oppositeIndices=isLeft?[12,14,16,24]:[11,13,15,23];
  const selectedPoints=[
    {x:.44,y:.30},{x:.48,y:.48},{x:.53,y:.65},{x:.44,y:.72},
  ];
  const oppositePoints=[
    {x:.62,y:.30},{x:.66,y:.45},{x:.70,y:.60},{x:.62,y:.72},
  ];
  selectedIndices.forEach((index,i)=>{lm[index]={...selectedPoints[i],visibility:selectedVisible?1:0};});
  oppositeIndices.forEach((index,i)=>{lm[index]={...oppositePoints[i],visibility:oppositeVisible?1:0};});
  return lm;
}

test('assisted-stick choice is available only for Levels 3 and 4',()=>{
  assert.equal(api.exerciseModeAvailable('3'),true);
  assert.equal(api.exerciseModeAvailable('4'),true);
  for(const level of ['2','5','67','']) assert.equal(api.exerciseModeAvailable(level),false);
  assert.match(html,/function shoulderExerciseModeAvailable\(level=state\.level\)\{ return level==='3'\|\|level==='4'; \}/);
  assert.match(html,/card\.hidden=!enabled/);
});

test('controller selects and reports active-assisted state without changing target logic',()=>{
  const controller=api.createController({level:'3'});
  assert.equal(controller.snapshot().exerciseMode,'active');
  assert.equal(controller.setExerciseMode('assisted-stick'),true);
  controller.setTarget(50,'3');
  const selected=controller.snapshot();
  assert.equal(selected.exerciseMode,'assisted-stick');
  assert.equal(selected.selectedTargetDeg,50);
  assert.equal(selected.trackingTarget,'selected-anatomical-affected-arm');
  assert.equal(selected.unaffectedHandFallback,false);
  assert.match(controller.toText(),/exerciseMode:assisted-stick/);
  assert.match(controller.toText(),/unaffectedHandFallback:false/);
  assert.equal(controller.setExerciseMode('bilateral-tracking'),false);
});

test('concise setup and trial/training rules describe both movement modes and 1 lb stick',()=>{
  assert.match(html,/data-testid="button-shoulder-mode-active">[\s\S]*患臂主動/);
  assert.match(html,/data-testid="button-shoulder-mode-assisted-stick">[\s\S]*雙手持 1 lb 棍/);
  assert.match(html,/雙手握棍，健手協助｜Hold stick with both hands; unaffected hand assists/);
  assert.match(html,/相機只追蹤已選患側手臂；角度只作訓練估算/);
  assert.match(html,/shoulderModeCue\+'0° 起點/);
  assert.match(html,/shoulderExerciseProfile\(\)\.patient\+'至治療師所選目標/);
  assert.match(html,/相機只追蹤已選患側手臂；角度只作訓練估算/);
  assert.doesNotMatch(html,/醫療級肩關節活動幅度|medical-grade shoulder ROM/i);
});

test('assisting hand can never replace a missing selected anatomical affected arm',()=>{
  const controller=api.createController({level:'4',exerciseMode:'assisted-stick'});
  controller.setExerciseMode('assisted-stick');
  const lost=controller.update({
    lm:fullPose({selected:'right',selectedVisible:false,oppositeVisible:true}),
    side:'right',frameFresh:true,frameGeneration:1,
    frame:{fresh:true,generation:1},
    // Deliberately supplied opposite arm data must be ignored.
    arm:{shoulder:{x:.62,y:.30},elbow:{x:.66,y:.45},wrist:{x:.70,y:.60}},
  });
  assert.equal(lost.reason,'selected-arm-lost');
  assert.equal(lost.gameReady,false);
  assert.equal(lost.side,'right');
  assert.equal(lost.unaffectedHandFallback,false);
});

test('mode persists through controller calibration reset while a new app level resets to active',()=>{
  const controller=api.createController({level:'3'});
  controller.setExerciseMode('assisted-stick');
  controller.reset('3',60);
  assert.equal(controller.snapshot().exerciseMode,'assisted-stick');
  assert.match(html,/function selectLevel\(levelId\)\{[\s\S]*state\.shoulderExerciseMode='active';[\s\S]*state\.shoulderTargetDeg=40/);
  assert.match(html,/function exitToLevelSelection\(\)\{[\s\S]*state\.shoulderExerciseMode = 'active';/);
  assert.match(html,/shoulderFlexionController\.reset\(state\.level,state\.shoulderTargetDeg\);[\s\S]*shoulderFlexionController\.setExerciseMode\(state\.shoulderExerciseMode\)/);
});

test('existing Level 3 and Level 4 target-degree sets remain unchanged',()=>{
  assert.match(html,/state\.level==='3'\?\[30,40,50,60\][\s\S]{0,80}:Array\.from\(\{length:13\},\(_,index\)=>60\+index\*10\)/);
  const level3=api.createController({level:'3'});
  const level4=api.createController({level:'4'});
  assert.equal(level3.setTarget(30,'3'),true);
  assert.equal(level3.setTarget(70,'3'),false);
  assert.equal(level4.setTarget(60,'4'),true);
  assert.equal(level4.setTarget(180,'4'),true);
  assert.equal(level4.setTarget(50,'4'),false);
});
