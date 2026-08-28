# v63 Level 6 no-angle-selector — completion record

Date: 2026-08-27  
Version: `v63-20260827-level6-no-angle-selector`

## Implemented

- The complete shared shoulder-flexion target card is hidden for normal FTHUE Level 6 setup.
- Level 3 still offers exactly 30°, 40°, 50°, and 60°.
- Level 4 still offers exactly 60° through 180° in 10° steps.
- Level 6 uses the existing conservative 60° internal transport endpoint and does not require or accept a therapist-facing target choice.
- All six Level 6 activities remain available: Flower Arranging, Chopstick Dim Sum, Cloth-Peg Laundry, Playing Cards, Mahjong, and Cook Egg Fried Rice.
- Chopstick index/middle open-close and laundry tripod-grasp interaction paths remain covered.
- Traditional Chinese and English setup, safety, calibration, and activity copy no longer describe a Level 6 angle choice or goniometer target.
- App, manifest, and service-worker markers are aligned to v63.
- `dist/public` was rebuilt: 134 files, approximately 83 MB.

## Validation

- Focused tests: 72/72 passed.
- Full Node suite: 251 total; 248 passed; 0 failed; 3 intentional skips.
- Source technical validator: 151/151 passed:
  - Level 2: 37
  - Level 3: 21
  - Level 4: 21
  - Level 5: 40
  - Level 6: 32
- JavaScript module and inline-block syntax checks passed.
- `git diff --check` passed.
- Production bundle static audit passed:
  - v63 markers aligned
  - Level 6 selector guard restricted to Levels 3/4
  - six Level 6 task controls present
  - no Level 6 `60–120°` or goniometer setup wording
  - authoring probes excluded
  - production JavaScript syntax valid

The production bundle intentionally excludes `window.__qa`, so the interactive technical validator runs against source. Production output was checked separately with static, syntax, marker, exclusion, and browser QA.

## iPad QA

Playwright QA used normal clicks at:

- 820 × 1180 portrait
- 1180 × 820 landscape

Confirmed:

- Level 3 exact selector and 50° selection.
- Level 4 exact selector and 120° selection.
- Level 6 target card absent in Traditional Chinese and English.
- All six Level 6 task controls synchronize the selected task, title, and preview.
- No horizontal overflow.
- No console or page errors.
- Eight screenshots visually inspected; no clipping, overlap, or Level 6 selector leakage found.

Artifacts:

- `/home/user/workspace/ych_rehab_qa_artifacts/v63-level6-no-angle-selector/qa-inventory.json`
- `/home/user/workspace/ych_rehab_qa_artifacts/v63-level6-no-angle-selector/ipad-qa-results.json`
- `/home/user/workspace/ych_rehab_qa_artifacts/v63-level6-no-angle-selector/browser/`
- `/home/user/workspace/ych_rehab_qa_artifacts/v63-level6-no-angle-selector/source-tech/`
- `/home/user/workspace/ych_rehab_games_advanced/full-node-v63.log`

## Limitation

Automated tests and simulated landmarks do not replace bedside testing with a real affected hand, physical chopsticks or cloth pegs, tool occlusion, ward lighting, shoulder tolerance, and the target iPad/Safari camera.

No commit, push, publish, or deployment was performed.
