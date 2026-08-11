import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL3_STATES, Level3BilateralSandbox } from "./Level3BilateralSandbox.js";

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
