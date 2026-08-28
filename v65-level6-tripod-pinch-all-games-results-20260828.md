# v65 Level 6 tripod-pinch repair — handoff

Version: `v65-20260828-level6-tripod-pinch-all-games`

## Implemented

- All six normal Level 6 catalog choices remain present and now launch as `gameType:'pinch'`: `flowers`, `chopstick_dimsum`, `peg_laundry`, `cards`, `mahjong`, and `cooking`.
- Every normal Level 6 frame must be a fresh Hand Landmarker generation for the selected affected anatomical hand. Missing, low-confidence, unknown, wrong-side, stale, repeated-generation, or partial-landmark input fails closed and resets partial gesture dwell.
- Pickup sequence is ordered and frame-distinct: visible tripod open preparation, sustained light close, hand-position transport, then sustained visible reopen. A static closed posture cannot arm or score.
- Thumb–index and thumb–middle aperture is normalized to palm scale. Entry accepts two moderate closures or asymmetric soft agreement (one clear closure plus the other moderately close). Hold/reopen hysteresis and safe personalized calibration remain.
- Chopstick and cloth-peg visuals remain, but both use the same tripod-pinch detector. Normal Level 6 no longer uses index/middle flexion, shoulder flexion, elbow angle, or pose readiness for pickup, progress, transport, release, or scoring.
- Pilot research tool modes were not changed. Legacy duplicate `dimsum`/`laundry`, the duplicate setup picker, and difficulty labels remain absent.

## Validation

- Focused Level 6: `44/44` passed.
- Full Node suite: `271` total; `268` passed; `0` failed; `3` intentional skips.
- Technical Level 2–6 validator: `165/165` passed; Level 6 `46/46`.
- `tools/checkjs.sh`: all 11 extracted JavaScript blocks passed.
- `git diff --check`: passed.
- Public build: `dist/public` rebuilt, `134 files`, `83M`; v65 HTML/manifest/service-worker markers verified.
- Playwright iPad QA: portrait `820×1180` and landscape `1180×820` passed with exact six-card catalog, all-six tripod-pinch setup copy, no duplicate picker or shoulder target panel, successful asymmetric-light-close pickup/hand transport/reopen score, no horizontal overflow, and no console/page errors.
- QA evidence: `/home/user/workspace/ych_rehab_qa_artifacts/v65-level6-tripod-pinch-all-games/`.

## Release boundary

No commit, push, publish, or change to `/home/user/workspace/ych_rehab_games_gh_pages_publish` was made. Automated Hand Landmarker frames do not replace supervised bedside testing on the target iPad for lighting, occlusion, handedness confidence, and each participant’s available tripod aperture.
