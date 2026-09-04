import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

/* ---------- Level 5 晾衫：每次一件衫 + 大衫籃 ---------- */

const layoutFn = new Function(
  'const LAUNDRY_BASKET_IMG_ASPECT = 198 / 300;\n' +
  functionSource('laundrySingleGarmentLayout') +
  '\nreturn laundrySingleGarmentLayout;'
)();

const VIEWPORTS = [[1180, 820], [820, 1180], [1024, 768], [768, 1024], [1366, 1024]];

function rects(cw, ch, n){
  const L = layoutFn(cw, ch, n);
  const baskets = L.baskets.map(b=>({
    left:b.x - L.bw / 2, right:b.x + L.bw / 2, top:b.y - L.bh / 2, bottom:b.y + L.bh / 2,
  }));
  const g = L.garment;
  const garment = { left:g.x - g.size / 2, right:g.x + g.size / 2, top:g.y - g.size / 2, bottom:g.y + g.size / 2 };
  return { L, baskets, garment };
}
const overlaps = (a, b)=> a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('v101 L5 laundry single-garment mode shows one garment and uses the big-basket layout', () => {
  assert.match(html, /function isLaundrySingleGarmentMode\(\)\{\s*return isPublicLevel5VerticalFlow\(\) && isPatientVisualCueMode\(\);/);
  assert.match(html, /if\(cfg && isLaundrySingleGarmentMode\(\)\) return Object\.assign\(\{\}, cfg, \{ items:1 \}\);/);
  assert.match(html, /const LAUNDRY_BASKET_IMG_ASPECT = 198 \/ 300;/);
  assert.match(html, /laundry\.layout\s*=\s*single/);
  assert.match(html, /'拿起衣物，放入同色衫籃。'/);
});

test('v101 L5 laundry layout: baskets never overlap each other, the garment, or the HUD band', () => {
  for(const [cw, ch] of VIEWPORTS){
    const portrait = ch > cw;
    // 直向 HUD（指示泡泡 + 按鈕列）約去到 0.13ch；橫向約 0.08ch。
    const hudBottom = ch * (portrait ? 0.13 : 0.08);
    for(const n of [2, 3, 4]){
      const { L, baskets, garment } = rects(cw, ch, n);
      assert.equal(baskets.length, n, `${cw}x${ch} n=${n} basket count`);
      for(let i = 0; i < n; i++){
        const b = baskets[i];
        assert.ok(b.left >= 0 && b.right <= cw, `${cw}x${ch} n=${n} basket ${i} inside horizontally`);
        assert.ok(b.top >= hudBottom, `${cw}x${ch} n=${n} basket ${i} clears HUD band (top=${b.top.toFixed(0)} hud=${hudBottom.toFixed(0)})`);
        assert.ok(!overlaps(b, garment), `${cw}x${ch} n=${n} basket ${i} clears garment`);
        for(let j = i + 1; j < n; j++){
          assert.ok(!overlaps(b, baskets[j]), `${cw}x${ch} n=${n} baskets ${i}/${j} overlap`);
          // 籃與籃之間要有明顯走廊（≥ 4% 畫面短邊）。
          const gapX = Math.max(baskets[j].left - b.right, b.left - baskets[j].right);
          const gapY = Math.max(baskets[j].top - b.bottom, b.top - baskets[j].bottom);
          assert.ok(Math.max(gapX, gapY) >= Math.min(cw, ch) * 0.04,
            `${cw}x${ch} n=${n} baskets ${i}/${j} corridor too narrow`);
        }
      }
      // 衫籃要夠大：闊度至少 0.26cw（三個或以上）／0.34cw（兩個），上限 460px。
      assert.ok(L.bw >= Math.min(460, cw * (n === 2 ? 0.34 : 0.26)) - 0.5, `${cw}x${ch} n=${n} baskets large enough (bw=${L.bw.toFixed(0)})`);
      // 件衫置中於畫面下方。
      assert.equal(L.garment.x, cw * 0.5);
      assert.ok(L.garment.y >= ch * 0.76 && garment.bottom <= ch, `${cw}x${ch} garment low-centre and inside`);
    }
  }
});

/* ---------- Level 6 晾衫：六件清空 + 語音 + 畫面內晾衫繩 ---------- */

test('v101 L6 rack clears after six garments, announces a new batch, and keeps hung garments on screen', () => {
  assert.match(html, /const LAUNDRY_RACK_CAPACITY = 6;/);
  assert.match(html, /const LAUNDRY_RACK_CLEAR_DELAY_MS = 1800;/);
  assert.match(html, /const LAUNDRY_NEW_BATCH_TEXT = '又有新衫要晾喇！';/);
  assert.match(html, /const LAUNDRY_RACK_SLOTS = \[-0\.375, -0\.225, -0\.075, 0\.075, 0\.225, 0\.375\];/);
  const draw = functionSource('drawLaundryRackTarget');
  assert.match(draw, /const railW = Math\.min\(rw, cw \* 0\.96\);/);
  assert.match(draw, /const hudSafeTop = ch \* \(ch > cw \? 0\.15 : 0\.11\);/);
  assert.match(draw, /const railY = Math\.max\(t\.y - rh \* 0\.42, hudSafeTop\);/);
  assert.match(draw, /const maxW = railW \* 0\.13;/);
  // 六個位加最大闊度：0.13 < 0.15 槽距，永不重疊；最外兩件 0.375+0.065=0.44 < 0.5 畫面內。
  assert.ok(0.13 < 0.15 && 0.375 + 0.13 / 2 < 0.5);
});

/* ---------- Level 6 筷子：簡單版都用懷舊公雞碟 ---------- */

test('v101 L6 chopsticks basic mode uses the rooster plate photo like complex mode', () => {
  const setup = functionSource('setupTargets');
  assert.match(setup, /type:'dimsum_plate', label:'大碟',\s*img:imgRoosterPlate,drawIcon:null,/);
  assert.doesNotMatch(setup, /basic\?null:imgRoosterPlate/);
  assert.doesNotMatch(html, /中央大碗/);
});

/* ---------- 啤牌指示放大三倍 ---------- */

test('v101 cards instruction chip is 3x (78px) in patient mode and sits between HUD and cards', () => {
  assert.match(html, /const CARDS_BIG_CHIP_FONT_PX = 78;/); // 26px × 3
  assert.match(html, /const CARDS_BIG_CHIP_H = 104;/);
  const render = functionSource('cardsRender');
  assert.match(render, /if\(isPatientVisualCueMode\(\)\)\{[\s\S]{0,400}drawCardsBigChip\(ctx, chipText, CARD_SUIT_COLOR\[cards\.suit\], cardsBigChipY\(cw, ch\)\);/);
  const chipYFn = new Function(functionSource('cardsBigChipY') + '\nreturn cardsBigChipY;')();
  // 標籤底邊必須高於牌面頂 (0.27ch 起)，頂邊必須低於 HUD 按鈕列（直向 ~140px，橫向 ~60px）。
  for(const [cw, ch] of [[1180, 820], [820, 1180], [1024, 768], [768, 1024], [1366, 1024]]){
    const chipY = chipYFn(cw, ch);
    assert.ok(chipY + 104 < ch * 0.27, `${cw}x${ch} chip clears cards`);
    assert.ok(chipY >= (ch > cw ? 150 : 66), `${cw}x${ch} chip clears HUD`);
  }
  // 太窄畫面會自動縮字，但唔會細過 30px，亦唔會超出 94% 闊。
  const chip = functionSource('drawCardsBigChip');
  assert.match(chip, /const maxW = cw \* 0\.94 - padX \* 2;/);
  assert.match(chip, /Math\.max\(30, Math\.floor\(fontPx \* maxW \/ tw\)\)/);
});

test('v101 L6 card sorting shows a big two-pile chip and a matching instruction text', () => {
  const l6 = functionSource('drawLevel6CardsChip');
  assert.match(l6, /state\.level !== '67' \|\| state\.theme !== 'cards' \|\| !isPatientVisualCueMode\(\)/);
  assert.match(l6, /'♥ 放紅心牌堆　♠ 放黑桃牌堆'/);
  assert.match(html, /drawFridgeOrderBanner\(ctx, cw, ch\);\s*drawLevel6CardsChip\(ctx, cw, ch\);/);
  const text = functionSource('level5PatientInstructionText');
  assert.match(text, /if\(state\.level === '67'\) return '拿起啤牌，放到相同花色牌堆。';/);
});
