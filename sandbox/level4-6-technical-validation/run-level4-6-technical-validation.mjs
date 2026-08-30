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
    ({ level, theme, dwellMs }) => {
      const level6Task = level === "67"
        ? ({ chopstick_dimsum: "chopsticks", peg_laundry: "peg" }[theme] || theme)
        : undefined;
      window.__qa.startGame({
        level, theme, level6Task, mode: "basic", duration: 180, dwellMs, affectedSide: "right",
      });
    },
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

/* ---- Level 4 calibration helpers -----------------------------------------
   Linear games use flexed/start then extended/end. Path games deliberately add
   one held-elbow horizontal endpoint; the helper uses the same explicit manual
   fallback API as the bedside buttons. */
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
  // Same selected-elbow angle as level4ReachPose while the upper arm moves
  // outward, so this is a true "keep elbow extended" horizontal endpoint.
  wrist:{x:.14,y:.29,z:-.26}, otherShoulder:{x:.60,y:.30,z:0},
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
  let ready = await page.evaluate(() => window.__qa.level4ReachState());
  let horizontal = null;
  if (ready.stage === "capture-horizontal") {
    await level4Pose(page, level4ArcPose);
    horizontal = await markLevel4Endpoint(page, "horizontal");
    ready = await page.evaluate(() => window.__qa.level4ReachState());
  }
  check("2", "two-pose calibration", "fresh flexed therapist mark succeeds exactly once",
    flexed.marked && flexed.after.captureCount.flexed === 1
      && flexed.after.captureCount.extended === 0
      && flexed.after.frame.fresh === true,
    flexed);
  check("2", "two-pose calibration", "fresh extended therapist mark succeeds exactly once",
    extended.marked && extended.after.captureCount.flexed === 1
      && extended.after.captureCount.extended === 1
      && extended.after.frame.fresh === true,
    extended);
  check("2", "two-pose calibration", "two fresh marks make Level 4 calibrated and game-ready",
    ready.calibrated === true && ready.gameReady === true
      && ready.captureCount.flexed === 1 && ready.captureCount.extended === 1,
    ready);
  // Returning to the flexed endpoint leaves the participant at progress 0.
  const returned = await level4Pose(page, flexedPose, 14);
  return { flexed, extended, horizontal, ready, returned };
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
    check("2", "flow", "dwell pickup acquires an item", (await state(page)).held !== null);
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
// Technical verification must read the supplied source/dist URL, not a
// previously installed PWA worker from another run.
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
const page = await context.newPage();
page.on("console", message => {
  if (message.type() === "error") errors.push({ level: "all", category: "console", name: message.text(), passed: false, details: {} });
});
page.on("pageerror", error => {
  errors.push({ level: "all", category: "pageerror", name: error.message, passed: false, details: {} });
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__qa && window.advanceTime, null, { timeout: 15000 });

  // Level 6 normal flow (internal id "67") uses selected affected-hand tripod
  // pinch for all six themes. Pose is not an interaction dependency.
  const expectedTypes = { "2": "dwell", "3": "dwell", "4": "dwell", "5": "grasp", "67": "pinch" };
  const displayLevel = { "2": "2", "3": "3", "4": "4", "5": "5", "67": "6" };
  for (const level of Object.keys(expectedTypes)) {
    const themes = await page.evaluate(
      requestedLevel => window.__qa.themes(requestedLevel).map(theme => theme.id),
      level,
    );
    for (const theme of themes) {
      const launch = await start(page, level, theme);
      const expectedType = expectedTypes[level];
      check(displayLevel[level], "launch matrix", `${theme} launches with the correct engine`,
        launch.screen === "game" &&
        launch.level === level &&
        launch.gameType === expectedType &&
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
  const level6Themes = await page.evaluate(() =>
    window.__qa.themes("67").map(theme => theme.id));
  check("6", "availability", "exact restored Level 6 catalog has six choices and no legacy duplicates",
    JSON.stringify(level6Themes) === JSON.stringify([
      "flowers", "chopstick_dimsum", "peg_laundry", "cards", "mahjong", "cooking",
    ]) && !level6Themes.includes("dimsum") && !level6Themes.includes("laundry"),
    { themes: level6Themes });

  const level6TaskByTheme = {
    flowers:"flowers", chopstick_dimsum:"chopsticks", peg_laundry:"peg",
    cards:"cards", mahjong:"mahjong", cooking:"cooking",
  };
  for (const [theme, task] of Object.entries(level6TaskByTheme)) {
    const locked = await page.evaluate(({theme,task}) => {
      window.__qa.selectLevel("67");
      window.__qa.selectActivity(theme);
      const setup = window.__qa.state();
      const title = document.getElementById("settingsTitle")?.textContent.trim() || "";
      const instructions = document.getElementById("settingsContext")?.textContent.trim() || "";
      document.querySelector('[data-side="right"]')?.click();
      const afterSide = window.__qa.state();
      window.__qa.startGame({duration:60,affectedSide:"right"});
      const launched = window.__qa.state();
      return {
        setup, afterSide, launched, title, instructions,
        taskCard:!!document.getElementById("level67ToolCard"),
        taskButtons:document.querySelectorAll("#screen-start [data-level6-task]").length,
        expectedTask:task,
      };
    }, {theme,task});
    check("6", "locked activity", `${theme} stays locked from library through setup and launch`,
      locked.setup.theme===theme && locked.setup.level6Task===task
      && locked.setup.level6LockedTheme===theme
      && locked.afterSide.theme===theme && locked.afterSide.level6Task===task
      && locked.launched.theme===theme && locked.launched.level6Task===task
      && locked.launched.level6LockedTheme===theme
      && locked.title.length>0 && locked.instructions.includes(locked.title)
      && !locked.taskCard && locked.taskButtons===0,
      locked);
  }

  for (const task of Object.values(level6TaskByTheme)) {
    const flow = await page.evaluate(taskId => {
      const send = (gesture, count, extra = {}) => {
        for (let index = 0; index < count; index++) {
          window.__qa.setLevel6ToolFrame({
            gesture, stepMs:120, poseMissing:["shoulder","elbow","wrist"], ...extra,
          });
        }
        return window.__qa.level6ToolState();
      };
      window.__qa.startGame({level:"67", level6Task:taskId, shoulderTargetDeg:90,
        duration:60, affectedSide:"right"});
      const layout=window.__qa.level67Layout();
      // v69: the chopstick activity is order-driven — items go to one central big
      // plate and only still-needed order types score.
      const neededTypes = layout.dimsumOrder
        ? layout.dimsumOrder.lines.filter(l=>l.placed<l.need).map(l=>l.type)
        : null;
      const pair=layout.items.map(item=>({item,target:neededTypes
        ? (neededTypes.includes(item.type)
          ? layout.targets.find(target=>target.type==="dimsum_plate")
          : null)
        : layout.targets.find(target=>target.type===item.type)}))
        .find(value=>value.target);
      if(!pair) throw new Error("No matching Level 6 item/target");
      const at=point=>({nx:point.x/layout.canvas.width,ny:point.y/layout.canvas.height});
      const prepared = send("open",5,at(pair.item));
      const picked = send("closed",5,{...at(pair.item),apertures:{index:.10,middle:.15}});
      const transported = send("closed",30,{...at(pair.target),apertures:{index:.10,middle:.15}});
      const released = send("open",8,at(pair.target));
      return {prepared,picked,transported,released,target:pair.target};
    }, task);
    check("6", "tripod pinch", `${task} requires open-light-close, hand transport, and reopen`,
      flow.prepared.handOpenPrep && flow.picked.grabCount === 1 && !!flow.picked.held
      && Math.hypot(flow.transported.heldPosition?.x-flow.target.x,
        flow.transported.heldPosition?.y-flow.target.y)<90
      && flow.transported.shoulder.gameReady===false
      && flow.released.held === null && flow.released.correctCount === 1,
      flow);

    const rejected = await page.evaluate(taskId => {
      const send = (gesture, count, extra = {}) => {
        for (let index = 0; index < count; index++) {
          window.__qa.setLevel6ToolFrame({gesture,stepMs:120,...extra});
        }
        return window.__qa.level6ToolState();
      };
      const start = () => window.__qa.startGame({level:"67",level6Task:taskId,
        shoulderTargetDeg:90,duration:60,affectedSide:"right"});
      start(); send("open",5); const generation=window.__qa.level6ToolState().frameGeneration;
      const stale=send("closed",6,{generation});
      start(); send("open",5); const wrong=send("closed",6,{handSide:"left"});
      start(); send("open",5);
      const partial=send("closed",6,{missingHand:[12]});
      start(); const staticClosed=send("closed",24);
      start(); send("open",5); const missingSide=send("closed",6,{handSide:"missing"});
      start(); send("open",5); const uncertainSide=send("closed",6,{handednessConfidence:.30});
      return {stale,wrong,partial,staticClosed,missingSide,uncertainSide};
    }, task);
    check("6", "tool safety", `${task} rejects stale, wrong-hand, partial and static-closed input`,
      Object.values(rejected).every(value => value.held === null && value.grabCount === 0)
      && !rejected.stale.handDetected && !rejected.wrong.handDetected
      && !rejected.partial.handDetected && !rejected.staticClosed.handOpenPrep,
      rejected);
  }

  const activityDifficultyLabels = await page.evaluate(() => {
    const result = [];
    for (const language of ["zh-Hant","en"]) {
      window.YCHLanguage.setLanguage(language);
      for (const level of ["2","3","4","5","67"]) {
        window.__qa.selectLevel(level);
        const cards=[...document.querySelectorAll("#activityGrid .activity-card")];
        result.push({language,level,count:cards.length,
          metadata:cards.filter(card=>card.querySelector(".ac-meta")).length,
          hasLabel:cards.some(card=>/難度|Difficulty/i.test(
            `${card.textContent} ${card.getAttribute("aria-label")||""}`))});
      }
    }
    return result;
  });
  check("6", "activity library", "no per-game difficulty label is rendered at any level in either language",
    activityDifficultyLabels.every(row=>row.count>0 && row.metadata===0 && !row.hasLabel),
    {rows:activityDifficultyLabels});

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
  // Pinch-probe checks below cover the preserved research-only bare-hand path.
  check("6", "gesture (research track only)", "pinch enters below normalized aperture threshold", gestures.pinchEnter.isPinching, gestures.pinchEnter);
  check("6", "gesture (research track only)", "pinch hysteresis retains hold between enter and exit thresholds", gestures.pinchHysteresisHold.isPinching, gestures.pinchHysteresisHold);
  check("6", "gesture (research track only)", "pinch exits above normalized release threshold", !gestures.pinchExit.isPinching, gestures.pinchExit);
  check("6", "gesture (research track only)", "clearly separated fingers arm a new pinch", gestures.pinchOpen.isSeparated, gestures.pinchOpen);
  check("5", "safety", "malformed grasp landmarks fail safely", gestures.invalidGrasp.valid === false && !gestures.invalidGrasp.isGrasping, gestures.invalidGrasp);
  check("6", "safety (research track only)", "malformed pinch landmarks fail safely", gestures.invalidPinch.valid === false && !gestures.invalidPinch.isPinching, gestures.invalidPinch);

  // Level 2 production validation: exactly one fail-closed, torso-relative,
  // selected-arm tabletop shoulder-horizontal-abduction activity.
  const level2Availability = await page.evaluate(() => ({
    themes:window.__qa.themes("2").map(theme=>theme.id),
    sessions:window.__qa.level4SessionThemes(),
  }));
  check("2","availability","exactly one Level 2 activity is available",
    JSON.stringify(level2Availability.themes)===JSON.stringify(["bilateral"])
      && JSON.stringify(level2Availability.sessions)===JSON.stringify(["bilateral"]),
    level2Availability);
  await start(page,"2","mahjongwash");
  const level2Fallback=await page.evaluate(()=>({
    theme:window.__qa.state().theme,
    elbowBar:document.getElementById("level4CalibBar").classList.contains("show"),
  }));
  check("2","availability","unsupported direct launch fails closed to bilateral",
    level2Fallback.theme==="bilateral",level2Fallback);
  check("2","calibration","Level 2 never shows elbow calibration",
    level2Fallback.elbowBar===false,level2Fallback);

  const level2Midline={
    leftShoulder:{x:.40,y:.30},rightShoulder:{x:.60,y:.30},
    leftElbow:{x:.47,y:.52},rightElbow:{x:.53,y:.52},
    leftWrist:{x:.50,y:.68},rightWrist:{x:.50,y:.68},
    leftHip:{x:.42,y:.72},rightHip:{x:.58,y:.72},
  };
  const level2RightOut={
    ...level2Midline,rightElbow:{x:.61,y:.52},rightWrist:{x:.68,y:.68},
  };
  const level2LeftOut={
    ...level2Midline,leftElbow:{x:.39,y:.52},leftWrist:{x:.32,y:.68},
  };
  async function level2Cycle(side,outward){
    await start(page,"2","bilateral");
    await page.evaluate(({midline,outward})=>{
      window.__qa.setLevel3Pose({...midline,frames:5});
      window.__qa.setLevel3Pose({...outward,frames:8});
    },{midline:level2Midline,outward});
    const reached=await page.evaluate(()=>({
      motion:window.__qa.level3LateralState(),game:window.__qa.state(),
    }));
    await page.evaluate(midline=>window.__qa.setLevel3Pose({...midline,frames:8}),level2Midline);
    const returned=await page.evaluate(()=>window.__qa.level3LateralState());
    return {reached,returned};
  }
  const rightCycle=await level2Cycle("right",level2RightOut);
  const leftCycle=await page.evaluate(async ({midline,outward})=>{
    window.__qa.startGame({level:"2",theme:"bilateral",affectedSide:"left",duration:180});
    window.__qa.setLevel3Pose({...midline,frames:5});
    window.__qa.setLevel3Pose({...outward,frames:8});
    return {motion:window.__qa.level3LateralState(),game:window.__qa.state()};
  },{midline:level2Midline,outward:level2LeftOut});
  check("2","symmetry","left and right selected arms produce symmetric outward progress",
    rightCycle.reached.motion.targetHits===1&&leftCycle.motion.targetHits===1
      && Math.abs(rightCycle.reached.motion.progress-leftCycle.motion.progress)<.001,
    {right:rightCycle.reached.motion,left:leftCycle.motion});
  check("2","repetition","outward scores once and return to midline rearms",
    rightCycle.reached.game.correctCount===1&&rightCycle.reached.game.grabCount===0
      && rightCycle.returned.phase==="outward",
    rightCycle);

  await start(page,"2","bilateral");
  const level2Rejected=await page.evaluate(({midline,outward})=>{
    window.__qa.setLevel3Pose({...midline,frames:5});
    const wristOnly=window.__qa.setLevel3Pose({...midline,rightWrist:outward.rightWrist});
    const torso=window.__qa.setLevel3Pose({
      leftShoulder:{x:.48,y:.30},rightShoulder:{x:.68,y:.30},
      leftElbow:{x:.55,y:.52},rightElbow:{x:.69,y:.52},
      leftWrist:{x:.58,y:.68},rightWrist:{x:.76,y:.68},
      leftHip:{x:.50,y:.72},rightHip:{x:.66,y:.72},
    });
    const missing=window.__qa.setLevel3Pose({...outward,missing:["rightElbow"]});
    const score=window.__qa.state().correctCount;
    return {wristOnly,torso,missing,score};
  },{midline:level2Midline,outward:level2RightOut});
  check("2","tracking","recording-like supported slide starts moving without a fixed elbow ratio",
    level2Rejected.wristOnly.reason==="tracking"
      && level2Rejected.wristOnly.progress>0
      && level2Rejected.score===0,
    level2Rejected.wristOnly);
  check("2","fail closed","meaningful torso translation is rejected",
    level2Rejected.torso.reason==="torso-translation"&&level2Rejected.score===0,
    level2Rejected.torso);
  check("2","fail closed","missing selected landmarks are rejected",
    /^missing-/.test(level2Rejected.missing.reason)&&level2Rejected.score===0,
    level2Rejected.missing);

  // Retain the old standalone-module probes as unreachable source reference.
  // They are not production Level 2 validation and create no reported checks.
  if(false){
  const l4Layout = await start(page, "2");
  const itemY = Math.min(...l4Layout.items.map(item => item.y));
  const targetY = Math.max(...l4Layout.targets.map(target => target.y));
  check("2", "layout", "targets remain forward of tabletop source items", targetY < itemY, { targetY, itemY });

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
  await start(page, "2");
  await calibrateLevel4(page);
  const level4Baseline = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "two-pose calibration", "flexed then extended capture calibrates and returns to progress 0",
    level4Baseline.calibrated && level4Baseline.stage === "ready"
    && level4Baseline.progress === 0
    && level4Baseline.captureCount.flexed === 1 && level4Baseline.captureCount.extended === 1
    && level4Baseline.qualified.length === 1 && level4Baseline.qualified[0] === "angle",
    level4Baseline);

  // A visible flexed pose without its deliberate therapist mark must never
  // calibrate silently or pretend the endpoint was captured.
  await start(page, "2");
  await level4Pose(page, level4StartPose, 16);
  const level4FlexedOnly = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "two-pose calibration", "unmarked flexed pose waits for the explicit flexed therapist capture",
    level4FlexedOnly.calibrated === false && level4FlexedOnly.stage === "capture-flexed"
    && level4FlexedOnly.reason === "awaiting-flexed-capture"
    && level4FlexedOnly.captureCount.flexed === 0 && level4FlexedOnly.captureCount.extended === 0
    && level4FlexedOnly.retryCount === 0 && level4FlexedOnly.progress === 0,
    level4FlexedOnly);

  // Two nearly identical labelled poses must keep the flexed capture and ask
  // only for the extended endpoint again, without a hidden retry state.
  await start(page, "2");
  await level4Pose(page, level4StartPose);
  const retryFlexedMark = await markLevel4Endpoint(page, "flexed");
  await level4Pose(page, {
    ...level4StartPose,
    wrist:{x:.58,y:.488,z:0},
  });
  const retryExtendedMark = await markLevel4Endpoint(page, "extended");
  const level4Retry = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "two-pose calibration", "insufficient endpoint separation requests a retry with diagnostics",
    retryFlexedMark.marked && !retryExtendedMark.marked
    && level4Retry.calibrated === false && level4Retry.gameReady === false
    && level4Retry.stage === "capture-extended"
    && level4Retry.reason === "angle-separation-too-small"
    && level4Retry.lacking.length === 1 && level4Retry.guidance.main.length > 0,
    { retryFlexedMark, retryExtendedMark, level4Retry });

  // Compact therapist fallback: two buttons mark the current pose as either
  // endpoint when automatic capture struggles.
  await start(page, "2");
  await level4Pose(page, level4StartPose, 6);
  await page.evaluate(() => window.__qa.level4ManualCapture("flexed"));
  await level4Pose(page, level4ReachPose, 6);
  await page.evaluate(() => window.__qa.level4ManualCapture("extended"));
  await level4Pose(page, level4ReachPose, 4);
  const level4Manual = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "two-pose calibration", "therapist buttons mark both endpoints manually",
    level4Manual.calibrated && level4Manual.manual.flexed === true
    && level4Manual.manual.extended === true && level4Manual.reason === "ready"
    && level4Manual.captureCount.flexed === 1 && level4Manual.captureCount.extended === 1
    && level4Manual.progress > 0.90, level4Manual);
  await level4Pose(page, level4StartPose, 10);
  const level4ManualReturn = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "two-pose calibration", "manual calibration still returns to 0 at the flexed endpoint",
    level4ManualReturn.progress < 0.05, level4ManualReturn);

  await start(page, "2");
  await calibrateLevel4(page);
  await level4Pose(page, level4JitterPose, 10);
  const level4Jitter = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "drift guard", "small elbow-angle jitter cannot move the object by itself",
    !level4Jitter.engaged && level4Jitter.progress < 0.10
    && !level4Jitter.completionReady, level4Jitter);
  await level4Pose(page, level4PartialExtensionPose, 10);
  const level4Partial = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "completion gate", "partial elbow extension moves upward but cannot complete placement",
    level4Partial.engaged && level4Partial.progress > 0.20
    && level4Partial.progress < 0.90 && !level4Partial.completionReady,
    level4Partial);

  await start(page, "2");
  await calibrateLevel4(page);
  await level4Pose(page, level4HikePose, 3);
  const level4Hike = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "elbow-only control", "non-elbow landmark changes cannot change direct elbow progress or create an elevation signal",
    level4Hike.progress < 0.02 && !("shoulderHike" in level4Hike)
    && level4Hike.warning === "", level4Hike);

  await start(page, "2");
  await calibrateLevel4(page);
  await level4Pose(page, level4ReachPose, 10);
  const level4Forward = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "elbow-only control", "elbow extension moves the object upward without a secondary shoulder-elevation gate",
    level4Forward.progress > 0.90 && level4Forward.elbowAngle > 140
    && !("shoulderHike" in level4Forward), level4Forward);
  await level4Pose(page, level4ForwardFlexedPose, 12);
  const level4ElbowReturn = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "compound movement", "elbow flexion lowers the object while the wrist remains forward",
    level4ElbowReturn.progress < 0.08 && level4ElbowReturn.elbowAngle < 100,
    level4ElbowReturn);
  await level4Pose(page, level4StartPose, 12);
  const level4Return = await page.evaluate(() => window.__qa.level4ReachState());
  check("2", "elbow-only control", "elbow flexion returns the object downward without a secondary shoulder-elevation gate",
    level4Return.progress < 0.02 && level4Return.elbowAngle < 100
    && !("shoulderHike" in level4Return), level4Return);

  // Every Level 4 theme shares one elbow interpretation: extension advances a
  // fixed-X on-screen guide upward, and flexion returns it downward. The three
  // path/precision games retain their real wrist input, but elbow motion itself
  // cannot inject a horizontal cursor displacement.
  for (const theme of ["dimsum", "wipewindow", "bowling", "mahjongwash", "buspay"]) {
    await start(page, "2", theme);
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
      || (extended.bowling.phase === "rolling" && extended.bowling.armProgress > 0.80
        && flexed.bowling.phase === "rolling" && flexed.bowling.armProgress < 0.08);
    check("2", "vertical elbow mapping",
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
  await start(page, "2", "dimsum", 300);
  await calibrateLevel4(page);
  const unheldProbe = await state(page);
  const unheldRawPoint = {
    x: Math.round(unheldProbe.items[0].x - 95),
    y: Math.round(unheldProbe.items[0].y + 8),
  };
  await position(page, unheldRawPoint, false, true);
  await advance(page, 80);
  const unheldCursor = await page.evaluate(() => window.__qa.level4TransportState());
  check("2", "elbow carry", "unheld Level 4 cursor remains the real wrist point for item selection",
    unheldCursor.held === null
    && Math.abs(unheldCursor.rawCursor.x - unheldRawPoint.x) < 1
    && Math.abs(unheldCursor.rawCursor.y - unheldRawPoint.y) < 1
    && Math.abs(unheldCursor.displayCursor.x - unheldRawPoint.x) < 1,
    unheldCursor);

  const pickup = (await state(page)).items[0];
  await page.evaluate(() => window.__qa.snapCursor());
  await position(page, pickup, false, true);
  // Establish stillness with separate decoded generations.  The generic game
  // loop may tick in between, but only these fresh pose admissions can advance
  // the Level 4 pickup dwell.
  await holdLevel4Pose(page, level4StartPose, 1200, 8);
  const heldStart = await page.evaluate(() => window.__qa.level4TransportState());
  check("2", "elbow carry", "ordinary Level 4 pickup captures a stable carry lane",
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
  check("2", "elbow carry", "held standard Level 4 item keeps its fixed carry X across elbow extension",
    heldExtended.held !== null
    && Math.abs(heldExtended.held.x - heldStart.carry.laneX) < 0.001
    && heldExtended.rawCursor.x < heldStart.rawCursor.x - 100,
    { heldStart, heldExtended });
  check("2", "elbow carry", "held standard Level 4 item moves upward on elbow extension",
    heldExtended.held.y < heldStart.held.y - 20
    && heldExtended.reachProgress > heldStart.reachProgress + 0.50,
    { heldStart, heldExtended });

  await level4Pose(page, level4ForwardFlexedPose, 12);
  await advance(page, 120);
  const heldFlexed = await page.evaluate(() => window.__qa.level4TransportState());
  check("2", "elbow carry", "held standard Level 4 item moves downward on elbow flexion",
    heldFlexed.held !== null
    && Math.abs(heldFlexed.held.x - heldStart.carry.laneX) < 0.001
    && heldFlexed.held.y > heldExtended.held.y + 20
    && heldFlexed.reachProgress < heldExtended.reachProgress - 0.50,
    { heldExtended, heldFlexed });

  await start(page, "2", "wipewindow");
  await calibrateLevel4(page);
  const wipeRawPoint = { x: 318, y: 472 };
  await position(page, wipeRawPoint, false, true);
  await level4Pose(page, level4ReachPose, 8);
  await advance(page, 80);
  const wipeCursor = await page.evaluate(() => window.__qa.level4TransportState());
  check("2", "independent mechanics", "wipe-window keeps the real wrist path rather than a carry lane",
    wipeCursor.standardTransport === false && wipeCursor.carry === null
    && Math.abs(wipeCursor.displayCursor.x - wipeCursor.rawCursor.x) < 0.001
    && Math.abs(wipeCursor.rawCursor.x - wipeRawPoint.x) < 1,
    wipeCursor);

  // --- Category 2 ordered cycle, driven by real synthetic poses -----------
  await start(page, "2", "wipewindow");
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
  check("2", "ordered arc cycle",
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

  await start(page, "2", "bowling");
  const bowlingCycle = await page.evaluate(() => {
    window.__level4MiniGamesQA.reset();
    // A genuine returned flexed fresh frame arms one throw; extension then
    // commits exactly one roll. A later flexed image does not undo the roll.
    window.__level4MiniGamesQA.bowling({
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:401,
      engaged:false, progress:0, reachGate:false, returnReady:true, completionReady:false,
    });
    window.__level4MiniGamesQA.bowling({
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:402,
      engaged:true, progress:.72, reachGate:true, returnReady:false, completionReady:false,
    });
    window.__level4MiniGamesQA.bowling({
      calibrated:true, gameReady:true, newFrame:true, frameGeneration:403,
      engaged:false, progress:.12, reachGate:false, returnReady:true, completionReady:false,
    });
    return window.__level4MiniGamesQA.state.bowling;
  });
  check("2", "independent mechanics", "bowling arms only from flexed start and commits one extension roll",
    bowlingCycle.phase === "rolling" && bowlingCycle.peak >= .72 && bowlingCycle.armProgress < .18,
    bowlingCycle);

  await start(page, "2", "mahjongwash");
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
  check("2", "independent mechanics",
    "mahjong-wash requires extension then the side-correct arc before washing",
    mahjongPath.linearOnly.progress === 0
    && mahjongPath.onArc.progress > 0 && mahjongPath.onArc.lastPoint?.x === .31,
    mahjongPath);

  await start(page, "2", "buspay");
  const busPrecision = await page.evaluate(() => {
    window.__level4MiniGamesQA.reset();
    const target = { x:.10, y:.43 };
    const extendedAtReader = {
      calibrated:true, gameReady:true, newFrame:true,
      engaged:true, progress:.92, elbowExtensionProgress:.92,
      reachGate:true, returnReady:false, abductionProgress:0,
    };
    // First fresh extended pose enters pay; four further distinct images create
    // the payment dwell. Holding extension cannot score twice.
    for (let index = 0; index < 6; index += 1) {
      window.__level4MiniGamesQA.bus({...extendedAtReader, frameGeneration:431 + index}, target.x, target.y);
    }
    const paid = {...window.__level4MiniGamesQA.state.bus};
    for (let index = 0; index < 5; index += 1) {
      window.__level4MiniGamesQA.bus({...extendedAtReader, frameGeneration:440 + index}, target.x, target.y);
    }
    const held = {...window.__level4MiniGamesQA.state.bus};
    // Flexion alone is insufficient: the horizontal-abduction return must reach
    // the far/right end first, then one fresh returned flexed frame re-arms.
    const flexedWithoutReturn = {
      calibrated:true, gameReady:true, newFrame:true, engaged:false,
      progress:0, elbowExtensionProgress:0, reachGate:false, returnReady:true,
      abductionProgress:0,
    };
    window.__level4MiniGamesQA.bus({...flexedWithoutReturn, frameGeneration:450}, target.x, target.y);
    const noHorizontalReturn = {...window.__level4MiniGamesQA.state.bus};
    window.__level4MiniGamesQA.bus({...extendedAtReader, frameGeneration:451, abductionProgress:1}, target.x, target.y);
    window.__level4MiniGamesQA.bus({...flexedWithoutReturn, frameGeneration:452, abductionProgress:1}, target.x, target.y);
    return { paid, held, noHorizontalReturn, rearmed:{...window.__level4MiniGamesQA.state.bus} };
  });
  check("2", "independent mechanics",
    "bus pays once after elbow forward, then needs horizontal return plus flexed return to re-arm",
    busPrecision.paid.hitCount === 1 && busPrecision.paid.beepCount === 1
    && busPrecision.paid.phase === 'return-horizontal' && busPrecision.paid.armed === false
    && busPrecision.held.beepCount === 1
    && busPrecision.noHorizontalReturn.phase === 'return-horizontal'
    && busPrecision.rearmed.phase === 'forward' && busPrecision.rearmed.armed === true,
    busPrecision);

  await start(page, "2");
  await calibrateLevel4(page, level4OccludedStartPose, level4OccludedReachPose);
  await level4Pose(page, level4OccludedReachPose, 10);
  const level4OccludedReach = await page.evaluate(() => window.__qa.level4ReachState());
  check("legacy", "table occlusion", "affected elbow extension remains playable when the opposite shoulder is hidden",
    level4OccludedReach.framingReady && level4OccludedReach.progress > 0.80,
    level4OccludedReach);
  }

  // Generic grasp/drop flow below is specific to Level 5. Level 2 supported
  // motion is covered separately above, and the two Level 6 selected-hand
  // tool flows are covered by their deterministic gesture checks above.
  for (const level of ["5"]) {
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
  // release difficulty, Level 6 no-angle-selector wording, camera failures).
  // ================================================================
  const safetyConstants = await page.evaluate(() => window.__qa.safety.constants());
  check("5", "safety", "maximum carry duration defaults to a conservative 5 seconds",
    safetyConstants.maxHoldMs === 5000, safetyConstants);
  check("5", "safety", "repeated release difficulty limit is configured",
    safetyConstants.releaseDifficultyLimit >= 2 && safetyConstants.releaseDifficultyLimit <= 3,
    { limit: safetyConstants.releaseDifficultyLimit });

  for (const levelKey of ["2", "3", "4", "5", "67"]) {
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
    check(label, "safety gate", "concise level-specific note is present",
      note.length >= 10, { length: note.length });
  }

  const notes = safetyConstants.levelNotes;
  check("2", "safety copy", "Level 2 concise note retains tabletop support and required landmarks",
    notes["2"].includes("手臂放桌面") && notes["2"].includes("肩、肘、腕")
    && notes["2"].includes("路徑入鏡"), { note: notes["2"] });
  check("3", "safety copy", "Level 3 concise note retains off-table arm and full framing",
    notes["3"].includes("患臂離桌") && notes["3"].includes("軀幹")
    && notes["3"].includes("全臂入鏡"), { note: notes["3"] });
  check("4", "safety copy", "Level 4 concise note retains off-table arm and full framing",
    notes["4"].includes("患臂離桌") && notes["4"].includes("軀幹")
    && notes["4"].includes("全臂入鏡"), { note: notes["4"] });
  check("5", "safety copy", "Level 5 concise note retains off-table reach and loose hand sequence",
    notes["5"].includes("患臂離桌") && notes["5"].includes("伸手")
    && notes["5"].includes("輕合") && notes["5"].includes("張手")
    && !notes["5"].includes("握拳") && !notes["5"].includes("握緊"), { note: notes["5"] });
  check("6", "safety copy", "Level 6 concise note requires tripod pinch without shoulder/elbow wording",
    notes["67"].includes("患手三指張開") && notes["67"].includes("輕捏拿起")
    && notes["67"].includes("張開放下")
    && !/量角器|60[–-]120|角度|肩屈曲|手肘|抬高手臂/.test(notes["67"]),
    { note: notes["67"] });

  const selectorMatrix = await page.evaluate(() => {
    const inspect = level => {
      window.__qa.selectLevel(level);
      window.__qa.selectActivity(level === "67" ? "flowers" : "dimsum");
      const card = document.getElementById("shoulderTargetCard");
      return {
        hidden: card.hidden,
        values: [...document.querySelectorAll("#shoulderTargetOptions [data-shoulder-target]")]
          .map(button => Number(button.dataset.shoulderTarget)),
      };
    };
    return { level3: inspect("3"), level4: inspect("4"), level6: inspect("67") };
  });
  check("3", "setup", "Level 3 keeps its 30–60 degree selector",
    selectorMatrix.level3.hidden === false
      && JSON.stringify(selectorMatrix.level3.values) === JSON.stringify([30,40,50,60]),
    selectorMatrix.level3);
  check("4", "setup", "Level 4 keeps its 60–180 degree selector",
    selectorMatrix.level4.hidden === false
      && JSON.stringify(selectorMatrix.level4.values) === JSON.stringify([60,70,80,90,100,110,120,130,140,150,160,170,180]),
    selectorMatrix.level4);
  check("6", "setup", "Level 6 hides the complete shoulder target selector panel",
    selectorMatrix.level6.hidden === true, selectorMatrix.level6);

  const bodyText = await page.evaluate(() => document.body.innerText);
  check("5", "safety copy", "no patient-facing 握拳/握緊 wording remains in the interface",
    !bodyText.includes("握拳") && !bodyText.includes("握緊"), {
      hasFist: bodyText.includes("握拳"), hasSqueeze: bodyText.includes("握緊"),
    });

  for (const level of ["2", "3", "4", "5", "67"]) {
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
  await start(page, "2");
  const firstComp = await page.evaluate(() => window.__qa.safety.compensation("shoulder_hiking"));
  check("2", "compensation", "a single observed compensation is logged without pausing",
    firstComp.counts.shoulder_hiking === 1 && firstComp.blocking === false, firstComp);
  const secondComp = await page.evaluate(() => window.__qa.safety.compensation("shoulder_hiking"));
  check("2", "compensation", "the same compensation observed twice pauses and prompts a shorter distance",
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
    check("2", "camera error", `${name} shows an in-page error with Retry and Return`,
      shown.visible === true && shown.hasRetry && shown.hasReturn
      && shown.message.includes(expected), shown);
    check("2", "camera error", `${name} shows a concise technical code without a raw stack`,
      shown.detail.includes(name) && shown.detail.length < 40, { detail: shown.detail });
    const cleared = await page.evaluate(() => window.__qa.safety.clearCameraError());
    check("2", "camera error", `${name} error can be dismissed on retry`,
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
  scope: "Independent technical verification for FTHUE Levels 2–6",
  limitation: "Not clinical validation; all six normal-flow Level 6 activities use fresh selected affected-hand tripod-pinch frames for open, light close, hand-position transport, and reopen. Shoulder and elbow motion are not interaction dependencies. The software does not identify physical tools or measure pinch/grip force.",
  summary: {
    total: tests.length + errors.filter(error => !tests.includes(error)).length,
    passed: tests.filter(test => test.passed).length,
    failed: errors.length,
    by_level: Object.fromEntries(["2", "3", "4", "5", "6"].map(level => [
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
  ...["2", "3", "4", "5", "6"].map(level => `| ${level} | ${result.summary.by_level[level].passed} | ${result.summary.by_level[level].failed} |`),
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
  "This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. All six normal-flow Level 6 activities use the selected affected hand and fresh Hand Landmarker frames for tripod-pinch open preparation, light/asymmetric close, hand-position transport and stabilized reopen. No shoulder or elbow angle controls readiness, pickup, progress, transport, release or scoring. Missing, uncertain, partial, stale, repeated-generation or wrong-side hand input fails closed. The software neither identifies physical tools nor measures pinch/grip force. The research-only tool path remains separate. Compensation, muscle tone and spasticity are never detected automatically: they are therapist observations entered manually. Safety-control behaviour verified here is software behaviour only and still requires supervised bedside testing on the target iPad.",
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
