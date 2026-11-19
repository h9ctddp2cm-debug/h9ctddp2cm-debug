import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v133 — therapist report after v132: "no fire, and the wok should be on top of
// gas stove, also the rice should be placed on the plate (not putting the whole
// rice and plate on top of the big plate!!)". Visual-only change to the Level 6
// 煮蛋炒飯 wok steps: the wok is anchored to the painted burner of the kitchen
// background (fractions of the background image, so it follows the background
// in every viewport), flames are drawn behind and in front of the pan bottom,
// and the rice sprite is a cutout without its plate. Detection is untouched.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v133 source wiring: burner/knob anchors, rice cutout, flame layers, background anchoring', () => {
  assert.match(src, /const COOK_BG_BURNER = \{ u:0\.156, v:0\.660 \};/);
  assert.match(src, /const COOK_BG_KNOB = \{ u:0\.125, v:0\.722 \};/);
  assert.match(src, /const imgCookRice = new Image\(\); imgCookRice\.src = 'img\/cook_rice_only\.png';/);
  assert.ok(existsSync(path.join(root, 'img', 'cook_rice_only.png')), 'rice cutout asset present');
  // background keeps the stove visible (anchor horizontally on the burner, never leaving a gap)
  // (v134: the burner anchor is used for the stove steps; other steps centre the background)
  assert.match(src, /const anchor = stoveView \? cw \* 0\.36 - COOK_BG_BURNER\.u \* dw : \(cw - dw\) \* 0\.5;/);
  assert.match(src, /const ox = Math\.max\(cw - dw, Math\.min\(0, anchor\)\);/);
  assert.match(src, /bgRect = \{ x:ox, y:oy, w:dw, h:dh \};/);
  // wok anchored to the painted burner
  assert.match(src, /const burnerX = bgRect\.x \+ COOK_BG_BURNER\.u \* bgRect\.w;/);
  assert.match(src, /const burnerY = bgRect\.y \+ COOK_BG_BURNER\.v \* bgRect\.h;/);
  assert.match(src, /const panCX = burnerX;/);
  assert.match(src, /const panBottom = burnerY \+ wokS \* 0\.05;/);
  assert.match(src, /const wokY = panBottom - wokS \* 0\.32;/);
  // two flame layers around the pan bottom
  assert.match(src, /function drawCookFlames\(ctx, cx, cy, w, count, alpha, now, flameH, layer\)\{/);
  assert.match(src, /drawCookFlames\(ctx, panCX, panBottom - wokS\*0\.02, wokS\*0\.78, 7, flameAlpha, now, wokS\*0\.30\*flameScale, 'back'\);/);
  assert.match(src, /drawCookFlames\(ctx, panCX, panBottom, wokS\*0\.62, 6, flameAlpha, now, wokS\*0\.16\*flameScale, 'front'\);/);
  // rice without plate inside the wok and on the serving plate; the old plate-inclusive sprite is gone from these steps
  assert.match(src, /drawSprite\(ctx, imgCookRice, panCX \+ bob, innerY - wokS\*0\.03/);
  assert.match(src, /drawSprite\(ctx, imgCookRice, plateX, plateY - plateS\*0\.08/);
  assert.doesNotMatch(src, /const wokImg = advImg\('wok'\), riceImg = advImg\('friedrice'\);/);
  // stove knob drawn at the painted knob position
  assert.match(src, /const knobX = bgRect\.x \+ COOK_BG_KNOB\.u \* bgRect\.w, knobY = bgRect\.y \+ COOK_BG_KNOB\.v \* bgRect\.h;/);
  // detection untouched (v132)
  assert.match(src, /const on = sc >= d\.baseline \+ rise;/);
  assert.match(src, /const DIGIFLEX_OFF_FRACTION = 0\.4;/);
  assert.match(src, /numHands:\s*2/);
});

let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(error){
    console.warn('playwright unavailable; browser checks skipped:', error.message);
  }
});
after(async () => { if(browser) await browser.close(); });

for(const vp of [{ width:1413, height:653 }, { width:1024, height:1366 }]){
  test(`v133 e2e ${vp.width}x${vp.height}: all twelve cooking steps render without page errors`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    try{
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__qa && window.__qa.startGame);
      const r = await page.evaluate(() => {
        window.__qa.startGame({ level:'67', level6Task:'cooking', duration:300, affectedSide:'right' });
        const seen = [];
        for(let i = 0; i < 12; i++){
          const s = window.__qa.cook.step();
          seen.push(s.id);
          for(let k = 0; k < 5; k++) window.__qa.setLevel6ToolFrame({ curl:.2, stepMs:33, nx:.5, ny:.55 });
          window.__qa.cook.completeStep();
          window.advanceTime(4000);
        }
        return seen;
      });
      assert.deepEqual(r.slice(5, 12), ['heat','oil','pour','salt','onion','off','plate']);
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}
