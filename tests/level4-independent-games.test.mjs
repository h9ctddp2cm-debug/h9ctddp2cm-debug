import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const moduleJs = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-dist.sh'), 'utf8');

test('Level 4 presents five complementary games while preserving other themes', () => {
  for (const id of ['bowling', 'mahjongwash', 'buspay']) {
    assert.match(html, new RegExp(`${id}: mkTheme`));
  }
  assert.match(html, /return \['dimsum','wipewindow','bowling','mahjongwash','buspay'\]/);
  assert.match(html, /\['wipewindow','bowling','mahjongwash','buspay'\]\.includes\(themeId\)/);
});

test('Level 4 library limits the visible session choice to one or two therapist-selected games', () => {
  assert.match(html, /level4SessionThemes:\['dimsum','wipewindow'\]/);
  assert.match(html, /function visibleThemeOrder\(level = state\.level\)/);
  assert.match(html, /return selected\.length \? selected\.slice\(0,2\) : \['dimsum'\]/);
  assert.match(html, /治療師設定 · 本節顯示/);
  assert.match(html, /每節最多 2 款/);
  assert.match(html, /id="btnLevel4AutoRotate"/);
  assert.match(html, /if\(current\[0\] === all\[start\] && current\[1\] === all\[\(start\+1\)%all\.length\]\)/);
});

test('actual tracking and render loops connect all three independent games', () => {
  assert.match(html, /updateLevel4Bowling\(level4Motion\)/);
  assert.match(html, /updateLevel4MahjongWash\(\s*level4Motion, cursorX\/cw, cursorY\/ch/);
  assert.match(html, /updateLevel4BusPay\(\s*level4Motion, cursorX\/cw, cursorY\/ch/);
  assert.match(html, /renderLevel4Bowling\(ctx, cw, ch\)/);
  assert.match(html, /renderLevel4MahjongWash\(ctx, cw, ch\)/);
  assert.match(html, /renderLevel4BusPay\(ctx, cw, ch\)/);
});

test('bowling requires a reach-return cycle and bus pay requires stable frames', () => {
  assert.match(moduleJs, /game\.phase = 'return'/);
  assert.match(moduleJs, /motion\.completionReady \|\| \(game\.peak >= 0\.68 && motion\.progress <= 0\.18\)/);
  assert.match(moduleJs, /game\.holdFrames < 4/);
  assert.match(moduleJs, /game\.armed = false/);
});

test('mahjong graphics are deterministic and progress ignores shimmer', () => {
  assert.doesNotMatch(moduleJs, /Math\.random/);
  assert.match(moduleJs, /distance < 0\.007 \|\| distance > 0\.16/);
  assert.match(moduleJs, /LEVEL4_MAHJONG_TILES/);
});

test('wipe game reveals the mirrored live camera through visibly opaque fog', () => {
  assert.match(html, /ctx\.drawImage\(gameVideo,sx,sy,sw,sh,0,0,w,h\)/);
  assert.match(html, /ctx\.scale\(-1,1\)/);
  assert.match(html, /const mist = 0\.88/);
  assert.match(html, /level4-selfie-window/);
});

test('offline build ships and caches the new module', () => {
  assert.match(build, /cp "\$ROOT\/level4-three-games-module\.js" "\$DIST\/level4-three-games-module\.js"/);
  assert.match(html, /<script src="level4-three-games-module\.js"><\/script>/);
});
