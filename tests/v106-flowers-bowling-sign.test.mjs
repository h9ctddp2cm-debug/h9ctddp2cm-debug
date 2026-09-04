// v106 — 花名精簡（粉玫瑰／雛菊）、雛菊／百合／蘭花新圖（冇甩花瓣）、荃灣保齡球場招牌掛喺球樽上方
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('flower names use the therapist wording (粉玫瑰, 雛菊) and keep the full eight-flower set', () => {
  const block = html.slice(html.indexOf('const FLOWER_KINDS'), html.indexOf('const FLOWER_KINDS') + 1600);
  const names = [...block.matchAll(/key:'v75f_0(\d)', name:'([^']+)'/g)].map(m => m[2]);
  assert.deepEqual(names, ['紅玫瑰', '橙玫瑰', '粉玫瑰', '黃菊花', '橙菊花', '雛菊', '百合', '蘭花']);
  assert.doesNotMatch(html, /小雛菊|粉紅玫瑰/);
});

test('flower 06/07/08 artwork is present, transparent PNG, and sized for the palette', () => {
  for (const n of ['06', '07', '08']) {
    const p = path.join(root, 'img', `flower_${n}.png`);
    assert.ok(fs.existsSync(p), `img/flower_${n}.png exists`);
    const buf = fs.readFileSync(p);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert.ok(Math.max(w, h) <= 200 && Math.min(w, h) >= 120, `flower_${n} ${w}x${h} within 120–200 px`);
    assert.ok(buf.length < 60000, `flower_${n} small enough for offline cache (${buf.length} B)`);
  }
});

test('bowling sign asset exists and is referenced by the alley scene', () => {
  const p = path.join(root, 'img', 'bowling_sign.png');
  assert.ok(fs.existsSync(p), 'img/bowling_sign.png exists');
  const buf = fs.readFileSync(p);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  assert.ok(buf.length < 150000, `sign small enough for offline cache (${buf.length} B)`);
  assert.match(html, /const imgBowlingSign = new Image\(\); imgBowlingSign\.src = 'img\/bowling_sign\.png';/);
  assert.match(html, /function drawBowlingSign\(ctx,g\)/);
  // Drawn after the background and before the pins, so it hangs above them without covering any pin.
  const scene = html.slice(html.indexOf('function drawBowlingAlleyScene'), html.indexOf('function drawBowlingAlleyScene') + 1200);
  const iSign = scene.indexOf('drawBowlingSign(ctx,g);');
  const iPins = scene.indexOf('drawBowlingPins(ctx,g);');
  assert.ok(iSign > 0 && iPins > iSign, 'sign drawn before pins inside drawBowlingAlleyScene');
  // Fallback text keeps the orientation cue even if the PNG has not loaded yet.
  assert.match(html, /fillText\('荃灣保齡球場'/);
});

test('bowling ball rest point follows the lowered rack in the public game (research untouched)', () => {
  assert.match(html, /if\(state\.theme==='bowlinglane'&&!research\.active\)\{[\s\S]{0,200}top=bowlingLaneGeometry\(cw,ch\)\.ballTopY;/);
  assert.match(html, /const startY=g\.ballTopY;/);
  assert.match(html, /const ballTopY=pinBaseY-ch\*0\.05;/);
});

test('bowling scene still hands off exactly as before (v73 contract intact)', () => {
  assert.match(html, /if\(state\.theme==='bowlinglane'\)\{ drawBowlingAlleyScene\(ctx,cw,ch\); return; \}/);
});
