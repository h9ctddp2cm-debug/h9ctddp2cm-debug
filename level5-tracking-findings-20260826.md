# Level 5 tracking investigation — 2026-08-26

## Scope

Reviewed the current v50 Level 5 camera path from MediaPipe hand landmarks through selected-side admission, grasp calibration and hysteresis, gesture dwell, tracking-loss grace, and held-object release. Existing repository notes and demo media were also checked; no real Level 5 landmark telemetry or identifiable bedside gameplay trace was present, so the device-specific conclusions below remain hypotheses until target-iPad validation.

## Likely real-device failures found

1. **Wrong hand could drive gameplay.** Hand Landmarker requested only one hand, and `detectWrist()` always consumed `results.landmarks[0]`. There was no check against the configured affected anatomical side, so an unaffected or therapist hand could silently acquire, move, and release a Level 5 item.
2. **Calibrated aggregate score could override clear finger evidence.** Personalized thresholds completely replaced the direct two-finger curl/reopen rule. Reach-related foreshortening can shift normalized fingertip-to-palm distances enough for a clearly curled or reopened hand to remain on the wrong side of the calibrated threshold.
3. **Stale tracking could finish release dwell.** The last detected gesture/cursor was retained for a 750 ms tracking grace, longer than Level 5's 650 ms release dwell. A brief detector loss after an open sample could therefore release an object without fresh landmarks.
4. **Synthetic coverage bypassed the camera admission path.** Existing interaction tests mainly injected cursor position and grasp booleans through QA hooks. They did not exercise Hand Landmarker handedness, candidate selection, or dwell behavior during tracking grace.

## Small correction implemented

- Request up to two hand candidates and admit only the selected affected side. Missing/unknown handedness or an opposite-side-only result fails closed rather than falling back to candidate zero.
- Preserve personalized grasp hysteresis, but allow two directly visible curled fingers to enter and two directly visible reopened fingers to exit even when the aggregate calibrated score conflicts.
- Keep the held object and last cursor stable during brief tracking grace, but reset pickup/release dwell so stale landmarks cannot complete either action.
- Add deterministic QA probes and Level 5 browser regression tests for all three cases.

## Focused validation

- `node --test tests/level5-tracking.test.mjs tests/tracking-regression.test.mjs`: **34 passed, 0 failed, 0 skipped**.
- `bash tools/checkjs.sh`: **all 10 inline script blocks passed syntax validation**.
- `git diff --check`: **passed**.
- Full suite: **207 passed, 0 failed, 3 intentional skips** across 210 tests.
- Source technical validation: **211/211 passed**, including **40/40 Level 5** checks.
- `bash scripts/build-dist.sh`: **passed**, producing 133 public files (83M).
- Rebuilt `dist/public` contains the corrected mapping and aligned
  `v52-20260826-right-hand-label-fix` app, manifest and service-worker markers.
- The technical-validation runner cannot execute against the hardened public
  bundle because `build-dist.sh` intentionally removes `window.__qa` and
  `window.advanceTime`; its dist run timed out waiting for that absent test-only
  interface. This is a packaging boundary, not a gameplay assertion failure.

## Files changed for this task

- `index.html` — affected-hand candidate selection, two-finger/calibrated hysteresis reconciliation, fail-closed tracking-grace gates, and QA probes.
- `tests/level5-tracking.test.mjs` — new deterministic regression coverage.
- `service-worker.js`, `manifest.webmanifest` and release-marker tests — v52
  cache/build alignment.
- `dist/public/*` — rebuilt static distribution.
- `progress.md` — v52 diagnosis and validation handoff.
- `level5-tracking-findings-20260826.md` — this handoff.

The worktree already contained unrelated modified and untracked v50 files before this investigation; they were not cleaned, committed, deployed, or published.

## Remaining bedside limits

- Test on the actual iPad/browser with the affected hand entering first, the unaffected/therapist hand entering first, both hands visible, and one hand crossing the other.
- Two-hand inference may reduce frame rate on older iPads; confirm responsiveness and thermal behavior during a full session.
- Severe partial-hand visibility may omit or misclassify handedness. The new behavior intentionally fails closed, so camera angle, lighting, sleeve position, and keeping the palm plus fingertips visible remain important.
- Re-run open/close calibration after camera repositioning. The correction tolerates conflicting aggregate scores when two fingers are clearly visible, but cannot recover landmarks that the model does not produce.
- Confirm clinically that holding the item stationary through a short tracking miss is preferable to immediately dropping it; no score or release can occur until fresh affected-hand tracking returns.

## v51 right-hand regression and correction

The first selected-side-only implementation applied the legacy MediaPipe Hands
rule and swapped `Left`/`Right` for every raw webcam frame. That rule is obsolete
for the bundled current MediaPipe Tasks Hand Landmarker: MediaPipe v0.10.5
explicitly changed the task with “Swap left and right hand labels.” The raw
decoded `<video>` passed to `detectForVideo()` is unmirrored; this app's
`scaleX(-1)` is CSS presentation only. The additional application swap therefore
turned the selected anatomical right hand into `left`, rejected it during
calibration and gameplay, and waited for an opposite hand that must never be a
fallback.

The correction now treats current Hand Landmarker labels from the raw camera
frame as anatomical labels. A swap is performed only when pixels supplied to
inference are explicitly mirrored. Deterministic tests cover left and right
selection for both unmirrored and mirrored inference inputs, plus missing and
opposite-only fail-closed cases.

Pose-wrist association was considered but deliberately not added to this small
fix. Level 5 currently runs Hand Landmarker only; loading and running Pose
Landmarker on the same frames would add a second model to the older-iPad hot
path. The root cause is the deterministic double label swap, and retaining
handedness-gated two-candidate selection fixes it without allowing candidate
zero or an assisting/therapist hand to become a fallback.
