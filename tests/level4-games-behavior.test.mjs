/* Behavioural tests for the Level 4 standalone games: the bowling ball must
   actually travel down the lane and topple pins with deterministic physics, and
   巴士拍卡 must beep exactly once per valid tap. The games module is executed in a
   sandbox with a stub runtime, so the tests are offline and deterministic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'level4-three-games-module.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-dist.sh'), 'utf8');

function loadGames({theme = 'bowling'} = {}){
  const log = {scores:[], beeps:0, audioAvailable:true};
  let clock = 10000;
  const runtime = {
    addScore(points, name, detail){ log.scores.push({points, name, detail}); },
    now(){ return clock; },
    clamp01(v){ return v < 0 ? 0 : v > 1 ? 1 : v; },
    roundedRect(){},
    theme(){ return theme; },
    isBowling(){ return theme === 'bowling'; },
    isMahjongWash(){ return theme === 'mahjongwash'; },
    isBusPay(){ return theme === 'buspay'; },
    reachProgress(){ return 0; },
    reachMotion(){ return {}; },
    beepTap(){
      if(!log.audioAvailable) return false;
      log.beeps += 1;
      return true;
    },
    drawVerticalReachGuide(){},
    cursor(){ return {detected:false, x:-1, y:-1}; },
  };
  const window = {__level4GameRuntime:runtime};
  const context = vm.createContext({window, Math, Number, Object, Array, String, console});
  vm.runInContext(source, context);
  return {
    qa:window.__level4MiniGamesQA,
    log,
    advance(ms){ clock += ms; },
    now(){ return clock; },
  };
}

const reached = {
  calibrated:true, gameReady:true, engaged:true, progress:0.95, reachGate:true,
  returnReady:false, shoulderHike:false, cyclePhase:'reached',
  arcCalibrated:true, arcProgress:0, arcActive:false,
};
const flexedStart = {
  calibrated:true, gameReady:true, engaged:false, progress:0.05, reachGate:false,
  returnReady:true, shoulderHike:false, cyclePhase:'start',
  arcCalibrated:true, arcProgress:0, arcActive:false,
};
const onArc = {
  calibrated:true, gameReady:true, engaged:true, progress:0.92, reachGate:true,
  returnReady:false, shoulderHike:false, cyclePhase:'arc-out',
  arcCalibrated:true, arcProgress:0.7, arcActive:true,
};

function parse(text){
  const out = {};
  for(const chunk of text.replace(/^level4MiniGames=/, '').split(' ')){
    const [key, value] = chunk.split(':');
    out[key] = value;
  }
  return out;
}

test('bowling uses a flexed start then one forward throw, rolls to the pins and requires return to re-arm', () => {
  const game = loadGames({theme:'bowling'});
  game.qa.reset();
  game.qa.bowling(flexedStart);
  assert.equal(parse(game.qa.bowling(reached)).bowlingPhase, 'rolling');
  let state = parse(game.qa.bowling(reached));
  assert.equal(state.bowlingPhase, 'rolling');
  assert.equal(Number(state.bowlingPinsDown), 0, 'pins must not fall before the ball arrives');

  // Mid-roll: the ball is travelling and pins are still standing.
  game.advance(500);
  state = parse(game.qa.bowling(flexedStart));
  assert.ok(Number(state.bowlingBall) > 0.3 && Number(state.bowlingBall) < 1,
    `ball should be mid-lane, got ${state.bowlingBall}`);
  assert.equal(Number(state.bowlingPinsDown), 0);

  // Ball reaches the pins: they topple immediately, then settle.
  game.advance(700);
  state = parse(game.qa.bowling(flexedStart));
  assert.equal(Number(state.bowlingBall), 1);
  assert.ok(Number(state.bowlingPinsDown) >= 4, `expected a topple, got ${state.bowlingPinsDown}`);
  assert.equal(state.bowlingPinsSettled, 'false', 'pins should be scattering right after impact');
  assert.equal(game.log.scores.length, 1);
  assert.equal(game.log.scores[0].name, 'level4_bowling_complete');

  // Physics settles deterministically and a new rack is set up.
  for(let i = 0; i < 40; i++){ game.advance(40); game.qa.bowling(flexedStart); }
  state = parse(game.qa.bowling(flexedStart));
  assert.equal(state.bowlingPhase, 'forward');
  assert.equal(Number(state.bowlingPinsDown), 0, 'a fresh rack should be standing');
  assert.equal(Number(state.bowlingRounds), 1);
});

test('bowling ignores endpoint jitter after one forward throw until a flexed return', () => {
  const game = loadGames({theme:'bowling'});
  game.qa.reset();
  game.qa.bowling(flexedStart);
  let state = parse(game.qa.bowling(reached));
  assert.equal(state.bowlingPhase, 'rolling');
  state = parse(game.qa.bowling({...reached, progress:.82}));
  assert.equal(state.bowlingPhase, 'rolling', 'endpoint jitter cannot duplicate a throw');
});

test('all standalone Level 4 scoring stays locked until the fresh calibrated controller is ready', () => {
  const bowling = loadGames({theme:'bowling'});
  bowling.qa.reset();
  const lockedReach = {...reached, gameReady:false};
  assert.equal(parse(bowling.qa.bowling(lockedReach)).bowlingPhase, 'await-start');

  const bus = loadGames({theme:'buspay'});
  bus.qa.reset();
  for(let i = 0; i < 8; i++) bus.qa.bus({...onArc, gameReady:false}, 0.50, 0.43);
  assert.equal(bus.log.scores.length, 0);
  assert.equal(bus.log.beeps, 0);
});

test('bowling pin physics is reproducible for the same reach peak', () => {
  const run = () => {
    const game = loadGames({theme:'bowling'});
    game.qa.reset();
    game.qa.bowling(flexedStart);
    game.qa.bowling(reached);
    game.advance(1100);
    game.qa.bowling(flexedStart);
    game.advance(80);
    return game.qa.bowling(flexedStart);
  };
  assert.equal(run(), run());
});

test('bus pay beeps once after forward payment and re-arms only after horizontal then flexed return', () => {
  const game = loadGames({theme:'buspay'});
  game.qa.reset();
  const target = {x:0.10, y:0.43};
  game.qa.bus(flexedStart,target.x,.84);
  game.qa.bus(reached,target.x,target.y);

  let state;
  for(let i = 0; i < 4; i++) state = parse(game.qa.bus(reached, target.x, target.y));
  assert.equal(game.log.beeps, 1, 'exactly one beep per valid tap');
  assert.equal(Number(state.busHits), 1);
  assert.equal(Number(state.busBeeps), 1);
  assert.equal(state.busArmed, 'false');

  // Dwelling at the reader must not beep again while disarmed.
  for(let i = 0; i < 20; i++) game.qa.bus(reached, target.x, target.y);
  assert.equal(game.log.beeps, 1, 'held pose must not repeat the beep');

  // Horizontal return precedes a fresh flexed return.
  game.qa.bus({...reached,abductionProgress:.95,arcProgress:.95,arcActive:true}, .85, target.y);
  game.qa.bus({...flexedStart,abductionProgress:.95,arcProgress:.95,arcActive:true}, .85, .84);
  game.qa.bus(reached,target.x,target.y);
  for(let i = 0; i < 4; i++) state = parse(game.qa.bus(reached, target.x, target.y));
  assert.equal(game.log.beeps, 2);
  assert.equal(Number(state.busHits), 2);
});

const LEVEL4_NEXT_TARGET = {x:0.43, y:0.37};

test('bus pay still scores when Web Audio is unavailable', () => {
  const game = loadGames({theme:'buspay'});
  game.log.audioAvailable = false;
  game.qa.reset();
  let state;
  game.qa.bus(flexedStart,.1,.84);
  game.qa.bus(reached,.1,.43);
  for(let i = 0; i < 4; i++) state = parse(game.qa.bus(reached, .1, .43));
  assert.equal(Number(state.busHits), 1, 'silent devices must still register the tap');
  assert.equal(state.busBeeped, 'false');
  assert.equal(game.log.scores.length, 1);
});

test('path-game titles state the ordered forward then shoulder-horizontal-abduction contract', () => {
  assert.match(source, /屈肘開始 → 伸肘向前 → 肩水平外展/);
  assert.match(source, /肩水平外展：由左至右返回/);
  assert.match(html, /手臂保持枱面高度/);
});

test('a single beep helper is used and it degrades gracefully', () => {
  assert.match(html, /function playBusTapBeep\(\)/);
  assert.match(html, /beepTap: playBusTapBeep/);
  assert.match(html, /catch\(e\)\{ return false; \}/);
  assert.match(html, /if\(ctx\.state === 'suspended' && typeof ctx\.resume === 'function'\) ctx\.resume\(\)/);
  // The AudioContext is unlocked on a user gesture before gameplay.
  assert.match(html, /Unlock AudioContext on first interaction/);
});

test('bowling and bus visuals are offline, deterministic and recognizable', () => {
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.match(source, /function level4DrawPin\(ctx, x, y, scale, angle, down\)/);
  assert.match(source, /LEVEL4_PIN_LAYOUT/);
  assert.match(source, /function level4StepPinBodies\(game, now\)/);
  assert.match(source, /請拍卡 TAP/);
  assert.match(source, /嘟 · 已拍卡/);
});

test('per-theme Level 4 scenario GIFs are mapped and shipped offline', () => {
  assert.match(html, /const LEVEL4_GUIDE_ASSETS = \{/);
  assert.match(html, /bowling:\{src:'img\/advanced\/level4_bowling_real_life\.gif'/);
  assert.match(html, /buspay:\{src:'img\/advanced\/level4_buspay_real_life\.gif'/);
  assert.match(html, /mahjongwash:\{src:'img\/advanced\/level4_mahjongwash_real_life\.gif'/);
  // The superseded illustrated GIFs must no longer be referenced anywhere.
  assert.doesNotMatch(html, /level4_bowling_illustrated\.gif/);
  assert.doesNotMatch(html, /level4_buspay_illustrated\.gif/);
  assert.doesNotMatch(html, /level4_mahjongwash_illustrated\.gif/);
  // Activity-library thumbnails use the same real-life assets.
  assert.match(html, /thumbnail:'img\/advanced\/level4_bowling_real_life\.gif'/);
  assert.match(html, /thumbnail:'img\/advanced\/level4_buspay_real_life\.gif'/);
  assert.match(html, /thumbnail:'img\/advanced\/level4_mahjongwash_real_life\.gif'/);
  assert.match(html, /wipewindow:\{src:'img\/advanced\/level4_lateral_forward_slide_v2\.gif'/);
  assert.match(html, /dimsum:\{src:'img\/advanced\/level4_lateral_forward_slide_v2\.gif'/);
  assert.match(html, /function renderLevel4ScenarioDemo\(\)/);
  assert.match(html, /data-testid="figure-level4-scenario-demo"/);
  // Compact and inline: the demo lives in the setup flow, never over the canvas.
  assert.match(html, /\.level4-scenario-demo\{/);
  assert.doesNotMatch(html, /level4-scenario-demo\{[^}]*position:\s*fixed/);
  const shipped = ['level4_bowling_real_life.gif', 'level4_buspay_real_life.gif',
    'level4_mahjongwash_real_life.gif'];
  for(const file of shipped){
    assert.ok(fs.existsSync(path.join(root, 'img/advanced', file)), `${file} must ship with the app`);
    // The build guards each asset explicitly so a missing GIF fails the build.
    assert.ok(build.includes(file), `${file} must be guarded by scripts/build-dist.sh`);
  }
  for(const file of ['level4_bowling_illustrated.gif', 'level4_buspay_illustrated.gif',
    'level4_mahjongwash_illustrated.gif']){
    assert.ok(!fs.existsSync(path.join(root, 'img/advanced', file)),
      `${file} must be removed from the shipped assets`);
  }
  // img/ is copied wholesale into dist and precached from the dist listing.
  assert.match(build, /cp -R "\$ROOT\/img" "\$DIST\/img"/);
  assert.match(build, /offline-assets\.js/);
});
