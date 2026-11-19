# v132 Security / Safety Review — Level 6 Digi-Flex counting relaxed (hold / release)

Date: 2026-11-19 · Marker `v132-20261119-digiflex-lenient`

## Change
Public Level 6 cooking task only (`cookDigiflexDetect`, `drawCookDigiflexBadge`, constants), markers, tests.
- Therapist bedside report after v131: "too difficult, need to hold too long". Reproduced with slow
  synthetic squeezes: baseline chased a slow squeeze (3%/frame drift); the absolute calibrated
  threshold could latch "squeezing" when the relaxed hold already scored high; release demanded
  half of (peak − baseline) with a possibly far-too-low baseline.
- Detection is now relative only: on when score ≥ rolling-minimum baseline + rise (25% of the
  calibrated range, 0.03–0.08); baseline from "settled" frames of the last 2.5 s, re-based after
  3 s unsettled; release at 40% of the (capped) rise from peak, 20% after 2 s, or back to baseline
  + half rise; a "squeeze" never released for 4 s is re-based without counting; 3-frame median;
  80 ms minimum squeeze.
- Squeeze meter beside the exerciser picture (fill = progress to the counting line).

## Gameplay / safety gates unchanged
- Research mode, Level 5, other Level 6 tasks, chopsticks `gameType:'dwell'` untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. `computeGraspScore` unchanged (the Digi-Flex override of
  `isGrasping` remains for the cursor; it no longer feeds the rep counter).
- Disclaimer unchanged: the page reads finger opening/closing only, does not identify equipment and
  does not measure grip or pinch force. Counting is a relative movement count, not a force value.
- No new network, storage, camera or permission code; nothing new recorded.

## Privacy / content
- No research / pilot wording added; `window.__qa` stripped from `dist/public`.

## Validation
- Full Node suite in four groups, 0 fail (new `tests/v132-digiflex-lenient.test.mjs`; v131 suite
  updated to the new constants; marker tests bumped).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean; `./scripts/build-dist.sh`.
- Synthetic slow-squeeze timings and badge/meter screenshots in
  `ych_rehab_qa_artifacts/v132/v132-qa-contact-sheet.png`.

## Residual
- Values are second estimates from synthetic hands; confirm with a real exerciser on the department
  iPad. If still hard: lower `DIGIFLEX_RELATIVE_RISE` (0.25 → 0.2) or `DIGIFLEX_MAX_RISE`; if it
  over-counts jitter: raise `DIGIFLEX_MIN_RISE` (0.03 → 0.04).
