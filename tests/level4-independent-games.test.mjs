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

test('Level 4 library shows all five games by default and allows independent visibility choices', () => {
  assert.match(html, /level4SessionThemes:\['dimsum','wipewindow','bowling','mahjongwash','buspay'\]/);
  assert.match(html, /function visibleThemeOrder\(level = state\.level\)/);
  assert.match(html, /return selected\.length \? selected : \['dimsum'\]/);
  assert.match(html, /Level 4 遊戲 · 顯示/);
  assert.doesNotMatch(html, /每節最多 2 款/);
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
  assert.match(moduleJs, /if\(level4MotionReachGate\(motion\)\)/);
  assert.match(moduleJs, /const clearFlexionReversal = game\.peak >= 0\.62/);
  assert.match(moduleJs, /if\(clearFlexionReversal \|\| level4MotionReturnReady\(motion\)\)/);
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

test('ordinary Level 4 transport is lane-locked while standalone mechanics stay independent', () => {
  assert.match(html, /function isLevel4StandardTransportGame\(\)/);
  assert.match(html, /return isLevel4Tabletop\(\) && !isLevel4StandaloneGame\(\)/);
  assert.match(html, /function beginLevel4StandardCarry\(item\)/);
  assert.match(html, /const pickupX = item\.x/);
  assert.match(html, /laneX:pickupFitsTarget \? pickupX : \(matchingTarget \? matchingTarget\.x : pickupX\)/);
  assert.match(html, /y:carry\.pickupY \+ \(carry\.targetY-carry\.pickupY\) \* progress/);
  assert.match(html, /function moveHeldItemWithController\(\)/);
  assert.match(html, /beginLevel4StandardCarry\(nearest\)/);
  assert.match(html, /const heldPoint = heldItemControlPoint\(\)/);
  assert.match(html, /function displayCursorPoint\(\)/);
  assert.match(html, /standardTransport:isLevel4StandardTransportGame\(\)/);
  assert.match(html, /function level4VerticalReachPoint\(cw = gameCanvas\.width, ch = gameCanvas\.height\)/);
  assert.match(html, /y:bottom \+ \(top-bottom\) \* clamp01\(level4Reach\.progress\)/);
  assert.match(html, /fixed in X, so elbow motion can never be presented as left\/right movement/);
  assert.match(html, /drawLevel4VerticalReachGuide\(ctx, cw, ch\)/);
  assert.match(html, /reachProgress\(\)\{ return clamp01\(level4Reach\.progress\); \}/);
  assert.match(moduleJs, /armProgress:0/);
  assert.match(moduleJs, /const progress = level4MotionProgress\(motion\)/);
  assert.match(moduleJs, /game\.armProgress = progress/);
  assert.match(moduleJs, /const verticalProgress = game\.phase === 'rolling' \? game\.ballProgress : game\.armProgress/);
  assert.match(moduleJs, /level4Runtime\.drawVerticalReachGuide\(ctx,cw,ch\)/);
  assert.match(moduleJs, /function updateLevel4MahjongWash\(motion, nx, ny\)/);
  assert.match(moduleJs, /function updateLevel4BusPay\(motion, nx, ny\)/);
});

test('offline build ships and caches the new module', () => {
  assert.match(build, /cp "\$ROOT\/level4-three-games-module\.js" "\$DIST\/level4-three-games-module\.js"/);
  assert.match(html, /<script src="level4-three-games-module\.js"><\/script>/);
});
