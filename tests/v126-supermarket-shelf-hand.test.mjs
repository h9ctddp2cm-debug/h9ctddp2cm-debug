import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// v126 (19 Nov 2026 user requests on the v125 supermarket story):
//   1. Default shopping-list length is 中單 (4 items ≈ 22 raises).
//   2. Shelf display looks like a real supermarket: fruit sits as a heap in a
//      crate and one piece is taken from the top; bottles/boxes stand in a row
//      and the front one is taken. The heap/row never empties.
//   3. The raise marker is a real open-palm picture (img/shop_hand.png), not
//      an orange circle with the character 手.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');

function functionSource(name){
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for(let i = open; i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}
function constSource(name){
  const start = html.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `missing const ${name}`);
  let depth = 0, i = start;
  for(; i < html.length; i++){
    const c = html[i];
    if(c === '{') depth++; else if(c === '}') depth--; else if(c === ';' && depth === 0) break;
  }
  return html.slice(start, i + 1);
}
function layoutFn(){
  const src = [
    constSource('SHOP_ITEMS').replace(/img:\(\)=>[A-Za-z]+,/g, 'img:null,'),
    functionSource('shopShelfLayout'),
    'globalThis.__out = { shopShelfLayout };',
  ].join('\n');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx.__out.shopShelfLayout;
}
const g = { laneX: 700, shelfItemY: 300, itemSize: 140 };

test('v126 default shopping list is 中單 (medium, 4 items)', () => {
  assert.match(html, /shopListSize:\s*'medium'/);
  assert.match(functionSource('shopListSizeKey'), /: 'medium'; \}/);
  assert.match(functionSource('buildShopList'), /SHOP_LIST_SIZES\[sizeKey\]\|\|4/);
});

test('v126 fruit is a heap in a crate; taking reduces the heap by one but never empties it', () => {
  const layout = layoutFn();
  const two = layout(g, 'apple', 2);
  const one = layout(g, 'apple', 1);
  const none = layout(g, 'apple', 0);
  assert.ok(two.crate, 'apples sit in a crate');
  assert.equal(two.items.length, 7);
  assert.equal(one.items.length, 6);
  assert.equal(none.items.length, 5, 'five filler apples stay so the heap never looks empty');
  // Heap items are smaller than a single shelf item and overlap (closer than one item width).
  for(const it of two.items) assert.ok(it.s < g.itemSize);
  const xs = two.items.map(i => i.x).sort((a, b) => a - b);
  assert.ok(xs[1] - xs[0] < two.items[0].s, 'heap pieces overlap horizontally');
  // The piece to take (last) is the top of the heap: highest y (smallest value) and inside the crate.
  const top = two.items[two.items.length - 1];
  assert.ok(two.items.every(i => i.y >= top.y));
  assert.ok(top.x > two.crate.x && top.x < two.crate.x + two.crate.w);
  assert.ok(layout(g, 'orange', 2).crate, 'oranges also heap');
});

test('v126 bottles / boxes stand in a row with the front one taken; row never empties', () => {
  const layout = layoutFn();
  for(const id of ['soysauce', 'milk', 'eggs', 'rice', 'toiletpaper', 'choysum']){
    const r1 = layout(g, id, 1), r0 = layout(g, id, 0);
    assert.equal(r1.crate, null, `${id} has no crate`);
    assert.equal(r1.items.length, 4);
    assert.equal(r0.items.length, 3, `${id}: three filler pieces remain`);
    const ys = r1.items.map(i => i.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) < g.itemSize * 0.2, 'row is roughly level');
  }
});

test('v126 aisle scene draws the heap/row and the flying piece leaves from the take slot', () => {
  const aisle = functionSource('drawSupermarketScene');
  assert.match(aisle, /const layout=shopShelfLayout\(g,itemId,remaining\);/);
  assert.match(aisle, /layout\.crate&&drawShopCrate\(ctx,layout\.crate\);/);
  assert.match(aisle, /const targetSlot=layout\.items\[layout\.items\.length-1\];/);
  assert.match(aisle, /const from=\{x:targetSlot\.x,y:targetSlot\.y\}/);
  assert.match(aisle, /drawShopImgFit\(ctx,shopItemImg\(itemId\),p\.x,p\.y,targetSlot\.s\*\(1-0\.25\*animP\)/);
  assert.match(functionSource('drawShopCrate'), /rrPath\(ctx,c\.x,c\.y,c\.w,c\.h,8\)/);
});

test('v126 raise marker is the open-palm picture, no 手 glyph circle', () => {
  const m = functionSource('drawShopArmMarker');
  assert.match(html, /const imgShopHand = new Image\(\); imgShopHand\.src = 'img\/shop_hand\.png';/);
  assert.match(m, /ctx\.drawImage\(imgShopHand,/);
  assert.doesNotMatch(m, /fillText\('手'/);
  assert.doesNotThrow(() => readFileSync(path.join(root, 'img', 'shop_hand.png')));
  // Fallback circle only when the image has not loaded.
  assert.match(m, /imgShopHand\.complete&&imgShopHand\.naturalWidth/);
});
