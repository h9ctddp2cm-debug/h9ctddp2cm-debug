import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';

// v112 — therapist / IRB request (12 Sep): the public website must have no
// recording capability at all. Every level shows one 「訓練」 button that
// behaves exactly like the former 試玩 mode (no recording, no therapist
// alerts, practice-only progression text). The MediaRecorder module and the
// recording training mode survive only in the source/research build behind
// PUBLIC_BUILD_REMOVE markers.
const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const publicIndex = path.join(root, 'dist/public/index.html');

test('source: every level offers one non-recording 訓練 button and a marked recording variant', () => {
  for (const level of ['2', '3', '4', '5', '67']) {
    const tag = level === '67' ? '6' : level;
    assert.match(html, new RegExp(`data-testid="button-mode-trial-${level}" aria-label="FTHUE Level ${tag} 訓練">訓練</button>`));
    assert.match(html, new RegExp(`data-testid="button-mode-training-${level}" aria-label="FTHUE Level ${tag} 訓練及錄影，提示治療師">訓練＋錄影</button>`));
  }
  assert.equal((html.match(/PUBLIC_BUILD_REMOVE_START: recording training mode/g) || []).length, 5);
  assert.doesNotMatch(html, /不錄影及不提示治療師/);
});

test('source: recording module, indicator and review panel are marked for public removal', () => {
  assert.match(html, /PUBLIC_BUILD_REMOVE_START: movement recording module/);
  assert.match(html, /PUBLIC_BUILD_REMOVE_START: silent recording indicator/);
  assert.match(html, /PUBLIC_BUILD_REMOVE_START: movement video review panel/);
  assert.match(html, /PUBLIC_BUILD_REMOVE_START: movement video review controls/);
  // Real module still present for the research build.
  assert.match(html, /new MediaRecorder\(privacyStream/);
});

test('source: call sites go through the facade and the public build can only run the non-recording mode', () => {
  assert.match(html, /const movementRecordingApi = \(typeof startMovementRecording === 'function'\)/);
  assert.match(html, /state\.sessionMode = \(mode === 'trial' \|\| !movementRecordingApi\.available\) \? 'trial' : 'training';/);
  assert.match(html, /state\.sessionMode = movementRecordingApi\.available \? 'training' : 'trial';/);
  assert.match(html, /movementRecordingApi\.start\(\);/);
  assert.match(html, /movementRecordingApi\.stop\(true\);/);
  // No direct calls outside the marked module / review controls.
  const outside = html
    .replace(/\/\* PUBLIC_BUILD_REMOVE_START: movement recording module[\s\S]*?PUBLIC_BUILD_REMOVE_END \*\//, '')
    .replace(/\/\* PUBLIC_BUILD_REMOVE_START: movement video review controls[\s\S]*?PUBLIC_BUILD_REMOVE_END \*\//, '')
    .replace(/const movementRecordingApi[\s\S]*?\};\n/, '');
  assert.doesNotMatch(outside, /\b(?:clear|start|stop)MovementRecording\(/);
});

test('adaptive progression: practice text no longer says 試玩', () => {
  const js = readFileSync(path.join(root, 'fthue-adaptive-progression.js'), 'utf8');
  assert.doesNotMatch(js, /practice(?:Success|Failure|Title|Note): '[^']*(?:試玩|Trial mode)/);
});

test('public build: no recording capability, wording or training-mode button', (t) => {
  if (!existsSync(publicIndex)) return t.skip('run scripts/build-dist.sh first');
  const pub = readFileSync(publicIndex, 'utf8');
  for (const level of ['3', '4', '5', '67']) {
    assert.match(pub, new RegExp(`data-testid="button-mode-trial-${level}"[^>]*>訓練</button>`));
    assert.doesNotMatch(pub, new RegExp(`button-mode-training-${level}`));
  }
  assert.doesNotMatch(pub, /MediaRecorder|captureStream|recordingIndicator|movementReview|downloadMovementVideo/);
  assert.doesNotMatch(pub, /錄影|錄頭部|試玩|Silent recording|Trial mode/);
  assert.doesNotMatch(pub, /\.recording-indicator|\.movement-review/);
  const loc = readFileSync(path.join(root, 'dist/public/localization.js'), 'utf8');
  assert.doesNotMatch(loc, /錄影|recording|試玩|\bTrial\b/i);
});
