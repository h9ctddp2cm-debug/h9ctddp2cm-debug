import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');

test('camera permission is requested at most once while an active session stream is reusable',()=>{
  assert.match(html,/function reusableCameraStream\(\)/);
  assert.match(html,/if\(reusable\)\{[\s\S]*videoEl\.srcObject!==reusable[\s\S]*return true;/);
  assert.match(html,/let cameraRequestPromise=null/);
  assert.match(html,/let cameraRequestAttempted=false/);
  assert.match(html,/if\(cameraRequestAttempted\)\{[\s\S]*return false;/);
  assert.match(html,/if\(!cameraRequestPromise\)\{[\s\S]*navigator\.mediaDevices\.getUserMedia/);
  assert.match(html,/cameraRequestAttempted=true/);
  assert.match(html,/cameraRequestPromise=navigator\.mediaDevices\.getUserMedia/);
  const calibrationFlow=html.slice(html.indexOf('async function enterCalibrationFlow()'),html.indexOf('window.enterCalibrationFlow'));
  assert.ok(calibrationFlow.indexOf("const cameraStart=startCamera('calibVideo')")
    < calibrationFlow.indexOf('await ensurePoseLandmarker'));
});

test('hand calibration passes the current decoded-frame status into the fail-closed detector',()=>{
  const start=html.indexOf('function startCalibLoop()');
  const end=html.indexOf('function stopCalibLoop()',start);
  const calibrationLoop=html.slice(start,end);
  assert.match(calibrationLoop,/const frame=level4FrameStatus\(video\)/);
  assert.match(calibrationLoop,/if\(isLevel6\(\)\)\{[\s\S]*res=detectWrist\(video,frame\)/);
  assert.match(calibrationLoop,/else\{[\s\S]*res=detectWrist\(video,frame\)/);
  assert.doesNotMatch(calibrationLoop,/detectWrist\(video\);/);
});

test('normal Level 6 initializes Hand Landmarker rather than the legacy Pose-only route',()=>{
  const start=html.indexOf('async function enterCalibrationFlow()');
  const end=html.indexOf('window.enterCalibrationFlow',start);
  const calibrationFlow=html.slice(start,end);
  assert.match(calibrationFlow,/if\(isGrossTabletop\(\) && !isLevel6ToolGestureTask\(\)\)/);
  assert.match(calibrationFlow,/else\{[\s\S]*await ensureHandLandmarker\(\)/);
  assert.doesNotMatch(calibrationFlow,/if\(isGrossTabletop\(\)\)\{/);
});

test('screen transitions suspend tracking without stopping camera tracks',()=>{
  const start=html.indexOf('function stopCamera(release=false)');
  const stopBody=html.slice(start,html.indexOf("document.getElementById('btnDownloadMovementVideo')",start));
  assert.match(stopBody,/if\(release&&state\.stream\)/);
  assert.doesNotMatch(stopBody,/if\(state\.stream\)\{\s*state\.stream\.getTracks/);
  assert.match(html,/window\.addEventListener\('pagehide', event=>\{[\s\S]*if\(!event\.persisted\) stopCamera\(true\)/);
});

test('tracking model initializers remain promise-cached across games and levels',()=>{
  assert.match(html,/let handLandmarkerPromise = null/);
  assert.match(html,/if\(handLandmarkerPromise\) return handLandmarkerPromise/);
  assert.match(html,/let poseLandmarker = null, poseLoading = null/);
  assert.match(html,/if\(poseLoading\) return poseLoading/);
});
