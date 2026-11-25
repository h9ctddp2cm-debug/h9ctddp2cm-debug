// v114 — public build removes the flower-arranging "keepsake" feature entirely (name input,
// signature pad, downloadable PNG). Rationale: it is not mentioned in the Protocol/PIS/ICF, and
// unlike gameplay telemetry it collects identifiable information (a typed name and a handwritten
// signature) baked into an image the patient can download. The feature stays available in the
// source/research tree only (a possible future, ethics-approved version); the public site must
// ship neither the keepsake DOM nor any of its supporting functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const distDir = path.join(root, 'dist', 'public');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

test('source: keepsake DOM is wrapped in PUBLIC_BUILD_REMOVE markers', () => {
  const start = html.indexOf('PUBLIC_BUILD_REMOVE_START: participation keepsake DOM');
  assert.ok(start > -1, 'marker present');
  const end = html.indexOf('PUBLIC_BUILD_REMOVE_END', start);
  assert.ok(end > start, 'matching end marker present');
  const block = html.slice(start, end);
  assert.match(block, /const keep = mk\('keepsake'/);
  assert.match(block, /id="ksName"/);
  assert.match(block, /id="ksSig"/);
  assert.match(block, /id="ksDownload"/);
});

test('source: keepsake flow functions are wrapped in PUBLIC_BUILD_REMOVE markers', () => {
  const start = html.indexOf('PUBLIC_BUILD_REMOVE_START: participation keepsake flow');
  assert.ok(start > -1, 'marker present');
  const end = html.indexOf('PUBLIC_BUILD_REMOVE_END', start);
  assert.ok(end > start, 'matching end marker present');
  const block = html.slice(start, end);
  for (const fn of ['startFlowersKeepsake', 'bindKeepsake', 'drawKeepsake', 'ksRedraw', 'ksDataURL', 'ksDownload', 'ksDateStr']) {
    assert.match(block, new RegExp(`function ${fn}\\(`), `${fn} present in marked block`);
  }
});

test('source: flowersFinish() facade falls back to a plain completion when the keepsake flow is stripped', () => {
  const idx = html.indexOf('const flowersFinishApi');
  assert.ok(idx > -1, 'facade present');
  const facade = html.slice(idx, idx + 400);
  assert.match(facade, /typeof startFlowersKeepsake === 'function'/);
  assert.match(facade, /endGame\(\)/);
});

test('source: build-dist.sh excludes img/cert and fails closed if it or keepsake identifiers leak', () => {
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-dist.sh'), 'utf8');
  assert.match(build, /rm -rf "\$DIST\/img\/cert"/);
  assert.match(build, /DIST\/img\/cert.*fail "orphaned img\/cert assets leaked/);
  assert.match(build, /bindKeepsake\|drawKeepsake/);
  // startFlowersKeepsake itself must stay OUT of the forbidden-string check: the
  // flowersFinishApi facade legitimately keeps a `typeof startFlowersKeepsake === 'function'`
  // guard in the public build, mirroring the v112 movementRecordingApi precedent.
  const grepLine = build.split('\n').find((l) => l.includes('BUILD FAILED: authoring, research-entry'));
  assert.ok(grepLine, 'forbidden-string grep line present');
  const grepArgLine = build.split('\n')[build.split('\n').indexOf(grepLine) - 1];
  assert.ok(!grepArgLine.includes('startFlowersKeepsake'), 'startFlowersKeepsake must not be in the forbidden-string list (facade needs it)');
});

test('public build: no keepsake DOM/functions, no img/cert assets, cache bumped to v114', { skip: !hasDist }, () => {
  const distHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  // startFlowersKeepsake is intentionally excluded here: the flowersFinishApi facade keeps a
  // `typeof startFlowersKeepsake === 'function'` guard in the public build (same pattern as
  // v112's movementRecordingApi), so the bare identifier legitimately remains.
  assert.doesNotMatch(distHtml, /bindKeepsake|drawKeepsake|ksPreview|ksName|ksSig|ksDownload|ksDataURL|ksRedraw|ksDateStr|留念/);
  // Minification may inline the trivial flowersFinish() wrapper and normalize the typeof
  // check's operand order, so match tolerantly rather than on exact source formatting.
  assert.match(distHtml, /flowersFinishApi\s*=.*startFlowersKeepsake/);
  assert.match(distHtml, /flowersFinishApi\.run\(\)/);
  assert.ok(!fs.existsSync(path.join(distDir, 'img', 'cert')), 'img/cert must not ship in dist/public');
  const offlineAssets = fs.readFileSync(path.join(distDir, 'offline-assets.js'), 'utf8');
  assert.doesNotMatch(offlineAssets, /img\/cert/);
  const sw = fs.readFileSync(path.join(distDir, 'service-worker.js'), 'utf8');
  assert.match(sw, /v141-20261125-story-repeat/);
});
