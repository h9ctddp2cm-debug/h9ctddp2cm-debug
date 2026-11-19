# v131 Security / Safety Review — Level 6 煮蛋炒飯 as a hand-grip-exerciser squeeze game

Date: 2026-11-19 · Marker `v131-20261119-digiflex-cooking`

## Change
Public Level 6 cooking task only, `index.html` + three new images + markers + tests.
- Routing: `isLevel6DigiflexTask()` (= `isLevel6()` && task `cooking`; `isLevel6()` already excludes
  `research.active`). `usesAdvancedThemeModule('cooking')` now returns true for this task, so public
  Level 6 cooking runs the 12-step egg-fried-rice module (`gameType:'grasp'`) instead of the generic
  vegetable→wok / noodle→pot picker it previously fell through to.
- Counting: each step needs N whole-hand squeeze→relax cycles, `COOK_DIGIFLEX_NEED =
  [3,4,4,3,5,2,2,3,4,5,1,8]` (44), scaled by the therapist setting `cookSqueezeAmount`
  less/normal/more (0.5/1/1.5, per-step minimum 1 → 25/44/69).
- Detection (`cookDigiflexDetect`): 5-frame median of the whole-hand curl score; "on" when the
  calibrated grasp threshold is met or the score rises 35% (`DIGIFLEX_RELATIVE_RISE`, floor
  `DIGIFLEX_MIN_RISE` 0.03) above the patient's own tracked relaxed baseline; "off" when it falls
  back half the rise from the peak; squeezes shorter than `DIGIFLEX_MIN_SQUEEZE_MS` 100 ms are
  ignored; baseline drifts slowly; an unfinished squeeze is discarded on step change.
- Calibration copy: 放鬆揸住握力器 / 揸實握力器; relaxed sample accepts the half-curled posture of a
  hand holding the exerciser (`digiflexCalibRelaxedQualifies`, `DIGIFLEX_CALIB_MIN_RANGE` 0.02).
  Pose landmarker is not loaded for this task.
- Canvas scene `cookRenderDigiflex()`: AI kitchen background, per-step props that move on each
  squeeze, step title / count pill / 12 progress dots / exerciser badge with 揸實 ✊ · 放鬆 🖐 ·
  請將手入鏡 label (public patient-mode status bar is intentionally empty). Intro banner and voice
  「買完餸返到屋企，而家煮蛋炒飯」.
- Settings card `#cookSqueezeCard` shown only for Level 6 + cooking + not research.

## Gameplay / safety gates unchanged
- Research mode, Level 5 (incl. Level 5 cooking), Level 6 laundry / flowers / cards / mahjong /
  peg, Level 6 chopsticks (`gameType:'dwell'`) untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Disclaimer retained in `ADV_RULES.cooking_digiflex`: the page reads finger opening/closing only;
  it does not identify equipment and does not measure grip or pinch force.
- No new network, storage, camera or permission code; no new data recorded or exported.
  `cookSqueezeAmount` lives in in-memory `state` only.

## Privacy / content
- No research / pilot wording added (`rg -c "research|pilot" dist/public/index.html` → 0).
- `window.__qa` (incl. new `__qa.cook.*`) stripped from `dist/public` (`rg -c "__qa"` → 0).
- New images are generated illustrations (kitchen, exerciser in a hand, spatula); no faces, no
  patient data.

## Validation
- Full Node suite in four groups, 0 fail (new `tests/v131-digiflex-cooking.test.mjs`: source wiring,
  totals, five Playwright e2e cases; `level67-interactions` cooking type updated to `grasp`;
  marker tests bumped).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh`; dist contains `img/cook_kitchen_bg.jpg`, `img/cook_digiflex_relax.png`,
  `img/cook_spatula.png`.
- Playwright, three viewports (1413×653 / 1180×820 / 1024×1366), intro → step 1 → 切蔥花 → 落油 →
  上碟, 0 page errors (`ych_rehab_qa_artifacts/v131/v131-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing, not user-visible).
- 35% relative rise / 100 ms / counts are first estimates; tune `DIGIFLEX_RELATIVE_RISE`,
  `DIGIFLEX_MIN_RISE`, `DIGIFLEX_MIN_SQUEEZE_MS`, `COOK_DIGIFLEX_NEED`, `COOK_SQUEEZE_AMOUNTS`
  after bedside use.
- The synthetic QA hand approximates a curled hand; real-exerciser behaviour should be checked on
  the department iPad.
