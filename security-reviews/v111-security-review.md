# v111 Release and Security Review — Trial Result Screen Reads 訓練完成

Build marker: `v111-20260907-trial-result-training-complete`
Date: 2026-09-07 (HKT)
Scope: `index.html` (`endGame()` result title/context strings, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist request

The pilot runs all sessions in 試玩 mode because patient video cannot be recorded (privacy). For the patient it is a real training session, so the result screen should say 訓練完成 and should not mention recording at all — stating "not recording" draws attention (「此地無銀三百両」). Recording wording should only appear when recording is genuinely active.

## Change summary

| Area | v110 | v111 |
|------|------|------|
| Result title (trial) | 試玩完成 / Trial complete | 訓練完成 / Training complete (same as training) |
| Result context (trial) | `Level · 試玩 · 不錄影／不提示` | `Level · theme title` (same as training) |
| Research result context, mode buttons, recording indicator, detection logic | — | unchanged |

## Safety and privacy analysis

- Text-only change in the result screen; no detection, camera, storage, recording, network or service-worker fetch logic touched. `CACHE_VERSION` bumped so clients fetch the new bundle.
- Recording state is unaffected: `initGame()` still calls `clearMovementRecording()` in trial mode and `startMovementRecording()` only in training mode, and the `無聲錄影中 · 不錄頭部` indicator is only shown after a recorder actually starts. Trial sessions therefore never record and never display recording wording; when recording is used in future (訓練 button) the indicator appears as before — honest disclosure is preserved where it applies.
- The session mode is still distinguishable internally (`state.sessionMode`, adaptive-progression session tagging, mode-button aria-labels), so data handling and the research/non-research separation are unchanged; only the patient-facing label was unified.
- Research mode strings untouched; `__qa` absent from `dist/public`; isolation test 5/5.

## Residual risk

- Therapists can no longer tell from the result screen alone whether a session was 試玩 or 訓練; the presence of the video-review panel and the recording indicator during play still distinguish the modes.
