import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const localization=fs.readFileSync(path.join(root,'localization.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const build=fs.readFileSync(path.join(root,'scripts','build-dist.sh'),'utf8');

test('accessible globe menu offers the two required languages with Traditional Chinese selected by default',()=>{
  assert.match(html,/id="languageButton"[\s\S]*aria-haspopup="menu"[\s\S]*aria-expanded="false"/);
  assert.match(html,/id="languageMenu"[\s\S]*role="menu"[\s\S]*data-language="zh-Hant" aria-checked="true">繁體中文<\/button>[\s\S]*data-language="en" aria-checked="false">English<\/button>/);
  assert.match(html,/class="language-button"[\s\S]*<circle cx="12" cy="12" r="9"/);
  assert.match(html,/\.language-button\{\s*width:44px; height:44px/);
  assert.match(html,/html\[data-screen="game"\] \.language-switcher/);
});

test('language selection is in-memory, starts in Traditional Chinese, and never uses browser storage',()=>{
  assert.match(localization,/let currentLanguage = LANG_ZH/);
  assert.match(localization,/function init\(\) \{\s*currentLanguage = LANG_ZH/);
  assert.doesNotMatch(localization,/\blocalStorage\b|\bsessionStorage\b|document\.cookie/);
  assert.match(localization,/new CustomEvent\('ychlanguagechange'/);
  assert.match(html,/<html lang="zh-Hant">/);
});

test('localization covers static, dynamic, accessibility, canvas and speech surfaces',()=>{
  assert.match(localization,/NodeFilter\.SHOW_TEXT/);
  assert.match(localization,/\['aria-label', 'title', 'placeholder', 'alt'\]/);
  assert.match(localization,/new MutationObserver/);
  assert.match(localization,/CanvasRenderingContext2D\.prototype\.fillText/);
  assert.match(html,/window\.addEventListener\('ychlanguagechange'/);
  assert.match(html,/window\.YCHLanguage\?\.apply\(screens\[currentScreen\]/);
  assert.match(html,/const english = !!\(window\.YCHLanguage && window\.YCHLanguage\.isEnglish\(\)\)/);
  assert.match(html,/voices\.find\(v => \/\^en/i);
});

test('required shoulder demonstration labels localize exactly and remain clinically scoped',()=>{
  assert.match(localization,/'主動肩屈曲 \(Active shoulder flexion\)':'Active shoulder flexion'/);
  assert.match(localization,/'主動輔助肩屈曲 \(Active-assisted shoulder flexion\)':'Active-assisted shoulder flexion'/);
  assert.match(html,/data-testid="demo-level-3-active"[\s\S]*主動肩屈曲 \(Active shoulder flexion\)/);
  assert.match(html,/data-testid="demo-level-3-assisted"[\s\S]*主動輔助肩屈曲 \(Active-assisted shoulder flexion\)/);
  assert.doesNotMatch(html,/shoulder-demos[\s\S]{0,400}(疼痛|不適)/);
});

test('app, manifest, service worker and build output include localization consistently',()=>{
  const version='v74-20260831-teahouse';
  assert.match(html,new RegExp(version));
  assert.equal(JSON.parse(manifest).start_url,`./index.html?build=${version}`);
  assert.match(worker,new RegExp(`fthue-rehab-${version}`));
  assert.match(build,/cp "\$ROOT\/localization\.js" "\$DIST\/localization\.js"/);
});
