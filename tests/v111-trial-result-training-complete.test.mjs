import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v111 — therapist request (7 Sep): a 試玩 session is a real training session
// for the patient, so the result screen must read 訓練完成 in both modes and
// must not mention recording / therapist alerts.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('result title is 訓練完成 / Training complete regardless of mode', () => {
  assert.match(html, /getElementById\('resultTitle'\)\.textContent = resultEnglish \? 'Training complete' : '訓練完成';/);
  assert.doesNotMatch(html, /'試玩完成'/);
  assert.doesNotMatch(html, /'Trial complete'/);
});

test('result context never mentions recording or therapist alerts in trial mode', () => {
  assert.doesNotMatch(html, /不錄影／不提示/);
  assert.doesNotMatch(html, /no recording or therapist alerts/);
  // trial and training now share the level tag + theme title context line
  assert.match(html, /: currentLevel\(\)\.tag \+ ' · ' \+ \(window\.YCHLanguage \? window\.YCHLanguage\.text\(getTheme\(\)\.title\) : getTheme\(\)\.title\);/);
});

test('research-mode result context and mode buttons are untouched', () => {
  assert.match(html, /research\.participantId \+ ' · Session ' \+ research\.sessionNo/);
  assert.match(html, /data-testid="button-mode-trial-67"/);
  assert.match(html, /data-testid="button-mode-training-67"/);
});
