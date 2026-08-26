import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `could not find ${signature}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`could not close ${signature}`);
}

const manualCaptureSource = extractFunction(html, 'function level4ManualCapture(which)');

function makeHarness({ inferenceSucceeds }) {
  const calls = { cancel:0, detect:0, update:0, markFlexed:0, markExtended:0, markHorizontal:0, render:0, log:0 };
  const frame = {fresh:true,generation:41,ageMs:8,source:'test',reason:'fresh-decoded-frame'};
  const pose = [{x:.5,y:.3,visibility:1}];
  const context = {
    state:{qaMode:false},
    gameVideo:{},
    level4Reach:{warning:''},
    level4AutoCalibration:{cancel(){ calls.cancel += 1; }},
    level4Controller:{
      update(){ calls.update += 1; },
      markFlexed(){ calls.markFlexed += 1; },
      markExtended(){ calls.markExtended += 1; },
      markHorizontal(){ calls.markHorizontal += 1; },
    },
    lastPoseFrameGeneration:40,
    lastPoseWorldLm:null,
    level4FrameStatus(){ return frame; },
    detectPose(_video, generation){
      calls.detect += 1;
      if (!inferenceSucceeds) return null;
      context.lastPoseFrameGeneration = generation;
      return pose;
    },
    updateLevel4ReachController(currentPose, _world, currentFrame){
      assert.equal(currentPose, pose);
      assert.equal(currentFrame, frame);
      calls.update += 1;
    },
    level4SyncReachMirror(){},
    level4UpdateCalibrationBar(){ calls.render += 1; },
    researchLog(){ calls.log += 1; },
  };
  vm.createContext(context);
  new vm.Script(`${manualCaptureSource}; globalThis.__capture=level4ManualCapture;`).runInContext(context);
  return {capture:context.__capture, context, calls};
}

test('manual mark infers and admits the exact visible decoded generation before capture', () => {
  const harness = makeHarness({inferenceSucceeds:true});
  harness.capture('flexed');
  assert.equal(harness.calls.detect, 1);
  assert.equal(harness.calls.update, 1);
  assert.equal(harness.calls.markFlexed, 1);
  assert.equal(harness.calls.log, 1);
});

test('failed current-frame inference does not inject arm loss or mutate endpoints', () => {
  const harness = makeHarness({inferenceSucceeds:false});
  harness.capture('extended');
  assert.equal(harness.calls.detect, 1);
  assert.equal(harness.calls.update, 0, 'no arm-less controller packet is injected');
  assert.equal(harness.calls.markExtended, 0);
  assert.match(harness.context.level4Reach.warning, /Waiting for the current affected-arm frame/);
  assert.equal(harness.calls.render, 1);
});
