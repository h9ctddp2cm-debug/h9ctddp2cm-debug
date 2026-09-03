# v97 Release and Security Review — Level 5/6 Low Latency

Build marker: `v97-20260903-level5-6-low-latency`
Date: 2026-09-03 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `tests/`, `progress.md`, `dist/public`

## Evidence reviewed

The therapist's 25.765-second iPad recording was inspected frame by frame. It contains 773 frames at a stable approximately 30 fps, with a maximum recorded frame interval of 35 ms and no interval above 50 ms. The lag visible during Level 5/6 use was therefore investigated in the application's inference, cursor-update and rendering paths rather than attributed to recording frame loss.

## Root causes and changes

| # | Symptom | Root cause | Change |
|---|---------|-----------|--------|
| 1 | Level 6 detection reacts slowly | Level 6 satisfied the gross-tabletop condition and initialised Pose Landmarker, while Level 6 also initialised Hand Landmarker. The frame loop could therefore perform synchronous Pose and Hand inference for the same camera frame. | Added `needsGrossPoseInference()`: Pose is now limited to Levels 2–4; every normal Level 6 task uses one Hand Landmarker path. |
| 2 | Level 5/6 cursor trails the patient's hand | Public Level 5/6 still passed accepted hand coordinates through a 3-frame median and EMA smoothing stage. | Public Level 5/6 uses the newest accepted coordinate directly. Research and Levels 2–4 retain their previous smoothing. |
| 3 | External monitor use increases lag | The canvas backing store expanded to full display resolution, so every animation frame repainted large PNGs, shadows and text at 1080p or 4K on the same main thread as MediaPipe. | Public mode caps the backing store at a 1600 px edge and 1.44 million pixels while keeping full-size CSS presentation and unchanged normalised geometry. iPad 1180×820 and research mode remain native. |
| 4 | Chopsticks path risked being coupled to flexion classification | Earlier calibration/tool-flexion support could be mistaken for the gameplay pointer source. | The public chopsticks task is explicitly exercised through the Level 6 Hand path as affected-side index-fingertip dwell. Finger flexion is not a prerequisite for cursor movement, pickup or release. |

## Safety and clinical behaviour preserved

- Affected-side hand selection, handedness checks, finite-landmark checks, fresh decoded-frame generation and stale/duplicate-frame rejection are unchanged.
- No opposite-hand fallback was added.
- Level 6 no longer substitutes a Pose wrist for the affected hand.
- The chopsticks activity remains index-fingertip dwell; the change does not add a grip, pinch or flexion requirement.
- Existing open-before-close, tool-gate and release-dwell rules for other Level 6 grasp/tool activities remain unchanged.
- Research mode retains the previous inference/smoothing and uncapped canvas behaviour.
- Canvas downscaling changes backing resolution only; task coordinates, target geometry, scoring and timers remain in CSS/canvas-normalised space.

## Browser and automated validation

- Full Node suite: **490 tests / 487 passed / 0 failed / 3 intentional skips**.
- New v97 tests cover single-model routing, direct Level 5/6 cursor mapping, research isolation, canvas limits and Level 6 chopsticks/flowers end-to-end QA routing.
- `tools/checkjs.sh`, service-worker and shell syntax checks, and `git diff --check` passed.
- Playwright visual/functional QA:
  - Level 6 flowers, 1920×1080 CSS display, 1600×900 canvas backing store.
  - Level 6 chopsticks, 1180×820, two consecutive index-tip frames mapped to the current frame exactly; `gameType: dwell`.
  - Level 5 flowers, 820×1180, two consecutive frames mapped to the current frame exactly.
  - Pause/resume toggled through a real button click.
  - Zero page errors in all scenarios.

## Public build isolation

`dist/public` was regenerated with `scripts/build-dist.sh` (189 files, 88 MB). The index, manifest and service worker carry aligned `v97-20260903-level5-6-low-latency` markers; the single-model Level 6 route, direct Level 5/6 cursor path and canvas limit are present after sanitisation. Public-isolation plus v97 regression tests passed 10/10. A clean static-server boot with service workers blocked reported `window.__qa` as `undefined`, zero page errors and the correct manifest marker; no `research/` or `tests/` directory is shipped.

## Residual risks and bedside checks

- Synthetic landmarks and desktop Chromium cannot reproduce iPad thermal throttling, real hemiplegic movement, chopstick occlusion, ward lighting or external-display hardware.
- Direct cursor mapping intentionally trades some visual smoothing for lower latency. Bedside testing should confirm that tremor/jitter remains clinically acceptable.
- The display backing cap may look slightly softer on a 4K monitor, but interaction geometry and full-screen layout are unchanged.
