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

test("Levels 3 and 4 can use Pose when tabletop hands occlude the finger model", () => {
  assert.match(publicSource, /source:'pose-bilateral-wrist'/);
  assert.match(publicSource, /source:'pose-wrist'/);
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

test("Level 4 vertical transport requires shoulder flexion and elbow extension together", () => {
  assert.ok(publicSource.includes("let compoundProgress = (extensionProgress >= 0.10 && shoulderFlexProgress >= 0.10)"));
  assert.ok(publicSource.includes("Math.min(extensionProgress,shoulderFlexProgress)"));
  assert.ok(publicSource.includes("mapped.y = ch * 0.82 - level4Motion.progress * ch * 0.40"));
  assert.ok(publicSource.includes("baseline.wristRelativeZ-sample.wristRelativeZ"));
  assert.ok(publicSource.includes("baseline.wristRelativeY-sample.wristRelativeY"));
});

test("Level 4 shoulder hiking freezes transport and alerts the therapist", () => {
  assert.ok(publicSource.includes("const shoulderHike = (baseline.shoulderBalance-sample.shoulderBalance) > 0.035"));
  assert.ok(publicSource.includes("compoundProgress = level4Reach.progress"));
  assert.match(publicSource, /患側聳肩 · 請治療師即時糾正/);
  assert.ok(publicSource.includes("classList.toggle('level4-movement-alert'"));
});

test("Level 4 exposes deterministic compound-movement QA hooks", () => {
  assert.ok(publicSource.includes("setLevel4Pose(spec)"));
  assert.ok(publicSource.includes("level4ReachState()"));
  assert.ok(publicSource.includes("resetLevel4Reach()"));
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

test("Level 3 display and target coordinates share the same mirrored direction", () => {
  assert.match(level3Page, /id="cameraVideo"/);
  assert.match(level3App, /mirrorPoseForDisplay/);
  assert.match(level3App, /x:\s*1\s*-\s*point\.x/);
  assert.match(level3Engine, /bindEmpiricalDirection\(this\.affectedSide,\s*rawDisplacement\)/);
  assert.doesNotMatch(level3Page, /name="affectedSide"[^>]*checked/);
  assert.doesNotMatch(level3App, /TARGET \$\{/);
});
