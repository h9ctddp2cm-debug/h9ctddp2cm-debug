import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

test('current build markers stay aligned', () => {
  const manifest = readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
  const worker = readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const version = 'v102-20260905-kungfu-theme-certificate';
  assert.match(html, new RegExp(version));
  assert.match(manifest, new RegExp(version));
  assert.match(worker, new RegExp(version));
});

test('patient-simple HUD is restricted to public Levels 5 and 6', () => {
  assert.match(html,
    /gameStage\.classList\.toggle\('patient-simple-hud',\s*!research\.active && \(state\.level === '5' \|\| state\.level === '67'\)\)/);
  assert.match(html, /\.game-stage\.patient-simple-hud \.prompt-slot\{ display:none !important; \}/);
  assert.match(html, /\.game-stage\.patient-simple-hud \.hud\{[\s\S]*?display:block !important;/);
  assert.match(html, /\.game-stage\.patient-simple-hud \.hud-item:last-child/);
  assert.match(html,
    /@media \(min-width:601px\) and \(max-width:900px\) and \(orientation:portrait\)[\s\S]*?\.game-stage\.patient-simple-hud \.prompt-zone\{ top:52% !important; \}/);
  assert.match(html, /function drawDimsumOrderBanner[\s\S]*?dimsumOrderBannerRect = null;\s*return;/);
  assert.match(html, /function drawLaundryOrderBanner[\s\S]*?laundryOrderBannerRect = null;\s*return;/);
  assert.match(html, /function drawFridgeOrderBanner[\s\S]*?fridgeBannerRect = null;\s*return;/);
});

test('open and closed hand cues stay large on canvas without a duplicate side card', () => {
  assert.match(html, /const handEmoji = isGrasping \? '✊🏻' : '✋🏻';/);
  assert.match(html, /const closedHandSize=isLevel6\(\)[\s\S]{0,150}\? Math\.max\(210,Math\.min\(280,[\s\S]{0,150}: Math\.max\(104,Math\.min\(124,/);
  assert.match(html, /const handSize=isGrasping \? closedHandSize : closedHandSize\*1\.5;/);
  assert.match(html, /const gestureCue = openWords\.test\(main\) \? 'open' : 'close';/);
  assert.match(html, /\.game-stage\.public-clean-hud\.patient-simple-hud \.status-bar\{\s*display:none !important;/);
  assert.match(html, /if\(patientMode && !mustShowOpenArmPrompt\)\{[\s\S]{0,300}statusBar\.innerHTML = '';/);
  assert.match(html, /mustShowOpenArmPrompt[\s\S]{0,220}先張開筷子/);
  assert.match(html, /statusBar\.dataset\.gestureCue = gestureCue/);
});

test('gesture semantics are classified before English translation', () => {
  const promptFn = html.slice(
    html.indexOf('function setActionPrompt('),
    html.indexOf('function graspPrompt('),
  );
  const classifyAt = promptFn.indexOf("const gestureCue = openWords.test(main)");
  const translateAt = promptFn.indexOf("main = window.YCHLanguage.text(main)");
  assert.ok(classifyAt >= 0, 'gesture classification must exist');
  assert.ok(translateAt >= 0, 'language translation must exist');
  assert.ok(classifyAt < translateAt, 'classify the internal action before translating it');
});

test('large canvas cues and advanced enlargements are public-only', () => {
  assert.match(html, /function isPatientVisualCueMode\(\)\{\s*return !research\.active && \(state\.level === '5' \|\| state\.level === '67'\);\s*\}/);
  const graspBranches = (html.match(/if\(isGraspStyleMode\(\)\)\{\s*if\(isPatientVisualCueMode\(\)\)\{/g) || []).length;
  assert.equal(graspBranches, 2, 'both cursor paths must preserve the grasp branch before applying public cues');
  assert.match(html, /Preserve the pre-v76 research grasp\/pinch cursor exactly\.[\s\S]*?isPinchMode\(\) \? '捏' : '✊'/);
  assert.match(html, /progressRadius = isPatientVisualCueMode\(\)[\s\S]*?: 36;/);
  assert.match(html, /const patientLarge = isPatientVisualCueMode\(\);[\s\S]*?patientLarge \? 0\.19 : 0\.16/);
  assert.match(html, /wok:[\s\S]*?patientLarge \? 0\.33 : 0\.34[\s\S]*?plate:[\s\S]*?patientLarge \? 0\.72 : 0\.70/);
  assert.match(html, /const tileMin = patientLarge \? \(narrow \? 72 : 82\) : \(narrow \? 56 : 64\)/);
  assert.match(html, /const size = patientLarge[\s\S]*?gap\*1\.04[\s\S]*?gap\*0\.94/);
});

test('advanced Level 6 activities receive phase-specific grasp and release cues', () => {
  assert.match(html, /const advancedHeld = !!\(carrier\.heldId \|\| picker\.heldId\);/);
  assert.match(html, /setActionPrompt\(isGrasping \? '保持揸住' : '張開手放低', ''\)/);
  assert.match(html, /setActionPrompt\(isGrasping \? '揸實' : '揸實拿起', ''\)/);
  assert.match(html, /setActionPrompt\('張開手', ''\)/);
});

test('Level 5 and 6 objects and targets are enlarged without changing gesture gates', () => {
  assert.match(html, /state\.level === '5'\) \? 1\.36 : 1/);
  assert.match(html,
    /const level6Boost = \(!research\.active && state\.level === '67'\)[\s\S]*?state\.theme === 'peg_laundry' \? 1\.70 : 1\.16/);
  assert.match(html, /patientTargetBoost[\s\S]*?state\.theme === 'peg_laundry' \? 1\.10 : 1\.16/);
  assert.match(html, /\[\[0\.20,0\.66\],\[0\.80,0\.66\],\[0\.50,0\.88\]\]/);
  assert.match(html, /const bothReopened = nearRatio >= t\.nearExit && farRatio >= t\.farExit;/);
  assert.match(html, /if\(selectedHandIndex < 0\) return \{ detected:false, reason:'affected-hand-not-detected' \};/);
});
