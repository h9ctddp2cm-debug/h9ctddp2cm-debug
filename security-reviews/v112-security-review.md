# v112 Security / Privacy Review — public build has no recording capability

Date: 2026-09-12 · Branch `feature/level3-bilateral-sandbox` · Marker `v112-20260912-public-no-recording`

## Rationale
The therapist will present the public website (https://dorothy-tang.github.io/) to the IRB. Recording Hospital
Authority patients is not part of the pilot, so a recording feature on the public site — even one that is never
pressed — would undermine trust. v112 therefore removes recording from the public build entirely and renames the
non-recording mode from 「試玩」 to 「訓練」. The behaviour of the remaining button is byte-for-byte the previous
trial semantics: no `MediaRecorder`, no compensation-observation button or therapist alerts, adaptive controller in
`mode:'trial'` (practice counts only, no level recommendation), camera stopped at `endGame()`.

## What changed
| Area | Source / research build | Public build (`dist/public`) |
| --- | --- | --- |
| Mode buttons | `訓練` (trial semantics) + `訓練＋錄影` (recording) | `訓練` only, spans the card |
| `movementRecording` module, `MediaRecorder`, head-excluded stream | present, inside `PUBLIC_BUILD_REMOVE` markers | stripped |
| `#recordingIndicator`, `#movementReview` panel, download/delete controls, their CSS | present, marked | stripped (HTML by markers, CSS by sanitizer) |
| `movementRecordingApi` facade | delegates to module | inert (`available:false`) |
| `beginSessionMode()` / `exitToLevelSelection()` | unchanged defaults when module available | always `sessionMode='trial'` |
| Research block (`recording_status` params) | unchanged | already stripped (pre-existing markers) |

## Fail-closed guards added to `scripts/sanitize-public.cjs`
- Public index must not contain `MediaRecorder|captureStream|createHeadExcluded|recordingIndicator|movementReview|MovementVideo|movementRecording.|downloadMovementVideo`.
- Public index must not contain `data-session-mode="training"` or `button-mode-training`.
- Public index must not contain `錄影|無聲錄|不錄頭部|試玩|Trial mode|Silent recording`.
- Public `localization.js` drops any dictionary line matching recording / 試玩 / Trial copy and fails if any remains.
- Existing research/pilot guards unchanged; `__qa` still absent from the public index.

## Privacy constants unchanged
`numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE`, calibration blur / person-segmentation privacy constants, v101/v110 constants, chopstick `slotRatios`, handedness check default ON. Level 5 gameplay untouched. Research-mode strings untouched.

## Validation
- Node test suite (63 files) in four groups — 576 passed / 3 skipped / 0 failed (113 + 168/171 + 157 + 138), `tools/checkjs.sh` 11 OK, `node --check service-worker.js`, `git diff --check`.
- `./scripts/build-dist.sh` → 202 files; `tests/v78-public-build-isolation.test.mjs` 5/5 and `tests/v112-public-no-recording.test.mjs` 5/5 after build.
- `rg` on `dist/public`: no `錄影|試玩|MediaRecorder|button-mode-training|recording-indicator|__qa` in index.html; no `錄影|recording|試玩` in localization.js or fthue-adaptive-progression.js strings.
- Playwright QA on laptop 1413×653 and iPad 1180×820 / 820×1180, public and source builds: zero page errors; public DOM has no `#recordingIndicator` / `#movementReview` / `[data-session-mode="training"]`.

## Residual notes
- The source repository still contains the recording implementation for a possible future, ethics-approved version; it is never shipped to GitHub Pages.
- `fthue-adaptive-progression.js` is copied to the public build as-is, so its 試玩 wording was removed at source level (English comment mentioning "Trial (試玩) mode" remains as a code comment only, not user-facing).
