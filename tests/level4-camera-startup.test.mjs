/* Executable regression coverage for the camera-startup path.
 *
 * This loads the exact `startCamera` function embedded in index.html into a
 * small browser-like VM. It verifies that a successful mocked getUserMedia
 * result is attached and returned for both calibration and game video
 * elements, rather than merely checking source text. Hardware/Safari testing
 * remains separately required for decoded-frame delivery.
 */
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

const startCameraSource = extractFunction(html, 'async function startCamera(videoElId)');
const reusableCameraSource = extractFunction(html, 'function reusableCameraStream()');

function makeHarness() {
  const videos = new Map();
  const getUserMediaCalls = [];
  const freshnessWaits = [];
  const cameraErrors = [];
  let hideErrors = 0;
  let inlineConfigurations = 0;
  const stream = {
    getTracks() { return []; },
    getVideoTracks() { return [{readyState:'live'}]; },
  };

  for (const id of ['calibVideo', 'gameVideo']) {
    videos.set(id, {
      id,
      srcObject: null,
      playCalls: 0,
      async play() {
        this.playCalls += 1;
      },
    });
  }

  const context = {
    state: { stream: null },
    window: { innerWidth: 390, innerHeight: 844 },
    navigator: {
      mediaDevices: {
        async getUserMedia(constraints) {
          getUserMediaCalls.push(constraints);
          return stream;
        },
      },
    },
    document: {
      getElementById(id) {
        return videos.get(id) || null;
      },
    },
    configureInlineCameraVideo(video) {
      assert.ok(video, 'the requested video element must be supplied');
      inlineConfigurations += 1;
    },
    async waitForLiveCameraFrame(video) {
      freshnessWaits.push(video);
      return true;
    },
    hideCameraError() {
      hideErrors += 1;
    },
    showCameraError(error) {
      cameraErrors.push(error);
    },
  };
  vm.createContext(context);
  new vm.Script(`let cameraRequestPromise=null; let cameraRequestAttempted=false;
    ${reusableCameraSource}; ${startCameraSource};
    globalThis.__startCamera = startCamera;`).runInContext(context);

  return {
    startCamera: context.__startCamera,
    videos,
    stream,
    getUserMediaCalls,
    freshnessWaits,
    cameraErrors,
    get hideErrors() { return hideErrors; },
    get inlineConfigurations() { return inlineConfigurations; },
  };
}

test('startCamera attaches a mocked calibration stream and starts decoded-frame freshness', async () => {
  const harness = makeHarness();
  const result = await harness.startCamera('calibVideo');
  const calibVideo = harness.videos.get('calibVideo');

  assert.equal(result, true);
  assert.equal(calibVideo.srcObject, harness.stream);
  assert.equal(calibVideo.playCalls, 1);
  assert.equal(harness.getUserMediaCalls.length, 1);
  assert.equal(harness.getUserMediaCalls[0].audio, false);
  assert.deepEqual(harness.freshnessWaits, [calibVideo]);
  assert.deepEqual(harness.cameraErrors, []);
  assert.equal(harness.hideErrors, 1);
  assert.equal(harness.inlineConfigurations, 1);
});

test('startCamera attaches a mocked game stream and awaits decoded-frame freshness without a ReferenceError', async () => {
  const harness = makeHarness();
  const result = await harness.startCamera('gameVideo');
  const gameVideo = harness.videos.get('gameVideo');

  assert.equal(result, true);
  assert.equal(gameVideo.srcObject, harness.stream);
  assert.equal(gameVideo.playCalls, 1);
  assert.equal(harness.getUserMediaCalls.length, 1);
  assert.deepEqual(harness.freshnessWaits, [gameVideo]);
  assert.deepEqual(harness.cameraErrors, []);
  assert.equal(harness.hideErrors, 1);
  assert.equal(harness.inlineConfigurations, 1);
});

test('calibration and game transitions reuse one active stream and one permission request', async () => {
  const harness=makeHarness();
  assert.equal(await harness.startCamera('calibVideo'),true);
  assert.equal(await harness.startCamera('gameVideo'),true);
  assert.equal(harness.getUserMediaCalls.length,1);
  assert.equal(harness.videos.get('calibVideo').srcObject,harness.stream);
  assert.equal(harness.videos.get('gameVideo').srcObject,harness.stream);
  assert.deepEqual(harness.freshnessWaits,[
    harness.videos.get('calibVideo'),
    harness.videos.get('gameVideo'),
  ]);
});
