import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicSource = readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorkerSource = readFileSync(path.join(root, "service-worker.js"), "utf8");
const calibrationSource = readFileSync(path.join(root, "level4-elbow-calibration.js"), "utf8");
const level3Page = readFileSync(path.join(root, "sandbox/level3-bilateral/index.html"), "utf8");
const level3App = readFileSync(path.join(root, "sandbox/level3-bilateral/diagnosticApp.js"), "utf8");
const level3Engine = readFileSync(path.join(root, "sandbox/level3-bilateral/Level3BilateralSandbox.js"), "utf8");

test("public calibration mirrors the video once and leaves mapped overlay coordinates unflipped", () => {
  assert.match(publicSource, /\.calib-wrap video\{\s*transform:scaleX\(-1\)/);
  assert.match(publicSource, /\.calib-wrap canvas\{[^}]*transform:none/);
  assert.match(publicSource, /function interactionX\(rawX\)/);
  assert.match(publicSource, /id="btnMirrorX"/);
});

test("iPad tracking uses CPU-compatible MediaPipe creation with a CPU retry", () => {
  assert.match(publicSource, /delegate:\s*isAppleTouchDevice\(\)\s*\?\s*"CPU"\s*:\s*"GPU"/);
  assert.match(publicSource, /baseOptions:\{\.\.\.options\.baseOptions,\s*delegate:"CPU"\}/);
});

test("camera capture follows portrait or landscape orientation instead of forcing a cropped landscape frame", () => {
  assert.match(publicSource, /const portraitCamera = window\.innerHeight > window\.innerWidth/);
  assert.match(publicSource, /width:\{ideal:720\},\s*height:\{ideal:1280\}/);
  assert.match(publicSource, /aspectRatio:\{ideal:9\/16\}/);
  assert.match(publicSource, /video: cameraVideoConstraints/);
});

test("portrait phones keep the camera inline in a compact preview instead of fullscreen", () => {
  assert.match(publicSource, /<video id="gameVideo" playsinline webkit-playsinline autoplay muted>/);
  assert.match(publicSource, /@media \(max-width:600px\) and \(orientation:portrait\)/);
  assert.match(publicSource, /\.game-stage video#gameVideo\{/);
  assert.match(publicSource, /width:min\(40vw,168px\)/);
  assert.match(publicSource, /height:min\(25dvh,210px\)/);
  assert.ok(publicSource.includes("videoEl.setAttribute('webkit-playsinline', '')"));
  assert.ok(publicSource.includes("videoEl.controls = false"));
  assert.match(serviceWorkerSource, /fthue-rehab-v49-20260826-offline-release/);
});

test("Levels 3 and 4 can use Pose when tabletop hands occlude the finger model", () => {
  assert.match(publicSource, /source:'pose-bilateral-wrist'/);
  assert.match(publicSource, /source:'pose-wrist'/);
  assert.match(publicSource, /const res = isGrossTabletop\(\) \? readGrossPoseHand\(grossPose\) : readHand\(\)/);
  assert.match(publicSource, /activeAffectedSide\(\)\s*===\s*'left'\s*\?\s*15\s*:\s*16/);
});

test("Levels 2–4 open the shared activity library with supported games confined to Level 2", () => {
  assert.match(publicSource, /'2':\s*\{\s*id:'2'/);
  assert.match(publicSource, /'3':\s*\{\s*id:'3'/);
  assert.match(publicSource, /beginSessionMode\('3',\s*'training'\)/);
  assert.doesNotMatch(publicSource, /window\.location\.href\s*=\s*'sandbox\/level3-bilateral/);
  assert.match(publicSource, /const THEME_ORDER = \['wipewindow','bowling','mahjongwash','buspay','flowers','dimsum','laundry','cards','mahjong','cooking'\]/);
  assert.match(publicSource, /if\(\['wipewindow','bowling','mahjongwash','buspay'\]\.includes\(themeId\)\) return level === '2'/);
});

test("Level 2 bilateral controller follows only the selected anatomical affected wrist", () => {
  assert.match(publicSource, /function updateLevel3LateralController\(lm,\s*cw,\s*ch\)/);
  assert.match(publicSource, /const wrist=lm\?\.\[activeAffectedSide\(\)==='left'\?15:16\]/);
  assert.match(publicSource, /interactionX\(wrist\.x\)/);
  assert.match(publicSource, /const outwardPixels = affectedSideSign\(\) \* \(midpoint\.x-level3Lateral\.baselineX\)/);
  assert.match(publicSource, /mapped\.x = cw \* 0\.50 \+ affectedSideSign\(\) \* level3Motion\.progress/);
  assert.ok(publicSource.includes("setLevel3Pose(spec)"));
  assert.ok(publicSource.includes("level3LateralState()"));
});

test("Level 4 uses one observable two-point elbow signal with an independent shoulder-abduction path axis", () => {
  assert.ok(publicSource.includes('<script src="level4-elbow-calibration.js"></script>'));
  assert.ok(publicSource.includes("const level4Controller = level4Calibration ? level4Calibration.createController() : null"));
  assert.ok(publicSource.includes("level4Controller.update(level4Packet);"));
  assert.ok(publicSource.includes("const level4PathPoint = level4PathControlPoint(cw, ch, level4OrderedHorizontalProgress());"));
  assert.ok(publicSource.includes("updateLevel4Wipe(level4PathPoint.x/cw, level4PathPoint.y/ch, level4Motion)"));
  assert.match(calibrationSource, /const SIGNAL_KEYS = \['angle'\]/);
  assert.match(calibrationSource, /signed-angle-capture-order/);
  assert.ok(!calibrationSource.includes('worldSpanRatio'));
});

test("Level 4 uses captured order, fixed smoothing and endpoint hysteresis rather than fusion", () => {
  assert.match(calibrationSource, /minAngleSeparationDeg: 5/);
  assert.match(calibrationSource, /medianWindow: 3/);
  assert.match(calibrationSource, /smoothAlpha: 0\.45/);
  assert.match(calibrationSource, /endpointHysteresis: 0\.035/);
  assert.match(calibrationSource, /\(state\.filteredAngle - start\) \/ \(end - start\)/);
  assert.doesNotMatch(calibrationSource,
    /function evaluateEndpoints|function buildSignLock|rangeExpansion|conflictSuppression|hiddenRelearning/);
});

test("Level 4 refuses only insufficient absolute angle separation with clear guidance", () => {
  assert.ok(calibrationSource.includes('angle-separation-too-small'));
  assert.ok(calibrationSource.includes('too-similar'));
  assert.ok(calibrationSource.includes('RETRY_TEXT'));
  assert.match(calibrationSource, /至少相差 5°/);
  assert.ok(publicSource.includes("const guide = level4Reach.guidance();"));
});

test("Level 4 offers a compact two-button therapist fallback", () => {
  assert.ok(publicSource.includes('id="btnLevel4MarkFlexed"'));
  assert.ok(publicSource.includes('id="btnLevel4MarkExtended"'));
  assert.ok(publicSource.includes("level4ManualCapture('flexed')"));
  assert.ok(publicSource.includes("level4ManualCapture('extended')"));
  assert.ok(calibrationSource.includes("function markFlexed"));
  assert.ok(calibrationSource.includes("function markExtended"));
  assert.ok(publicSource.includes("min-height:56px"));
});

test("Level 4 debug mode exposes bedside calibration and movement diagnostics without changing tracking", () => {
  assert.ok(publicSource.includes('get("debug") === "1"'));
  assert.ok(publicSource.includes('window.render_game_to_text === "function"'));
  assert.ok(publicSource.includes('panel.id = "level4DebugPanel"'));
  assert.ok(publicSource.includes('toast.id = "level4CalibToast"'));
  assert.ok(publicSource.includes("const timeoutMs = 8000"));
  assert.ok(publicSource.includes("level4Reach=' + level4Reach.diagnosticsText()"));
  assert.ok(publicSource.includes("level4ReachGuide='"));
  assert.ok(publicSource.includes('between(reach, "captured:", " lateral:")'));
  assert.ok(publicSource.includes('between(reach, "rawAngle:", " progress:")'));
  assert.ok(publicSource.includes('field(reach, "stage")'));
  assert.ok(publicSource.includes("window.__level4Diagnostics = { update, panel, toast }"));
});

test("Level 4 accepts a table-occluded arm without requiring the opposite shoulder", () => {
  assert.ok(publicSource.includes("point.visibility >= 0.05"));
  assert.match(publicSource, /\[arm\.shoulder, arm\.elbow, arm\.wrist\]\.every\(level4PosePointUsable\)/);
  assert.match(calibrationSource, /return \[arm\.shoulder, arm\.elbow, arm\.wrist\]\.every\(pointUsable\)/);
});

test("Levels 3 and 4 use shoulder-flexion-only play without virtual pickup or release", () => {
  assert.match(publicSource, /function usesAdvancedThemeModule\(id\)/);
  assert.match(publicSource, /return !isGrossTabletop\(\) && isAdvTheme\(id\)/);
  assert.match(publicSource, /if\(usesAdvancedThemeModule\(\)\)\{ advUpdate\(\); advRender\(\); \}/);
  assert.match(publicSource, /function updateShoulderFlexionGame\(\)/);
  assert.match(publicSource, /updateShoulderFlexionGame\(\);\s*return;/);
  assert.match(publicSource, /No hand contact, pickup dwell, grip, plate overlap, or release/);
  assert.match(publicSource, /graspDetection:false releaseDetection:false/);
});

test("Level 3 changes dim sum, mahjong and playing-card artwork after each completed round", () => {
  assert.ok(publicSource.includes("const LEVEL3_THEME_VARIANTS ="));
  assert.match(publicSource, /dimsum:\[/);
  assert.match(publicSource, /type:'siumai'/);
  assert.match(publicSource, /type:'hargau'/);
  assert.match(publicSource, /type:'charsiu'/);
  assert.match(publicSource, /type:'lotusrice'/);
  assert.match(publicSource, /mahjong:\[1,2,3,4,5,6\]/);
  assert.match(publicSource, /\['heart','紅心'/);
  assert.match(publicSource, /\['diamond','階磚'/);
  assert.match(publicSource, /\['club','梅花'/);
  assert.match(publicSource, /\['spade','黑桃'/);
  assert.ok(publicSource.includes("variant.type !== level3PreviousVariantType"));
  assert.ok(publicSource.includes("advanceLevel3RoundVariant();"));
  assert.ok(publicSource.includes("setupTargets();"));
});

test("Level 4 omits shoulder flexion/elevation and admits horizontal observation only for path games", () => {
  assert.doesNotMatch(calibrationSource, /hikeTolerance|shoulderHike|shoulderFlexion|shoulderElevation/);
  assert.ok(publicSource.includes('enableHorizontalAbduction:isLevel4HorizontalPathGame()'));
  assert.ok(publicSource.includes('function isLevel4HorizontalPathGame()'));
  assert.ok(publicSource.includes('horizontalReading.hidden = !horizontalEnabled'));
});

test("all items stay clear of targets and can be parked in blank space", () => {
  assert.match(publicSource, /if\(targets\.some\(target =>\s*circleOverlapsRect/);
  assert.ok(publicSource.includes("clearsProtectedZones(x, y)"));
  assert.match(publicSource, /scale:0\.66/);
  assert.match(publicSource, /scale:0\.76/);
  assert.ok(publicSource.includes("[[0.22,0.34],[0.50,0.45],[0.78,0.34]]"));
  assert.ok(publicSource.includes("動物阻路：搬到空白位"));
  assert.ok(publicSource.includes("動物已移開"));
  assert.ok(publicSource.includes("點心已移到空白位"));
  assert.ok(publicSource.includes("function parkHeldItemInBlankSpace(item)"));
  assert.ok(publicSource.includes("function nearestSafeParkingPosition(food, desiredX, desiredY)"));
  assert.ok(publicSource.includes("researchLog('drop_parked'"));
  assert.ok(!publicSource.includes("heldItem.x = heldItem.baseX"));
  assert.ok(!publicSource.includes("heldItem.y = heldItem.baseY"));
});

test("offline worker forces the current build instead of serving the stale game", () => {
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(publicSource.includes('updateViaCache:"none"'));
  assert.match(serviceWorkerSource, /fthue-rehab-v49-20260826-offline-release/);
  assert.ok(publicSource.includes('const LEVEL_APP_BUILD = "v49-20260826-offline-release"'));
  assert.equal(manifest.start_url, "./index.html?build=v49-20260826-offline-release");
  assert.ok(publicSource.includes('const levelAppHadController = Boolean(navigator.serviceWorker.controller)'));
  assert.ok(publicSource.includes('if (!levelAppHadController || levelAppReloading) return'));
  assert.ok(publicSource.includes('navigator.serviceWorker.addEventListener("controllerchange"'));
  assert.ok(publicSource.includes('document.addEventListener("visibilitychange"'));
  assert.ok(publicSource.includes('window.addEventListener("pageshow", requestUpdate)'));
});

test("Level 4 exposes deterministic compound-movement QA hooks", () => {
  assert.ok(publicSource.includes("setLevel4Pose(spec)"));
  assert.ok(publicSource.includes("level4ReachState()"));
  assert.ok(publicSource.includes("level4ManualCapture(which)"));
  assert.ok(publicSource.includes("resetLevel4Reach()"));
  assert.ok(publicSource.includes("wipeLevel4At(nx, ny, valid)"));
  assert.ok(publicSource.includes("setActionPrompt('iPad 同枱直放 · 約 1 米', '患側肩・手肘・手腕全部入鏡')"));
});

test("Level 2 wipe-window is an independent supported activity and preserves the other supported games", () => {
  assert.ok(publicSource.includes("const level4Wipe = {"));
  assert.match(publicSource, /cols:16,\s*rows:10/);
  assert.match(publicSource, /const LEVEL4_WIPE_BOUNDS = \{left:0\.07, top:0\.18, right:0\.93, bottom:0\.90\}/);
  assert.match(publicSource, /const radius = 1\.80/);
  assert.match(publicSource, /cleanPercent >= 88/);
  assert.doesNotMatch(
    publicSource.slice(
      publicSource.indexOf("const level4Wipe = {"),
      publicSource.indexOf("function updateLevel4ReachController")
    ),
    /getImageData/
  );
  assert.ok(publicSource.includes("return !isGrossTabletop() && isAdvTheme(id)"));
  assert.match(publicSource, /function isLevel4WipeGame\(\)\{\s*return isLevel4Tabletop\(\) && state\.theme === 'wipewindow'/);
  assert.match(publicSource, /if\(isLevel4WipeGame\(\)\)\{\s*renderLevel4WipeGame/);
  assert.match(publicSource, /if\(\['wipewindow','bowling','mahjongwash','buspay'\]\.includes\(themeId\)\) return level === '2'/);
  for (const id of ["flowers", "dimsum", "laundry", "cards", "mahjong"]) {
    assert.ok(publicSource.includes(`${id}: mkTheme({`), `${id} remains registered`);
  }
});

test("Level 4 fog advances only after fresh calibrated extension and horizontal-abduction sweep", () => {
  assert.ok(publicSource.includes("function level4PathGateOpen(motion)"));
  assert.ok(publicSource.includes("const valid = !!(level4Wipe.phase === 'sweep' && motion?.engaged && level4PathGateOpen(motion))"));
  assert.ok(publicSource.includes("if(!motion?.calibrated || motion.gameReady !== true) return false"));
  assert.ok(publicSource.includes("if(dx <= 0 || distance < 0.006 || distance > 0.18){"));
  assert.ok(publicSource.includes("const level4PathPoint = level4PathControlPoint(cw, ch, level4OrderedHorizontalProgress());"));
  assert.ok(publicSource.includes("updateLevel4Wipe(level4PathPoint.x/cw, level4PathPoint.y/ch, level4Motion)"));
  assert.ok(!publicSource.includes("mapped.y = ch * 0.82 - level4Motion.progress"));
});

test("Level 5 grasp requires two curled fingers and releases after two visibly reopen", () => {
  assert.match(publicSource, /curledCount\s*>=\s*2/);
  assert.match(publicSource, /openCount\s*<\s*2/);
});

test("Level 5 calibration accepts the participant's available opening range without long holds", () => {
  assert.match(publicSource, /now\s*-\s*c\.openStart\s*>=\s*750/);
  assert.match(publicSource, /openMean\s*\+\s*0\.035/);
  assert.match(publicSource, /now\s*-\s*c\.closedStart\s*>=\s*550/);
  assert.match(publicSource, /openMean\s*\+\s*gap\s*\*\s*\(isPegMode\(\)\s*\?\s*0\.24\s*:\s*0\.48\)/);
  assert.match(
    publicSource,
    /const PREP_OPEN_MS\s*=\s*220,\s*GRASP_HOLD_MS\s*=\s*360,\s*DROP_DWELL_MS\s*=\s*650/
  );
});

test("Level 6–7 calibration accepts a light pinch without inventing a larger aperture range", () => {
  assert.match(publicSource, /openMean\s*-\s*Math\.max\(0\.020,\s*openMean\s*\*\s*0\.035\)/);
  assert.match(publicSource, /const gap = Math\.max\(0\.025, openMean - closedMean\)/);
  assert.match(publicSource, /personalPinchEnter = closedMean \+ gap \* 0\.72/);
  assert.match(publicSource, /personalPinchExit = closedMean \+ gap \* 0\.84/);
  assert.ok(publicSource.includes("personalPinchOpen = Math.min("));
  assert.doesNotMatch(publicSource, /Math\.max\(0\.12, openMean - closedMean\)/);
});

test("Level 6–7 exposes three independent interaction modes", () => {
  assert.match(publicSource, /id="level67ToolCard"/);
  assert.match(publicSource, /data-tool-mode="bare">空手（三指）/);
  assert.match(publicSource, /data-tool-mode="peg">夾仔/);
  assert.match(publicSource, /data-tool-mode="chopsticks">筷子/);
  assert.match(publicSource, /bare:\{\s*gameType:'pinch'/);
  assert.match(publicSource, /peg:\{\s*gameType:'grasp'/);
  assert.match(publicSource, /chopsticks:\{\s*gameType:'dwell'/);
});

test("bare, peg and chopsticks modes use different observable tracking signals", () => {
  assert.match(publicSource, /const required = isPegMode\(\)\s*\?\s*\[0,2,4,5,8,9,12,17\]/);
  assert.match(publicSource, /const indexGap = distance\(lm\[4\], lm\[8\]\)/);
  assert.match(publicSource, /const middleGap = distance\(lm\[4\], lm\[12\]\)/);
  assert.match(publicSource, /Math\.min\(indexGap, middleGap\) \* 0\.62/);
  assert.match(publicSource, /const pinchHeld = stabiliseDetectedGesture\(pinch\.isPinching, 'pinch'\)/);
  assert.match(publicSource, /isOpenPrep:!pinchHeld/);
  assert.match(publicSource, /const GESTURE_CONFIRM_MS = 60/);
  assert.match(publicSource, /function computePegPressState\(lm, isPressingPrev\)/);
  assert.match(publicSource, /source:'peg-aperture'/);
  assert.match(publicSource, /isPegMode\(\) \? 0\.006 : 0\.04/);
  assert.match(publicSource, /source:'index-dwell'/);
  assert.match(publicSource, /method:isChopsticksMode\(\) \? 'chopsticks_index_dwell' : 'dwell'/);
});

test("peg mode accepts a small calibrated light press and uses hysteresis for release", () => {
  assert.match(publicSource, /function computePegPressState\(lm, isPressingPrev\)/);
  assert.match(publicSource, /const aperture = nearGap \* 0\.68 \+ meanGap \* 0\.32/);
  assert.match(publicSource, /const enter = personal \? thresholds\.personalGraspEnter : 0\.56/);
  assert.match(publicSource, /const exit = personal \? thresholds\.personalGraspExit : 0\.51/);
  assert.match(publicSource, /score >= \(isPressingPrev \? exit : enter\)/);
  assert.match(publicSource, /value >= openMean \+ Math\.max\(0\.006, openMean \* 0\.015\)/);
  assert.match(publicSource, /isPegMode\(\) \? 0\.24 : 0\.48/);
});

test("research and QA flows preserve the selected Level 6–7 tool mode", () => {
  assert.match(publicSource, /research\.toolUsed === 'cloth_peg'\s*\?\s*'peg'/);
  assert.match(publicSource, /research\.toolUsed === 'chopsticks' \? 'chopsticks' : 'bare'/);
  assert.match(publicSource, /selectToolMode\(mode\)/);
  assert.match(publicSource, /toolModeState\(\)/);
  assert.match(publicSource, /toolMode=' \+ state\.toolMode/);
});

test("Level 3 display and target coordinates share the same mirrored direction", () => {
  assert.match(level3Page, /id="cameraVideo"/);
  assert.match(level3App, /mirrorPoseForDisplay/);
  assert.match(level3App, /x:\s*1\s*-\s*point\.x/);
  assert.match(level3Engine, /bindEmpiricalDirection\(this\.affectedSide,\s*rawDisplacement\)/);
  assert.doesNotMatch(level3Page, /name="affectedSide"[^>]*checked/);
  assert.doesNotMatch(level3App, /TARGET \$\{/);
});
