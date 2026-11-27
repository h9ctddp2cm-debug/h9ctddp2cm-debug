import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v147 — the games are also played on a wall-mounted screen at the department
// entrance, driven by a Windows laptop and its webcam. Two complaints:
// people walking past take over the tracking, and the picture feels slow.
//   1. Detection box: a green box on the calibration page; only the picture
//      inside it is sent to the hand / pose models, and the returned points are
//      converted back to whole-frame coordinates. Saved on the device.
//   2. Levels 3–4 main-subject lock: a pose that is much smaller than the
//      calibrated patient, or that jumps away in a single frame, is not used.
//   3. Camera request 640×360 at 30 frames a second (was 960×540).
//   4. No blur on the invisible camera picture; solid instruction panel.
//   5. "顯示速度" switch on the settings page (off by default).
// No movement threshold is changed and Level 5/6 still has no smoothing.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const localization = readFileSync(path.join(root, 'localization.js'), 'utf8');
const sw = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const require = createRequire(import.meta.url);
const api = require(path.join(root, 'shoulder-flexion-controller.js'));

test('release markers', () => {
  assert.match(sw, /const CACHE_VERSION = "fthue-rehab-v147-20261127-detect-box";/);
  assert.match(html, /const LEVEL_APP_BUILD = "v147-20261127-detect-box";/);
  assert.match(manifest, /"start_url": "\.\/index\.html\?build=v147-20261127-detect-box"/);
  assert.match(html, /perf v147/);
});

test('detection thresholds and frame pacing are untouched', () => {
  assert.match(html, /numHands:\s*2/);
  assert.match(html, /PUBLIC_GAME_WORK_INTERVAL_MS\s*=\s*1000\s*\/\s*30/);
  assert.match(html, /PUBLIC_CANVAS_MAX_EDGE\s*=\s*1600/);
  assert.match(html, /minPoseDetectionConfidence:0\.25,\s*minPosePresenceConfidence:0\.25,\s*minTrackingConfidence:0\.25/);
  assert.match(html, /numPoses: 1/);
  assert.equal(api.CONFIG.patientGateStableFrames, 2);
  assert.equal(api.CONFIG.smoothAlpha, 0.42);
  assert.equal(api.CONFIG.patientRearmDropDeg, 10);
});

test('both models are fed the cropped box and their points are converted back', () => {
  assert.match(html, /const crop = detectBoxCropSource\(videoEl, DETECT_BOX_HAND_MARGIN, 'hand'\);\s*results = handLandmarker\.detectForVideo\(crop \? crop\.canvas : videoEl, nextTs\('hand'\)\);\s*if\(crop && results\) detectBoxRemapLandmarks\(results\.landmarks, crop\);/);
  assert.match(html, /const res = poseLandmarker\.detectForVideo\(crop \? crop\.canvas : videoEl, nextTs\('pose'\)\);\s*if\(crop && res\) detectBoxRemapLandmarks\(res\.landmarks, crop\);/);
  assert.match(html, /const DETECT_BOX_DEFAULT = Object\.freeze\(\{ x0:0\.12, x1:0\.88 \}\);/);
  assert.match(html, /const DETECT_BOX_STORAGE_KEY = 'fthue\.detectBox\.v147';/);
});

test('wasted effects are removed, the visible camera stays blurred', () => {
  assert.match(html, /\.game-stage\.face-hide video#gameVideo\{ filter:blur\(18px\) saturate\(\.85\); \}/);
  assert.match(html, /\.game-stage\.face-hide\.white-game-background video#gameVideo\{ filter:none; \}/);
  const advPanel = html.slice(html.indexOf('.adv-panel{position:absolute'), html.indexOf('.adv-panel .ap-step'));
  assert.doesNotMatch(advPanel, /backdrop-filter/);
  const simpleHud = html.slice(html.indexOf('.game-stage.patient-simple-hud .adv-panel{'),
    html.indexOf('.game-stage.patient-simple-hud .adv-panel > '));
  assert.doesNotMatch(simpleHud, /backdrop-filter/);
  assert.match(simpleHud, /background:#fff/);
});

test('new on-screen wording has English', () => {
  for(const zh of ['偵測範圍（綠框）', '病人坐喺綠框入面。框外嘅人唔會被追蹤。', '左邊界', '右邊界',
    '還原預設（中間 76%）', '顯示速度', '關（預設）', '開（顯示）']){
    assert.ok(html.includes(zh), zh + ' is on the page');
    assert.ok(localization.includes("'" + zh + "':'"), zh + ' has English');
  }
});

// ---------------------------- subject lock (pure) ----------------------------
const body = (cx, cy, width) => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }));
  lm[11] = { x: cx + width / 2, y: cy, z: 0, visibility: 1 };
  lm[12] = { x: cx - width / 2, y: cy, z: 0, visibility: 1 };
  return lm;
};

test('subject lock: baseline comes from the calibration page', () => {
  const lock = api.createSubjectLock();
  for(let i = 0; i < 10; i++) lock.observeCalibration(body(0.50, 0.40, 0.20), 1);
  const s = lock.begin();
  assert.equal(s.fromCalibration, true);
  assert.ok(Math.abs(s.baselineWidth - 0.20) < 1e-9);
  assert.ok(Math.abs(s.cx - 0.50) < 1e-9 && Math.abs(s.cy - 0.40) < 1e-9);
  assert.equal(lock.admit(body(0.51, 0.40, 0.20), 1, 0).accept, true);
});

test('subject lock: a far-away passer-by (under 60% size) is refused, the patient is not', () => {
  const lock = api.createSubjectLock();
  for(let i = 0; i < 10; i++) lock.observeCalibration(body(0.50, 0.40, 0.20), 1);
  lock.begin();
  let t = 0;
  assert.equal(lock.admit(body(0.50, 0.40, 0.20), 1, t += 33).accept, true);
  const far = lock.admit(body(0.52, 0.38, 0.11), 1, t += 33);   // 55% of the baseline
  assert.deepEqual(far, { accept: false, reason: 'too-small' });
  // exactly on the 60% line is still the patient (lenient side)
  assert.equal(lock.admit(body(0.50, 0.40, 0.121), 1, t += 33).accept, true);
  // leaning, shifting in the chair or sitting a little further back is fine
  assert.equal(lock.admit(body(0.56, 0.42, 0.17), 1, t += 33).accept, true);
  assert.equal(lock.admit(body(0.60, 0.43, 0.15), 1, t += 33).accept, true);
  assert.equal(lock.snapshot().sizeRejected, 1);
});

test('subject lock: a single-frame jump to somebody else is refused, then let go after 2.5 s', () => {
  const lock = api.createSubjectLock();
  for(let i = 0; i < 10; i++) lock.observeCalibration(body(0.40, 0.40, 0.20), 1);
  lock.begin();
  let t = 1000;
  assert.equal(lock.admit(body(0.40, 0.40, 0.20), 1, t).accept, true);
  // same size, but 0.35 away (more than one shoulder width) in one frame
  assert.deepEqual(lock.admit(body(0.75, 0.40, 0.20), 1, t += 33), { accept: false, reason: 'jump' });
  // the patient is seen again: accepted at once, the timer is cleared
  assert.equal(lock.admit(body(0.41, 0.40, 0.20), 1, t += 33).accept, true);
  // a real move (e.g. the wheelchair was pushed aside): held 2.5 s, then followed
  const start = t + 33;
  assert.equal(lock.admit(body(0.75, 0.40, 0.20), 1, start).accept, false);
  assert.equal(lock.admit(body(0.75, 0.40, 0.20), 1, start + 2400).accept, false);
  assert.deepEqual(lock.admit(body(0.75, 0.40, 0.20), 1, start + 2500), { accept: true, reason: 'relocked' });
  assert.equal(lock.admit(body(0.76, 0.40, 0.20), 1, start + 2533).reason, 'locked');
});

test('subject lock: a much smaller body is only followed after 6 s, and the size is learned again', () => {
  const lock = api.createSubjectLock();
  for(let i = 0; i < 10; i++) lock.observeCalibration(body(0.50, 0.40, 0.20), 1);
  lock.begin();
  assert.equal(lock.admit(body(0.50, 0.40, 0.20), 1, 0).accept, true);
  assert.equal(lock.admit(body(0.50, 0.40, 0.08), 1, 100).accept, false);
  assert.equal(lock.admit(body(0.50, 0.40, 0.08), 1, 5900).accept, false);
  assert.equal(lock.admit(body(0.50, 0.40, 0.08), 1, 6100).reason, 'relocked');
  assert.ok(Math.abs(lock.snapshot().baselineWidth - 0.08) < 1e-9);
  // when the bigger (nearer) patient is back the baseline grows quickly again
  for(let i = 0; i < 20; i++) lock.admit(body(0.50, 0.40, 0.20), 1, 6200 + i * 33);
  assert.ok(lock.snapshot().baselineWidth > 0.19);
  assert.equal(lock.admit(body(0.50, 0.40, 0.10), 1, 7000).accept, false);
});

test('subject lock: without calibration it learns in the game; unreadable shoulders pass through', () => {
  const lock = api.createSubjectLock();
  lock.begin();
  assert.equal(lock.snapshot().fromCalibration, false);
  for(let i = 0; i < 6; i++) assert.equal(lock.admit(body(0.5, 0.4, 0.18), 1, i * 33).reason, 'learning');
  assert.ok(Math.abs(lock.snapshot().baselineWidth - 0.18) < 1e-9);
  assert.equal(lock.admit(body(0.5, 0.4, 0.09), 1, 300).accept, false);
  const hidden = body(0.5, 0.4, 0.18); hidden[11].visibility = 0.1;
  assert.deepEqual(lock.admit(hidden, 1, 333), { accept: true, reason: 'unmeasured' });
  assert.deepEqual(lock.admit(null, 1, 366), { accept: true, reason: 'unmeasured' });
  assert.equal(api.SUBJECT_LOCK_CONFIG.minSizeRatio, 0.60);
});

// ---------------------------- in the browser ----------------------------
let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(e){ browser = null; }
});
after(async () => { if(browser) await browser.close(); });

async function openPage(init){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await context.addInitScript(() => {
    try{
      const s = window.speechSynthesis;
      s.speak = u => { setTimeout(() => { try{ u.onend && u.onend({}); }catch(e){} }, 0); };
      s.cancel = () => {};
    }catch(e){}
  });
  if(init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { context, page, errors };
}

test('detection box: default, limits, saving and the region sent to each model', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa.detectBox, out = {};
      out.initial = q.get();
      out.camera = q.camera();
      out.poseRegion = q.region(640, 360, 0);
      out.handRegion = q.region(640, 360, 0.06);
      out.portrait = q.region(360, 640, 0);
      out.noVideo = q.region(0, 0, 0);
      out.narrow = q.set({ x0: 0.225, x1: 0.775 });
      out.stored = JSON.parse(localStorage.getItem('fthue.detectBox.v147'));
      out.tooNarrow = q.set({ x0: 0.45, x1: 0.55 });
      out.full = q.set({ x0: 0, x1: 1 });
      out.fullRegion = q.region(640, 360, 0);
      out.swapped = q.set({ x0: 0.9, x1: 0.2 });
      out.bad = q.set({ x0: 'a', x1: null });
      localStorage.setItem('fthue.detectBox.v147', '{"x0":0.3,"x1":0.8}');
      out.reloaded = q.reload();
      out.reset = q.reset();
      return out;
    });
    assert.deepEqual(r.initial, { x0: 0.12, x1: 0.88 });
    assert.deepEqual(r.camera, { long: 640, short: 360, fps: 30, hd: false });
    assert.deepEqual(r.poseRegion, { x0: 0.12, x1: 0.88 });
    assert.ok(Math.abs(r.handRegion.x0 - 0.06) < 1e-9 && Math.abs(r.handRegion.x1 - 0.94) < 1e-9);
    assert.equal(r.portrait, null, 'an upright (portrait) camera frame is not cropped');
    assert.equal(r.noVideo, null);
    assert.deepEqual(r.narrow, { x0: 0.225, x1: 0.775 });
    assert.deepEqual(r.stored, { x0: 0.225, x1: 0.775 });
    assert.ok(Math.abs((r.tooNarrow.x1 - r.tooNarrow.x0) - 0.30) < 1e-9, 'never narrower than 30%');
    assert.deepEqual(r.full, { x0: 0, x1: 1 });
    assert.equal(r.fullRegion, null, 'a full-width box takes the original uncropped path');
    assert.deepEqual(r.swapped, { x0: 0.2, x1: 0.9 });
    assert.deepEqual(r.bad, { x0: 0.12, x1: 0.88 });
    assert.deepEqual(r.reloaded, { x0: 0.3, x1: 0.8 });
    assert.deepEqual(r.reset, { x0: 0.12, x1: 0.88 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('detection box: the crop really cuts the picture and points map back to the whole frame', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa.detectBox;
      // a fake 640×360 camera frame: red on the left 20%, green in the middle, blue on the right 20%
      const frame = document.createElement('canvas'); frame.width = 640; frame.height = 360;
      const g = frame.getContext('2d');
      g.fillStyle = '#ff0000'; g.fillRect(0, 0, 128, 360);
      g.fillStyle = '#00ff00'; g.fillRect(128, 0, 384, 360);
      g.fillStyle = '#0000ff'; g.fillRect(512, 0, 128, 360);
      frame.videoWidth = 640; frame.videoHeight = 360;
      const out = {};
      q.set({ x0: 0.25, x1: 0.75 });
      out.pose = q.crop(frame, 0);          // 160..480 → all green
      out.hand = q.crop(frame, 0.06);       // 122..518 → starts in red
      const crop = { x0: 0.25, scale: 0.5 };
      out.mapped = q.remap([[{ x: 0, y: 0.3, z: -0.2 }, { x: 1, y: 0.9, z: 0.1 }, { x: 0.5, y: 0.5, z: 0 }]], crop);
      out.untouched = q.remap([[{ x: 0.4, y: 0.3, z: 0.2 }]], null);
      q.set({ x0: 0, x1: 1 });
      out.fullCrop = q.crop(frame, 0);
      q.reset();
      return out;
    });
    assert.equal(r.pose.width, 320); assert.equal(r.pose.height, 360);
    assert.equal(r.pose.x0, 0.25); assert.equal(r.pose.scale, 0.5);
    assert.deepEqual(r.pose.pixel.slice(0, 3), [0, 255, 0], 'the pose picture starts inside the box');
    assert.equal(r.hand.width, 397);
    assert.deepEqual(r.hand.pixel.slice(0, 3), [255, 0, 0], 'the hand picture keeps a small margin');
    assert.deepEqual(r.mapped[0][0], { x: 0.25, y: 0.3, z: -0.1 });
    assert.deepEqual(r.mapped[0][1], { x: 0.75, y: 0.9, z: 0.05 });
    assert.deepEqual(r.mapped[0][2], { x: 0.5, y: 0.5, z: 0 });
    assert.deepEqual(r.untouched[0][0], { x: 0.4, y: 0.3, z: 0.2 });
    assert.equal(r.fullCrop, null);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 5/6 cursor: default box changes nothing; a narrower box still reaches both screen edges', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa.detectBox, out = {};
      const xs = [0.05, 0.12, 0.3, 0.5, 0.7, 0.88, 0.95];
      const run = () => xs.map(x => +q.mapPoint(x, 0.5, 1600, 900, 640, 360).x.toFixed(2));
      out.noCamera = run();                              // the game video has no frame yet
      const video = document.getElementById('gameVideo');
      Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => 640 });
      Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => 360 });
      out.defaultBox = run();
      q.set({ x0: 0, x1: 1 }); out.fullBox = run();
      q.set({ x0: 0.25, x1: 0.75 }); out.narrowBox = run();
      out.narrowEdges = [q.mapPoint(0.25, 0.5, 1600, 900, 640, 360).x, q.mapPoint(0.75, 0.5, 1600, 900, 640, 360).x];
      q.set({ x0: 0.30, x1: 0.88 });                      // mirrored view: raw 0.30–0.88 shows as 0.12–0.70
      out.mirrorRange = q.displayRange(640, 360);
      out.sliders = q.sliders();
      q.reset();
      return out;
    });
    assert.deepEqual(r.defaultBox, r.noCamera, 'default 76% box = the reach range used before');
    assert.deepEqual(r.fullBox, r.noCamera, 'a wider box does not change the reach range');
    assert.deepEqual(r.noCamera, [0, 0, 378.95, 800, 1221.05, 1600, 1600]);
    assert.deepEqual(r.narrowEdges, [0, 1600]);
    assert.equal(r.narrowBox[3], 800);
    assert.ok(Math.abs(r.mirrorRange.left - 0.12) < 1e-9 && Math.abs(r.mirrorRange.right - 0.70) < 1e-9);
    assert.deepEqual(r.sliders, { left: 12, right: 70 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('calibration page: the green box card appears only with a landscape camera; sliders save', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(async () => {
      const out = {};
      const card = document.getElementById('detectBoxCard');
      out.hiddenAtFirst = card.hidden;
      const left = document.getElementById('detectBoxLeft'), right = document.getElementById('detectBoxRight');
      left.value = '20'; left.dispatchEvent(new Event('input', { bubbles: true }));
      right.value = '70'; right.dispatchEvent(new Event('input', { bubbles: true }));
      out.afterSliders = window.__qa.detectBox.get();     // mirrored view by default
      out.label = document.getElementById('detectBoxWidthLabel').textContent;
      out.stored = JSON.parse(localStorage.getItem('fthue.detectBox.v147'));
      document.getElementById('btnDetectBoxReset').click();
      out.afterReset = window.__qa.detectBox.get();
      out.sliderAfterReset = [left.value, right.value];
      out.gameHasNoBox = !document.querySelector('#screen-game #detectBoxCard, .game-stage #detectBoxCard');
      return out;
    });
    assert.equal(r.hiddenAtFirst, true);
    assert.deepEqual(r.afterSliders, { x0: 0.3, x1: 0.8 });
    assert.equal(r.label, '闊 50%');
    assert.deepEqual(r.stored, { x0: 0.3, x1: 0.8 });
    assert.deepEqual(r.afterReset, { x0: 0.12, x1: 0.88 });
    assert.deepEqual(r.sliderAfterReset, ['12', '88']);
    assert.equal(r.gameHasNoBox, true, 'the box controls live on the calibration page only');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a saved box is used again after reloading the page', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage(() => {
    try{ localStorage.setItem('fthue.detectBox.v147', '{"x0":0.2,"x1":0.7}'); }catch(e){}
  });
  try{
    assert.deepEqual(await page.evaluate(() => window.__qa.detectBox.get()), { x0: 0.2, x1: 0.7 });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 3: a passer-by pose is ignored in the game and the patient keeps control', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa, out = {};
      q.startGame({ level: '3', theme: 'bowlinglane', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0 });
      q.subjectLock.reset(); q.subjectLock.begin(); q.subjectLock.enable(true);
      const L = 0.26;
      const pose = (deg, frames, sh, width, armScale) => {
        const r = deg * Math.PI / 180, len = L * (armScale || 1);
        for(let i = 0; i < frames; i++){
          window.advanceTime(33, 1);
          q.setLevel4Pose({ shoulder: sh, otherShoulder: { x: sh.x + width, y: sh.y },
            elbow: { x: sh.x + Math.sin(r) * len * 0.5, y: sh.y + Math.cos(r) * len * 0.5 },
            wrist: { x: sh.x + Math.sin(r) * len, y: sh.y + Math.cos(r) * len }, frames: 1 });
        }
        const s = q.shoulderFlexionState();
        return { phase: s.phase, reps: s.repetitions, raw: s.rawAngle, progress: s.progress, lock: q.subjectLock.snapshot() };
      };
      const patient = { x: 0.42, y: 0.42 };
      out.rest = pose(0, 60, patient, 0.18);
      // a small figure far behind, arm up — must not move the game
      out.passerBy = pose(110, 30, { x: 0.47, y: 0.36 }, 0.07, 0.4);
      // same size but one frame later at the other side of the picture
      out.jumper = pose(110, 10, { x: 0.74, y: 0.42 }, 0.18);
      // the patient lifts the arm: this is used
      out.patientUp = pose(96, 20, patient, 0.18);
      return out;
    });
    // (each synthetic frame runs the tracking step twice: once on the clock
    // tick with the previous pose and once with the new pose)
    assert.equal(r.rest.lock.rejected, 0);
    assert.equal(r.rest.progress, 0, 'arm is down at rest');
    assert.ok(r.passerBy.lock.sizeRejected >= 30, 'every passer-by frame was refused');
    assert.equal(r.passerBy.raw, r.rest.raw, 'the game stayed where the patient left it');
    assert.equal(r.passerBy.progress, 0);
    assert.equal(r.passerBy.phase, r.rest.phase);
    assert.equal(r.passerBy.reps, r.rest.reps);
    assert.ok(r.jumper.lock.jumpRejected >= 10);
    assert.equal(r.jumper.raw, r.rest.raw);
    assert.equal(r.jumper.progress, 0);
    assert.ok(r.patientUp.lock.rejected - r.jumper.lock.rejected <= 1, 'the patient was not refused');
    assert.equal(r.patientUp.progress, 1, 'the patient\'s own lift is followed again at once');
    assert.notEqual(r.patientUp.phase, r.rest.phase);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Level 3 without the lock switch in QA behaves exactly as before', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa;
      q.startGame({ level: '3', theme: 'bowlinglane', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0 });
      for(let i = 0; i < 20; i++){ window.advanceTime(33, 1); q.setLevel4Pose({ shoulder: { x: 0.42, y: 0.42 }, otherShoulder: { x: 0.6, y: 0.42 }, elbow: { x: 0.42, y: 0.55 }, wrist: { x: 0.42, y: 0.68 }, frames: 1 }); }
      for(let i = 0; i < 20; i++){ window.advanceTime(33, 1); q.setLevel4Pose({ shoulder: { x: 0.8, y: 0.42 }, otherShoulder: { x: 0.85, y: 0.42 }, elbow: { x: 0.8, y: 0.5 }, wrist: { x: 0.8, y: 0.58 }, frames: 1 }); }
      return q.subjectLock.snapshot();
    });
    assert.equal(r.rejected, 0);
    assert.equal(r.accepted, 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('speed display: off by default, simple three numbers when on, remembered on the device', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage();
  try{
    const r = await page.evaluate(() => {
      const q = window.__qa, out = {};
      out.defaultOn = q.speedDisplay.get();
      out.preview = document.getElementById('preview-speed-display').textContent;
      q.startGame({ level: '5', theme: 'dimsum', duration: 600, affectedSide: 'right', dwellMs: 0 });
      out.offTick = q.speedDisplay.tick();
      document.querySelector('[data-testid="button-speed-display-on"]').click();
      out.on = q.speedDisplay.get();
      out.stored = localStorage.getItem('fthue.speedDisplay.v147');
      out.previewOn = document.getElementById('preview-speed-display').textContent;
      out.text = q.speedDisplay.text({ fps: 27.6, trackMs: 34.4, video: [640, 360] });
      out.onTick = q.speedDisplay.tick();
      document.querySelector('[data-testid="button-speed-display-off"]').click();
      out.offAgain = { on: q.speedDisplay.get(), display: document.getElementById('framePerfOverlay').style.display };
      out.poseDelegate = q.speedDisplay.poseDelegate();
      return out;
    });
    assert.equal(r.defaultOn, false);
    assert.equal(r.preview, '關');
    assert.equal(r.offTick, null, 'nothing is drawn while the switch is off');
    assert.equal(r.on, true);
    assert.equal(r.stored, 'on');
    assert.equal(r.previewOn, '開');
    assert.equal(r.text, '速度 v147  每秒 28 幀\n追蹤 34 毫秒  鏡頭 640×360');
    assert.match(r.onTick.text, /^速度 v147 {2}每秒 \d+ 幀\n追蹤 \d+ 毫秒 {2}鏡頭 \d+×\d+$/);
    assert.equal(r.onTick.display, 'block');
    assert.deepEqual(r.offAgain, { on: false, display: 'none' });
    assert.equal(r.poseDelegate, 'GPU');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('the switch survives a reload, and ?perf=1 still shows the detailed box', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openPage(() => {
    try{ localStorage.setItem('fthue.speedDisplay.v147', 'on'); }catch(e){}
  });
  try{
    assert.equal(await page.evaluate(() => window.__qa.speedDisplay.get()), true);
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?perf=1&poseDelegate=cpu&cam=hd', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const q = window.__qa;
      q.startGame({ level: '3', theme: 'bowlinglane', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0 });
      return { tick: q.speedDisplay.tick(), pose: q.speedDisplay.poseDelegate(), cam: q.detectBox.camera() };
    });
    assert.match(r.tick.text, /^perf v147 {2}/);
    assert.match(r.tick.text, /姿勢模型/);
    assert.match(r.tick.text, /偵測框 .*主角鎖定 .*路人拒絕 \d+/);
    assert.equal(r.pose, 'CPU');
    assert.equal(r.cam.hd, true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
