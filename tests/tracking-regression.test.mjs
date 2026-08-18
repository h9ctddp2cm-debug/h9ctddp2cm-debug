import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicSource = readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorkerSource = readFileSync(path.join(root, "service-worker.js"), "utf8");
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
  assert.match(serviceWorkerSource, /fthue-rehab-v11-20260818-level4-wipe-card/);
});

test("Levels 3 and 4 can use Pose when tabletop hands occlude the finger model", () => {
  assert.match(publicSource, /source:'pose-bilateral-wrist'/);
  assert.match(publicSource, /source:'pose-wrist'/);
  assert.match(publicSource, /const res = isGrossTabletop\(\) \? readGrossPoseHand\(grossPose\) : readHand\(\)/);
  assert.match(publicSource, /activeAffectedSide\(\)\s*===\s*'left'\s*\?\s*15\s*:\s*16/);
});

test("Level 3 opens the shared activity library instead of the diagnostic redirect", () => {
  assert.match(publicSource, /'3':\s*\{\s*id:'3'/);
  assert.match(publicSource, /beginSessionMode\('3',\s*'training'\)/);
  assert.doesNotMatch(publicSource, /window\.location\.href\s*=\s*'sandbox\/level3-bilateral/);
  assert.match(publicSource, /const THEME_ORDER = \['wipewindow','flowers','dimsum','laundry','cards','mahjong','cooking'\]/);
  assert.match(publicSource, /if\(themeId === 'wipewindow'\) return level === '4'/);
});

test("Level 3 bilateral controller follows the selected affected side only", () => {
  assert.match(publicSource, /function updateLevel3LateralController\(lm,\s*cw,\s*ch\)/);
  assert.match(publicSource, /interactionX\(\(leftWrist\.x\+rightWrist\.x\)\/2\)/);
  assert.match(publicSource, /const outwardPixels = affectedSideSign\(\) \* \(midpoint\.x-level3Lateral\.baselineX\)/);
  assert.match(publicSource, /mapped\.x = cw \* 0\.50 \+ affectedSideSign\(\) \* level3Motion\.progress/);
  assert.ok(publicSource.includes("setLevel3Pose(spec)"));
  assert.ok(publicSource.includes("level3LateralState()"));
});

test("Level 4 calibrates elbow extension but lets the real wrist draw the wipe path", () => {
  assert.ok(publicSource.includes("const elbowConfirmed = activeExtension || maintainedExtension"));
  assert.ok(publicSource.includes("directionLearningEligible"));
  assert.ok(publicSource.includes("level4Reach.forwardAxis = reachVector.map"));
  assert.ok(publicSource.includes("let compoundProgress = level4Reach.engaged ? extensionProgress : 0"));
  assert.ok(publicSource.includes("The wipe cursor follows the real affected wrist"));
  assert.ok(publicSource.includes("updateLevel4Wipe(cursorX/cw, cursorY/ch, level4Motion)"));
  assert.ok(publicSource.includes("baseline.wristRelativeZ-sample.wristRelativeZ"));
  assert.ok(publicSource.includes("baseline.wristRelativeY-sample.wristRelativeY"));
  assert.ok(publicSource.includes("sample.wristReachRadius-baseline.wristReachRadius"));
});

test("Level 4 ignores elbow jitter and gates wiping after deliberate extension", () => {
  assert.ok(publicSource.includes("level4Reach.elbowAngleHistory.length > 5"));
  assert.ok(publicSource.includes("elbowGain >= 6"));
  assert.ok(publicSource.includes("level4Reach.movementConfirmFrames >= 3"));
  assert.ok(publicSource.includes("motion.elbowExtensionProgress >= 0.35"));
  assert.ok(publicSource.includes("setActionPrompt('慢慢伸直手肘', '再向外畫大弧')"));
});

test("Level 4 calibration accepts an already-extended bedside starting posture", () => {
  assert.ok(publicSource.includes("elbowAngle >= 25 && elbowAngle <= 178"));
  assert.ok(publicSource.includes("level4Reach.samples.length >= 10"));
  assert.ok(publicSource.includes("baseline.elbowAngle >= 138"));
  assert.ok(publicSource.includes("'maintained-extension'"));
});

test("Level 4 accepts a table-occluded arm and does not require the opposite shoulder", () => {
  assert.ok(publicSource.includes("point.visibility >= 0.05"));
  assert.match(
    publicSource,
    /\[arm\.shoulder, arm\.elbow, arm\.wrist\]\.every\(level4PosePointUsable\)/
  );
  assert.ok(publicSource.includes("const otherShoulderVisible = level4PosePointUsable"));
  assert.ok(publicSource.includes("upperArmLength * 1.35"));
});

test("Level 3 visual themes share the standard lateral pickup and drop engine", () => {
  assert.match(publicSource, /function usesAdvancedThemeModule\(id\)/);
  assert.match(publicSource, /return !isGrossTabletop\(\) && isAdvTheme\(id\)/);
  assert.match(publicSource, /if\(usesAdvancedThemeModule\(\)\)\{ advUpdate\(\); advRender\(\); \}/);
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

test("Level 4 shoulder hiking freezes transport and alerts the therapist", () => {
  assert.ok(publicSource.includes("const shoulderHike = Number.isFinite(baseline.shoulderBalance)"));
  assert.ok(publicSource.includes("(baseline.shoulderBalance-sample.shoulderBalance) > 0.035"));
  assert.ok(publicSource.includes("compoundProgress = level4Reach.progress"));
  assert.match(publicSource, /患側聳肩 · 請治療師即時糾正/);
  assert.ok(publicSource.includes("classList.toggle('level4-movement-alert'"));
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
  assert.ok(publicSource.includes('updateViaCache:"none"'));
  assert.match(serviceWorkerSource, /fthue-rehab-v11-20260818-level4-wipe-card/);
});

test("Level 4 exposes deterministic compound-movement QA hooks", () => {
  assert.ok(publicSource.includes("setLevel4Pose(spec)"));
  assert.ok(publicSource.includes("level4ReachState()"));
  assert.ok(publicSource.includes("resetLevel4Reach()"));
  assert.ok(publicSource.includes("wipeLevel4At(nx, ny, valid)"));
  assert.ok(publicSource.includes("setActionPrompt('iPad 同枱直放 · 約 1 米', '患側肩・手肘・手腕全部入鏡')"));
});

test("Level 4 wipe-window is an independent activity and preserves the other Level 4 games", () => {
  assert.ok(publicSource.includes("const level4Wipe = {"));
  assert.match(publicSource, /cols:18,\s*rows:12/);
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
  assert.match(publicSource, /if\(themeId === 'wipewindow'\) return level === '4'/);
  for (const id of ["flowers", "dimsum", "laundry", "cards", "mahjong"]) {
    assert.ok(publicSource.includes(`${id}: mkTheme({`), `${id} remains registered`);
  }
});

test("Level 4 fog advances only with elbow-gated real wrist movement", () => {
  assert.ok(publicSource.includes("motion.elbowExtensionProgress >= 0.35"));
  assert.ok(publicSource.includes("&& !motion.shoulderHike"));
  assert.ok(publicSource.includes("if(distance < 0.006 || distance > 0.18) return"));
  assert.ok(publicSource.includes("updateLevel4Wipe(cursorX/cw, cursorY/ch, level4Motion)"));
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
  assert.match(publicSource, /openMean\s*\+\s*gap\s*\*\s*0\.48/);
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
  assert.match(publicSource, /const required = state\.gameType === 'pinch'\s*\?\s*\[0,4,5,8,9,12,17\]/);
  assert.match(publicSource, /const indexGap = distance\(lm\[4\], lm\[8\]\)/);
  assert.match(publicSource, /const middleGap = distance\(lm\[4\], lm\[12\]\)/);
  assert.match(publicSource, /Math\.min\(indexGap, middleGap\) \* 0\.62/);
  assert.match(publicSource, /isOpenPrep:!pinch\.isPinching/);
  assert.match(publicSource, /const GESTURE_CONFIRM_MS = 60/);
  assert.match(publicSource, /isPegMode\(\).*personalGraspEnter/s);
  assert.match(publicSource, /source:'index-dwell'/);
  assert.match(publicSource, /method:isChopsticksMode\(\) \? 'chopsticks_index_dwell' : 'dwell'/);
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
