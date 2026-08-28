# v38 Level 2–4 clinical remap handoff

## Implemented

- Level 2 is the only tabletop-supported level.
  - `bilateral`: inherited bilateral towel/affected-side lateral slide, with camera control restricted to the selected affected wrist.
  - Preserved former supported elbow/path games: dim sum, wipe-window, bowling, mahjong wash and bus pay.
  - Existing v35 hands-free endpoint capture, selected anatomical indices, mirror correctness, stale/duplicate protection and torso continuity remain in the preserved Level 2 controller.
- Level 3: shoulder-flexion games with therapist-selected camera-estimated targets exactly `{30,40,50}` degrees.
- Level 4: shoulder-flexion games with therapist-selected camera-estimated targets exactly `{60,70,80,90,100,110,120,130,140,150,160,170,180}` degrees.
- Every Level 3/4 object gets a deterministic-random required start from `{0,10,20}` degrees, with no immediate repeat when alternatives exist.
- Camera/tracking starts only after target selection. After Start there is no therapist capture/confirm step.
- Stable required-start acquisition, stable target reach and stable return-to-start re-arm are generation-idempotent and hands-free.
- Shoulder diagnostics/results expose selected start and target, observed stable baseline estimate, current/peak camera estimate, target state and repetitions.
- Selected affected arm is fixed to left 11/13/15 or right 12/14/16. Mirror changes display only. Opposite-arm-only, selected-arm loss, stale frame, duplicate frame, torso discontinuity, visible shoulder hike and trunk lean fail closed.
- Added practical affected-side anterior-oblique 30–45° single-tablet guidance. UI explicitly says estimates are training feedback, not goniometry or automatic FTHUE classification.
- Added a six-photo offline Tsuen Wan street-scene matching activity across Levels 2–4. Photos are local optimized JPEGs and include in-app plus machine-readable attribution.

## Files in the final working tree

### Added in this task

- `shoulder-flexion-controller.js`
- `image-sources.json`
- `img/advanced/tsuenwan_chuen_lung.jpg`
- `img/advanced/tsuenwan_market_street.jpg`
- `img/advanced/tsuenwan_downtown.jpg`
- `img/advanced/tsuenwan_skyline.jpg`
- `img/advanced/tsuenwan_plaza.jpg`
- `img/advanced/tsuenwan_tak_wah_park.jpg`
- `tests/shoulder-flexion-levels.test.mjs`
- `tests/tsuenwan-photo-assets.test.mjs`
- `v38-level2-4-handoff-20260825.md`

### Modified in this task

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `scripts/build-dist.sh`
- `sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs`
- `tests/adaptive-progression.test.mjs`
- `tests/level4-independent-games.test.mjs`
- `tests/tracking-regression.test.mjs`
- `tests/ui-layout.test.mjs`
- `progress.md`

### Pre-existing uncommitted v35 files preserved

- `level4-elbow-calibration.js`
- `level4-three-games-module.js`
- `tests/fixtures/level4-two-point-test-helpers.mjs`
- `tests/level4-bedside-preflight.test.mjs`
- `tests/level4-frame-freshness.test.mjs`
- `tests/level4-games-behavior.test.mjs`
- `tests/level4-generation-idempotence.test.mjs`
- `tests/level4-auto-calibration.test.mjs`
- `tests/level4-axis-mapping.test.mjs`
- `tests/level4-handsfree-v33.test.mjs`
- `tests/level4-manual-current-frame.test.mjs`
- `tests/level4-ordered-cycles.test.mjs`
- `movement-gate-diagnosis-2026-08-24.md`
- `sandbox/level4-v33-browser-qa.mjs`
- existing modified technical report/result files under `sandbox/level4-6-technical-validation/`

## Validation

- `bash tools/checkjs.sh`: passed, inline blocks 0–8.
- `node --check shoulder-flexion-controller.js`: passed.
- `node --check level4-elbow-calibration.js`: passed.
- `node --check level4-three-games-module.js`: passed.
- `node --check service-worker.js`: passed.
- `node --check sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs`: passed.
- `NODE_PATH=/home/user/node_modules node --test tests/*.mjs`: 178 total, 175 passed, 0 failed, 3 intentional skips.
- `bash scripts/build-dist.sh`: passed; `dist/public` has 129 files / 76 MB.
- `git diff --check`: passed.
- Updated technical validation, source: 211/211 passed.
- Updated technical validation, final rebuilt dist: 211/211 passed.
  - Level 2: 106
  - Level 3: 20
  - Level 4: 20
  - Level 5: 40
  - Level 6: 25
- iPad browser QA:
  - portrait 820×1180
  - landscape 1180×820
  - Level 4 exact target selector
  - Level 3 hands-free random-start readiness
  - selected arm/trunk overlay
  - local Tsuen Wan photo objects/targets
  - no page/console errors
  - no horizontal overflow

External QA locations:

- `/home/user/workspace/ych_rehab_qa_artifacts/v38-browser-final/`
- `/home/user/workspace/ych_rehab_qa_artifacts/v38-source-final2/`
- `/home/user/workspace/ych_rehab_qa_artifacts/v38-dist-postbuild/`

## Limitations / blockers

- Motion testing is synthetic; no patient video or private uploaded media was opened, copied into source, or included in `dist/public`.
- The affected-side anterior-oblique camera is a practical single-tablet training view, not a medical-grade sagittal ROM measurement. Exact ROM requires a separate lateral camera/device or therapist goniometry.
- Real-device bedside validation remains necessary for iPad/Samsung framing, clothing/occlusion, world-landmark availability, target/start tolerances and substitution safeguards.
- The originally supplied `Tsuen_Wan_Market_Street_(full_view).jpg` binary URL was rejected by the image fetch service. It was replaced with the verified Wikimedia Commons `Tsuen Wan Market Street in February 2024` image by 姒姓賢寧 under CC BY-SA 4.0.
- No commit, push, publish or deployment was performed.
