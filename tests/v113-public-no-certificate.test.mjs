// v113 — public build removes the participation certificate feature entirely.
// Rationale: the certificate is not mentioned in the Protocol/PIS/ICF, and the IRB is
// sensitive to anything that could look like a participant reward/incentive. The
// certificate stays available in the source/research tree only (a possible future,
// ethics-approved version); the public site must ship neither the entry link nor the
// standalone certificate.html file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const loc = fs.readFileSync(path.join(root, 'localization.js'), 'utf8');
const distDir = path.join(root, 'dist', 'public');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

test('source: certificate entry point is wrapped in PUBLIC_BUILD_REMOVE markers', () => {
  const start = html.indexOf('PUBLIC_BUILD_REMOVE_START: participation certificate entry');
  assert.ok(start > -1, 'marker present');
  const end = html.indexOf('PUBLIC_BUILD_REMOVE_END', start);
  assert.ok(end > start, 'matching end marker present');
  const block = html.slice(start, end);
  assert.match(block, /<a class="cert-entry" id="lnkCertificate" href="certificate\.html"/);
  assert.match(block, /頒發參與嘉許狀/);
});

test('source: certificate.html still exists (kept for a future ethics-approved version)', () => {
  assert.ok(fs.existsSync(path.join(root, 'certificate.html')));
});

test('source: build-dist.sh no longer copies certificate.html and fails closed if it leaks', () => {
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-dist.sh'), 'utf8');
  assert.doesNotMatch(build, /cp "\$ROOT\/certificate\.html"/);
  assert.match(build, /DIST\/certificate\.html.*fail "participation certificate leaked/);
  assert.match(build, /cert-entry\|lnkCertificate\|certificate\\\.html\|嘉許狀/);
});

test('source: sanitizer fails closed on certificate wording/selectors/entry', () => {
  const san = fs.readFileSync(path.join(root, 'scripts', 'sanitize-public.cjs'), 'utf8');
  assert.match(san, /cert-entry\)\/i\.test\(header\)/);
  assert.match(san, /cert-entry\|lnkCertificate\|certificate\\\.html\|嘉許狀/);
  assert.match(san, /嘉許狀\|\[Cc\]ertificate of participation/);
});

test('source: localization dictionary still carries the certificate label (used by source/research build)', () => {
  assert.ok(loc.includes("'頒發參與嘉許狀'"));
});

test('public build: no certificate.html file, no entry link, no 嘉許狀 wording anywhere', { skip: !hasDist }, () => {
  assert.ok(!fs.existsSync(path.join(distDir, 'certificate.html')), 'certificate.html must not ship in dist/public');
  const distHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  assert.doesNotMatch(distHtml, /cert-entry|lnkCertificate|certificate\.html|嘉許狀/);
  const distLoc = fs.readFileSync(path.join(distDir, 'localization.js'), 'utf8');
  assert.doesNotMatch(distLoc, /嘉許狀|Certificate of participation/i);
});
