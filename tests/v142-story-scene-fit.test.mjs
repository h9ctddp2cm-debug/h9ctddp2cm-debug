import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// v142 (second part) — therapist feedback on the story pictures (26 Nov):
//   1. 「去超市買餸」 home scene: the soy sauce, rice and toilet paper were drawn on the tiled
//      wall under the wall cabinet. They now stand on the cabinet shelf, and the cold food
//      sits on the fridge shelves, following where the furniture is in the background picture.
//   2. 「洗衫晾衫」: the clothes looked as if they stood behind the basket. They are now drawn
//      inside it (front wall of the basket in front of them).
//   3. the sun stopped beside the clothes, below the bamboo pole. It now stops in the sky
//      above the pole.
// Display only. Nothing about detection or scoring changes.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

function fnSource(name){
  const start = html.indexOf('\nfunction ' + name + '(');
  assert.ok(start >= 0, 'function ' + name + ' exists');
  let i = html.indexOf('{', html.indexOf(')', start)), depth = 0;
  for(; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}'){ depth--; if(depth === 0) break; }
  }
  return html.slice(start + 1, i + 1);
}

test('home scene: goods are placed on the shelves of the pictured cabinet and fridge', () => {
  const scene = fnSource('drawSupermarketScene');
  const home = scene.slice(scene.indexOf("scene==='home'||scene==='done'"));
  assert.match(home, /shopHomeLayout\(cw,ch,g,nDry,nCold\)/);
  assert.match(home, /SHOP_ITEMS\[id\]\.cold\?slotAt\(H\.fr,fi\+\+\):slotAt\(H\.cab,ci\+\+\)/);
  assert.match(home, /drawShopImgSink\(ctx,shopItemImg\(id\),p\.x,p\.base-p\.size\/2,p\.size,p\.size,1,true\)/);
  assert.doesNotMatch(home, /cabPos|frPos|g\.cabinetY|g\.fridgeY/, 'no fixed positions left over');
  assert.match(html, /const SHOP_HOME_CABINET=\{ u0:[\d.]+, u1:[\d.]+, rows:\[/);
  assert.match(html, /const SHOP_HOME_FRIDGE=\{ u0:[\d.]+, u1:[\d.]+, rows:\[/);
  // same "cover" maths as the background, so the shelves stay matched on every screen shape
  assert.match(fnSource('shopHomeBgRect'), /Math\.max\(cw\/iw,ch\/ih\)/);
  // the counter is only a last resort: a cabinet shelf that still has room is always preferred
  assert.match(fnSource('shopHomeLayout'), /if\(def\.counter&&best\.room\*0\.94<slotS\*0\.75\)/);
  assert.match(fnSource('drawShopBgCover'), /Math\.max\(cw\/img\.naturalWidth,ch\/img\.naturalHeight\)/);
});

test('home scene: the flying item lands exactly where it is then drawn', () => {
  const scene = fnSource('drawSupermarketScene');
  assert.match(scene, /const target=\{ x:slot\.x, y:slot\.base-slot\.size\/2 \};/);
  assert.match(scene, /drawShopImgSink\(ctx,shopItemImg\(a\.item\),p\.x,p\.y,sz,sz,animP,false\)/);
});

test('laundry basket: clothes are drawn between the back of the basket and its front wall', () => {
  const src = fnSource('drawLaundryBasket');
  const first = src.indexOf('drawShopImgFit(ctx,imgLaundryBasket');
  const clothes = src.indexOf('drawLaundryGarment(ctx,id,b.x+off*b.w*0.115');
  const second = src.lastIndexOf('drawShopImgFit(ctx,imgLaundryBasket');
  assert.ok(first > 0 && clothes > first && second > clothes, 'basket → clothes → front of basket again');
  assert.equal((src.match(/ctx\.clip\(\)/g) || []).length, 2, 'clothes clipped to the basket; front wall clipped below the rim');
  assert.match(html, /const LAUNDRY_BASKET_SHAPE=\{ w:520, h:322, /);
});

test('sun: its resting place is worked out from the pole, not from the clothes', () => {
  const scene = fnSource('drawLaundryStoryScene');
  assert.match(scene, /const sun=laundrySunSpot\(cw,ch,L\), sr=sun\.r, sx=sun\.x, syEnd=sun\.y/);
  assert.doesNotMatch(scene, /syEnd=L\.poleY\+L\.hangH/);
  assert.match(fnSource('laundrySunSpot'), /bottom=L\.poleY-poleR-6\*cs/);
});

test('detection and scoring code is untouched by the picture changes', () => {
  for(const name of ['shopHomeLayout', 'shopHomeBgRect', 'drawShopImgSink', 'drawShopHomeLabel', 'drawLaundryBasket', 'laundrySunSpot']){
    assert.doesNotMatch(fnSource(name), /shoulderFlexionState|addScore|state\.score|repsDone|landmark/i, name + ' only draws');
  }
});

// ---------------------------------------------------------------- e2e
let browser = null;
before(async () => {
  try{
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
  }catch(e){ browser = null; }
});
after(async () => { if(browser) await browser.close(); });

async function openGame(vw, vh, start){
  const context = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(start => { window.__qa.startGame(start); }, start);
  await page.waitForTimeout(300);
  return { context, page, errors };
}

test('home scene on a phone held sideways: the cabinet is under the top buttons, so dry goods stand on the kitchen counter instead of floating', async t => {
  if(!browser) return t.skip('playwright unavailable');
  const { context, page, errors } = await openGame(844, 390, { level: '3', theme: 'supermarket', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0, shopListSize: 'medium' });
  try{
    const H = await page.evaluate(() => {
      const qa = window.__qa;
      for(let i = 0; i < 400; i++){ const s = qa.shopStory.state(); if(s.step && s.step.scene === 'done') break; if(s.step && s.step.kind === 'scene') qa.shopStory.skipScene(); else { qa.shopStory.trigger(); qa.shopStory.finishAnim(); } }
      window.advanceTime(200, 6);
      return qa.shopStory.homeLayout();
    });
    assert.ok(H.nDry >= 1 && H.cab.length >= H.nDry);
    H.cab.slice(0, H.nDry).forEach((p, i) => {
      assert.ok(Math.abs(p.base - Math.min(H.ch - 8 * H.cssScale, H.counterBase)) < 1, `dry item ${i}: stands on the counter`);
      assert.ok(p.base - p.size >= H.hudTop && p.x - p.size / 2 >= 0 && p.x + p.size / 2 <= H.cw, `dry item ${i}: fully visible`);
    });
    assert.deepEqual(errors, []);
  }finally{ await context.close(); }
});

const SCREENS = [['iPad landscape', 1180, 820], ['iPad portrait', 820, 1180], ['department laptop', 1413, 653]];

for(const [label, vw, vh] of SCREENS){
  for(const size of ['medium', 'long']){
    test(`home scene on ${label} (${size} list): every item stands on a shelf, inside the furniture, clear of the banner`, async t => {
      if(!browser) return t.skip('playwright unavailable');
      const { context, page, errors } = await openGame(vw, vh, { level: '3', theme: 'supermarket', duration: 600, affectedSide: 'right', shoulderTargetDeg: 30, dwellMs: 0, shopListSize: size });
      try{
        const out = await page.evaluate(() => {
          const qa = window.__qa, S = () => qa.shopStory.state();
          for(let i = 0; i < 400; i++){ const s = S(); if(s.step && s.step.scene === 'done') break; if(s.step && s.step.kind === 'scene') qa.shopStory.skipScene(); else { qa.shopStory.trigger(); qa.shopStory.finishAnim(); } }
          window.advanceTime(200, 6);
          return { state: S(), H: qa.shopStory.homeLayout() };
        });
        const H = out.H, cs = H.cssScale;
        assert.equal(out.state.step.scene, 'done');
        assert.equal(out.state.shelved.length, H.nDry + H.nCold, 'everything bought was put away');
        assert.ok(H.cab.length >= H.nDry && H.fr.length >= H.nCold, 'a place for every item');
        const banner = { x0: H.banner.x0, x1: H.banner.x1, y0: H.banner.y, y1: H.banner.y + H.bannerH };
        const check = (slots, box, n, what) => {
          slots.slice(0, n).forEach((p, i) => {
            const row = box.rows.find(r => Math.abs(r.base - p.base) < 1);
            assert.ok(row, `${what} ${i}: stands on a shelf of the picture`);
            assert.ok(p.base - p.size >= row.top - 1, `${what} ${i}: fits under the shelf above`);
            assert.ok(p.x >= box.x0 - 1 && p.x <= box.x1 + 1, `${what} ${i}: inside the ${what} left to right`);
            assert.ok(p.x - p.size * 0.5 >= -1 && p.x + p.size * 0.5 <= H.cw + 1, `${what} ${i}: on screen`);
            assert.ok(p.base - p.size >= H.hudTop - 1 && p.base <= H.ch, `${what} ${i}: below the top bar, above the bottom edge`);
            const overlapsBanner = p.x + p.size * 0.5 > banner.x0 && p.x - p.size * 0.5 < banner.x1 && p.base - p.size < banner.y1 && p.base > banner.y0;
            assert.ok(!overlapsBanner, `${what} ${i}: not hidden by the banner`);
            assert.ok(p.size >= 40 * cs, `${what} ${i}: still big enough to see`);
          });
        };
        check(H.cab, H.cabinet, H.nDry, 'cabinet');
        check(H.fr, H.fridge, H.nCold, 'fridge');
        assert.ok(H.banner.x1 - H.banner.x0 >= 380 * cs, 'banner keeps a readable width');
        assert.deepEqual(errors, []);
      }finally{ await context.close(); }
    });
  }

  test(`sun on ${label}: stops in the sky above the bamboo pole, on screen and below the top buttons`, async t => {
    if(!browser) return t.skip('playwright unavailable');
    const { context, page, errors } = await openGame(vw, vh, { level: '4', theme: 'laundry', duration: 600, affectedSide: 'right', shoulderTargetDeg: 60, dwellMs: 0, laundryLoadSize: 'medium' });
    try{
      const out = await page.evaluate(() => {
        const qa = window.__qa, S = () => qa.laundryStory.state();
        for(let i = 0; i < 400; i++){ const s = S(); if(s.step && s.step.cut === 'sun') break; if(s.step && s.step.kind === 'scene') qa.laundryStory.skipScene(); else { qa.laundryStory.trigger(); qa.laundryStory.finishAnim(); } }
        window.advanceTime(2600, 80);
        return { state: S(), G: qa.laundryStory.sunSpot() };
      });
      const G = out.G, cs = G.cssScale, reach = G.sun.r * 1.55; // disc plus rays
      assert.ok(G.sun.y + reach <= G.poleY - G.poleR, 'whole sun is above the pole');
      assert.ok(G.sun.y - reach >= (G.portrait ? 146 : 76) * cs, 'below the top buttons');
      assert.ok(G.sun.x + reach <= G.cw && G.sun.x - reach >= G.cw * 0.5, 'on the right-hand side, fully on screen');
      assert.ok(G.sun.r >= 30 * cs, 'sun is still a good size');
      assert.deepEqual(errors, []);
    }finally{ await context.close(); }
  });
}
