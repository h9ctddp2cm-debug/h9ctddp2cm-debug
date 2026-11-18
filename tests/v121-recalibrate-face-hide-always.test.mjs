// v121: "重新校準" button on the calibration screen + backport of the live
// v115–v120 bundle changes (camera re-acquire, calibration stall watchdog,
// hand-landmarker recovery, peg un-pinch prep, face-hide always on).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

function functionSource(name){
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for(let i = open; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

/* ---------- release markers ---------- */

test('v121 release markers', () => {
  assert.match(html, /const LEVEL_APP_BUILD = "v125-20261118-supermarket-story";/);
  assert.match(html, /perf v125/);
  assert.match(sw, /^const CACHE_VERSION = "fthue-rehab-v125-20261118-supermarket-story";/);
  assert.match(manifest, /v125-20261118-supermarket-story/);
});

/* ---------- 重新校準 button ---------- */

test('v121 calibration screen has a 重新校準 button that fully resets the hand calibration', () => {
  assert.match(html, /<button class="btn-secondary" id="btnRecalibrate" type="button" data-testid="button-recalibrate"/);
  assert.match(html, /id="btnRecalibrate"[^>]*>重新校準<\/button>/);
  const fn = functionSource('recalibrateFromCalibrationScreen');
  assert.match(fn, /if\(research\.active\)\{[\s\S]*resetResearchCalibration\(\);[\s\S]*\}else\{\s*resetNormalCalibration\(\);/);
  assert.match(fn, /resetToolPinchAdapt\(\);/);
  assert.match(fn, /resetHandAdmissionAndLock\(\);/);
  assert.match(fn, /calibDetectedOnce = false;/);
  assert.match(fn, /calibDotEmaX = -1; calibDotEmaY = -1;/);
  assert.match(fn, /resetCalibStall\(\);/);
  assert.match(fn, /hideCalibForceStart\(\);/);
  assert.match(fn, /startBtn\.disabled = true;/);
  assert.match(fn, /status\.textContent = '已重設 · 請患手再次入鏡';/);
  assert.match(fn, /updateCalibrationCopy\(\);/);
  assert.match(html, /document\.getElementById\('btnRecalibrate'\)\.addEventListener\('click', \(\)=>\{\s*recalibrateFromCalibrationScreen\(\);/);
});

/* ---------- v117 backport: camera re-acquire + calibration stall watchdog ---------- */

test('v117 backport: startCamera can force a fresh stream a bounded number of times', () => {
  const fn = functionSource('startCamera');
  assert.match(html, /const CAMERA_REACQUIRE_MAX=8;/);
  assert.match(fn, /if\(reusable && !options\.forceReacquire\)\{/);
  assert.match(fn, /if\(cameraRequestAttempted && !hadStream\)\{/);
  assert.match(fn, /cameraReacquireCount >= CAMERA_REACQUIRE_MAX/);
  assert.match(fn, /waitForLiveCameraFrame\(videoEl, waitMs\)/);
  assert.match(functionSource('ensureGameCameraPlayback'), /startCamera\('gameVideo', \{ forceReacquire:true, timeoutMs:3500 \}\)/);
});

test('v117 backport: calibration stall watchdog and 10 s force-start escape hatch', () => {
  assert.match(html, /const CALIB_STALL_REACQUIRE_MS = 2500;/);
  assert.match(html, /const CALIB_STALL_MAX_ATTEMPTS = 2;/);
  assert.match(html, /const CALIB_FORCE_START_AFTER_MS = 10000;/);
  assert.match(html, /<button class="btn-secondary" id="btnCalibForceStart" type="button" hidden/);
  assert.match(html, /校準未完成？直接開始 ▶/);
  const loop = functionSource('startCalibLoop');
  assert.match(loop, /calibCameraStallWatchdog\(/);
  assert.match(loop, /updateCalibForceStart\(/);
  assert.match(functionSource('enterCalibrationFlow'), /calibEnteredAt = performance\.now\(\);/);
  assert.match(functionSource('enterCalibrationFlow'), /hideCalibForceStart\(\);/);
  assert.match(html, /document\.getElementById\('btnCalibForceStart'\)\.addEventListener\('click', \(\)=>\{[\s\S]{0,120}beginGameFromCalibration\(\);/);
});

test('v116/v117 backport: hand landmarker recovery after a detect failure streak', () => {
  assert.match(html, /const HAND_DETECT_FAIL_RESET_STREAK = 20;/);
  assert.ok(html.includes('function recoverHandLandmarker('), 'recoverHandLandmarker missing');
  assert.match(functionSource('preferredHandDelegate'), /handDelegateRuntimeOverride/);
});

test('v119+ backport: public in-game camera stall watchdog is public-only', () => {
  assert.match(html, /const PUBLIC_CAMERA_STALL_PLAY_MS = 4000;/);
  assert.match(html, /const PUBLIC_CAMERA_STALL_REACQUIRE_MS = 9000;/);
  assert.match(html, /const PUBLIC_CAMERA_STALL_RETRY_GAP_MS = 6000;/);
  assert.match(functionSource('initGame'), /resetPublicCameraStall\(\);/);
  assert.match(functionSource('gameLoop'), /!research\.active && !state\.qaMode[\s\S]{0,80}publicCameraStallWatchdog\(/);
});

/* ---------- v115 backport: peg un-pinch prep ---------- */

test('v115 backport: a 400 ms sustained un-pinch arms the peg release (public only)', () => {
  assert.match(html, /const PUBLIC_PEG_UNPINCHED_PREP_MS = 400;/);
  assert.match(html, /pegUnpinchedSustained/);
  assert.match(html, /isOpenPrep:!pinchHeld && \(!research\.active && isLevel6\(\)[\s\S]{0,160}pinch\.valid && \(pinch\.isSeparated \|\| pegUnpinchedSustained\)/);
  assert.match(functionSource('resetToolPinchAdapt'), /pegUnpinchedSinceMs\s*=\s*0/);
});

/* ---------- v118/v120 backport: face-hide always on ---------- */

test('v118/v120 backport: face-hide privacy mode is the default and the toggle is hidden', () => {
  assert.match(html, /\n  privacyFaceHide:true,/);
  assert.match(html, /const PRIVACY_MODE_STORAGE_KEY = 'nivr\.privacyMode\.v118';/);
  assert.match(functionSource('faceHideEnabled'), /privacyBlurEnabled\(\) && state\.privacyFaceHide === true/);
  assert.match(html, /\.game-stage\.face-hide video#gameVideo\{ filter:blur\(18px\) saturate\(\.85\); \}/);
  // v120: the mode is forced on at load; the button stays in the DOM for QA but is hidden.
  assert.match(functionSource('loadPrivacyMode'), /privacyFaceHide = true/);
  assert.match(functionSource('applyPrivacyBlurMode'), /classList\.toggle\('face-hide'/);
  assert.match(functionSource('applyPrivacyBlurMode'), /style\.display\s*=\s*'none'/);
  const loop = functionSource('startCalibLoop');
  assert.match(loop, /if\(privacyBlurEnabled\(\) && !faceHideEnabled\(\)\) ensurePrivacySegmenter\(\);/);
  // Game canvas: the mirrored camera frame is blurred when face-hide is on.
  assert.ok((html.match(/ctx\.filter\s*=\s*'blur\(14px\)'/g) || []).length >= 2, 'both gameVideo drawImage sites blur');
});

/* ---------- browser behaviour ---------- */

let browser;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    browser = null;
    console.warn('playwright unavailable; v121 browser tests skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

async function withPage(fn){
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__qa && typeof window.__qa.startGame === 'function');
  try{
    await fn(page);
  }finally{
    await context.close();
  }
  assert.deepEqual(errors.map(String), []);
}

test('v121 clicking 重新校準 clears the personal tool calibration and disables 開始遊戲', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      window.__qa.selectLevel('67');
      window.__qa.selectLevel6Task('peg');
      const before = window.__qa.setLevel6PersonalToolCalibration({ pinch: { closed: 0.08, open: 0.30 } });
      const startBtn = document.getElementById('btnStartGame');
      startBtn.disabled = false;
      const btn = document.getElementById('btnRecalibrate');
      const out = { hadPinch: !!before.personalToolPinch, btnVisible: !btn.hidden, btnText: btn.textContent.trim() };
      btn.click();
      const after = window.__qa.level6ToolState();
      out.pinchAfter = after.personalToolPinch;
      out.startDisabled = startBtn.disabled;
      out.status = document.getElementById('pixelCount').textContent;
      out.forceStartHidden = document.getElementById('btnCalibForceStart').hidden;
      return out;
    });
    assert.equal(r.hadPinch, true);
    assert.equal(r.btnVisible, true);
    assert.equal(r.btnText, '重新校準');
    assert.equal(r.pinchAfter, null);
    assert.equal(r.startDisabled, true);
    assert.equal(r.status, '已重設 · 請患手再次入鏡');
    assert.equal(r.forceStartHidden, true);
  });
});

test('v120 face-hide is on by default and the privacy toggle button is not shown', async t => {
  if(!browser) return t.skip('playwright unavailable');
  await withPage(async page => {
    const r = await page.evaluate(() => {
      const btn = document.getElementById('btnPrivacyBlur');
      const stage = document.querySelector('.game-stage');
      const wrap = document.getElementById('calibOverlay').parentElement;
      return {
        label: btn.textContent,
        hidden: btn.hidden && getComputedStyle(btn).display === 'none',
        stageFaceHide: stage.classList.contains('face-hide'),
        calibBlur: wrap.classList.contains('privacy-blur'),
      };
    });
    assert.equal(r.label, '遮面：開（只見手）');
    assert.equal(r.hidden, true);
    assert.equal(r.stageFaceHide, true);
    assert.equal(r.calibBlur, true);
  });
});
