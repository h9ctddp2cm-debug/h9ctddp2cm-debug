import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v134 — therapist: "also should go to sink to wash the veggies right? there
// should be water coming out from the water tap". The Level 6 煮蛋炒飯 "wash"
// step now shows a stainless sink with a gooseneck tap (cutout
// img/cook_sink.png) on the counter, a running water stream with moving
// highlights, splashes on the spring onion held under the tap, and the onion
// dips on every squeeze. In portrait the kitchen background pans to the stove
// only for the stove steps, so the sink does not overlap the painted burner.
// Detection untouched (v132 rules).

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'index.html'), 'utf8');

test('v134 source wiring: sink asset, spout/basin fractions, running water, portrait camera', () => {
  assert.match(src, /const imgCookSink = new Image\(\); imgCookSink\.src = 'img\/cook_sink\.png';/);
  assert.ok(existsSync(path.join(root, 'img', 'cook_sink.png')), 'sink cutout asset present');
  assert.match(src, /const COOK_SINK_SPOUT = \{ u:0\.423, v:0\.228 \};/);
  assert.match(src, /const COOK_SINK_BASIN_V = 0\.72;/);
  assert.match(src, /const COOK_SINK_ASPECT = 530 \/ 900;/);
  assert.match(src, /function drawCookTapWater\(ctx, x, top, bottom, sinkS, now\)\{/);
  assert.match(src, /function drawCookTapSplash\(ctx, x, y, sinkS, now\)\{/);
  // wash step: sink drawn, water from spout to basin, onion under the tap, splash on top
  assert.match(src, /drawSprite\(ctx, imgCookSink, sinkX, sinkY, sinkS, \{ shadow:true \}\);/);
  assert.match(src, /const tapX = sinkX \+ \(COOK_SINK_SPOUT\.u - 0\.5\) \* sinkS, tapY = sinkY \+ \(COOK_SINK_SPOUT\.v - 0\.5\) \* sinkH;/);
  assert.match(src, /drawCookTapWater\(ctx, tapX, tapY, basinY, sinkS, now\);/);
  assert.match(src, /drawSprite\(ctx, advImg\('spring_onion'\), tapX \+ sinkS \* 0\.02, onionY, sinkS \* 0\.38/);
  assert.match(src, /drawCookTapSplash\(ctx, tapX, onionY - sinkH \* 0\.05, sinkS, now\);/);
  // sink never covers the count pill; landscape sink sits left of centre, portrait centred
  assert.match(src, /const sinkBottom = g\.countY - 12 \* g\.cssScale;/);
  assert.match(src, /const sinkX = cx - \(g\.portrait \? 0 : sinkS \* 0\.12\), sinkY = sinkBottom - sinkH \* 0\.5;/);
  // background pans to the stove only for stove steps
  assert.match(src, /const stoveView = \['heat','oil','pour','salt','onion','off','plate'\]\.includes\(st\.id\);/);
  assert.match(src, /const anchor = stoveView \? cw \* 0\.36 - COOK_BG_BURNER\.u \* dw : \(cw - dw\) \* 0\.5;/);
  assert.match(src, /const wokOnStove = stoveView;/);
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
  test(`v134 e2e ${vp.width}x${vp.height}: wash step renders with squeezes and the whole task completes without page errors`, async t => {
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
        while(window.__qa.cook.step().idx < 3){ window.__qa.cook.completeStep(); window.advanceTime(4000); }
        window.advanceTime(4000);
        const washId = window.__qa.cook.step().id;
        window.__qa.cook.squeeze({ relaxMs: 480 });
        for(let k = 0; k < 5; k++) window.__qa.setLevel6ToolFrame({ curl:.2, stepMs:33, nx:.5, ny:.55 });
        const reps = window.__qa.cook.step().reps;
        while(window.__qa.cook.step().idx < 11){ window.__qa.cook.completeStep(); window.advanceTime(4000); }
        return { washId, reps, last: window.__qa.cook.step().id };
      });
      assert.equal(r.washId, 'wash');
      assert.equal(r.reps, 1);
      assert.equal(r.last, 'plate');
      assert.deepEqual(errors, []);
    }finally{
      await context.close();
    }
  });
}
