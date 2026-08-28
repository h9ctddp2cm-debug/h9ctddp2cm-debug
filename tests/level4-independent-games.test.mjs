import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const moduleJs = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-dist.sh'), 'utf8');

test('Level 2 presents exactly one fail-closed supported tabletop game', () => {
  assert.match(html, /if\(level === '2'\) return themeId === 'bilateral'/);
  assert.match(html, /return \['bilateral'\]/);
  assert.match(html, /level4SessionThemes:\['bilateral'\]/);
});

test('Level 2 copy prescribes only supported shoulder horizontal abduction and return', () => {
  assert.match(html, /id:'bilateral', title:'檯面肩水平外展'/);
  assert.match(html, /患側前臂承托，由中線向患側外滑，再返回中線/);
  assert.match(html, /返回中線後再開始下一次/);
  assert.match(html, /return \['bilateral'\]/);
});

test('Level 2 directly follows torso-relative outward progress without pickup or release gates', () => {
  assert.match(html, /function updateLevel2LateralGame\(\)/);
  assert.match(html, /item\.x=lane\.startX\+\(lane\.endX-lane\.startX\)\*clamp01\(level3Lateral\.progress\)/);
  assert.match(html, /adaptiveNoteTrial\('level2_horizontal_abduction','success'\)/);
  assert.match(html, /if\(isLevel3Tabletop\(\)\)\{\s*updateLevel2LateralGame\(\);\s*return;/);
  assert.match(html, /phase:'outward'/);
  assert.match(html, /Level2HorizontalAbductionController/);
  assert.match(html, /generation:frame\?\.generation/);
});

test('Level 2 library always shows the one prescribed game without a picker', () => {
  assert.match(html, /level4SessionThemes:\['bilateral'\]/);
  assert.match(html, /function visibleThemeOrder\(level = state\.level\)/);
  assert.match(html, /return availableThemeOrder\(level\)/);
  assert.match(html, /picker\.hidden = true/);
});

test('actual tracking and render loops connect all three independent games', () => {
  assert.match(html, /updateLevel4Bowling\(level4Motion\)/);
  assert.match(html, /const level4PathPoint = level4PathControlPoint\(cw, ch, level4OrderedHorizontalProgress\(\)\)/);
  assert.match(html, /updateLevel4MahjongWash\(\s*level4Motion, level4PathPoint\.x\/cw, level4PathPoint\.y\/ch/);
  assert.match(html, /updateLevel4BusPay\(\s*level4Motion, level4PathPoint\.x\/cw, level4PathPoint\.y\/ch/);
  assert.match(html, /renderLevel4Bowling\(ctx, cw, ch\)/);
  assert.match(html, /renderLevel4MahjongWash\(ctx, cw, ch\)/);
  assert.match(html, /renderLevel4BusPay\(ctx, cw, ch\)/);
});

test('bowling requires an explicit fresh flexed return and bus pay has ordered dwell and return phases', () => {
  assert.match(moduleJs, /game\.phase = 'await-start'/);
  assert.match(moduleJs, /game\.phase = 'await-return'/);
  assert.match(moduleJs, /if\(game\.phase === 'forward' && level4MotionReachGate\(motion\)\)/);
  assert.match(moduleJs, /if\(level4MotionReturnReady\(motion\)\)\{\s*game\.phase = 'forward'/);
  assert.match(moduleJs, /game\.holdFrames < 4/);
  assert.match(moduleJs, /game\.armed = false/);
  assert.match(moduleJs, /game\.phase = 'return-horizontal'/);
});

test('mahjong graphics are deterministic and progress ignores shimmer', () => {
  assert.doesNotMatch(moduleJs, /Math\.random/);
  assert.match(moduleJs, /distance < 0\.007 \|\| distance > 0\.16/);
  // Real tile faces, seeded (not Math.random) disorder, and a real reshuffle.
  assert.match(moduleJs, /LEVEL4_MAHJONG_CODES/);
  assert.match(moduleJs, /function level4MahjongShuffle/);
  assert.match(moduleJs, /function level4Prng/);
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
  // Canonical direction lock: the lane runs bottom (progress 0, flexed) to top
  // (progress 1, extended), so elbow flexion can never lift the carried item.
  assert.match(html, /y:bottomY \+ \(topY-bottomY\) \* progress/);
  assert.match(html, /bottomY = Math\.max\(item\.level4Carry\.pickupY, item\.level4Carry\.targetY\)/);
  assert.match(html, /function moveHeldItemWithController\(\)/);
  assert.match(html, /beginLevel4StandardCarry\(nearest\)/);
  assert.match(html, /const heldPoint = heldItemControlPoint\(\)/);
  assert.match(html, /function displayCursorPoint\(\)/);
  assert.match(html, /standardTransport:isLevel4StandardTransportGame\(\)/);
  assert.match(html, /function level4VerticalReachPoint\(cw = gameCanvas\.width, ch = gameCanvas\.height\)/);
  assert.match(html, /y:bottom \+ \(top-bottom\) \* clamp01\(level4Reach\.progress\)/);
  assert.match(html, /function level4PathControlPoint\(cw = gameCanvas\.width, ch = gameCanvas\.height, horizontalProgress = 0\)/);
  assert.match(html, /level4Calibration\.pathCoordinates\(level4Reach\.progress, horizontalProgress/);
  assert.match(html, /function level4OrderedHorizontalProgress\(\)/);
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
