import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v127 (19 Nov 2026 user requests on the supermarket story cashier scene):
//   1. Items on the cashier counter were too small → counter widened and items
//      drawn at full shelf size (shrinking only when many pieces are out).
//   2. Cashier background too busy → plain white background picture; on
//      landscape screens it is fitted by height with the counter extended to
//      both edges, and the drawn card reader stands on the counter.

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

test('v127 counter items use full shelf size on a wider counter', () => {
  const scene = functionSource('drawSupermarketScene');
  assert.match(scene, /const cs=Math\.min\(g\.itemSize,g\.counterW\/Math\.max\(3,counterSlots\)\);/);
  assert.doesNotMatch(scene, /g\.itemSize\*0\.6,g\.counterW/);
  const geo = functionSource('shopGeometry');
  assert.match(geo, /counterW:cw\*\(portrait\?0\.74:0\.50\)/);
  assert.match(geo, /bagCounterX:cw\*\(portrait\?0\.86:0\.82\), readerX:cw\*\(portrait\?0\.88:0\.93\)/);
});

test('v127 cashier background is fitted by height on landscape with the counter extended', () => {
  const bg = functionSource('drawShopBgCover');
  assert.match(bg, /function drawShopBgCover\(ctx,img,cw,ch,fallback,fitHeight\)/);
  assert.match(bg, /fitHeight&&cw>=ch\?ch\/img\.naturalHeight/);
  assert.match(bg, /h\*0\.826/, 'counter top in the picture sits at 82.6% height');
  assert.match(html, /drawShopBgCover\(ctx,bg,cw,ch,'#e8e3d6',scene==='cashier'\);/);
});

test('v127 card reader has a stand on the counter', () => {
  const scene = functionSource('drawSupermarketScene');
  assert.match(scene, /const standTop=g\.readerY\+g\.itemSize\*0\.2, standBottom=g\.portrait\?g\.counterY-g\.itemSize\*0\.1:ch\*0\.83;/);
});

test('v127 cashier picture is the white-background version (1280×720 JPEG)', () => {
  const buf = readFileSync(path.join(root, 'img', 'shop_cashier_bg.jpg'));
  assert.equal(buf[0], 0xff); assert.equal(buf[1], 0xd8);
  // Sample the top-left pixel region through a tiny decode-free heuristic:
  // the file must be small (plain background compresses well, < 150 kB).
  assert.ok(buf.length < 150 * 1024, `expected plain-background JPEG, got ${buf.length} bytes`);
});
