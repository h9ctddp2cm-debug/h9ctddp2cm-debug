# v110 Release and Security Review — Peg Hold Hysteresis Gate

Build marker: `v110-20260907-peg-hold-hysteresis-gate`
Date: 2026-09-07 (HKT)
Scope: `index.html` (public peg calibration entry ratio, combined release gate in `computeToolPinchState`, HUD peg line, markers), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist report

At bedside the Level 6 clothes-peg task flipped between 揸實 and 鬆開 while the patient simply held the real peg, although all three calibration steps were ticked. The task worked in v107.

## Root cause

v108 lowered every release path (per-digit 50 %, decisive-digit path, adaptive floor 25 %) but left the combined entry threshold at 56 % of the combined range. Because the state machine evaluates `closeConfirmed` when not holding and `releaseConfirmed` when holding, any static aperture between the release points and the entry point is simultaneously "closed" and "reopened", so the state inverts on every 180 ms confirmation window. This was a v108 regression, not a camera or calibration failure.

## Change summary

| Area | v109 | v110 |
|------|------|------|
| Public peg entry | `closedMean + gapC*0.56` | `closedMean + gapC*0.40` (`PUBLIC_PEG_ENTER_RATIO`); research/other tasks keep 0.56 |
| Calibration object | per-digit fields | + `comboClosed`, `comboRange` |
| Release decision | `bothReopened \|\| decisiveReopen` | `(bothReopened \|\| decisiveReopen) && ratio >= enter + comboRange*0.10` (`publicPegReleaseGate`) |
| HUD `?perf=1` | per-digit peg line | + `衣夾 合併 / 拎起≤ / 放手閘≥` |
| Chopstick flex path, Level 5, research strings, MediaPipe config, privacy constants | — | unchanged |

## Safety and privacy analysis

- Detection-logic change limited to the public peg task guard (`!research.active && isLevel6RealToolTask()`); research mode derives thresholds exactly as before and never reads the public calibration object (tested).
- Hysteresis is now strictly monotone: entry (40 %) < gate (50 %) ≤ per-digit release points, so no aperture can satisfy both transitions. A 0.20–0.70 sweep with equal and unequal digits, from both previous states and with adaptive lowering forced to its floor, produced zero flips. A legacy calibration object without `comboRange` is gated at `enter + 1e-6`, so it cannot oscillate either.
- The gate only *blocks* releases; it cannot create a pick-up. False pick-ups are reduced (entry lowered from 56 % to 40 %), which is conservative for the patient — a light touch of the peg is no longer read as a grasp.
- No camera, storage, recording, network, upload or service-worker fetch logic touched; `CACHE_VERSION` bumped so clients receive the new bundle. No new CSS; the sanitizer-forbidden words do not appear in any new comment. `__qa` remains absent from `dist/public`; isolation test 5/5.
- HUD additions are diagnostic text only, gated behind `?perf=1`, and expose no personal data.

## Residual risk

- If a patient's real peg produces a combined range so small that the 10 % hysteresis band is below landmark noise, the hold could still be noisy; the HUD line now exposes `合併 / 拎起 / 放手閘` so the therapist can report the numbers for tuning.
