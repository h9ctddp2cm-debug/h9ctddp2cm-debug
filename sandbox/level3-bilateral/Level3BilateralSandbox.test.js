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
  affectedElbowAngle = 180,
  affectedWristInwardShift = 0,
  visibility = 0.99,
  anomaly = null,
} = {}) {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5));
  pose[11] = point(shoulderCenterX - shoulderWidth / 2, 0.35, 0, visibility);
  pose[12] = point(shoulderCenterX + shoulderWidth / 2, 0.35, 0, visibility);
  pose[15] = point(vcpX - wristSeparation / 2, wristY, 0, visibility);
  pose[16] = point(vcpX + wristSeparation / 2, wristY, 0, visibility);
  const setElbow = (shoulderIndex, elbowIndex, wristIndex, angleDeg, inwardShift = 0) => {
    const shoulder = pose[shoulderIndex];
    const wrist = pose[wristIndex];
    const midX = (shoulder.x + wrist.x) / 2 + inwardShift;
    const midY = (shoulder.y + wrist.y) / 2;
    if (angleDeg >= 175) {
      pose[elbowIndex] = point(midX, midY, 0, visibility);
      return;
    }
    const bend = Math.max(0.025, (175 - angleDeg) / 350);
    pose[elbowIndex] = point(midX + bend, midY - bend, 0, visibility);
  };
  setElbow(11, 13, 15, affectedElbowAngle, affectedWristInwardShift);
  setElbow(12, 14, 16, 180, 0);
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
  assert.equal(engine.currentState, LEVEL3_STATES.DIRECTION_CHECK);
  const directionPose = makePose({ vcpX: 0.54 });
  const directionOutput = updateWithPose(engine, directionPose, false, clock.value);
  clock.value += 50;
  assert.equal(directionOutput.action, "DIRECTION_AUTO_BOUND");
  assert.equal(engine.directionBoundThisSession, true);
  engine.abortCurrentRepetition();
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

  assert.equal(engine.currentState, LEVEL3_STATES.DIRECTION_CHECK);
  assert.ok(Math.abs(engine.calibrationVcpXMedian - 0.5) < 0.005);
  assert.ok(Math.abs(engine.calibrationVcpYMedian - 0.7) < 0.005);
  assert.ok(Number.isFinite(engine.calibrationVcpMad));
  assert.ok(engine.dynamicVcpTolerance >= 0.025 && engine.dynamicVcpTolerance <= 0.08);
  assert.ok(Math.abs(engine.scaledTargetRangeX - 0.24) < 0.01);
});

test("screen-space wrists remain usable when Pose World Landmarks are unavailable", () => {
  const engine = new Level3BilateralSandbox({ affectedSide: "LEFT" });
  const pose = makePose();
  const output = engine.update(pose, null, false, 0);
  assert.equal(output.action, "CALIBRATING");
  assert.equal(output.trackingStable, true);
  assert.equal(output.metrics.wristSeparationUnit, "shoulder_width_ratio");
  assert.ok(Number.isFinite(output.metrics.wristSeparation));
});

test("midline requires a fresh continuous 0.8-second hold", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 700, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  advance(engine, {}, clock, 200, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);
});

test("a completed lateral cycle repeats the affected-side direction and increments score", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);

  const targetX = engine.calibrationVcpXMedian
    + engine.directionSign() * (engine.scaledTargetRangeX + 0.01);
  advance(engine, { vcpX: targetX }, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.RETURN_CENTER);

  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.MIDLINE_READY);
  assert.equal(engine.targetDirection, "LEFT");
  assert.equal(engine.score, 1);
});

test("wrist separation remains telemetry and never blocks Level 3 gameplay", () => {
  const { engine, clock } = calibratedEngine();
  const pose = makePose({ wristSeparation: 0.14 });
  const output = updateWithPose(engine, pose, false, clock.value);
  assert.notEqual(output.action, "BILATERAL_ASYMMETRY_WARNING");
  assert.equal(output.state, LEVEL3_STATES.MIDLINE_READY);
  assert.equal(output.metrics.handAction, "NOT_APPLICABLE");
  assert.equal(typeof output.metrics.bilateralAsymmetryFlag, "boolean");
});

test("shoulder translation is reported as a warning rather than a diagnosis", () => {
  const { engine, clock } = calibratedEngine();
  const pose = makePose({ shoulderCenterX: 0.62 });
  const output = updateWithPose(engine, pose, false, clock.value);
  assert.equal(output.action, "TRUNK_TRANSLATION_WARNING");
  assert.equal(output.state, LEVEL3_STATES.MIDLINE_READY);
});

test("sustained elbow flexion pauses progression and asks for therapist review", () => {
  const { engine, clock } = calibratedEngine();
  let output = null;
  for (let index = 0; index < 10; index += 1) {
    output = updateWithPose(
      engine,
      makePose({ affectedElbowAngle: 95 }),
      false,
      clock.value,
    );
    clock.value += 50;
  }
  assert.equal(output.action, "ELBOW_FLEXION_WARNING");
  assert.match(output.message, /治療師請即時檢查/);
});

test("sustained inward wrist drift asks the therapist to check lateral-path and trunk compensation", () => {
  const { engine, clock } = calibratedEngine();
  let output = null;
  for (let i = 0; i < 12; i += 1) {
    output = updateWithPose(
      engine,
      makePose({
        vcpX: 0.46,
        affectedWristInwardShift: 0.04,
      }),
      false,
      clock.value,
    );
    clock.value += 50;
  }
  assert.equal(output.action, "MEDIAL_ARM_PATTERN_WARNING");
  assert.match(output.message, /偏離外滑路徑或出現軀幹代償/);
});

test("missing elbow landmarks do not break the existing tabletop tracking path", () => {
  const { engine, clock } = calibratedEngine();
  const pose = makePose();
  pose[13].visibility = 0.1;
  pose[14].visibility = 0.1;
  const output = updateWithPose(engine, pose, false, clock.value);
  assert.notEqual(output.action, "UNKNOWN");
  assert.equal(output.trackingStable, true);
});

test("tracking interruption clears debounce and requires 0.9 seconds plus fresh evidence", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 600, 100);
  const lost = engine.update(null, null, true, clock.value);
  assert.equal(lost.action, "TRACKING_LOST");
  assert.equal(engine.timerStartedAt, null);

  clock.value += 100;
  let pose = makePose();
  assert.equal(updateWithPose(engine, pose, false, clock.value).action, "STABILIZING");
  clock.value += 700;
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
    makePose({ visibility: 0.1 }),
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

test("first affected-side slide auto-binds a mirrored camera direction", () => {
  const engine = new Level3BilateralSandbox({
    affectedSide: "LEFT",
    patientLeftXSign: -1,
  });
  const clock = { value: 0 };
  while (engine.currentState === LEVEL3_STATES.CALIBRATION && clock.value <= 5000) {
    updateWithPose(engine, makePose(), false, clock.value);
    clock.value += 50;
  }
  assert.equal(engine.currentState, LEVEL3_STATES.DIRECTION_CHECK);

  const output = updateWithPose(engine, makePose({ vcpX: 0.55 }), false, clock.value);
  assert.equal(output.action, "DIRECTION_AUTO_BOUND");
  assert.equal(engine.directionSign("LEFT"), 1);
  assert.equal(engine.directionSign("RIGHT"), -1);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);
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

test("wide wrist separation does not fade or drop the Level 3 game object", () => {
  const { engine, clock } = calibratedEngine();
  advance(engine, {}, clock, 900, 100);
  assert.equal(engine.currentState, LEVEL3_STATES.WIPING_LATERAL);

  const releasedPose = makePose({ wristSeparation: 0.12 });
  const released = updateWithPose(engine, releasedPose, false, clock.value, null);
  assert.notEqual(released.action, "OBJECT_FADE_OUT");
  assert.equal(released.state, LEVEL3_STATES.WIPING_LATERAL);
  assert.equal(released.objectVisible, true);
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

test("Level 3 instructions prioritise shoulder abduction, optional elbow extension and midline trunk control", () => {
  assert.match(pageSource, /肩外展向患側外滑/);
  assert.match(pageSource, /手肘按能力保持或逐步伸直/);
  assert.doesNotMatch(pageSource, /外旋|內旋/);
  const engine = new Level3BilateralSandbox();
  assert.match(engine.lastMessage, /肩外展向患側外滑/);
  assert.match(engine.lastMessage, /手肘按能力保持或逐步伸直/);
  assert.doesNotMatch(engine.lastMessage, /外旋|內旋/);
  assert.match(engine.lastMessage, /毛巾跟手側滑/);
  assert.match(engine.lastMessage, /軀幹保持正中/);
});

test("movement-quality warnings flash only the camera edge and request therapist review", () => {
  assert.match(appSource, /MOVEMENT_QUALITY_WARNING_ACTIONS/);
  assert.match(appSource, /movement-quality-flash/);
  assert.match(pageSource, /data-testid="text-level3-live-warning"/);
  assert.match(appSource, /movementAlertText\.textContent = output\.message/);
  assert.match(pageSource, /影像只作動作品質提示；治療師作最終判斷/);
});

test("Level 3 page gates camera and session behind an explicit acknowledgement", () => {
  assert.match(pageSource, /data-testid="panel-level3-safety-gate"/);
  assert.match(pageSource, /data-testid="checkbox-l3-safety-ack"/);
  assert.match(pageSource, /id="safetyGateContinue"[\s\S]*?disabled/);
  for (const item of ["safety-stop", "safety-movement", "safety-practice"]) {
    assert.ok(pageSource.includes(`data-testid="text-l3-${item}"`), `missing gate item: ${item}`);
  }
  assert.match(pageSource, /開始前安全確認（FTHUE Level 3）/);
  assert.match(pageSource, /好手帶動患手向外滑，毛巾跟著移動/);
  assert.match(pageSource, /動作慢、穩，不追求次數/);
  assert.match(appSource, /function requireSafetyAck/);
  assert.match(appSource, /requireSafetyAck\("啟動相機"\)/);
  assert.match(appSource, /requireSafetyAck\("開始 Session"\)/);
  assert.match(appSource, /launchParams\.get\("safetyAck"\) === "1"[\s\S]*closeSafetyGate\(\)/);
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

test("Level 3 separates query-driven trial and training recording behavior", () => {
  assert.match(appSource, /launchParams\.get\("mode"\)/);
  assert.match(appSource, /const sessionMode = requestedMode === "trial" \? "trial" : "training"/);
  assert.match(appSource, /試玩 · 不錄影／不提示/);
  assert.match(pageSource, /訓練 · 錄影及姿勢提示/);
  assert.match(appSource, /const isMovementWarning = !isTrialMode && MOVEMENT_QUALITY_WARNING_ACTIONS\.has/);
  assert.match(appSource, /function flashMovementQualityWarning\(output\) \{\s+if \(isTrialMode\) return;/);
  assert.match(appSource, /function startTrainingRecordingIfPossible/);
  assert.match(appSource, /createHeadExcludedRecordingStream\(\)/);
  assert.match(appSource, /new MediaRecorder\(videoOnlyStream,\s*options\)/);
  assert.match(appSource, /queueMicrotask\(\(\) => startTrainingRecordingIfPossible\(inputs\.patientId\)\)/);
  assert.match(appSource, /elements\.cameraStatus\.textContent = "本機偵測已啟動 · 正在校準";\s+startTrainingRecordingIfPossible\(\)/);
  assert.match(appSource, /onEndSession: \(inputs\) => new Promise\(\(resolve\) => \{\s+stopTrainingRecording\(\)/);
  assert.match(appSource, /recording: \{\s+state: recordingState/);
  assert.equal(appSource.includes('rgba(8, 20, 17, 0.2)'), false);
});

test("Level 3 recording review has play, download, delete, and an anonymized filename", () => {
  for (const id of ["recordingPlay", "recordingDownload", "recordingDelete"]) {
    assert.ok(pageSource.includes(`id="${id}"`), `missing recording control: ${id}`);
  }
  assert.match(appSource, /function makeRecordingFilename\(patientId = "ANON"\)/);
  assert.match(appSource, /replace\(\/\[\^A-Z0-9_-\]\/g, ""\)/);
  assert.match(appSource, /downloadFile\(recordingFilename, recordingBlob/);
  assert.match(appSource, /URL\.revokeObjectURL\(recordingUrl\)/);
});

test("Level 3 training recording excludes the top head region before MediaRecorder", () => {
  assert.match(appSource, /RECORDING_HEAD_EXCLUSION_RATIO\s*=\s*0\.30/);
  assert.match(appSource, /canvas\.captureStream\(12\)/);
  assert.match(appSource, /drawImage\(elements\.video,\s*0,\s*cropTop/);
  assert.match(appSource, /new MediaRecorder\(videoOnlyStream,\s*options\)/);
  assert.match(pageSource, /只錄頭部以下/);
});

test("Level 3 requires an explicit affected-side choice before starting", () => {
  const sideFieldset = pageSource.match(
    /<fieldset id="affectedSideFieldset"[\s\S]*?<\/fieldset>/,
  );
  assert.ok(sideFieldset, "affected-side fieldset is missing");
  assert.doesNotMatch(sideFieldset[0], /name="affectedSide"[^>]*checked/);
  assert.match(sideFieldset[0], /左手患側/);
  assert.match(sideFieldset[0], /右手患側/);
  assert.match(pageSource, /id="startCamera"[\s\S]*?disabled>先選患手<\/button>/);
  assert.match(dashboardSource, /if \(!inputs\.affectedSide\)/);
  assert.match(appSource, /if \(!selectedSide\)/);
});

test("Level 3 first affected-side movement empirically binds camera left-right", () => {
  assert.match(appSource, /mirrorPoseForDisplay/);
  assert.match(engineSource, /bindEmpiricalDirection\(this\.affectedSide, rawDisplacement\)/);
  assert.match(engineSource, /action: "DIRECTION_AUTO_BOUND"/);
  assert.match(appSource, /requestedAffectedSide === "LEFT" \|\| requestedAffectedSide === "RIGHT"/);
});

test("Level 3 uses a single game-start action and a responsive local inference loop", () => {
  assert.match(pageSource, /開始 Level 3 遊戲|先選患手/);
  assert.match(appSource, /if \(!dashboard\.sessionActive && dashboard\.start\(\) !== true\) return false/);
  assert.doesNotMatch(appSource, /inferenceFrameCount % 2/);
  assert.match(appSource, /isAppleTouchDevice\(\) \? 50 : 40/);
  assert.match(appSource, /canvas\.captureStream\(12\)/);
  assert.match(appSource, /localInference: true/);
});
