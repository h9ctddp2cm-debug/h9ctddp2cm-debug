# v96 Release and Security Review — Level 5/6 Detection Robustness

Build marker: `v96-20260903-level5-6-detection-robustness`
Date: 2026-09-03 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `tests/`, `progress.md`, `dist/public`

## Evidence reviewed

Five iPad screen recordings from the therapist (2026-09-02 23:37–23:43): Level 5 cards, Level 5 laundry, Level 5 flowers, Level 6 chopsticks (calibration never leaves 尚未偵測), Level 6 flowers (landscape). Frames were extracted with ffmpeg; the chopsticks calibration frames were replayed through the real MediaPipe Hand Landmarker inside headless Chromium against the v95 page.

## Root causes and changes

| # | Symptom | Root cause | Change |
|---|---------|-----------|--------|
| 1 | Chopsticks calibration stuck at 尚未偵測 | Normal-flow chopsticks satisfied `isGrossTabletop() && !isLevel6ToolGestureTask()`, so `interpretHandResults` entered the pose fallback and referenced `videoEl`, which is not in that function's scope. The first hand-less frame threw `ReferenceError` inside the calibration RAF loop and the loop stopped. Present since v67; reproduced in headless Chromium. | `interpretHandResults(results, inputMirrored, videoEl)`; fallback condition is now `isGrossTabletop() && !isLevel6()` (all normal Level 6 tasks fail closed); `detectWrist` catches interpretation faults (`interpret-error`); calibration and game RAF loops survive a per-frame exception (`calib-frame-error`; QA mode rethrows). |
| 2 | Level 5 cursor vanishes mid-grasp, object not carried/released | Handedness label or score dips while the whole hand closes into a fist; the strict label gate returned `affected-hand-not-detected`, which cleared cursor and grasp state immediately (not grace-eligible). | Public Level 5 only: short continuity rescue (600 ms, 0.16 normalised units from last accepted wrist, confident opposite hand ≥ 0.80 still rejected, cold-start ambiguous labels still fail closed) and `affected-hand-not-detected` now qualifies for the existing 750 ms hold. Level 6 keeps strict handedness (unchanged tests). |
| 3 | Level 6 flowers (landscape): released bloom appears stuck at the screen corner | Full-width planter plus the v77 lateral amplification placed the bloom partly off-canvas. | Placement clamped so the bloom stays visible; v77 mapping otherwise unchanged. |

## Fail-closed properties preserved

- No pose-wrist substitution for any normal Level 6 task (now including chopsticks, matching the original comment).
- Level 6 handedness: wrong hand, missing label, low confidence, missing landmarks, stale/duplicate frames all still fail closed (`tests/level67-interactions.test.mjs` unchanged and passing).
- Research track: no behaviour change (`research.active` excluded from continuity and grace).
- Level 5 continuity never admits a confidently labelled opposite hand, never admits a hand away from the tracked wrist, and expires after 600 ms.
- Grace hold only retains the last cursor/gesture; it never tracks or earns dwell from an unselected hand.

## Public build isolation

`dist/public` rebuilt with `scripts/build-dist.sh` (189 files, 88 MB). Sanitised public index contains the v96 changes and build marker. No `research/`, `tests/`, `tools/`, sandboxes, progress notes or probe files are shipped. Temporary probe artefacts (`probe.html`, `qa_frames/`) were deleted before commit.

## Tests

- New: `tests/v96-level5-6-detection-robustness.test.mjs` (6 tests: chopsticks hand-less frame does not throw and fails closed; gross-tabletop fallback tolerates missing video element; Level 5 continuity accept/reject matrix; Level 6 remains strict; grace scope Level 5 only; flower placement stays inside canvas on landscape and portrait).
- Full suite: 51 files, 485 tests, 482 passed, 0 failed, 3 intentional skips.

## Residual risks / follow-ups

- The chopsticks close/open decision still requires a participant-specific flex range (calibration or in-game adaptation) by design; calibration now proceeds, so this path can be exercised on device.
- Hand lost when it leaves the camera field of view (top or bottom of frame) is a physical limit; the safe-area mapping is unchanged.
- Whether the planter's lateral amplification should be reduced on landscape is a design choice for the therapist to confirm.
