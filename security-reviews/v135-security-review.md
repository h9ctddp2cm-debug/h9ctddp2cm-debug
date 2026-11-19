# v135 Security / Safety Review — Level 6 Digi-Flex: calibration optional (hand seen → start)

Date: 2026-11-19 · Marker `v135-20261119-digiflex-calib-optional`

## Change
Public Level 6 cooking (Digi-Flex) calibration gate and copy only; one default constant in
`cookDigiflexDetect`; QA probe `__qa.cook.calibProbe()` (stripped from `dist/public`); markers; tests.
- Therapist bedside report after v134: "difficult to pass the tracking". The calibration screen
  required an observed relax/squeeze range (span ≥ 0.02, 750 ms relaxed, 450 ms squeezed) before
  開始遊戲 enabled, although since v132 the rep counter is relative to the participant's own
  relaxed level and does not use that gate.
- `c.ready = detectedDone && ((openDone && closedDone) || digiflexCalibOptional())`, where
  `digiflexCalibOptional()` is true only for the public Level 6 cooking task. The relax/squeeze rows
  remain as optional refinements (labelled 可選); when completed they still set the personal range.
- Uncalibrated play uses `DIGIFLEX_DEFAULT_GAP = 0.16` (rise 0.04) instead of the generic grasp
  defaults (rise 0.06). Calibrated behaviour and the v132 detection rules are unchanged.

## Gameplay / safety gates unchanged
- Research mode keeps the full three-stage gate (`research.active` excluded). Peg, chopsticks, bare
  Level 6, Level 5 and shoulder levels untouched (`requiredOpenHoldMs`, `TOOL_CALIB_MIN_RANGE`,
  `DIGIFLEX_CALIB_MIN_RANGE` unchanged).
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. The existing 10 s 「校準未完成？直接開始」 escape hatch and
  「重新校準」 button are unchanged.
- Disclaimer unchanged: the page does not identify equipment and does not measure grip or pinch force.
- No new network, storage, camera or permission code.

## Privacy / content
- No research / pilot wording added; `window.__qa` stripped from `dist/public`.

## Validation
- Full Node suite in four groups, 0 fail (new `tests/v135-digiflex-calibration-optional.test.mjs`;
  v131 copy assertion updated; marker tests bumped).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean; `./scripts/build-dist.sh`.
- Calibration screen (fake camera) on laptop and iPad portrait in `ych_rehab_qa_artifacts/v135/`.

## Residual
- If the 「偵測」 row itself never ticks, the hand is not being found by the hand model (lighting,
  distance, exerciser covering the fingers); that is upstream of this change — ask the therapist
  which row stalled.
