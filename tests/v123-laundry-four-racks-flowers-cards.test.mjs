import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v123 (18 Nov 2026 user requests):
//   1. Level 6 晾衫 difficulty: 「較複雜」replaced by two selective-attention
//      four-rack modes — 着燈四架 (zones: clip the named garment to the flashing
//      rack) and 分類四架 (sort: 上衣／褲／裙／內衣襪 racks). Racks show only the
//      rail part of the photo so each rack can be bigger; four racks sit 2×2
//      above the garment lane. Wrong rack → no penalty, garment returns.
//   2. Level 5/6 插花: patient palette flowers enlarged (≤180px), portrait 2×4.
//   3. Level 6 麻雀 / 啤牌 reuse the Level 5 module interface.
//   4. Level 6 點心: pieces on the big plate drawn larger (0.21 of plate size).

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

function laundryCardHtml(){
  const start = html.indexOf('id="laundryDifficultyCard"');
  assert.ok(start >= 0, 'missing laundry difficulty card');
  const end = html.indexOf('id="fridgeDifficultyCard"', start);
  return html.slice(start, end > start ? end : start + 2000);
}

function constSource(name){
  const start = html.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `missing const ${name}`);
  return html.slice(start, html.indexOf(';', start) + 1);
}

/* ---------------- 1. Laundry: settings card ---------------- */

test('v123 laundry difficulty card offers a 1 → 2 → 4 rack ladder and no complex mode', () => {
  assert.match(html, /data-laundry-difficulty="basic"[\s\S]{0,180}基本：一架/);
  assert.match(html, /data-laundry-difficulty="zones2"[\s\S]{0,180}着燈兩架/);
  assert.match(html, /data-laundry-difficulty="zones"[\s\S]{0,180}着燈四架/);
  assert.match(html, /data-laundry-difficulty="sort2"[\s\S]{0,180}分類兩架/);
  assert.match(html, /data-laundry-difficulty="sort"[\s\S]{0,180}分類四架/);
  // Buttons appear in ladder order: 1 rack → 2 lit → 4 lit → 2 sort → 4 sort.
  const order = [...laundryCardHtml().matchAll(/data-laundry-difficulty="([a-z0-9]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['story', 'basic', 'zones2', 'zones', 'sort2', 'sort']);   // v143: story layout first
  assert.match(constSource('LAUNDRY_DIFFICULTY_KEYS'), /\['basic', 'zones2', 'zones', 'sort2', 'sort'\]/);
  assert.doesNotMatch(html, /data-laundry-difficulty="complex"/);
  assert.doesNotMatch(laundryCardHtml(), /較複雜/, 'laundry card no longer offers 較複雜');
  const mode = functionSource('laundryDifficultyMode');
  assert.match(mode, /if\(d === 'complex' \|\| d === 'zones' \|\| d === 'zones2'\) return 'zones';/);
  assert.match(mode, /if\(d === 'sort' \|\| d === 'sort2'\) return 'sort';/);
  const count = functionSource('laundryRackCount');
  assert.match(count, /if\(k === 'zones2' \|\| k === 'sort2'\) return 2;/);
  assert.match(count, /if\(k === 'zones' \|\| k === 'sort'\) return 4;/);
  assert.match(count, /return 1;/);
  assert.match(functionSource('laundryDifficultyKey'), /if\(d === 'complex'\) return 'zones';/);
  assert.match(functionSource('isLaundryFourRackGame'), /isLaundryZoneGame\(\) \|\| isLaundrySortGame\(\)/);
  assert.match(functionSource('isLaundryOrderGame'), /return isLaundryZoneGame\(\);/);
});

test('v123 two-rack sort splits 上身 (shirt, vest) from 下身 (jeans, skirt, boxers, socks)', () => {
  const racks = constSource('LAUNDRY_SORT_RACKS_2');
  const types = [...racks.matchAll(/laundry_[a-z]+/g)].map(m => m[0]);
  assert.deepEqual([...types].sort(), ['laundry_boxers', 'laundry_jeans', 'laundry_shirt',
    'laundry_skirt', 'laundry_socks', 'laundry_vest']);
  assert.match(racks, /label:'上身', types:\['laundry_shirt','laundry_vest'\]/);
  assert.match(racks, /label:'下身', types:\['laundry_jeans','laundry_skirt','laundry_boxers','laundry_socks'\]/);
  assert.match(functionSource('laundrySortRacks'), /laundryRackCount\(\) === 2 \? LAUNDRY_SORT_RACKS_2 : LAUNDRY_SORT_RACKS/);
});

test('v123 two racks sit side by side (left / right half) above the garment on laptop, iPad and portrait', () => {
  for(const [cw, ch] of [[1413, 653], [1180, 820], [1024, 1366]]){
    const portrait = ch > cw;
    const racks = multiRackTargets(cw, ch, portrait, false, 2);
    assert.equal(racks.length, 2);
    assert.deepEqual(racks.map(r => r.rackIndex), [0, 1]);
    assert.equal(racks[0].y, racks[1].y, 'one row');
    assert.ok(racks[0].x + racks[0].w / 2 < cw / 2 && racks[1].x - racks[1].w / 2 > cw / 2, 'left and right halves');
    assert.ok(racks[0].x - racks[0].w / 2 >= 0 && racks[1].x + racks[1].w / 2 <= cw);
    const garmentR = portrait ? Math.min(cw * 0.17, ch * 0.13) : Math.min(cw * 0.12, ch * 0.18);
    const garmentTop = ch * (portrait ? 0.80 : 0.78) - garmentR;
    for(const r of racks) assert.ok(r.y + r.h / 2 <= garmentTop && r.y - r.h / 2 >= (portrait ? 150 : 72) - 1);
    // Two racks are never smaller than the four-rack version (landscape: taller).
    const four = multiRackTargets(cw, ch, portrait, false, 4);
    assert.ok(racks[0].h >= four[0].h && racks[0].w >= four[0].w);
  }
  const sorted = multiRackTargets(1413, 653, false, true, 2);
  assert.deepEqual(sorted.map(r => r.sortLabel), ['上身', '下身']);
});

test('v123 sort categories cover all six garment types exactly once (內衣襪 groups vest/boxers/socks)', () => {
  const racks = constSource('LAUNDRY_SORT_RACKS');
  const types = [...racks.matchAll(/laundry_[a-z]+/g)].map(m => m[0]);
  assert.deepEqual([...types].sort(), ['laundry_boxers', 'laundry_jeans', 'laundry_shirt',
    'laundry_skirt', 'laundry_socks', 'laundry_vest']);
  assert.match(racks, /label:'上衣',\s*types:\['laundry_shirt'\]/);
  assert.match(racks, /label:'褲',\s*types:\['laundry_jeans'\]/);
  assert.match(racks, /label:'裙',\s*types:\['laundry_skirt'\]/);
  assert.match(racks, /label:'內衣襪',\s*types:\['laundry_vest','laundry_boxers','laundry_socks'\]/);
});

/* ---------------- 1. Laundry: four-rack geometry ---------------- */

function multiRackTargets(cw, ch, portrait, sortMode, count = 4){
  const code = constSource('LAUNDRY_RACK_RAIL_FRAC') + '\n' + constSource('LAUNDRY_SORT_RACKS') + '\n' +
    constSource('LAUNDRY_SORT_RACKS_2') + '\n' + functionSource('laundryRackRailFracFor') + '\n' +
    functionSource('laundryMultiRackTargets') + '\nreturn laundryMultiRackTargets(cw, ch, portrait, count);';
  const fn = new Function('cw', 'ch', 'portrait', 'count', 'imgLaundryRack', 'isLaundrySortGame', code);
  return fn(cw, ch, portrait, count, {naturalWidth: 779, naturalHeight: 453}, () => !!sortMode);
}
const fourRackTargets = (cw, ch, portrait, sortMode) => multiRackTargets(cw, ch, portrait, sortMode, 4);

test('v123 four racks form a 2×2 grid above the single garment lane on laptop, iPad landscape and portrait', () => {
  for(const [cw, ch] of [[1413, 653], [1180, 820], [820, 1180]]){
    const portrait = ch > cw;
    const racks = fourRackTargets(cw, ch, portrait, false);
    assert.equal(racks.length, 4);
    assert.deepEqual(racks.map(r => r.rackIndex), [0, 1, 2, 3]);
    assert.ok(racks.every(r => r.type === 'laundry_rack' && r.style === 'rack'));
    // Two columns, two rows.
    assert.equal(racks[0].y, racks[1].y);
    assert.equal(racks[2].y, racks[3].y);
    assert.equal(racks[0].x, racks[2].x);
    assert.equal(racks[1].x, racks[3].x);
    assert.ok(racks[0].x < racks[1].x && racks[0].y < racks[2].y);
    // Every rack fits inside the canvas and stays above the garment slot.
    const garmentR = portrait ? Math.min(cw * 0.17, ch * 0.13) : Math.min(cw * 0.12, ch * 0.18);
    const garmentTop = ch * (portrait ? 0.80 : 0.78) - garmentR;
    for(const r of racks){
      assert.ok(r.x - r.w / 2 >= 0 && r.x + r.w / 2 <= cw, `rack ${r.rackIndex} inside horizontally at ${cw}x${ch}`);
      assert.ok(r.y + r.h / 2 <= garmentTop, `rack ${r.rackIndex} above garment at ${cw}x${ch}`);
      assert.ok(r.y - r.h / 2 >= (portrait ? 150 : 72) - 1, `rack ${r.rackIndex} below HUD at ${cw}x${ch}`);
      assert.ok(r.w >= 150 && r.h >= 60, `rack ${r.rackIndex} is big enough (${Math.round(r.w)}×${Math.round(r.h)})`);
    }
    // Racks never overlap each other.
    for(let i = 0; i < 4; i++) for(let j = i + 1; j < 4; j++){
      const a = racks[i], b = racks[j];
      const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
      assert.ok(apart, `racks ${i} and ${j} do not overlap at ${cw}x${ch}`);
    }
  }
});

test('v123 sort mode labels the four racks 上衣／褲／裙／內衣襪; zones mode numbers them', () => {
  const sorted = fourRackTargets(1413, 653, false, true);
  assert.deepEqual(sorted.map(r => r.sortLabel), ['上衣', '褲', '裙', '內衣襪']);
  assert.deepEqual(sorted.map(r => r.sortKey), ['tops', 'trousers', 'skirt', 'underwear']);
  const zones = fourRackTargets(1413, 653, false, false);
  assert.deepEqual(zones.map(r => r.label), ['晾衫架1', '晾衫架2', '晾衫架3', '晾衫架4']);
  assert.ok(zones.every(r => r.sortKey === null));
});

test('v123 racks draw only the rail part of the photo, flash the lit rack and frame a wrong rack', () => {
  const draw = functionSource('drawLaundryFourRackTarget');
  // 9-argument drawImage crops the rack photo to its top (rail) part.
  assert.match(draw, /drawImage\(img,\s*0,\s*0,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^)]+\)/);
  assert.match(draw, /laundryLitRack/);
  assert.match(draw, /Math\.sin\(now ?\/ ?175\)/, 'same yellow pulse rhythm as the fridge zones');
  assert.match(draw, /laundryWrongRack/);
  assert.match(functionSource('drawLaundryRackTarget'), /typeof t\.rackIndex === 'number'[\s\S]{0,80}drawLaundryFourRackTarget\(ctx, t\)/);
  assert.match(html, /if\(isLaundryFourRackGame\(\)\)\{[\s\S]{0,200}laundryMultiRackTargets\(cw, ch, portrait, laundryRackCount\(\)\)/);
});

/* ---------------- 1. Laundry: no-penalty rejection ---------------- */

test('v123 a wrong rack never deducts score or feeds wrongStreak on either drop path', () => {
  for(const branch of [
    /else if\(laundryOrderDrop && laundryRackRejectedWithoutPenalty\(\)\)\{[\s\S]{0,260}?\} else \{/,
    /else if\(dwellLaundryOrderDrop && laundryRackRejectedWithoutPenalty\(\)\)\{[\s\S]{0,260}?\} else \{/,
  ]){
    const m = html.match(branch);
    assert.ok(m, 'laundry reject branch exists before the score-penalty else');
    const reject = m[0].split('} else {')[0];
    assert.doesNotMatch(reject, /score -=|score = Math\.max|wrongStreak\+\+|totalWrong\+\+|adaptiveNoteTrial/);
    assert.match(reject, /drop_laundry_rack_reject/);
  }
  assert.match(functionSource('laundryRackRejectedWithoutPenalty'), /return isLaundryFourRackGame\(\);/);
});

test('v123 the patient voice guide points at the lit or category rack', () => {
  const voice = functionSource('publicPatientVoiceTarget');
  assert.match(voice, /laundryLitRack/);
  assert.match(voice, /laundrySortRackFor/);
});

/* ---------------- 2. Flowers: larger patient palette ---------------- */

function paletteLayout(cw, ch, portrait, patientLarge){
  const code = constSource('FLOWERS_PER_PAGE') + '\n' + constSource('FLOWERS_PATIENT_MAX_SIZE') + '\n' +
    constSource('FLOWERS_PATIENT_MIN_SIZE_FOR_8') + '\n' + constSource('FLOWERS_PATIENT_LEFT_CLEAR_PX') + '\n' +
    functionSource('flowersPaletteLayout') + '\nreturn flowersPaletteLayout(cw, ch, portrait, patientLarge);';
  return new Function('cw', 'ch', 'portrait', 'patientLarge', code)(cw, ch, portrait, patientLarge);
}

test('v123 patient flowers are larger: laptop 8×≥160px, iPad landscape 6×≥170px, portrait 4 per row ×2', () => {
  const laptop = paletteLayout(1413, 653, false, true);
  assert.equal(laptop.perRow, 8);
  assert.ok(laptop.size >= 160 && laptop.size <= 180, `laptop size ${laptop.size}`);
  const ipad = paletteLayout(1180, 820, false, true);
  assert.equal(ipad.perRow, 6, 'iPad landscape cannot fit eight ≥150px flowers, so it shows six');
  assert.ok(ipad.size >= 170 && ipad.size <= 180, `iPad size ${ipad.size}`);
  const portrait = paletteLayout(820, 1180, true, true);
  assert.equal(portrait.perRow, 4);
  assert.ok(portrait.size >= 140 && portrait.size <= 180, `portrait size ${portrait.size}`);
  // Eight flowers → two rows in portrait.
  assert.equal(Math.ceil(8 / portrait.perRow), 2);
  // All sizes are larger than the pre-v123 patient cap (132px).
  for(const l of [laptop, ipad, portrait]) assert.ok(l.size > 132);
});

test('v123 non-patient (research / Levels 3-4) flower palette is unchanged', () => {
  const landscape = paletteLayout(1413, 653, false, false);
  assert.equal(landscape.perRow, 8);
  assert.equal(landscape.size, Math.min(Math.min(1413 * 0.118, 140) * 0.94, 120));
  const portrait = paletteLayout(820, 1180, true, false);
  assert.equal(portrait.perRow, 8);
  assert.equal(portrait.size, Math.min(Math.min(820 * 0.118, 96) * 0.94, 92));
});

test('v123 flowersSetup lays the palette out by rows and keeps the first six kinds when only six fit', () => {
  const setup = functionSource('flowersSetup');
  assert.match(setup, /flowersPaletteLayout\(cw, ch, portrait, patientLarge\)/);
  assert.match(setup, /const shown = perRow < FLOWERS_PER_PAGE && !portrait \? batch\.slice\(0, perRow\) : batch;/);
  assert.match(setup, /const rows = Math\.ceil\(shown\.length \/ perRow\);/);
});

/* ---------------- 3. Level 6 mahjong / cards = Level 5 interface ---------------- */

test('v123 Level 6 mahjong and cards reuse the Level 5 modules', () => {
  assert.match(constSource('LEVEL6_SHARED_LEVEL5_THEMES'), /\['flowers','cards','mahjong'\]/);
  assert.match(functionSource('usesAdvancedThemeModule'),
    /if\(isLevel6\(\) && LEVEL6_SHARED_LEVEL5_THEMES\.includes\(theme\)\) return true;/);
  // The generic two-pile chip only remains for the research track.
  assert.match(functionSource('drawLevel6CardsChip'), /^function drawLevel6CardsChip\(ctx, cw, ch\)\{[\s\S]{0,260}if\(usesAdvancedThemeModule\(\)\) return;/);
  // Level 6 no longer uses the old two-pile instruction text.
  assert.doesNotMatch(functionSource('level5PatientInstructionText'), /拿起啤牌，放到相同花色牌堆/);
  // Level 6 task hints describe the shared interface.
  assert.match(html, /指定花色嘅啤牌，移到患側收牌區/);
  assert.match(html, /一組麻雀，移到患側放牌區/);
});

test('v123 Level 6 picker modules count pick-ups like Level 6 flowers; Level 5 keeps counting placements', () => {
  assert.match(html, /this\.heldId = best\.id; this\.armed = false; this\.relStart = 0;[\s\S]{0,260}if\(isLevel6\(\)\) grabCount\+\+;/);
  assert.match(html, /score \+= pts; correctCount\+\+;\s*if\(!isLevel6\(\)\) grabCount\+\+;/);
  assert.match(html, /score \+= res\.fan \* 10;\s*correctCount\+\+;\s*if\(!isLevel6\(\)\) grabCount\+\+;/);
});

/* ---------------- 4. Level 6 dim sum: larger pieces on the plate ---------------- */

test('v123 dim sum pieces on the big plate are drawn at 0.21 of the plate size with spread-out slots', () => {
  assert.match(html, /const DIMSUM_PLATE_ITEM_R_FRAC = 0\.21;/);
  assert.match(functionSource('drawBigPlateTarget'), /Math\.min\(plateW, plateH\) \* DIMSUM_PLATE_ITEM_R_FRAC/);
  const slots = constSource('DIMSUM_PLATE_SLOTS');
  const pts = [...slots.matchAll(/\{fx:(-?[\d.]+),fy:(-?[\d.]+)\}/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.ok(pts.length >= 10, 'at least ten plate slots');
  for(const [fx, fy] of pts) assert.ok(Math.abs(fx) <= 0.32 && Math.abs(fy) <= 0.28, 'slots stay on the plate');
});

/* ---------------- Public wording ---------------- */

test('v123 public source never mentions research or pilot wording in the new laundry card', () => {
  assert.doesNotMatch(laundryCardHtml(), /research|pilot|研究|護士/i);
});
