import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicSource = readFileSync(path.join(root, "index.html"), "utf8");
const level3Page = readFileSync(path.join(root, "sandbox/level3-bilateral/index.html"), "utf8");
const level3App = readFileSync(path.join(root, "sandbox/level3-bilateral/diagnosticApp.js"), "utf8");

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

test("Level 4 can fall back from an occluded hand to the affected-side Pose wrist", () => {
  assert.match(publicSource, /source:'pose-wrist'/);
  assert.match(publicSource, /activeAffectedSide\(\)\s*===\s*'left'\s*\?\s*15\s*:\s*16/);
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
  assert.match(level3App, /context\.translate\(width,\s*0\)/);
  assert.match(level3App, /x:\s*1\s*-\s*point\.x/);
  assert.match(level3Page, /option value="-1" selected/);
  assert.doesNotMatch(level3App, /TARGET \$\{/);
});
