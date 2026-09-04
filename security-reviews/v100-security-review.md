# v100 Release and Security Review — Calibration Privacy: Participant-Only Person Segmentation

Build marker: `v100-20260904-privacy-person-segmentation`
Date: 2026-09-04 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `vendor/mediapipe/models/selfie_segmenter.tflite` (new), `tests/`, `progress.md`, `dist/public`

## Therapist request

After v99 the therapist clarified: the participant must be clearly visible, while every other part of the background (other patients, passers-by) is blurred like a video-call background.

## Change

| Area | v99 | v100 |
|------|-----|------|
| Sharp region | Bounding box around the detected hand / affected shoulder–elbow–wrist | Person mask connected to the tracked wrist (whole participant) + the v99 hand window |
| Model | None (canvas resample) | MediaPipe selfie segmenter (local 250 KB tflite, same wasm runtime), 192 px input, ≤10 runs/s |
| Other people | Blurred unless inside the hand window | Blurred; a separate person component is never revealed, even if the model labels it as a person |
| Failure mode | — | Model load/frame error → `privacySegmenterFailed`, falls back to v99 hand-window behaviour; per-frame errors are caught |

## Privacy and safety analysis

- All processing is in-browser on the calibration canvas; no frames, masks or landmarks leave the device. The model file is served from the same origin (`vendor/`) and cached by the service worker like the existing hand/pose models.
- The segmenter sees only a 192 px-wide down-scaled copy of the frame; the full-resolution video remains hidden (`opacity:0`) while blur is on.
- Participant selection is tied to the hand/pose detection already required for calibration (wrist seed, 8 % snap radius, 2.5 s memory). Before the first detection the largest person component is shown — normally the participant, who is closest and largest; a nearer bystander could be shown for those seconds. Documented as a residual risk.
- The v99 hand window is kept so the affected hand is always sharp even when the segmenter misses a hand resting on a table; a face directly behind the hand within that window is still visible (unchanged v99 limitation, now much less likely to matter because the participant's own body is the usual background of their hand).
- No change to hand admission, hand lock, handedness switch, grasp/pinch thresholds, Level 6 dwell rules or research mode. Research strata use the same calibration screen and therefore also get the improved blur; no research data path is touched.
- Segmentation results are closed after each frame (`result.close()`); mask buffers are small typed arrays reallocated per run.
- Performance: throttled to 100 ms (250 ms when slow). The participant layer and blur are 2D-canvas draws only. Headless software-GL timings are not representative; bedside `?perf=1` check recommended.

## Public build isolation

- Rebuilt `dist/public`: sanitized index 700 623 bytes, 192 files (model included, listed in `offline-assets.js`). `tests/v78-public-build-isolation.test.mjs` passed; boot check `typeof window.__qa === 'undefined'`, `advanceTime` undefined, marker present, no page errors.
- New QA hooks (`privacyPersonComponent`, `privacySegState`, `setPrivacyPersonMask`) exist only in the source build.

## Validation

- Node suite: 515 tests, 512 passed, 3 intentional skips, 0 failed after isolated reruns of the isolation test and one timing-based v98 test that had raced the concurrent dist rebuild.
- `tools/checkjs.sh` all blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- Build markers aligned ×3 and the seven marker tests updated.
- iPad Playwright QA (820×1180, 1180×820) with `--use-fake-device-for-media-stream`: real segmenter loaded (`ready:true`, masks 192×341 / 192×108, 0 components on the synthetic feed), injected person mask composite inspected, blur OFF restores the sharp video. Screenshots in `ych_rehab_qa_artifacts/v100/`.

## Residual risks

- Largest-component fallback before first detection.
- Far participants (Level 3/4 at 1.4 m) may be partially masked by a selfie-oriented model; the hand/arm window still reveals the affected limb.
- CPU cost on the ward laptop unknown until measured.
