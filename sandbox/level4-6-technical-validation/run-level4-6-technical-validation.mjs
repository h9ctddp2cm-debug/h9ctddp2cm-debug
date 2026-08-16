import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const outputDir = path.dirname(fileURLToPath(import.meta.url));
const tests = [];
const errors = [];

function record(level, category, name, passed, details = {}) {
  const row = { level, category, name, passed, details };
  tests.push(row);
  if (!passed) errors.push(row);
}

function check(level, category, name, condition, details = {}) {
  record(level, category, name, Boolean(condition), details);
}

function itemsDoNotOverlap(items) {
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const a = items[left];
      const b = items[right];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) return false;
    }
  }
  return true;
}

async function state(page) {
  return page.evaluate(() => window.__qa.state());
}

async function start(page, level, theme = "dimsum", dwellMs = 300) {
  await page.evaluate(
    ({ level, theme, dwellMs }) =>
      window.__qa.startGame({ level, theme, mode: "basic", duration: 180, dwellMs, affectedSide: "right" }),
    { level, theme, dwellMs },
  );
  return state(page);
}

async function position(page, point, grasping, openPrep) {
  await page.evaluate(
    ({ point, grasping, openPrep }) => {
      window.__qa.snapCursor();
      window.__qa.setHandAt(point.x, point.y, grasping, openPrep);
    },
    { point, grasping, openPrep },
  );
}

async function advance(page, milliseconds) {
  await page.evaluate(ms => window.advanceTime(ms), milliseconds);
}

async function performPlacement(page, level, correct) {
  const before = await state(page);
  const item = before.items[0];
  const target = before.targets.find(t => correct ? t.type === item.type : t.type !== item.type);
  if (!item || !target) throw new Error(`Missing ${correct ? "matching" : "mismatching"} item/target`);

  if (level === "4") {
    await position(page, item, false, true);
    await advance(page, 900);
    check("4", "flow", "dwell pickup acquires an item", (await state(page)).held !== null);
    await position(page, target, false, true);
    await advance(page, 900);
  } else {
    await position(page, item, false, true);
    await advance(page, 420);
    await position(page, item, true, false);
    await advance(page, 700);
    check(level === "5" ? "5" : "6", "flow", "prepared gesture and hold acquire an item", (await state(page)).held !== null);
    await position(page, target, true, false);
    await advance(page, 420);
    await position(page, target, false, true);
    await advance(page, 1250);
  }

  const after = await state(page);
  return { before, after, item, target };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
page.on("console", message => {
  if (message.type() === "error") errors.push({ level: "all", category: "console", name: message.text(), passed: false, details: {} });
});
page.on("pageerror", error => {
  errors.push({ level: "all", category: "pageerror", name: error.message, passed: false, details: {} });
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__qa && window.advanceTime, null, { timeout: 15000 });

  const expectedTypes = { "4": "dwell", "5": "grasp", "67": "pinch" };
  const displayLevel = { "4": "4", "5": "5", "67": "6" };
  const themes = await page.evaluate(() => window.__qa.themes().map(theme => theme.id));
  for (const level of Object.keys(expectedTypes)) {
    for (const theme of themes) {
      const launch = await start(page, level, theme);
      check(displayLevel[level], "launch matrix", `${theme} launches with the correct engine`,
        launch.screen === "game" &&
        launch.level === level &&
        launch.gameType === expectedTypes[level] &&
        itemsDoNotOverlap(launch.items),
        { screen: launch.screen, engine: launch.gameType, non_overlapping_items: itemsDoNotOverlap(launch.items) });
    }
  }

  const gestures = await page.evaluate(() => ({
    graspOneFinger: window.__qa.gestureProbe.grasp([0.6, 1, 1, 1, 1], false, "any"),
    graspTwoFingers: window.__qa.gestureProbe.grasp([0.6, 0.6, 1, 1, 1], false, "any"),
    graspOneFingerReopen: window.__qa.gestureProbe.grasp([0.82, 0.82, 0.82, 1, 0.82], true, "any"),
    graspTwoFingerRelease: window.__qa.gestureProbe.grasp([0.82, 1, 1, 0.82, 0.82], true, "any"),
    pinchEnter: window.__qa.gestureProbe.pinch(0.30, false),
    pinchHysteresisHold: window.__qa.gestureProbe.pinch(0.45, true),
    pinchExit: window.__qa.gestureProbe.pinch(0.58, true),
    pinchOpen: window.__qa.gestureProbe.pinch(0.70, false),
    invalidGrasp: window.__qa.gestureProbe.invalid("grasp"),
    invalidPinch: window.__qa.gestureProbe.invalid("pinch"),
  }));
  check("5", "gesture", "one curled finger cannot trigger grasp", !gestures.graspOneFinger.isGrasping, gestures.graspOneFinger);
  check("5", "gesture", "two curled fingers trigger configured grasp", gestures.graspTwoFingers.isGrasping, gestures.graspTwoFingers);
  check("5", "gesture", "one reopened finger does not release held item", gestures.graspOneFingerReopen.isGrasping, gestures.graspOneFingerReopen);
  check("5", "gesture", "two reopened major fingers release held item", !gestures.graspTwoFingerRelease.isGrasping, gestures.graspTwoFingerRelease);
  check("6", "gesture", "pinch enters below normalized aperture threshold", gestures.pinchEnter.isPinching, gestures.pinchEnter);
  check("6", "gesture", "pinch hysteresis retains hold between enter and exit thresholds", gestures.pinchHysteresisHold.isPinching, gestures.pinchHysteresisHold);
  check("6", "gesture", "pinch exits above normalized release threshold", !gestures.pinchExit.isPinching, gestures.pinchExit);
  check("6", "gesture", "clearly separated fingers arm a new pinch", gestures.pinchOpen.isSeparated, gestures.pinchOpen);
  check("5", "safety", "malformed grasp landmarks fail safely", gestures.invalidGrasp.valid === false && !gestures.invalidGrasp.isGrasping, gestures.invalidGrasp);
  check("6", "safety", "malformed pinch landmarks fail safely", gestures.invalidPinch.valid === false && !gestures.invalidPinch.isPinching, gestures.invalidPinch);

  const l4Layout = await start(page, "4");
  const itemY = Math.min(...l4Layout.items.map(item => item.y));
  const targetY = Math.max(...l4Layout.targets.map(target => target.y));
  check("4", "layout", "targets remain forward of tabletop source items", targetY < itemY, { targetY, itemY });

  for (const level of ["4", "5", "67"]) {
    const label = displayLevel[level];
    await start(page, level);
    const correct = await performPlacement(page, level, true);
    check(label, "flow", "correct placement increments the correct count",
      correct.after.correctCount === correct.before.correctCount + 1 && correct.after.held === null,
      { before: correct.before.correctCount, after: correct.after.correctCount });

    await start(page, level);
    const wrong = await performPlacement(page, level, false);
    check(label, "flow", "wrong placement increments only the wrong count",
      wrong.after.correctCount === wrong.before.correctCount &&
      wrong.after.wrongCount === wrong.before.wrongCount + 1 &&
      wrong.after.held === null,
      { correct: wrong.after.correctCount, wrong: wrong.after.wrongCount });

    await start(page, level);
    await page.evaluate(() => window.__qa.setHand(0.5, 0.5, false, true));
    await advance(page, 100);
    await page.evaluate(() => window.__qa.clearHand());
    await advance(page, 500);
    const grace = await state(page);
    await advance(page, 400);
    const lost = await state(page);
    check(label, "tracking", "brief tracking loss uses the 750 ms grace window",
      grace.handDetected && grace.detectionHeldGrace, grace);
    check(label, "tracking", "sustained tracking loss clears detection safely",
      !lost.handDetected && !lost.detectionHeldGrace && lost.held === null, lost);
  }

  // ================================================================
  // P0 clinical safety review checks (mandatory gate, rest/stop,
  // Level 4 compensation prompt, Level 5 hold timeout and repeated
  // release difficulty, Level 6 bare-hand wording, camera failures).
  // ================================================================
  const safetyConstants = await page.evaluate(() => window.__qa.safety.constants());
  check("5", "safety", "maximum carry duration defaults to a conservative 5 seconds",
    safetyConstants.maxHoldMs === 5000, safetyConstants);
  check("5", "safety", "repeated release difficulty limit is configured",
    safetyConstants.releaseDifficultyLimit >= 2 && safetyConstants.releaseDifficultyLimit <= 3,
    { limit: safetyConstants.releaseDifficultyLimit });

  for (const levelKey of ["3", "4", "5", "67"]) {
    const label = levelKey === "67" ? "6" : levelKey;
    await page.evaluate(() => window.__qa.safety.resetGateFlags());
    const opened = await page.evaluate(key => window.__qa.safety.openGate(key), levelKey);
    check(label, "safety gate", "safety screen is shown before camera or game",
      opened.screen === "safety", { screen: opened.screen });
    check(label, "safety gate", "continue is blocked until the checklist is acknowledged",
      opened.continueDisabled === true && opened.ackChecked === false, opened);

    const blocked = await page.evaluate(() => window.__qa.safety.clickContinue());
    check(label, "safety gate", "clicking continue without acknowledgement does not proceed",
      blocked.continued === false && blocked.screen === "safety", blocked);

    const acked = await page.evaluate(() => window.__qa.safety.ack(true));
    check(label, "safety gate", "acknowledgement enables the continue action",
      acked.continueDisabled === false, acked);
    const proceeded = await page.evaluate(() => window.__qa.safety.clickContinue());
    check(label, "safety gate", "explicit acknowledgement is required and then proceeds",
      proceeded.continued === true, proceeded);

    const note = opened.levelNote || "";
    check(label, "safety gate", "level-specific safety note is visible on the screen",
      note.length > 20, { length: note.length });
  }

  const notes = safetyConstants.levelNotes;
  check("3", "safety copy", "Level 3 note requires towel movement and prohibits trunk compensation",
    notes["3"].includes("毛巾須隨手移動") && notes["3"].includes("軀幹保持正中")
    && notes["3"].includes("不側彎") && notes["3"].includes("肩外展")
    && !notes["3"].includes("互扣合攏"), { note: notes["3"] });
  check("4", "safety copy", "Level 4 note requires a clear environment and safe board distance",
    notes["4"].includes("清空桌面") && notes["4"].includes("10–15 cm")
    && notes["4"].includes("不可貼近腹部") && notes["4"].includes("慢慢向前滑"),
    { note: notes["4"] });
  check("5", "safety copy", "Level 5 note specifies off-table functional reach and loose simulated grasp",
    notes["5"].includes("手臂全程離開桌面") && notes["5"].includes("可見空隙")
    && notes["5"].includes("空手模擬") && !notes["5"].includes("握拳")
    && !notes["5"].includes("握緊")
    && notes["5"].includes("按患者當日張手幅度校準"), { note: notes["5"] });
  check("6", "safety copy", "Level 6 note specifies off-table functional reach and empty-hand pinch",
    notes["67"].includes("手臂全程離開桌面") && notes["67"].includes("只用空手")
    && notes["67"].includes("不拿實物") && notes["67"].includes("不要用盡力"),
    { note: notes["67"] });

  const bodyText = await page.evaluate(() => document.body.innerText);
  check("5", "safety copy", "no patient-facing 握拳/握緊 wording remains in the interface",
    !bodyText.includes("握拳") && !bodyText.includes("握緊"), {
      hasFist: bodyText.includes("握拳"), hasSqueeze: bodyText.includes("握緊"),
    });

  for (const level of ["4", "5", "67"]) {
    const label = displayLevel[level];
    await start(page, level);
    const controls = await page.evaluate(() => window.__qa.safety.controlsVisible());
    check(label, "rest/stop", "large 休息 and 停止 controls are always visible during play",
      controls.rest === true && controls.stop === true, controls);

    const rested = await page.evaluate(() => window.__qa.safety.rest());
    check(label, "rest/stop", "rest pauses active game timing",
      rested.paused === true && rested.blocking === true && rested.restCount === 1, rested);
    check(label, "rest/stop", "rest overlay shows the 放下雙手、放鬆肩膀 instruction",
      rested.body.includes("放下雙手") && rested.body.includes("放鬆肩膀"), { body: rested.body });

    const beforeResume = await state(page);
    await advance(page, 1200);
    const stillPaused = await state(page);
    check(label, "rest/stop", "game clock does not run while resting",
      stillPaused.timeLeft === beforeResume.timeLeft,
      { before: beforeResume.timeLeft, after: stillPaused.timeLeft });

    const resumed = await page.evaluate(() => window.__qa.safety.resumeRest());
    check(label, "rest/stop", "resume from rest is explicit and clears the pause",
      resumed.paused === false && resumed.blocking === false, resumed);

    const stopped = await page.evaluate(() => window.__qa.safety.stop("participant_request"));
    check(label, "rest/stop", "stop ends the session safely with a recorded reason",
      stopped.stoppedEarly === true && stopped.stopReason === "participant_request"
      && stopped.screen !== "game", stopped);

    const testids = await page.evaluate(() => ({
      rest: !!document.querySelector('[data-testid="button-game-rest"]'),
      stop: !!document.querySelector('[data-testid="button-game-stop"]'),
      pause: !!document.querySelector('[data-testid="panel-safety-pause"]'),
      confirm: !!document.querySelector('[data-testid="panel-stop-confirm"]'),
    }));
    check(label, "rest/stop", "stable data-testid attributes exist for the safety controls",
      testids.rest && testids.stop && testids.pause && testids.confirm, testids);
  }

  // Level 4 therapist-confirmed compensation prompt (manual observation only).
  await start(page, "4");
  const firstComp = await page.evaluate(() => window.__qa.safety.compensation("shoulder_hiking"));
  check("4", "compensation", "a single observed compensation is logged without pausing",
    firstComp.counts.shoulder_hiking === 1 && firstComp.blocking === false, firstComp);
  const secondComp = await page.evaluate(() => window.__qa.safety.compensation("shoulder_hiking"));
  check("4", "compensation", "the same compensation observed twice pauses and prompts a shorter distance",
    secondComp.counts.shoulder_hiking === 2 && secondComp.blocking === true
    && secondComp.alert.includes("縮短滑行距離"), secondComp);

  // Level 5 maximum hold duration.
  await start(page, "5");
  await page.evaluate(() => window.__qa.safety.holdStart());
  const beforeTimeout = await page.evaluate(() => window.__qa.safety.holdCheck());
  check("5", "hold timeout", "carrying below the maximum duration does not interrupt play",
    beforeTimeout.fired === false && beforeTimeout.blocking === false, beforeTimeout);
  await advance(page, 5200);
  const afterTimeout = await page.evaluate(() => window.__qa.safety.holdCheck());
  check("5", "hold timeout", "exceeding the maximum carry duration pauses the game",
    afterTimeout.fired === true && afterTimeout.blocking === true
    && afterTimeout.holdTimeoutCount === 1, afterTimeout);
  check("5", "hold timeout", "hold timeout prompts 放下物件、張開手、放鬆",
    afterTimeout.title.includes("放下物件") && afterTimeout.title.includes("張開手")
    && afterTimeout.title.includes("放鬆"), { title: afterTimeout.title });
  const timeoutLogged = (await state(page)).safety.holdTimeoutCount;
  check("5", "hold timeout", "hold_timeout is tracked in the session safety data",
    timeoutLogged === 1, { holdTimeoutCount: timeoutLogged });

  // Level 5 repeated release difficulty.
  await start(page, "5");
  let releaseResult = null;
  for (let attempt = 0; attempt < safetyConstants.releaseDifficultyLimit; attempt += 1) {
    releaseResult = await page.evaluate(
      () => window.__qa.safety.releaseAttempt(3500, false),
    );
  }
  check("5", "release difficulty", "consecutive delayed or failed releases are counted",
    releaseResult.releaseDelayCount === safetyConstants.releaseDifficultyLimit, releaseResult);
  check("5", "release difficulty", "repeated release difficulty pauses and prompts reassessment",
    releaseResult.repeated === 1 && releaseResult.blocking === true
    && releaseResult.title.includes("放手"), releaseResult);

  // Camera failures must always surface an in-page error with Retry and Return.
  const cameraCases = [
    ["UnsupportedError", "不支援"],
    ["NotAllowedError", "權限"],
    ["NotFoundError", "找不到"],
    ["SomeUnexpectedError", "未能啟動相機"],
  ];
  for (const [name, expected] of cameraCases) {
    const shown = await page.evaluate(errName => window.__qa.safety.cameraError(errName), name);
    check("4", "camera error", `${name} shows an in-page error with Retry and Return`,
      shown.visible === true && shown.hasRetry && shown.hasReturn
      && shown.message.includes(expected), shown);
    check("4", "camera error", `${name} shows a concise technical code without a raw stack`,
      shown.detail.includes(name) && shown.detail.length < 40, { detail: shown.detail });
    const cleared = await page.evaluate(() => window.__qa.safety.clearCameraError());
    check("4", "camera error", `${name} error can be dismissed on retry`,
      cleared.visible === false, cleared);
  }

  // Session data fields required by the safety review.
  await start(page, "5");
  const safetyFields = (await state(page)).safety;
  const requiredFields = ["restCount", "restTotalSec", "stopReason", "stoppedEarly",
    "trackingFailureCount", "holdTimeoutCount", "releaseDelayCount",
    "repeatedReleaseDifficulty", "difficultyReducedCount"];
  const missingFields = requiredFields.filter(field => !(field in safetyFields));
  check("5", "data", "session safety fields are present for export",
    missingFields.length === 0, { missing: missingFields });

} catch (error) {
  errors.push({ level: "all", category: "runner", name: error.stack || error.message, passed: false, details: {} });
} finally {
  await browser.close();
}

const result = {
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  scope: "Independent technical verification for FTHUE Levels 4, 5, and 6",
  limitation: "Not clinical validation; Level 6 aperture detection does not measure pinch force.",
  summary: {
    total: tests.length + errors.filter(error => !tests.includes(error)).length,
    passed: tests.filter(test => test.passed).length,
    failed: errors.length,
    by_level: Object.fromEntries(["4", "5", "6"].map(level => [
      level,
      {
        passed: tests.filter(test => test.level === level && test.passed).length,
        failed: tests.filter(test => test.level === level && !test.passed).length,
      },
    ])),
  },
  tests,
  runtime_errors: errors.filter(error => !tests.includes(error)),
};

fs.writeFileSync(path.join(outputDir, "level4-6-validation-results.json"), `${JSON.stringify(result, null, 2)}\n`);
const lines = [
  "# Level 4–6 Technical Validation Report",
  "",
  `Generated: ${result.generated_at}`,
  "",
  `Result: **${result.summary.failed === 0 ? "PASS" : "FAIL"}** (${result.summary.passed}/${result.summary.total} checks passed)`,
  "",
  "| FTHUE level | Passed | Failed |",
  "|---|---:|---:|",
  ...["4", "5", "6"].map(level => `| ${level} | ${result.summary.by_level[level].passed} | ${result.summary.by_level[level].failed} |`),
  "",
  "## Verified scope",
  "",
  "- Six-theme launch matrix and correct engine selection.",
  "- Level-specific gesture or dwell thresholds and full placement flows.",
  "- Correct versus incorrect placement accounting.",
  "- Tracking-loss grace and sustained-loss reset.",
  "- Malformed hand-landmark fail-safe behaviour.",
  "- Mandatory safety acknowledgement gate for Levels 3\u20136.",
  "- Always-visible rest and stop controls, rest pausing active timing, and safe stop.",
  "- Therapist-confirmed compensation prompt, Level 5 hold timeout and repeated release difficulty.",
  "- In-page camera failure handling with Retry and Return for every getUserMedia error class.",
  "",
  "## Interpretation boundary",
  "",
  "This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. Level 6 measures normalized thumb-index aperture state and does not measure pinch force. Compensation, muscle tone and spasticity are never detected automatically: they are therapist observations entered manually. Safety-control behaviour verified here is software behaviour only and still requires supervised bedside testing on the target iPad.",
  "",
  "## Checks",
  "",
  ...tests.map(test => `- ${test.passed ? "PASS" : "FAIL"} | Level ${test.level} | ${test.category} | ${test.name}`),
  ...result.runtime_errors.map(error => `- FAIL | Runtime | ${error.name}`),
  "",
];
fs.writeFileSync(path.join(outputDir, "level4-6-validation-report.md"), `${lines.join("\n")}\n`);
console.log(JSON.stringify(result.summary, null, 2));
if (result.summary.failed > 0) process.exit(1);
