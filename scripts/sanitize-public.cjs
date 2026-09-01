#!/usr/bin/env node
'use strict';

/*
 * Deterministic public-build sanitizer.
 *
 * The source application intentionally contains an authenticated research
 * workflow. The static public distribution must not. PUBLIC_BUILD_REMOVE
 * markers remove complete DOM/modules first; Terser then specializes the
 * shared runtime with research.active fixed to false and eliminates every
 * unreachable research branch. Hard guards below fail closed if a future
 * source edit leaves any study DOM, state, handler, function or entry route.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const terser = require('./vendor/terser-5.44.0.bundle.min.cjs');

const EXPECTED_TERSER_SHA256 =
  'eb4d18d0c9363d8a6ccd4aa80e609d01ddfb90eb3bfb850c0ffeab664f45dd0f';
const optimizerPath = path.join(__dirname, 'vendor', 'terser-5.44.0.bundle.min.cjs');
const inputPath = path.resolve(process.argv[2] || '');
const localizationPath = process.argv[3] ? path.resolve(process.argv[3]) : '';
if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('PUBLIC SANITIZER FAILED: expected an existing index.html path');
  process.exit(1);
}
if (localizationPath && !fs.existsSync(localizationPath)) {
  console.error('PUBLIC SANITIZER FAILED: localization path does not exist');
  process.exit(1);
}
const optimizerHash = crypto.createHash('sha256').update(fs.readFileSync(optimizerPath)).digest('hex');
if (optimizerHash !== EXPECTED_TERSER_SHA256) {
  console.error('PUBLIC SANITIZER FAILED: pinned optimizer checksum mismatch');
  process.exit(1);
}

function fail(message) {
  console.error(`PUBLIC SANITIZER FAILED: ${message}`);
  process.exit(1);
}

function stripMarkedLines(input) {
  let depth = 0;
  const kept = [];
  for (const line of input.split(/\n/)) {
    if (line.includes('PUBLIC_BUILD_REMOVE_START:')) {
      depth++;
      continue;
    }
    if (line.includes('PUBLIC_BUILD_REMOVE_END')) {
      if (depth === 0) fail('unmatched PUBLIC_BUILD_REMOVE_END marker');
      depth--;
      continue;
    }
    if (depth === 0) kept.push(line);
  }
  if (depth !== 0) fail('unclosed PUBLIC_BUILD_REMOVE_START marker');
  return kept.join('\n');
}

function sanitizePublicLocalization(filePath) {
  if (!filePath) return;
  const forbiddenStudyCopy =
    /(?:\bresearch\b|\bpilot\b|study protocol|研究模式|研究情境|研究方案)/i;
  const publicCopy = fs.readFileSync(filePath, 'utf8')
    .split(/\n/)
    .map(line => line
      .replace('影片只暫存在本頁。下載後請按研究方案及機構私隱要求處理。',
        '影片只暫存在本頁。下載後請按機構私隱要求處理。')
      .replace('After downloading, handle it according to the study protocol and institutional privacy requirements.',
        'After downloading, handle it according to institutional privacy requirements.'))
    .filter(line => !forbiddenStudyCopy.test(line))
    .join('\n');
  if (forbiddenStudyCopy.test(publicCopy)) {
    fail('research-only localization remains in public JavaScript');
  }
  fs.writeFileSync(filePath, publicCopy);
}

function matchingBrace(css, open) {
  let depth = 0;
  let quote = '';
  let comment = false;
  for (let i = open; i < css.length; i++) {
    const c = css[i], next = css[i + 1];
    if (comment) {
      if (c === '*' && next === '/') { comment = false; i++; }
      continue;
    }
    if (!quote && c === '/' && next === '*') { comment = true; i++; continue; }
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

function sanitizeCss(css) {
  let out = '';
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open < 0) { out += css.slice(cursor); break; }
    const close = matchingBrace(css, open);
    if (close < 0) fail('unbalanced CSS while removing research selectors');
    const header = css.slice(cursor, open);
    const body = css.slice(open + 1, close);
    const forbiddenSelector = /(?:research|pilot)/i.test(header);
    if (!forbiddenSelector) {
      out += header + '{' + (/^\s*@(?:media|supports|layer|container)\b/i.test(header)
        ? sanitizeCss(body) : body) + '}';
    }
    cursor = close + 1;
  }
  return out.replace(/\/\*[\s\S]*?(?:research|pilot)[\s\S]*?\*\//gi, '');
}

async function main() {
  let html = fs.readFileSync(inputPath, 'utf8');
  html = html.replace(
    '影片只暫存在本頁。下載後請按研究方案及機構私隱要求處理。',
    '影片只暫存在本頁。下載後請按機構私隱要求處理。',
  );
  html = html.replace(/\s*<script data-pplx-inline-edit>[\s\S]*?<\/script>\s*/g, '\n');
  html = stripMarkedLines(html);

  html = html.replace(/<style>([\s\S]*?)<\/style>/g,
    (_whole, css) => `<style>${sanitizeCss(css)}</style>`);

  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!inlineScripts.length) fail('main inline application script not found');
  const mainMatch = inlineScripts.reduce((largest, candidate) =>
    candidate[1].length > largest[1].length ? candidate : largest);
  let code = mainMatch[1];

  // Remove the dead screen-registry key before constant folding so showScreen()
  // can never resolve a hidden/direct research route.
  code = code.replace(/\n\s*research:\s*document\.getElementById\('screen-research'\),?/, '');

  // Assignments exist only in research/setup/QA flows. Marked modules are
  // already gone; remaining public reset assignments can be deleted.
  code = code.replace(/\bresearch\.active\s*=\s*(?:true|false)\s*;?/g, '');
  code = code.replace(/\bresearch\.active\b/g, 'false');

  // Language changes retain only public state-derived rendering.
  code = code.replace(
    /\n\s*pilotLang\s*=\s*window\.YCHLanguage\?\.isEnglish\(\)\s*\?\s*'en'\s*:\s*'zh';/,
    '',
  );
  code = code.replace(
    /\n\s*const researchError = document\.getElementById\('researchError'\);\n\s*if\(researchError\) researchError\.textContent = '';\n\s*if\(currentScreen === 'research'\) renderPilotLanguage\(\);/,
    '',
  );

  // Any residual study helper call is a no-op in a public session. Declaring
  // these helpers pure lets whole-program compression remove their functions,
  // state and protocol constants rather than merely hiding them.
  const pureStudyFunctions = [
    ...code.matchAll(/\b((?:research|pilot)[A-Z_$][\w$]*)\s*\(/g),
    ...code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*(?:research|pilot)[A-Za-z0-9_$]*)\s*\(/gi),
  ].map(match => match[1]);

  const optimized = await terser.minify(code, {
    compress: {
      toplevel: true,
      passes: 3,
      pure_funcs: [...new Set(pureStudyFunctions)],
    },
    mangle: false,
    format: { beautify: true, comments: false },
  });
  if (optimized.error || !optimized.code) {
    fail(`JavaScript specialization error: ${optimized.error || 'empty output'}`);
  }
  html = html.slice(0, mainMatch.index) +
    mainMatch[0].replace(mainMatch[1], `\n${optimized.code}\n`) +
    html.slice(mainMatch.index + mainMatch[0].length);

  // Remove comments that describe a route/surface which no longer exists.
  html = html.replace(/<!--[\s\S]*?(?:research|pilot)[\s\S]*?-->/gi, '');

  const mainScript = optimized.code;
  if (process.env.PUBLIC_SANITIZER_DEBUG_DIR) {
    fs.mkdirSync(process.env.PUBLIC_SANITIZER_DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.PUBLIC_SANITIZER_DEBUG_DIR, 'public-main.js'), mainScript);
    fs.writeFileSync(path.join(process.env.PUBLIC_SANITIZER_DEBUG_DIR, 'public-index.html'), html);
  }
  const forbiddenLogic = [
    [/\bresearch(?:[A-Z_$]|\b|\.)/i, 'research state/function/reference'],
    [/\bpilot(?:[A-Z_$]|\b|\.)/i, 'pilot state/function/reference'],
    [/\b(?:RESEARCH|PILOT)_[A-Z0-9_]+/, 'research protocol constant'],
    [/\b(?:btnResearch|screen-research|researchParticipant|researchProtocol)\b/i,
      'research control identifier'],
    [/(?:role\s*=\s*['"]?intervention|applyInterventionDeepLink|autostart|research\/login)/i,
      'hidden/direct research entry route'],
    [/(?:downloadResearch|exportFormal|exportNonFormal|researchArchive)/i,
      'research export/archive handler'],
  ];
  for (const [pattern, label] of forbiddenLogic) {
    if (pattern.test(mainScript)) fail(`${label} remains in public JavaScript`);
  }

  const forbiddenDom = [
    [/<[^>]+\b(?:id|class|name|for|data-testid)=["'][^"']*(?:research|pilot)[^"']*["']/i,
      'research/pilot DOM attribute'],
    [/\bdata-feedback=/i, 'research feedback input'],
    [/\b(?:btnResearchBegin|btnDownloadResearch|btnReturnSessionRecord)\b/i,
      'research setup/export control'],
    [/\b(?:researchParticipant|researchVisit|researchProtocol|screen-research)\b/i,
      'research setup DOM'],
  ];
  for (const [pattern, label] of forbiddenDom) {
    if (pattern.test(html)) fail(`${label} remains in public HTML`);
  }

  if (!/id="sessionRestOverlay"/.test(html) ||
      !/id="safetyPauseOverlay"/.test(html) ||
      !/id="stopConfirmOverlay"/.test(html)) {
    fail('a clinical rest/stop safety control was removed');
  }
  if (!/id="screen-level"/.test(html) || !/id="screen-game"/.test(html)) {
    fail('public game screens were removed');
  }

  fs.writeFileSync(inputPath, html);
  sanitizePublicLocalization(localizationPath);
  console.log(`public index sanitized: ${Buffer.byteLength(html)} bytes`);
}

main().catch(error => fail(error && error.stack ? error.stack : String(error)));
