import { Level3BilateralSandbox } from "./Level3BilateralSandbox.js";
import { Level3BilateralDataCollector } from "./Level3BilateralDataCollector.js";
import { TherapistDashboard, PROTOCOL_VARIANT_LEGACY_DEG } from "./TherapistDashboard.js";
import { VamsInterfaceOverlay } from "./VamsInterfaceOverlay.js";

const elements = {
  affectedSides: [...document.querySelectorAll('input[name="affectedSide"]')],
  protocolVariant: document.querySelector("#protocolVariant"),
  safetyGate: document.querySelector("#safetyGate"),
  safetyGateAck: document.querySelector("#safetyGateAck"),
  safetyGateContinue: document.querySelector("#safetyGateContinue"),
  safetyGateBack: document.querySelector("#safetyGateBack"),
  cameraErrorBox: document.querySelector("#cameraErrorBox"),
  cameraErrorMessage: document.querySelector("#cameraErrorMessage"),
  cameraErrorDetail: document.querySelector("#cameraErrorDetail"),
  cameraRetry: document.querySelector("#cameraRetry"),
  cameraReturn: document.querySelector("#cameraReturn"),
  reachProfile: document.querySelector("#reachProfile"),
  toleranceMode: document.querySelector("#toleranceMode"),
  directionMapping: document.querySelector("#directionMapping"),
  startCamera: document.querySelector("#startCamera"),
  beginCalibration: document.querySelector("#beginCalibration"),
  runSynthetic: document.querySelector("#runSynthetic"),
  cameraStatus: document.querySelector("#cameraStatus"),
  canvas: document.querySelector("#diagnosticCanvas"),
  video: document.querySelector("#cameraVideo"),
  fpsValue: document.querySelector("#fpsValue"),
  stateValue: document.querySelector("#stateValue"),
  actionValue: document.querySelector("#actionValue"),
  vcpValue: document.querySelector("#vcpValue"),
  targetValue: document.querySelector("#targetValue"),
  shoulderValue: document.querySelector("#shoulderValue"),
  directionValue: document.querySelector("#directionValue"),
  scoreValue: document.querySelector("#scoreValue"),
  trackingBadge: document.querySelector("#trackingBadge"),
  symmetryCard: document.querySelector("#symmetryCard"),
  symmetryValue: document.querySelector("#symmetryValue"),
  symmetryLimit: document.querySelector("#symmetryLimit"),
  symmetryMeter: document.querySelector("#symmetryMeter"),
  trunkCard: document.querySelector("#trunkCard"),
  trunkValue: document.querySelector("#trunkValue"),
  trunkLimit: document.querySelector("#trunkLimit"),
  trunkMeter: document.querySelector("#trunkMeter"),
  guidance: document.querySelector("#guidance"),
  logSnapshot: document.querySelector("#logSnapshot"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
  clearLog: document.querySelector("#clearLog"),
  exportDataset: document.querySelector("#exportDataset"),
  logCount: document.querySelector("#logCount"),
  sessionId: document.querySelector("#sessionId"),
  logRows: document.querySelector("#logRows"),
  themeToggle: document.querySelector("#themeToggle"),
  diagnosticConsole: document.querySelector("#diagnosticConsole"),
  stimulusId: document.querySelector("#stimulusId"),
  responseStatus: document.querySelector("#responseStatus"),
  responseAccuracy: document.querySelector("#responseAccuracy"),
  applyCognitiveResponse: document.querySelector("#applyCognitiveResponse"),
};

const AUTO_LOG_ACTIONS = new Set([
  "CALIBRATION_SUCCESS",
  "TARGET_REACHED",
  "SUCCESS_SCORE",
  "OBJECT_FADE_OUT",
  "RETURN_AFTER_RELEASE",
  "TRUNK_TRANSLATION_WARNING",
  "BILATERAL_ASYMMETRY_WARNING",
]);

function currentConfig() {
  return {
    affectedSide: elements.affectedSides.find((input) => input.checked)?.value || "LEFT",
    reachRangeProfile: elements.reachProfile.value,
    toleranceMode: elements.toleranceMode.value,
    patientLeftXSign: Number(elements.directionMapping.value),
  };
}

function makeSessionId() {
  const date = new Date();
  const stamp = date.toISOString().replace(/\D/g, "").slice(0, 17);
  return `L3-${stamp}`;
}

let engine = new Level3BilateralSandbox(currentConfig());
let lastOutput = engine.output();
let lastPose = null;
let poseLandmarker = null;
let cameraStream = null;
let animationFrameId = null;
let lastInferenceAt = 0;
let inferenceFrameCount = 0;
let frameTimes = [];
let sessionEvents = [];
let sessionId = makeSessionId();
let lastLoggedSignature = "";
let lastLoggedAt = -Infinity;
const dataCollector = new Level3BilateralDataCollector();
let dashboard = null;
let latestDatasetPayload = null;

elements.sessionId.textContent = sessionId;

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  elements.themeToggle.setAttribute("aria-label", theme === "dark" ? "切換淺色模式" : "切換深色模式");
}

setTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

function format(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function logToConsole(message) {
  const timestamp = new Date().toISOString().slice(11, 23);
  elements.diagnosticConsole.textContent += `\n[${timestamp}] ${message}`;
  elements.diagnosticConsole.scrollTop = elements.diagnosticConsole.scrollHeight;
}

function diagnosticValues(output = lastOutput) {
  const metrics = output.metrics;
  const thresholds = engine.getDiagnosticThresholds();
  if (!metrics) {
    return {
      thresholds,
      wristDelta: null,
      trunkDelta: null,
      pairedAsymmetry: null,
    };
  }
  const leftDisplacement = metrics.leftWristX - engine.baselineLeftWristX;
  const rightDisplacement = metrics.rightWristX - engine.baselineRightWristX;
  return {
    thresholds,
    wristDelta: Math.abs(metrics.wristSeparation - engine.baselineWristSeparation),
    trunkDelta: Math.abs(metrics.shoulderCenterX - engine.calibrationShoulderCenter),
    pairedAsymmetry: Math.abs(leftDisplacement - rightDisplacement),
  };
}

function setMonitorState(card, meter, ratio, triggered) {
  card.classList.toggle("prewarning", !triggered && ratio >= 0.75);
  card.classList.toggle("triggered", triggered);
  meter.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

function updateMetrics(output) {
  lastOutput = output;
  const metrics = output.metrics;
  const diagnostics = diagnosticValues(output);
  const { thresholds } = diagnostics;

  elements.stateValue.textContent = output.state;
  elements.actionValue.textContent = output.action;
  elements.guidance.textContent = output.message;
  elements.scoreValue.textContent = String(output.score);
  elements.directionValue.textContent = `目前向${output.targetDirection === "LEFT" ? "左" : "右"}；首次患側 ${engine.affectedSide}`;
  elements.vcpValue.textContent = `${format(metrics?.vcpX)} / ${format(engine.calibrationVcpXMedian)} / ±${format(engine.dynamicVcpTolerance)}`;
  elements.targetValue.textContent = `目標距離 ${format(engine.scaledTargetRangeX)}；節次標籤 ${elements.protocolVariant.value}`;
  elements.shoulderValue.textContent = `${format(metrics?.shoulderWidth)} / ${format(metrics?.shoulderCenterX)}`;

  const symmetryRatio = Number.isFinite(diagnostics.wristDelta)
    ? metrics.wristSeparation / thresholds.wristSeparationLimit
    : 0;
  const trunkRatio = Number.isFinite(diagnostics.trunkDelta)
    ? diagnostics.trunkDelta / thresholds.trunkTranslationLimit
    : 0;
  const symmetryTriggered = output.action === "BILATERAL_ASYMMETRY_WARNING"
    || output.action === "OBJECT_FADE_OUT";
  const trunkTriggered = output.action === "TRUNK_TRANSLATION_WARNING";

  elements.symmetryValue.textContent = Number.isFinite(diagnostics.wristDelta)
    ? `${format(diagnostics.wristDelta)}（同步差 ${format(diagnostics.pairedAsymmetry)}）`
    : "--";
  const separationUnit = metrics?.wristSeparationUnit === "m" ? " m" : "";
  elements.symmetryLimit.textContent = `鬆開界線 ${format(thresholds.wristSeparationLimit)}${separationUnit}`;
  elements.trunkValue.textContent = Number.isFinite(diagnostics.trunkDelta)
    ? `${format(diagnostics.trunkDelta)}（中點 ${format(metrics.shoulderCenterX)}）`
    : "--";
  elements.trunkLimit.textContent = `位移界線 ${format(thresholds.trunkTranslationLimit)}`;
  setMonitorState(elements.symmetryCard, elements.symmetryMeter, symmetryRatio, symmetryTriggered);
  setMonitorState(elements.trunkCard, elements.trunkMeter, trunkRatio, trunkTriggered);

  elements.trackingBadge.textContent = output.trackingStable ? "追蹤穩定" : "追蹤鎖定中";
  elements.trackingBadge.classList.toggle("stable", output.trackingStable);
}

function eventRecord(output, reason = output.action) {
  const metrics = output.metrics || {};
  const diagnostics = diagnosticValues(output);
  return {
    timestamp: new Date().toISOString(),
    monotonicTimeMs: output.timestampMs,
    sessionId,
    reason,
    state: output.state,
    action: output.action,
    affectedSide: engine.affectedSide,
    targetDirection: output.targetDirection,
    // Legacy key retained for backward compatibility; see PROTOCOL_VARIANT_LEGACY_DEG.
    targetElevationMetadataDeg: PROTOCOL_VARIANT_LEGACY_DEG[elements.protocolVariant.value] ?? 45,
    protocolVariant: elements.protocolVariant.value,
    reachRangeProfile: engine.reachRangeProfile,
    toleranceMode: engine.toleranceMode,
    vcpX: metrics.vcpX ?? null,
    calibrationVcpXMedian: engine.calibrationVcpXMedian,
    targetRangeX: engine.scaledTargetRangeX,
    shoulderWidth: metrics.shoulderWidth ?? null,
    shoulderMidPointX: metrics.shoulderCenterX ?? null,
    wristSeparation: metrics.wristSeparation ?? null,
    wristSeparationDelta: diagnostics.wristDelta,
    pairedWristAsymmetry: diagnostics.pairedAsymmetry,
    trunkTranslationDelta: diagnostics.trunkDelta,
  };
}

function renderLog() {
  elements.logRows.replaceChildren();
  for (const event of sessionEvents.slice().reverse()) {
    const row = document.createElement("tr");
    const time = event.timestamp.slice(11, 23);
    row.innerHTML = `<td>${time}</td><td>${event.reason}</td><td>${event.state}</td><td>${format(event.vcpX)}</td><td>${format(event.shoulderWidth)}</td><td>${format(event.shoulderMidPointX)}</td>`;
    elements.logRows.append(row);
  }
  elements.logCount.textContent = String(sessionEvents.length);
  const disabled = sessionEvents.length === 0;
  elements.exportJson.disabled = disabled;
  elements.exportCsv.disabled = disabled;
  elements.clearLog.disabled = disabled;
}

function resetSessionLog() {
  sessionEvents = [];
  lastLoggedSignature = "";
  lastLoggedAt = -Infinity;
  sessionId = makeSessionId();
  elements.sessionId.textContent = sessionId;
  renderLog();
}

function maybeLog(output, forceReason = null) {
  if (!forceReason && !AUTO_LOG_ACTIONS.has(output.action)) return;
  const reason = forceReason || output.action;
  const signature = `${reason}:${output.state}`;
  const now = output.timestampMs || performance.now();
  if (!forceReason && signature === lastLoggedSignature && now - lastLoggedAt < 1000) return;
  sessionEvents.push(eventRecord(output, reason));
  lastLoggedSignature = signature;
  lastLoggedAt = now;
  renderLog();
}

function handleOutput(output) {
  updateMetrics(output);
  dataCollector.observe(output, engine, output.timestampMs);
  maybeLog(output);
  if (AUTO_LOG_ACTIONS.has(output.action) || output.action === "CENTER_READY") {
    logToConsole(`${output.action} | ${output.state} | VCP ${format(output.metrics?.vcpX)}/${format(output.metrics?.vcpY)}`);
  }
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

dashboard = new TherapistDashboard({
  onStartSession: (inputs) => {
    if (!requireSafetyAck("開始 Session")) return;
    engine = new Level3BilateralSandbox(currentConfig());
    resetSessionLog();
    latestDatasetPayload = null;
    elements.exportDataset.disabled = true;
    dataCollector.startSession(inputs, performance.now());
    elements.sessionId.textContent = inputs.patientId;
    elements.stimulusId.value = inputs.experimentalCondition === "SINGLE_TASK_BASELINE"
      ? "none_control"
      : "";
    elements.responseStatus.value = inputs.experimentalCondition === "SINGLE_TASK_BASELINE"
      ? "NOT_APPLICABLE"
      : "PENDING";
    elements.responseAccuracy.value = "";
    logToConsole(`SESSION_STARTED | ${inputs.experimentalCondition} | planned ${inputs.experimentalCondition === "SINGLE_TASK_BASELINE" ? 5 : 8} min`);
    handleOutput(engine.output({
      message: "Session 已建立，請開始中央桌面校準",
      action: "SESSION_STARTED",
      nowMs: performance.now(),
    }));
  },
  onPause: () => {
    dataCollector.pause(performance.now());
    logToConsole("SESSION_PAUSED | timing excluded");
  },
  onResume: () => {
    dataCollector.resume(performance.now());
    engine.resetTimer();
    logToConsole("SESSION_RESUMED | fresh debounce required");
  },
  onInvalidate: () => {
    const invalidated = dataCollector.invalidateCurrentRepetition("THERAPIST_INVALIDATED", performance.now());
    engine.abortCurrentRepetition();
    logToConsole(invalidated ? "REPETITION_INVALIDATED" : "INVALIDATE_IGNORED | no active repetition");
    handleOutput(engine.output({
      message: "目前 repetition 已作廢，請重新在中央起點準備",
      action: "THERAPIST_INVALIDATED",
      nowMs: performance.now(),
    }));
  },
  onEndSession: (inputs) => new Promise((resolve) => {
    new VamsInterfaceOverlay({
      onScoreSubmitted: (score) => {
        dataCollector.updateBlockMetadata({
          ...inputs,
          subjectiveEnjoymentVamsScore: score,
        });
        latestDatasetPayload = dataCollector.endSession(engine, performance.now());
        elements.exportDataset.disabled = false;
        logToConsole(
          `SESSION_ENDED | VAMS ${score}/10 | ${latestDatasetPayload.raw_experimental_repetition_logs.length} repetition(s)`,
        );
        resolve(latestDatasetPayload);
      },
    }).show();
  }),
});

elements.applyCognitiveResponse.addEventListener("click", () => {
  const condition = document.getElementById("experimentalCondition").value;
  dataCollector.setCognitiveResponse({
    stimulusId: condition === "SINGLE_TASK_BASELINE" ? "none_control" : elements.stimulusId.value.trim(),
    responseStatus: condition === "SINGLE_TASK_BASELINE" ? "NOT_APPLICABLE" : elements.responseStatus.value,
    isAccurate: condition === "SINGLE_TASK_BASELINE"
      ? null
      : elements.responseAccuracy.value === ""
        ? null
        : elements.responseAccuracy.value === "true",
  });
  logToConsole("COGNITIVE_RESPONSE_ANNOTATED");
});

elements.logSnapshot.addEventListener("click", () => {
  maybeLog(lastOutput, "MANUAL_SNAPSHOT");
});

elements.exportJson.addEventListener("click", () => {
  downloadFile(
    `${sessionId}.json`,
    JSON.stringify({ sessionId, exportedAt: new Date().toISOString(), events: sessionEvents }, null, 2),
    "application/json",
  );
});

elements.exportCsv.addEventListener("click", () => {
  const columns = [
    "timestamp", "sessionId", "reason", "state", "action", "affectedSide", "targetDirection",
    "targetElevationMetadataDeg", "protocolVariant", "reachRangeProfile", "toleranceMode", "vcpX",
    "calibrationVcpXMedian", "targetRangeX", "shoulderWidth", "shoulderMidPointX",
    "wristSeparation", "wristSeparationDelta", "pairedWristAsymmetry", "trunkTranslationDelta",
  ];
  const rows = [
    columns.map(csvCell).join(","),
    ...sessionEvents.map((event) => columns.map((column) => csvCell(event[column])).join(",")),
  ];
  downloadFile(`${sessionId}.csv`, `\uFEFF${rows.join("\n")}`, "text/csv;charset=utf-8");
});

elements.exportDataset.addEventListener("click", () => {
  const payload = latestDatasetPayload || dataCollector.exportPayload(engine);
  const participant = payload.sandbox_metadata.patient_anonymous_id || "LEVEL3_SESSION";
  const blockPosition = payload.sandbox_metadata.block_order_position || 0;
  const conditionCode = payload.sandbox_metadata.experimental_condition_block === "SINGLE_TASK_BASELINE"
    ? "ST"
    : "DT";
  downloadFile(
    `${participant}_B${blockPosition}_${conditionCode}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
});

elements.clearLog.addEventListener("click", () => {
  sessionEvents = [];
  lastLoggedSignature = "";
  lastLoggedAt = -Infinity;
  renderLog();
});

function drawCanvas() {
  const context = elements.canvas.getContext("2d");
  const { width, height } = elements.canvas;

  context.fillStyle = "#101715";
  context.fillRect(0, 0, width, height);
  if (cameraStream && elements.video.readyState >= 2) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(elements.video, 0, 0, width, height);
    context.restore();
    context.fillStyle = "rgba(8, 20, 17, 0.2)";
    context.fillRect(0, 0, width, height);
  } else {
    context.fillStyle = "#d9e4e0";
    context.font = "600 18px Satoshi, sans-serif";
    context.textAlign = "left";
    context.fillText("相機未啟動", 16, 30);
  }

  const centerX = engine.calibrationVcpXMedian * width;
  const toleranceWidth = engine.dynamicVcpTolerance * width;
  const targetX = (engine.calibrationVcpXMedian + engine.directionSign() * engine.scaledTargetRangeX) * width;

  context.fillStyle = "rgba(88, 194, 166, 0.2)";
  context.fillRect(centerX - toleranceWidth, height * 0.5, toleranceWidth * 2, height * 0.42);
  context.strokeStyle = "#f5d36b";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(centerX, height * 0.08);
  context.lineTo(centerX, height * 0.94);
  context.stroke();
  const targetY = height * 0.72;
  context.fillStyle = "rgba(242, 139, 130, 0.28)";
  context.strokeStyle = "#ff8d83";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(targetX, targetY, 42, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  const vcpX = lastOutput.metrics?.vcpX;
  const vcpY = lastOutput.metrics?.vcpY;
  if (Number.isFinite(vcpX) && Number.isFinite(vcpY)) {
    context.fillStyle = "#00ffcc";
    context.strokeStyle = "#10211d";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(vcpX * width, vcpY * height, 15, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.fillStyle = "#ffffff";
  context.font = "800 20px Satoshi, sans-serif";
  context.textAlign = "center";
  context.fillText("中央", centerX, 34);
  context.fillText(lastOutput.targetDirection === "LEFT" ? "向左" : "向右", targetX, targetY + 7);
}

function updateFps(now) {
  if (lastInferenceAt > 0) {
    frameTimes.push(now - lastInferenceAt);
    if (frameTimes.length >= 30) {
      const average = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
      elements.fpsValue.textContent = `FPS ${(1000 / average).toFixed(0)} · ${average.toFixed(1)}ms`;
      frameTimes = [];
    }
  }
}

async function loadPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  elements.cameraStatus.textContent = "正在載入 MediaPipe Pose 模型…";
  const visionBundle = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
  const vision = await visionBundle.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );
  const appleTouch = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const options = {
    baseOptions: {
      // Tasks Vision equivalent of the legacy Pose solution's modelComplexity: 0.
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: appleTouch ? "CPU" : "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.25,
    minPosePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25,
  };
  try {
    poseLandmarker = await visionBundle.PoseLandmarker.createFromOptions(vision, options);
  } catch {
    poseLandmarker = await visionBundle.PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    });
  }
  return poseLandmarker;
}

function mirrorPoseForDisplay(pose) {
  if (!Array.isArray(pose)) return null;
  return pose.map((point) => point ? { ...point, x: 1 - point.x } : point);
}

function cameraLoop(now) {
  drawCanvas();
  if (!cameraStream || !poseLandmarker || elements.video.readyState < 2) {
    animationFrameId = requestAnimationFrame(cameraLoop);
    return;
  }
  inferenceFrameCount += 1;
  if (inferenceFrameCount % 2 !== 0 || now - lastInferenceAt < 66) {
    animationFrameId = requestAnimationFrame(cameraLoop);
    return;
  }

  updateFps(now);
  lastInferenceAt = now;
  try {
    if (dashboard?.isPaused) {
      animationFrameId = requestAnimationFrame(cameraLoop);
      return;
    }
    const result = poseLandmarker.detectForVideo(elements.video, now);
    lastPose = mirrorPoseForDisplay(result?.landmarks?.[0] || null);
    const worldPose = result?.worldLandmarks?.[0] || null;
    handleOutput(engine.update(lastPose, worldPose, !lastPose, now));
  } catch {
    lastPose = null;
    handleOutput(engine.update(null, null, true, now));
  }
  animationFrameId = requestAnimationFrame(cameraLoop);
}

// ------------------------------------------------------------------
// Mandatory safety acknowledgement gate (blocks camera and session).
// ------------------------------------------------------------------
let safetyAcknowledged = false;

function safetyGateVisible() {
  return !elements.safetyGate.classList.contains("hidden");
}

function closeSafetyGate() {
  safetyAcknowledged = true;
  elements.safetyGate.classList.add("hidden");
  logToConsole("SAFETY_CHECKLIST_ACKNOWLEDGED | therapist supervised");
}

elements.safetyGateAck.addEventListener("change", () => {
  elements.safetyGateContinue.disabled = !elements.safetyGateAck.checked;
});

elements.safetyGateContinue.addEventListener("click", () => {
  if (!elements.safetyGateAck.checked) return;
  closeSafetyGate();
});

elements.safetyGateBack.addEventListener("click", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  window.location.href = "../../index.html";
});

function requireSafetyAck(actionLabel) {
  if (safetyAcknowledged) return true;
  elements.safetyGate.classList.remove("hidden");
  elements.safetyGateAck.focus();
  elements.cameraStatus.textContent = `請先完成安全確認，才可${actionLabel}。`;
  return false;
}

// ------------------------------------------------------------------
// In-page camera failure surface (never an indefinite waiting state).
// ------------------------------------------------------------------
function hideCameraError() {
  elements.cameraErrorBox.classList.remove("show");
  elements.cameraErrorMessage.textContent = "";
  elements.cameraErrorDetail.textContent = "";
}

function describeCameraError(error) {
  const name = error?.name || "";
  if (name === "UnsupportedError") {
    return "這部裝置或瀏覽器不支援相機功能。請改用 Safari（iPad）或 Chrome，並確認網址為 https。";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "相機權限被拒絕。請在瀏覽器設定允許此網站使用相機，然後按「重新嘗試」。";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "找不到可用的相機。請確認裝置有前置鏡頭，或改用其他裝置。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "相機正被其他應用程式使用。請關閉其他使用相機的程式，然後按「重新嘗試」。";
  }
  return "未能啟動相機。請按「重新嘗試」，或先使用「執行合成完整循環」作離線測試。";
}

function showCameraError(error) {
  elements.cameraErrorMessage.textContent = describeCameraError(error);
  elements.cameraErrorDetail.textContent = error?.name
    ? `技術代碼：${error.name}`
    : "技術代碼：UNKNOWN";
  elements.cameraErrorBox.classList.add("show");
  elements.cameraStatus.textContent = "相機未啟動；可重新嘗試或返回主頁。";
  elements.startCamera.disabled = false;
}

async function startCameraFlow() {
  if (!requireSafetyAck("啟動相機")) return false;
  hideCameraError();
  elements.startCamera.disabled = true;
  elements.cameraStatus.textContent = "正在啟動相機…";
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      const unsupported = new Error("getUserMedia unavailable");
      unsupported.name = "UnsupportedError";
      throw unsupported;
    }
    await loadPoseLandmarker();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 960, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: false,
    });
    elements.video.srcObject = cameraStream;
    await elements.video.play();
    elements.cameraStatus.textContent = "Pose Lite 已啟動（最高 1280×720、每兩幀推論一次）。請把 iPad 稍為向下傾，畫面須見到肩、手肘、雙手及整段側滑路徑。";
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(cameraLoop);
    return true;
  } catch (error) {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    showCameraError(error);
    logToConsole(`CAMERA_ERROR | ${error?.name || "UNKNOWN"}`);
    return false;
  }
}

// A parent-page acknowledgement (?safetyAck=1) pre-fills the checkbox but the
// therapist must still confirm explicitly on this page.
if (new URLSearchParams(window.location.search).get("safetyAck") === "1") {
  elements.safetyGateAck.checked = true;
  elements.safetyGateContinue.disabled = false;
}

elements.startCamera.addEventListener("click", () => { startCameraFlow(); });
elements.cameraRetry.addEventListener("click", () => { startCameraFlow(); });
elements.cameraReturn.addEventListener("click", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  window.location.href = "../../index.html";
});

elements.beginCalibration.addEventListener("click", () => {
  engine = new Level3BilateralSandbox(currentConfig());
  lastPose = null;
  handleOutput(engine.output({
    message: "已重置：雙手放回同一張毛巾中央；毛巾跟手側滑，軀幹保持正中",
    action: "CALIBRATION_STARTED",
    nowMs: performance.now(),
  }));
  drawCanvas();
});

function syntheticPose({
  vcpX = 0.5,
  shoulderCenterX = 0.5,
  shoulderWidth = 0.3,
  wristSeparation = 0.04,
} = {}) {
  const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  pose[11] = { x: shoulderCenterX - shoulderWidth / 2, y: 0.35, z: 0, visibility: 0.99 };
  pose[12] = { x: shoulderCenterX + shoulderWidth / 2, y: 0.35, z: 0, visibility: 0.99 };
  pose[13] = { x: vcpX - 0.1, y: 0.53, z: 0, visibility: 0.99 };
  pose[14] = { x: vcpX + 0.1, y: 0.53, z: 0, visibility: 0.99 };
  pose[15] = { x: vcpX - wristSeparation / 2, y: 0.7, z: 0, visibility: 0.99 };
  pose[16] = { x: vcpX + wristSeparation / 2, y: 0.7, z: 0, visibility: 0.99 };
  return pose;
}

function feedSynthetic(options, clock, durationMs, stepMs = 50) {
  const end = clock.value + durationMs;
  while (clock.value <= end) {
    lastPose = syntheticPose(options);
    handleOutput(engine.update(lastPose, lastPose, false, clock.value));
    clock.value += stepMs;
  }
}

function runSyntheticCycle() {
  engine = new Level3BilateralSandbox(currentConfig());
  const clock = { value: performance.now() };
  if (!dataCollector.sessionActive) {
    const inputs = dashboard.getFormInputs();
    dataCollector.startSession(inputs, clock.value);
    logToConsole("SYNTHETIC_SESSION_STARTED");
  }
  feedSynthetic({}, clock, 2100, 50);
  feedSynthetic({}, clock, 850, 50);
  const targetX = engine.calibrationVcpXMedian
    + engine.directionSign() * (engine.scaledTargetRangeX + 0.01);
  feedSynthetic({ vcpX: targetX }, clock, 850, 50);
  feedSynthetic({}, clock, 850, 50);
  elements.cameraStatus.textContent = "合成循環已完成；可核對狀態、邊界線及事件記錄。";
  renderLog();
  drawCanvas();
  return lastOutput;
}

elements.runSynthetic.addEventListener("click", runSyntheticCycle);

window.render_game_to_text = () => JSON.stringify({
  prototype: "level3-bilateral-diagnostic-sandbox",
  isolatedFromPilot: true,
  state: lastOutput.state,
  action: lastOutput.action,
  targetDirection: lastOutput.targetDirection,
  targetRangeX: lastOutput.targetRangeX,
  score: lastOutput.score,
  metrics: lastOutput.metrics,
  logCount: sessionEvents.length,
  collectedRepetitionCount: dataCollector.repetitions.length,
  sessionActive: dataCollector.sessionActive,
  targetElevationMetadataDeg: PROTOCOL_VARIANT_LEGACY_DEG[elements.protocolVariant.value] ?? 45,
  protocolVariant: elements.protocolVariant.value,
  cameraActive: Boolean(cameraStream),
});

window.advanceTime = (milliseconds) => {
  const clock = { value: (lastOutput.timestampMs || 0) + 1 };
  feedSynthetic({}, clock, milliseconds, Math.min(50, Math.max(10, milliseconds)));
  drawCanvas();
  return window.render_game_to_text();
};

window.injectDiagnosticFrame = (poseLandmarks, poseWorldLandmarks = poseLandmarks, nowMs = performance.now()) => {
  lastPose = poseLandmarks;
  handleOutput(engine.update(poseLandmarks, poseWorldLandmarks, !poseLandmarks || !poseWorldLandmarks, nowMs));
  drawCanvas();
  return JSON.parse(window.render_game_to_text());
};

window.__level3Diagnostic = {
  get engine() { return engine; },
  get safetyAcknowledged() { return safetyAcknowledged; },
  get safetyGateVisible() { return safetyGateVisible(); },
  get cameraErrorVisible() { return elements.cameraErrorBox.classList.contains("show"); },
  describeCameraError,
  showCameraError,
  hideCameraError,
  requireSafetyAck,
  get events() { return sessionEvents.slice(); },
  get dataset() { return dataCollector.exportPayload(engine); },
  get dashboard() { return dashboard; },
  runSyntheticCycle,
};

window.addEventListener("beforeunload", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
});

updateMetrics(lastOutput);
renderLog();
drawCanvas();
animationFrameId = requestAnimationFrame(cameraLoop);
