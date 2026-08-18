import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicSource = readFileSync(path.join(root, "index.html"), "utf8");
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
  assert.match(publicSource, /const THEME_ORDER = \['flowers','dimsum','laundry','cards','mahjong','cooking'\]/);
});

test("Level 3 bilateral controller follows the selected affected side only", () => {
  assert.match(publicSource, /function updateLevel3LateralController\(lm,\s*cw,\s*ch\)/);
  assert.match(publicSource, /interactionX\(\(leftWrist\.x\+rightWrist\.x\)\/2\)/);
  assert.match(publicSource, /const outwardPixels = affectedSideSign\(\) \* \(midpoint\.x-level3Lateral\.baselineX\)/);
  assert.match(publicSource, /mapped\.x = cw \* 0\.50 \+ affectedSideSign\(\) \* level3Motion\.progress/);
  assert.ok(publicSource.includes("setLevel3Pose(spec)"));
  assert.ok(publicSource.includes("level3LateralState()"));
});

test("Level 4 records camera direction but uses elbow angle as the authoritative transport signal", () => {
  assert.ok(publicSource.includes("const elbowConfirmed = activeExtension || maintainedExtension"));
  assert.ok(publicSource.includes("directionLearningEligible"));
  assert.ok(publicSource.includes("level4Reach.forwardAxis = reachVector.map"));
  assert.ok(publicSource.includes("let compoundProgress = level4Reach.engaged ? extensionProgress : 0"));
  assert.ok(publicSource.includes("if(returnElbowFlexion) compoundProgress = extensionProgress"));
  assert.ok(publicSource.includes("The smoothed elbow angle is authoritative"));
  assert.ok(publicSource.includes("mapped.y = ch * 0.82 - level4Motion.progress * ch * 0.40"));
  assert.ok(publicSource.includes("baseline.wristRelativeZ-sample.wristRelativeZ"));
  assert.ok(publicSource.includes("baseline.wristRelativeY-sample.wristRelativeY"));
  assert.ok(publicSource.includes("sample.wristReachRadius-baseline.wristReachRadius"));
});

test("Level 4 ignores elbow jitter and only permits placement near full extension", () => {
  assert.ok(publicSource.includes("level4Reach.elbowAngleHistory.length > 5"));
  assert.ok(publicSource.includes("elbowGain >= 6"));
  assert.ok(publicSource.includes("level4Reach.movementConfirmFrames >= 3"));
  assert.ok(publicSource.includes("level4Reach.completionReady"));
  assert.ok(publicSource.includes("level4Reach.progress >= 0.94"));
  assert.match(publicSource, /繼續伸直手肘/);
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
  assert.match(publicSource, /return !isLevel3Tabletop\(\) && isAdvTheme\(id\)/);
  assert.match(publicSource, /if\(usesAdvancedThemeModule\(\)\)\{ advUpdate\(\); advRender\(\); \}/);
});

test("Level 4 shoulder hiking freezes transport and alerts the therapist", () => {
  assert.ok(publicSource.includes("const shoulderHike = Number.isFinite(baseline.shoulderBalance)"));
  assert.ok(publicSource.includes("(baseline.shoulderBalance-sample.shoulderBalance) > 0.035"));
  assert.ok(publicSource.includes("compoundProgress = level4Reach.progress"));
  assert.match(publicSource, /患側聳肩 · 請治療師即時糾正/);
  assert.ok(publicSource.includes("classList.toggle('level4-movement-alert'"));
});

test("animal distractors remain movable but cannot spawn over a target", () => {
  assert.ok(publicSource.includes("def.targetType === 'distractor' && targets.some"));
  assert.ok(publicSource.includes("動物阻路：搬到空白位"));
  assert.ok(publicSource.includes("動物已移開"));
  assert.ok(publicSource.includes("heldItem.baseX = heldItem.x"));
  assert.ok(publicSource.includes("heldItem.baseY = heldItem.y"));
});

test("Level 4 exposes deterministic compound-movement QA hooks", () => {
  assert.ok(publicSource.includes("setLevel4Pose(spec)"));
  assert.ok(publicSource.includes("level4ReachState()"));
  assert.ok(publicSource.includes("resetLevel4Reach()"));
  assert.ok(publicSource.includes("setActionPrompt('iPad 同枱直放 · 約 1 米', '患側肩・手肘・手腕全部入鏡')"));
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
