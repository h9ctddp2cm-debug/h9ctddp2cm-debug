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
    graspJitterHold: window.__qa.gestureProbe.grasp([1, 0.82, 0.82, 1, 1], true, "any"),
    graspRelease: window.__qa.gestureProbe.grasp([0.8, 1, 1, 1, 0.8], true, "any"),
    pinchEnter: window.__qa.gestureProbe.pinch(0.30, false),
    pinchHysteresisHold: window.__qa.gestureProbe.pinch(0.45, true),
    pinchExit: window.__qa.gestureProbe.pinch(0.58, true),
    pinchOpen: window.__qa.gestureProbe.pinch(0.70, false),
    invalidGrasp: window.__qa.gestureProbe.invalid("grasp"),
    invalidPinch: window.__qa.gestureProbe.invalid("pinch"),
  }));
  check("5", "gesture", "one curled finger cannot trigger grasp", !gestures.graspOneFinger.isGrasping, gestures.graspOneFinger);
  check("5", "gesture", "two curled fingers trigger configured grasp", gestures.graspTwoFingers.isGrasping, gestures.graspTwoFingers);
  check("5", "gesture", "partial reopening does not release held item", gestures.graspJitterHold.isGrasping, gestures.graspJitterHold);
  check("5", "gesture", "three open major fingers release held item", !gestures.graspRelease.isGrasping, gestures.graspRelease);
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
  "",
  "## Interpretation boundary",
  "",
  "This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. Level 6 measures normalized thumb-index aperture state and does not measure pinch force.",
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
