import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
// Runtime evidence belongs outside the source tree.  Set QA_OUT_DIR when
// invoking this runner; retaining the local directory as a compatibility
// fallback keeps the standalone sandbox usable.
const outputDir = process.env.QA_OUT_DIR || path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(outputDir, { recursive: true });
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

function itemsDoNotCoverTargets(items, targets) {
  return items.every(item => targets.every(target => {
    const left = target.x - target.w / 2;
    const right = target.x + target.w / 2;
    const top = target.y - target.h / 2;
    const bottom = target.y + target.h / 2;
    const nearestX = Math.max(left, Math.min(item.x, right));
    const nearestY = Math.max(top, Math.min(item.y, bottom));
    return Math.hypot(item.x - nearestX, item.y - nearestY) >= item.r;
  }));
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

/* ---- Level 4 two-pose calibration helpers -------------------------------
   Level 4 needs two deliberate therapist-labelled fresh poses: flexed/start
   first, then extended/end.  The helper deliberately uses one fresh decoded
   generation for each visible pose and taps the same manual-capture API used by
   the bedside buttons; it never relies on retired automatic/preflight capture. */
const level4StartPose = {
  shoulder:{x:.45,y:.30,z:0}, elbow:{x:.45,y:.48,z:0},
  wrist:{x:.58,y:.48,z:0}, otherShoulder:{x:.60,y:.30,z:0},
};
const level4ReachPose = {
  shoulder:{x:.45,y:.30,z:0}, elbow:{x:.54,y:.35,z:-.10},
  wrist:{x:.74,y:.36,z:-.30}, otherShoulder:{x:.60,y:.30,z:0},
};

/* Category 2 outward arc: the elbow stays at the calibrated extended endpoint
   while the shoulder abducts to the patient's affected side. */
const level4ArcPose = {
  shoulder:{x:.45,y:.30,z:0}, elbow:{x:.34,y:.33,z:-.12},
  wrist:{x:.22,y:.34,z:-.26}, otherShoulder:{x:.60,y:.30,z:0},
};
// Same lateral position, but the elbow has folded back into flexion.
const level4ArcFlexedPose = {
  shoulder:{x:.45,y:.30,z:0}, elbow:{x:.33,y:.48,z:0},
  wrist:{x:.46,y:.48,z:0}, otherShoulder:{x:.60,y:.30,z:0},
};

async function level4Pose(page, pose, frames = 1) {
  return page.evaluate(
    ({ pose, frames }) => window.__qa.setLevel4Pose({ ...pose, frames }),
    { pose, frames },
  );
}

async function markLevel4Endpoint(page, which) {
  return page.evaluate((endpoint) => {
    const before = window.__qa.level4ReachState();
    const after = window.__qa.level4ManualCapture(endpoint);
    return {
      endpoint,
      marked: after.manual?.[endpoint] === true
        && after.captureCount?.[endpoint] === (before.captureCount?.[endpoint] || 0) + 1,
      before,
      after,
    };
  }, which);
}

async function calibrateLevel4(page, flexedPose = level4StartPose, extendedPose = level4ReachPose) {
  await level4Pose(page, flexedPose);
  const flexed = await markLevel4Endpoint(page, "flexed");
  await level4Pose(page, extendedPose);
  const extended = await markLevel4Endpoint(page, "extended");
  const ready = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "fresh flexed therapist mark succeeds exactly once",
    flexed.marked && flexed.after.captureCount.flexed === 1
      && flexed.after.captureCount.extended === 0
      && flexed.after.frame.fresh === true,
    flexed);
  check("4", "two-pose calibration", "fresh extended therapist mark succeeds exactly once",
    extended.marked && extended.after.captureCount.flexed === 1
      && extended.after.captureCount.extended === 1
      && extended.after.frame.fresh === true,
    extended);
  check("4", "two-pose calibration", "two fresh marks make Level 4 calibrated and game-ready",
    ready.calibrated === true && ready.gameReady === true
      && ready.captureCount.flexed === 1 && ready.captureCount.extended === 1,
    ready);
  // Returning to the flexed endpoint leaves the participant at progress 0.
  const returned = await level4Pose(page, flexedPose, 14);
  return { flexed, extended, ready, returned };
}

// In production, each decoded pose is followed immediately by its game tick.
// advanceTime deliberately repeats the current generation and therefore cannot
// progress an idempotent Level 4 dwell. This helper advances the virtual clock
// between distinct fresh pose admissions, which is the observable camera
// equivalent of holding a still arm through several decoded frames.
async function holdLevel4Pose(page, pose, milliseconds, samples = 4) {
  const slice = milliseconds / Math.max(1, samples);
  for (let sample = 0; sample < samples; sample += 1) {
    await advance(page, slice);
    await level4Pose(page, pose);
  }
}

async function performPlacement(page, level, correct) {
  let before = await state(page);
  const item = before.items[0];
  const target = before.targets.find(t => correct ? t.type === item.type : t.type !== item.type);
  if (!item || !target) throw new Error(`Missing ${correct ? "matching" : "mismatching"} item/target`);

  if (level === "4") {
    await calibrateLevel4(page);
    before = await state(page);
    await position(page, item, false, true);
    await holdLevel4Pose(page, level4StartPose, 900);
    check("4", "flow", "dwell pickup acquires an item", (await state(page)).held !== null);
    await level4Pose(page, level4ReachPose, 12);
    await position(page, target, false, true);
    await holdLevel4Pose(page, level4ReachPose, 900);
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
  for (const level of Object.keys(expectedTypes)) {
    const themes = await page.evaluate(
      requestedLevel => window.__qa.themes(requestedLevel).map(theme => theme.id),
      level,
    );
    for (const theme of themes) {
      const launch = await start(page, level, theme);
      check(displayLevel[level], "launch matrix", `${theme} launches with the correct engine`,
        launch.screen === "game" &&
        launch.level === level &&
        launch.gameType === expectedTypes[level] &&
        itemsDoNotOverlap(launch.items) &&
        itemsDoNotCoverTargets(launch.items, launch.targets),
        {
          screen: launch.screen,
          engine: launch.gameType,
          non_overlapping_items: itemsDoNotOverlap(launch.items),
          targets_visible: itemsDoNotCoverTargets(launch.items, launch.targets),
        });
    }
  }

  const gestures = await page.evaluate(() => ({
    graspOneFinger: window.__qa.gestureProbe.grasp([0.6, 1, 1, 1, 1], false, "any"),
    graspTwoFingers: window.__qa.gestureProbe.grasp([0.6, 0.6, 1, 1, 1], false, "any"),
    graspOneFingerReopen: window.__qa.gestureProbe.grasp([0.82, 0.82, 0.82, 1, 0.82], true, "any"),
    graspTwoFingerRelease: window.__qa.gestureProbe.grasp([0.82, 1, 1, 0.82, 0.82], true, "any"),
    pinchEnter: window.__qa.gestureProbe.pinch(0.30, false),
    pinchHysteresisHold: window.__qa.gestureProbe.pinch(0.45, true),
    pinchExit: window.__qa.gestureProbe.pinch(0.70, true),
    pinchOpen: window.__qa.gestureProbe.pinch(0.76, false),
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

  const level4JitterPose = {
    ...level4StartPose,
    wrist:{x:.58,y:.49,z:0},
  };
  const level4PartialExtensionPose = {
    shoulder:{x:.45,y:.30,z:0}, elbow:{x:.45,y:.48,z:0},
    wrist:{x:.58,y:.56,z:0}, otherShoulder:{x:.60,y:.30,z:0},
  };
  const level4ForwardFlexedPose = {
    // Keep the wrist forward in camera space while the elbow clearly flexes.
    // This reproduces the difficult front-facing iPad return case.
    shoulder:{x:.45,y:.30,z:0}, elbow:{x:.60,y:.50,z:-.05},
    wrist:{x:.74,y:.36,z:-.30}, otherShoulder:{x:.60,y:.30,z:0},
  };
  const level4HikePose = {
    shoulder:{x:.45,y:.22,z:0}, elbow:{x:.45,y:.40,z:0},
    wrist:{x:.58,y:.40,z:0}, otherShoulder:{x:.60,y:.30,z:0},
  };
  const level4OccludedStartPose = {
    ...level4StartPose,
    otherShoulder:{x:.60,y:.30,z:0,visibility:.01},
  };
  const level4OccludedReachPose = {
    ...level4ReachPose,
    otherShoulder:{x:.60,y:.30,z:0,visibility:.01},
  };
  await start(page, "4");
  await calibrateLevel4(page);
  const level4Baseline = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "flexed then extended capture calibrates and returns to progress 0",
    level4Baseline.calibrated && level4Baseline.stage === "ready"
    && level4Baseline.progress === 0
    && level4Baseline.captureCount.flexed === 1 && level4Baseline.captureCount.extended === 1
    && level4Baseline.qualified.length === 1 && level4Baseline.qualified[0] === "angle",
    level4Baseline);

  // A visible flexed pose without its deliberate therapist mark must never
  // calibrate silently or pretend the endpoint was captured.
  await start(page, "4");
  await level4Pose(page, level4StartPose, 16);
  const level4FlexedOnly = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "unmarked flexed pose waits for the explicit flexed therapist capture",
    level4FlexedOnly.calibrated === false && level4FlexedOnly.stage === "capture-flexed"
    && level4FlexedOnly.reason === "awaiting-flexed-capture"
    && level4FlexedOnly.captureCount.flexed === 0 && level4FlexedOnly.captureCount.extended === 0
    && level4FlexedOnly.retryCount === 0 && level4FlexedOnly.progress === 0,
    level4FlexedOnly);

  // Two nearly identical labelled poses must keep the flexed capture and ask
  // only for the extended endpoint again, without a hidden retry state.
  await start(page, "4");
  await level4Pose(page, level4StartPose);
  const retryFlexedMark = await markLevel4Endpoint(page, "flexed");
  await level4Pose(page, {
    ...level4StartPose,
    wrist:{x:.58,y:.488,z:0},
  });
  const retryExtendedMark = await markLevel4Endpoint(page, "extended");
  const level4Retry = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "insufficient endpoint separation requests a retry with diagnostics",
    retryFlexedMark.marked && !retryExtendedMark.marked
    && level4Retry.calibrated === false && level4Retry.gameReady === false
    && level4Retry.stage === "capture-extended"
    && level4Retry.reason === "angle-separation-too-small"
    && level4Retry.lacking.length === 1 && level4Retry.guidance.main.length > 0,
    { retryFlexedMark, retryExtendedMark, level4Retry });

  // Compact therapist fallback: two buttons mark the current pose as either
  // endpoint when automatic capture struggles.
  await start(page, "4");
  await level4Pose(page, level4StartPose, 6);
  await page.evaluate(() => window.__qa.level4ManualCapture("flexed"));
  await level4Pose(page, level4ReachPose, 6);
  await page.evaluate(() => window.__qa.level4ManualCapture("extended"));
  await level4Pose(page, level4ReachPose, 4);
  const level4Manual = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "therapist buttons mark both endpoints manually",
    level4Manual.calibrated && level4Manual.manual.flexed === true
    && level4Manual.manual.extended === true && level4Manual.reason === "ready"
    && level4Manual.captureCount.flexed === 1 && level4Manual.captureCount.extended === 1
    && level4Manual.progress > 0.90, level4Manual);
  await level4Pose(page, level4StartPose, 10);
  const level4ManualReturn = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "two-pose calibration", "manual calibration still returns to 0 at the flexed endpoint",
    level4ManualReturn.progress < 0.05, level4ManualReturn);

  await start(page, "4");
  await calibrateLevel4(page);
  await level4Pose(page, level4JitterPose, 10);
  const level4Jitter = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "drift guard", "small elbow-angle jitter cannot move the object by itself",
    !level4Jitter.engaged && level4Jitter.progress < 0.10
    && !level4Jitter.completionReady, level4Jitter);
  await level4Pose(page, level4PartialExtensionPose, 10);
  const level4Partial = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "completion gate", "partial elbow extension moves upward but cannot complete placement",
    level4Partial.engaged && level4Partial.progress > 0.20
    && level4Partial.progress < 0.90 && !level4Partial.completionReady,
    level4Partial);

  await start(page, "4");
  await calibrateLevel4(page);
  await level4Pose(page, level4HikePose, 3);
  const level4Hike = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "compound movement", "shoulder elevation alone cannot change direct elbow-angle progress",
    level4Hike.progress < 0.02 && level4Hike.shoulderHike === false
    && level4Hike.warning === "", level4Hike);

  await start(page, "4");
  await calibrateLevel4(page);
  await level4Pose(page, level4ReachPose, 10);
  const level4Forward = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "compound movement", "elbow extension moves the object upward without a secondary shoulder gate",
    level4Forward.progress > 0.90 && level4Forward.elbowAngle > 140
    && level4Forward.shoulderHike === false, level4Forward);
  await level4Pose(page, level4ForwardFlexedPose, 12);
  const level4ElbowReturn = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "compound movement", "elbow flexion lowers the object while the wrist remains forward",
    level4ElbowReturn.progress < 0.08 && level4ElbowReturn.elbowAngle < 100,
    level4ElbowReturn);
  await level4Pose(page, level4StartPose, 12);
  const level4Return = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "compound movement", "elbow flexion returns the object downward without a secondary shoulder gate",
    level4Return.progress < 0.02 && level4Return.elbowAngle < 100
    && level4Return.shoulderHike === false, level4Return);

  // Every Level 4 theme shares one elbow interpretation: extension advances a
  // fixed-X on-screen guide upward, and flexion returns it downward. The three
  // path/precision games retain their real wrist input, but elbow motion itself
  // cannot inject a horizontal cursor displacement.
  for (const theme of ["dimsum", "wipewindow", "bowling", "mahjongwash", "buspay"]) {
    await start(page, "4", theme);
    await calibrateLevel4(page);
    // The calibration sequence itself is one reach-return cycle, so clear any
    // mini-game state it advanced before probing the mapping.
    await page.evaluate(() => window.__level4MiniGamesQA?.reset?.());
    const fixedWristPoint = { x: 112, y: 156 };
    await position(page, fixedWristPoint, false, true);
    await advance(page, 80);
    await level4Pose(page, level4ReachPose, 10);
    const extended = await page.evaluate(() => ({
      reach: window.__qa.level4ReachState(),
      transport: window.__qa.level4TransportState(),
      bowling: {...window.__level4MiniGamesQA.state.bowling},
    }));
    await level4Pose(page, level4ForwardFlexedPose, 12);
    const flexed = await page.evaluate(() => ({
      reach: window.__qa.level4ReachState(),
      transport: window.__qa.level4TransportState(),
      bowling: {...window.__level4MiniGamesQA.state.bowling},
    }));
    const bowlingMovesVertically = theme !== "bowling"
      || (extended.bowling.phase === "return" && extended.bowling.armProgress > 0.80
        && flexed.bowling.phase === "rolling");
    check("4", "vertical elbow mapping",
      `${theme} maps extension upward and flexion downward without elbow-driven horizontal drift`,
      extended.reach.screenForward.y < flexed.reach.screenForward.y - 80
      && Math.abs(extended.reach.screenForward.x - flexed.reach.screenForward.x) < 0.001
      && Math.abs(extended.transport.rawCursor.x - fixedWristPoint.x) < 1
      && Math.abs(flexed.transport.rawCursor.x - fixedWristPoint.x) < 1
      && bowlingMovesVertically,
      { fixedWristPoint, extended, flexed });
  }

  // Held ordinary Level 4 items use a virtual carry lane after selection.
  // The raw wrist cursor remains available before pickup, then elbow progress
  // alone drives vertical transport so front-facing camera X drift cannot pull
  // an item sideways.
  await start(page, "4", "dimsum", 300);
  await calibrateLevel4(page);
  const unheldProbe = await state(page);
  const unheldRawPoint = {
    x: Math.round(unheldProbe.items[0].x - 95),
    y: Math.round(unheldProbe.items[0].y + 8),
  };
  await position(page, unheldRawPoint, false, true);
  await advance(page, 80);
  const unheldCursor = await page.evaluate(() => window.__qa.level4TransportState());
  check("4", "elbow carry", "unheld Level 4 cursor remains the real wrist point for item selection",
    unheldCursor.held === null
    && Math.abs(unheldCursor.rawCursor.x - unheldRawPoint.x) < 1
    && Math.abs(unheldCursor.rawCursor.y - unheldRawPoint.y) < 1
    && Math.abs(unheldCursor.displayCursor.x - unheldRawPoint.x) < 1,
    unheldCursor);

  const pickup = (await state(page)).items[0];
  await page.evaluate(() => window.__qa.snapCursor());
  await position(page, pickup, false, true);
  // Establish the ordinary stillness window with distinct fresh poses, begin
  // the dwell on that admitted image, then let time pass without admitting a
  // duplicate frame before the final fresh pose completes it.
  for (let sample = 0; sample < 4; sample += 1) {
    await level4Pose(page, level4StartPose);
    await advance(page, 100);
  }
  await advance(page, 760);
  await level4Pose(page, level4StartPose);
  const heldStart = await page.evaluate(() => window.__qa.level4TransportState());
  check("4", "elbow carry", "ordinary Level 4 pickup captures a stable carry lane",
    heldStart.held !== null && heldStart.carry !== null
    && Math.abs(heldStart.held.x - heldStart.carry.laneX) < 0.001,
    heldStart);

  const leftDriftPoint = {
    x: Math.max(20, Math.round(heldStart.rawCursor.x - 240)),
    y: Math.round(heldStart.rawCursor.y),
  };
  await position(page, leftDriftPoint, false, true);
  await level4Pose(page, level4ReachPose, 10);
  await advance(page, 120);
  const heldExtended = await page.evaluate(() => window.__qa.level4TransportState());
  check("4", "elbow carry", "held standard Level 4 item keeps its fixed carry X across elbow extension",
    heldExtended.held !== null
    && Math.abs(heldExtended.held.x - heldStart.carry.laneX) < 0.001
    && heldExtended.rawCursor.x < heldStart.rawCursor.x - 100,
    { heldStart, heldExtended });
  check("4", "elbow carry", "held standard Level 4 item moves upward on elbow extension",
    heldExtended.held.y < heldStart.held.y - 20
    && heldExtended.reachProgress > heldStart.reachProgress + 0.50,
    { heldStart, heldExtended });

  await level4Pose(page, level4ForwardFlexedPose, 12);
  await advance(page, 120);
  const heldFlexed = await page.evaluate(() => window.__qa.level4TransportState());
  check("4", "elbow carry", "held standard Level 4 item moves downward on elbow flexion",
    heldFlexed.held !== null
    && Math.abs(heldFlexed.held.x - heldStart.carry.laneX) < 0.001
    && heldFlexed.held.y > heldExtended.held.y + 20
    && heldFlexed.reachProgress < heldExtended.reachProgress - 0.50,
    { heldExtended, heldFlexed });

  await start(page, "4", "wipewindow");
  await calibrateLevel4(page);
  const wipeRawPoint = { x: 318, y: 472 };
  await position(page, wipeRawPoint, false, true);
  await level4Pose(page, level4ReachPose, 8);
  await advance(page, 80);
  const wipeCursor = await page.evaluate(() => window.__qa.level4TransportState());
  check("4", "independent mechanics", "wipe-window keeps the real wrist path rather than a carry lane",
    wipeCursor.standardTransport === false && wipeCursor.carry === null
    && Math.abs(wipeCursor.displayCursor.x - wipeCursor.rawCursor.x) < 0.001
    && Math.abs(wipeCursor.rawCursor.x - wipeRawPoint.x) < 1,
    wipeCursor);

  // --- Category 2 ordered cycle, driven by real synthetic poses -----------
  await start(page, "4", "wipewindow");
  await calibrateLevel4(page);
  await level4Pose(page, level4ReachPose, 10);
  const arcBeforeReach = await page.evaluate(() => window.__qa.level4ReachState());
  await level4Pose(page, level4ArcPose, 10);
  const arcOut = await page.evaluate(() => window.__qa.level4ReachState());
  await level4Pose(page, level4ArcFlexedPose, 8);
  const arcFlexed = await page.evaluate(() => window.__qa.level4ReachState());
  await level4Pose(page, level4ReachPose, 8);
  await level4Pose(page, level4StartPose, 12);
  const arcCycleEnd = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "ordered arc cycle",
    "shoulder abduction activates the lateral signal only after the calibrated extension, holds reach steady, pauses on elbow flexion and ends at the flexed start",
    arcBeforeReach.arcActive === false
    && arcOut.arcActive === true
    && arcOut.progress > 0.70
    && arcFlexed.arcActive === false
    // Arc movement may remain visible as a diagnostic value after flexion, but
    // it must no longer authorise path credit or rewrite direct angle progress.
    && arcFlexed.progress < 0.05
    && arcFlexed.reachGate === false
    && arcCycleEnd.progress < 0.25,
    { arcBeforeReach, arcOut, arcFlexed, arcCycleEnd });

  await start(page, "4", "bowling");
  const bowlingCycle = await page.evaluate(() => {
    window.__level4MiniGamesQA.reset();
    window.__level4MiniGamesQA.bowling({
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:401,
      shoulderHike:false, engaged:true, progress:.72,
      reachGate:true, returnReady:false, completionReady:false,
    });
    window.__level4MiniGamesQA.bowling({
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:402,
      shoulderHike:false, engaged:true, progress:.12,
      reachGate:false, returnReady:true, completionReady:true,
    });
    return window.__level4MiniGamesQA.state.bowling;
  });
  check("4", "independent mechanics", "bowling continues to consume the reach-return progress cycle",
    bowlingCycle.phase === "rolling" && bowlingCycle.peak >= .72, bowlingCycle);

  await start(page, "4", "mahjongwash");
  const mahjongPath = await page.evaluate(() => {
    window.__level4MiniGamesQA.reset();
    const reachOnly = {
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:411,
      engaged:true, shoulderHike:false,
      progress:.92, elbowExtensionProgress:.92, reachGate:true, returnReady:false,
      cyclePhase:'reached', arcCalibrated:true, arcProgress:0, arcActive:false,
    };
    window.__level4MiniGamesQA.mahjong(reachOnly, .24, .34);
    window.__level4MiniGamesQA.mahjong({...reachOnly, frameGeneration:412}, .31, .40);
    const linearOnly = {...window.__level4MiniGamesQA.state.mahjong};
    window.__level4MiniGamesQA.reset();
    const onArc = {
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:421,
      engaged:true, shoulderHike:false,
      progress:.92, elbowExtensionProgress:.92, reachGate:true, returnReady:false,
      cyclePhase:'arc-out', arcCalibrated:true, arcProgress:.7, arcActive:true,
    };
    window.__level4MiniGamesQA.mahjong(onArc, .24, .34);
    window.__level4MiniGamesQA.mahjong({...onArc, frameGeneration:422}, .31, .40);
    return { linearOnly, onArc:{...window.__level4MiniGamesQA.state.mahjong} };
  });
  check("4", "independent mechanics",
    "mahjong-wash requires extension then the side-correct arc before washing",
    mahjongPath.linearOnly.progress === 0
    && mahjongPath.onArc.progress > 0 && mahjongPath.onArc.lastPoint?.x === .31,
    mahjongPath);

  await start(page, "4", "buspay");
  const busPrecision = await page.evaluate(() => {
    window.__level4MiniGamesQA.reset();
    const target = { x:.50, y:.43 };
    const reachOnly = {
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:431,
      shoulderHike:false, engaged:true,
      progress:.92, elbowExtensionProgress:.92, reachGate:true, returnReady:false,
      cyclePhase:'reached', arcCalibrated:true, arcProgress:0, arcActive:false,
    };
    for (let index = 0; index < 8; index += 1) {
      window.__level4MiniGamesQA.bus({...reachOnly, frameGeneration:431 + index}, target.x, target.y);
    }
    const linearOnly = {...window.__level4MiniGamesQA.state.bus};
    const onArc = {
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:451,
      shoulderHike:false, engaged:true,
      progress:.92, elbowExtensionProgress:.92, reachGate:true, returnReady:false,
      cyclePhase:'arc-out', arcCalibrated:true, arcProgress:.7, arcActive:true,
    };
    for (let index = 0; index < 8; index += 1) {
      window.__level4MiniGamesQA.bus({...onArc, frameGeneration:451 + index}, target.x, target.y);
    }
    const tapped = {...window.__level4MiniGamesQA.state.bus};
    // A held pose must not beep twice; only a return to the flexed start re-arms.
    for (let index = 0; index < 12; index += 1) {
      window.__level4MiniGamesQA.bus({...onArc, frameGeneration:459 + index}, target.x, target.y);
    }
    return { linearOnly, tapped, held:{...window.__level4MiniGamesQA.state.bus} };
  });
  check("4", "independent mechanics",
    "bus-pay taps once per ordered reach-then-arc cycle at the reader",
    busPrecision.linearOnly.hitCount === 0
    && busPrecision.tapped.hitCount === 1 && busPrecision.tapped.beepCount === 1
    && busPrecision.tapped.armed === false
    && busPrecision.held.beepCount === 1,
    busPrecision);

  await start(page, "4");
  await calibrateLevel4(page, level4OccludedStartPose, level4OccludedReachPose);
  await level4Pose(page, level4OccludedReachPose, 10);
  const level4OccludedReach = await page.evaluate(() => window.__qa.level4ReachState());
  check("4", "table occlusion", "affected elbow extension remains playable when the opposite shoulder is hidden",
    level4OccludedReach.framingReady && level4OccludedReach.progress > 0.80,
    level4OccludedReach);

  for (const level of ["4", "5", "67"]) {
    const label = displayLevel[level];
    await start(page, level);
    const correct = await performPlacement(page, level, true);
    check(label, "flow", "correct placement increments the correct count",
      correct.after.correctCount === correct.before.correctCount + 1 && correct.after.held === null,
      { before: correct.before.correctCount, after: correct.after.correctCount });

    // Level 4 deliberately uses the picked item's matching fixed carry lane:
    // raw wrist X cannot steer a held item onto a different plate. Levels 5–7
    // retain their independent free-cursor wrong-placement behaviour.
    if (level !== "4") {
      await start(page, level);
      const wrong = await performPlacement(page, level, false);
      check(label, "flow", "wrong placement increments only the wrong count",
        wrong.after.correctCount === wrong.before.correctCount &&
        wrong.after.wrongCount === wrong.before.wrongCount + 1 &&
        wrong.after.held === null,
        { correct: wrong.after.correctCount, wrong: wrong.after.wrongCount });
    }

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
  check("6", "safety copy", "Level 6 note specifies off-table reach and all three light-operation modes",
    notes["67"].includes("手臂離桌") && notes["67"].includes("三指輕捏")
    && notes["67"].includes("夾仔") && notes["67"].includes("筷子")
    && notes["67"].includes("只需輕力"),
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
  "- Level-filtered launch matrix and correct engine selection.",
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
