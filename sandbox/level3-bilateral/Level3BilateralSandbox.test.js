import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL3_STATES, Level3BilateralSandbox } from "./Level3BilateralSandbox.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function point(x, y, z = 0, visibility = 0.99) {
  return { x, y, z, visibility };
}

function makePose({
  vcpX = 0.5,
  shoulderCenterX = 0.5,
  shoulderWidth = 0.3,
  wristSeparation = 0.04,
  wristY = 0.7,
  visibility = 0.99,
  anomaly = null,
} = {}) {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5));
  pose[11] = point(shoulderCenterX - shoulderWidth / 2, 0.35, 0, visibility);
  pose[12] = point(shoulderCenterX + shoulderWidth / 2, 0.35, 0, visibility);
  pose[15] = point(vcpX - wristSeparation / 2, wristY, 0, visibility);
  pose[16] = point(vcpX + wristSeparation / 2, wristY, 0, visibility);
  if (anomaly === "NAN") pose[15].x = Number.NaN;
  if (anomaly === "INFINITY") pose[16].z = Number.POSITIVE_INFINITY;
  if (anomaly === "EXTREME") pose[12].x = 999;
  return pose;
}

function updateWithPose(engine, pose, trackingLost, nowMs, worldPose = pose) {
  return engine.update(pose, worldPose, trackingLost, nowMs);
}

function advance(engine, options, clock, durationMs, stepMs = 50) {
  const end = clock.value + durationMs;
  let output = null;
  while (clock.value <= end) {
    const pose = makePose(options);
    output = updateWithPose(engine, pose, false, clock.value);
    clock.value += stepMs;
  }
  return output;
}

function calibratedEngine(config = {}) {
  const engine = new Level3BilateralSandbox({
    affectedSide: "LEFT",
    patientLeftXSign: 1,
    ...config,
  });
  const clock = { value: 0 };
  while (engine.currentState === LEVEL3_STATES.CALIBRATION && clock.value <= 5000) {
    const pose = makePose();
    updateWithPose(engine, pose, false, clock.value);
    clock.value += 50;
  }
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  return { engine, clock };
}

test("robust calibration derives a clamped MAD tolerance and shoulder-scaled target", () => {
  const engine = new Level3BilateralSandbox({
    affectedSide: "LEFT",
    reachRangeProfile: "STANDARD",
    toleranceMode: "STANDARD",
  });
  const clock = { value: 0 };
  for (let index = 0; index < 45; index += 1) {
    const vcpX = index === 8 ? 0.92 : 0.5 + ((index % 3) - 1) * 0.002;
    const pose = makePose({ vcpX, shoulderWidth: 0.3 });
    updateWithPose(engine, pose, false, clock.value);
    clock.value += 50;
  }

  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  assert.ok(Math.abs(engine.calibrationVcpXMedian - 0.5) < 0.005);
  assert.ok(Math.abs(engine.calibrationVcpYMedian - 0.7) < 0.005);
  assert.ok(Number.isFinite(engine.calibrationVcpMad));
  assert.ok(engine.dynamicVcpTolerance >= 0.025 && engine.dynamicVcpTolerance <= 0.08);
  assert.ok(Math.abs(engine.scaledTargetRangeX - 0.24) < 0.01);
});

test("midline requires a fresh continuous 0.8-second hold", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 700, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  advance(engine, {}, clock, 200, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);
});

test("a completed lateral cycle alternates direction and increments score", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);

  const targetX = engine.calibrationVcpXMedian
    + engine.directionSign() * (engine.scaledTargetRangeX + 0.01);
  advance(engine, { vcpX: targetX }, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.RETURN_CENTER);

  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  assert.equal(engine.targetDirection, "RIGHT");
  assert.equal(engine.score, 1);
});

test("wrist separation or unequal paired displacement pauses progression", () => {
  const { engine, clock } = calibratedEngine();
  const pose = makePose({ wristSeparation: 0.14 });
  const output = updateWithPose(engine, pose, false, clock.value);
  assert.equal(output.action, "BILATERAL_ASYMMETRY_WARNING");
  assert.equal(output.state, LEVEL3_STATES.MIDLINE_READY);
  assert.equal(engine.timerStartedAt, null);
});

test("shoulder translation is reported as a warning rather than a diagnosis", () => {
  const { engine, clock } = calibratedEngine();
  const pose = makePose({ shoulderCenterX: 0.62 });
  const output = updateWithPose(engine, pose, false, clock.value);
  assert.equal(output.action, "TRUNK_TRANSLATION_WARNING");
  assert.equal(output.state, LEVEL3_STATES.MIDLINE_READY);
});

test("tracking interruption clears debounce and requires 2.5 seconds plus fresh evidence", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 600, 100);
  const lost = engine.update(null, null, true, clock.value);
  assert.equal(lost.action, "TRACKING_LOST");
  assert.equal(engine.timerStartedAt, null);

  clock.value += 100;
  let pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).action, "STABILIZING");
  clock.value += 2400;
  pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).action, "STABILIZING");
  clock.value += 200;
  pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).state, LEVEL3_STATES.MIDLINE_READY);

  clock.value += 700;
  pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).state, LEVEL3_STATES.MIDLINE_READY);
  clock.value += 150;
  pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).state, LEVEL3_STATES.WIPING_LATERAL);
});

test("NaN, Infinity, extreme coordinates, and low visibility fail safely", () => {
  const cases = [
    makePose({ anomaly: "NAN" }),
    makePose({ anomaly: "INFINITY" }),
    makePose({ anomaly: "EXTREME" }),
    makePose({ visibility: 0.4 }),
  ];
  for (const pose of cases) {
    const engine = new Level3BilateralSandbox({ affectedSide: "LEFT" });
    const output = updateWithPose(engine, pose, false, 0);
    assert.equal(output.action, "UNKNOWN");
    assert.equal(output.state, LEVEL3_STATES.CALIBRATION);
  }
});

test("reach profiles are ordered and empirical direction mapping overrides x sign", () => {
  const short = calibratedEngine({ reachRangeProfile: "SHORT" }).engine.scaledTargetRangeX;
  const standardEngine = calibratedEngine({ reachRangeProfile: "STANDARD" }).engine;
  const standard = standardEngine.scaledTargetRangeX;
  const long = calibratedEngine({ reachRangeProfile: "LONG" }).engine.scaledTargetRangeX;
  assert.ok(short < standard && standard < long);

  assert.equal(standardEngine.bindEmpiricalDirection("LEFT", -0.12), true);
  assert.equal(standardEngine.directionSign("LEFT"), -1);
  assert.equal(standardEngine.directionSign("RIGHT"), 1);
});

test("heavy center tremor cannot falsely trigger the lateral target", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);

  for (let frame = 0; frame < 120; frame += 1) {
    const oscillation = frame % 2 === 0 ? 0.045 : -0.045;
    const pose = makePose({ vcpX: engine.calibrationVcpXMedian + oscillation });
    const output = updateWithPose(engine, pose, false, clock.value);
    clock.value += 40;
    assert.notEqual(output.action, "TARGET_REACHED");
  }
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);
});

test("Pose-world wrist release hides the object and returns without awarding score", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);

  const imagePose = makePose();
  const releasedWorldPose = makePose({ wristSeparation: 0.12 });
  const released = updateWithPose(engine, imagePose, false, clock.value, releasedWorldPose);
  assert.equal(released.action, "OBJECT_FADE_OUT");
  assert.equal(released.state, LEVEL3_STATES.RETURN_CENTER);
  assert.equal(released.objectVisible, false);

  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  assert.equal(engine.score, 0);
});


/* ==================================================================
   P0 clinical safety review: patient-facing copy and defaults.
   The Level 3 task is bilateral supported horizontal sliding; the
   affected hand rests lightly with support and the fingers do not
   need to interlock or grip.
   ================================================================== */

const SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const engineSource = readFileSync(path.join(SOURCE_DIR, "Level3BilateralSandbox.js"), "utf8");
const pageSource = readFileSync(path.join(SOURCE_DIR, "index.html"), "utf8");
const appSource = readFileSync(path.join(SOURCE_DIR, "diagnosticApp.js"), "utf8");
const dashboardSource = readFileSync(path.join(SOURCE_DIR, "TherapistDashboard.js"), "utf8");

test("engine messages drop instructions to close or interlock the hands", () => {
  for (const banned of ["雙手合攏", "互扣合攏", "重新互扣", "保持合攏"]) {
    assert.equal(engineSource.includes(banned), false, `engine still contains ${banned}`);
  }
  // The only permitted use of 互扣 is the explicit reassurance that it is not required.
  const interlockMatches = engineSource.match(/互扣/g) || [];
  assert.equal(interlockMatches.length, (engineSource.match(/不需互扣/g) || []).length);
});

test("initial engine guidance describes a lightly supported affected hand", () => {
  const engine = new Level3BilateralSandbox({ affectedSide: "RIGHT" });
  const message = engine.output().message;
  assert.match(message, /承托/);
  assert.match(message, /不需互扣/);
});

test("Level 3 page shows a prominent red stop warning before use", () => {
  assert.match(pageSource, /data-testid="panel-level3-red-warning"/);
  for (const cue of ["肩膊被拉扯", "愈來愈繃緊", "軀幹向側傾斜", "疼痛"]) {
    assert.ok(pageSource.includes(cue), `missing red-warning cue: ${cue}`);
  }
  assert.ok(pageSource.includes("影子測試"), "supervised shadow-testing warning must be kept");
});

test("Level 3 page gates camera and session behind an explicit acknowledgement", () => {
  assert.match(pageSource, /data-testid="panel-level3-safety-gate"/);
  assert.match(pageSource, /data-testid="checkbox-l3-safety-ack"/);
  assert.match(pageSource, /id="safetyGateContinue"[\s\S]*?disabled/);
  for (const item of ["safety-stable", "safety-support", "safety-baseline",
    "safety-practice", "safety-rest", "safety-quality"]) {
    assert.ok(pageSource.includes(`data-testid="text-l3-${item}"`), `missing gate item: ${item}`);
  }
  assert.match(appSource, /function requireSafetyAck/);
  assert.match(appSource, /requireSafetyAck\("啟動相機"\)/);
  assert.match(appSource, /requireSafetyAck\("開始 Session"\)/);
});

test("camera failures surface an in-page error with retry and return", () => {
  assert.match(pageSource, /data-testid="panel-l3-camera-error"/);
  assert.match(pageSource, /data-testid="button-l3-camera-retry"/);
  assert.match(pageSource, /data-testid="button-l3-camera-return"/);
  for (const errorName of ["UnsupportedError", "NotAllowedError", "NotFoundError", "NotReadableError"]) {
    assert.ok(appSource.includes(errorName), `unhandled camera error class: ${errorName}`);
  }
  assert.match(appSource, /elements\.cameraRetry\.addEventListener/);
  assert.match(appSource, /elements\.cameraReturn\.addEventListener/);
});

test("target elevation control is renamed to a neutral protocol label with legacy metadata", () => {
  assert.equal(pageSource.includes('id="targetElevation"'), false);
  assert.match(pageSource, /id="protocolVariant"/);
  assert.equal(pageSource.includes('data-testid="select-target-elevation"'), false);
  // The phrase may only survive inside the explanatory note about the rename.
  assert.equal((pageSource.match(/目標抬高角度/g) || []).length,
    (pageSource.match(/取代舊「目標抬高角度」/g) || []).length);
  assert.match(dashboardSource, /PROTOCOL_VARIANT_LEGACY_DEG/);
  assert.match(dashboardSource, /targetElevationDeg:/);
});

test("short reach profile is the therapist-selected default", () => {
  const reachSelect = pageSource.match(
    /<select id="reachProfile"[\s\S]*?<\/select>/,
  );
  assert.ok(reachSelect, "reach profile select not found");
  assert.match(reachSelect[0], /<option value="SHORT"[^>]*selected/);
  assert.equal(/<option value="(STANDARD|LONG)"[^>]*selected/.test(reachSelect[0]), false);
});
