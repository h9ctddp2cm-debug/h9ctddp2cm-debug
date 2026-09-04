# v98 Release and Security Review — Level 5/6 Hand Admission, Render Cache, 30 s Safety Pause

Build marker: `v98-20260904-level56-hand-admission-render-cache-hold30s`
Date: 2026-09-04 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `tests/`, `progress.md`, `dist/public`

## Evidence reviewed

Therapist recording `IMG_6325.mov` (Windows laptop, browser window mirrored to a ward TV, Level 5 dim sum) and the accompanying bedside report: slow detection, cursor absent for around 20 s while the participant performed the correct movement, inconsistent reappearance, open/closed hand icon flickering, and the red pause overlay appearing after 5 s.

## Root causes and changes

| # | Symptom | Root cause | Change |
|---|---------|-----------|--------|
| 1 | Red screen after 5 s | `MAX_HOLD_MS = 5000` safety pause fired on any hand that had not moved for 5 s, including slow reaches. | `MAX_HOLD_MS = 30000`; overlay copy derives from the constant. The pause still exists. |
| 2 | Cursor vanishes for tens of seconds although the hand is visible | Affected-hand gate rejected every frame whose MediaPipe handedness label was not the affected side at ≥0.55 confidence. A low webcam viewing the hand edge-on / from the dorsum produces wrong or uncertain labels for long stretches; continuity rescue (600 ms, Level 5 only) was shorter than a few slow inferences. | Public Level 5 and 6 only: continuity window 600 → 1500 ms and applied to Level 6; lone-hand admission (see policy below); 750 ms handedness-dropout grace applied to Level 6. Research mode unchanged. |
| 3 | Hand icon toggles open/closed every frame | Public Level 5 grasp stabiliser confirmed a flip after 30 ms — effectively the next frame. | Confirmation window 60 ms (two consecutive frames at 30 fps). |
| 4 | Slow detection / rendering on laptop | Megapixel photo assets resampled from full resolution every frame; hand model always on GPU delegate on non-Apple devices even when the iGPU/WebGL path is slow. | Down-sampled bitmap cache for large images; measured-cost GPU/CPU delegate selection with `?handDelegate=` override; `?perf=1` HUD. |

## Clinical policy change — affected-hand admission (public Level 5/6)

Order of evaluation per frame:

1. Strict: a hand labelled as the affected side with confidence ≥0.55 (highest confidence wins). Unchanged.
2. Continuity: an ambiguously labelled hand (missing, <0.55, or opposite but <0.80) within 0.16 normalised units of the last accepted wrist, within 1500 ms. Previously 600 ms and Level 5 only.
3. Lone hand: exactly one hand in view. Admitted at once if its label is affected/unknown/uncertain (<0.55). If it is confidently labelled as the opposite hand it is admitted only after being continuously alone in view and opposite-labelled for 1000 ms; any uncertain frame, a second hand, or an empty frame resets that streak.
4. Two or more hands: no lone-hand rule; a confidently opposite hand is never admitted; an ambiguous hand elsewhere is rejected. An assisting hand therefore cannot displace a visible affected hand.

Residual clinical risk: if the participant's hand leaves the frame and a therapist's hand is the only hand in view for more than one second, the game will track it. Therapists should keep demonstration hands out of frame or accept that those seconds are not participant performance. Research mode retains the strict fail-closed rule.

## Safety and clinical behaviour preserved

- Fresh decoded-frame generation, stale/duplicate-frame rejection, finite-landmark checks, open-before-close, tool-gate and release-dwell rules for Level 6 are unchanged.
- Chopsticks remains affected-side index-fingertip dwell (`gameType: dwell`); no flexion requirement was added.
- Grasp/pinch thresholds and personal calibration values are unchanged; only the stabiliser confirmation time changed.
- Render cache changes backing bitmaps only; task geometry, targets, scoring and timers are unchanged. Atlas/source-rect draws and Level 4 are untouched.
- Delegate selection writes one small `localStorage` record (`fthue.handDelegate.v98`) on the device, never in QA or research sessions; no data leaves the device.
- `?perf=1` and `?handDelegate=` are read-only URL flags; the HUD shows performance counters only, no participant data.

## Browser and automated validation

- Full Node suite in four bounded groups: **500 tests / 497 passed / 0 failed / 3 intentional skips**.
- New `tests/v98-level56-hand-admission.test.mjs` (10 tests) covers the 30 s pause, cached draws, perf instrumentation, delegate logic, admission constants and the lone-hand / continuity / two-hand behaviour in Level 5 and Level 6, plus the default Level 4 page remaining strict.
- Updated tests: `level67-interactions` (fail-closed cases with a second hand after the windows lapse), `v96-level5-6-detection-robustness` (v98 policy), `v77-accessible-grab-preview`, `v67-bedside-usability`, seven marker tests.
- `tools/checkjs.sh`, `node --check service-worker.js` and `git diff --check` passed.
- Playwright iPad QA at 820×1180 (Level 5 dim sum) and 1180×820 (Level 6 flowers with a label-dropout continuity admission, Level 6 chopsticks `gameType: dwell`), plus the `?perf=1` HUD in both orientations; screenshots visually inspected, zero page errors. Note: local `serve` redirects `/index.html?x` to `/` and drops the query, so QA used `/?perf=1`; GitHub Pages serves `index.html?perf=1` directly.

## Public build isolation

`dist/public` regenerated with `scripts/build-dist.sh`; index, manifest and service worker carry aligned `v98-20260904-level56-hand-admission-render-cache-hold30s` markers. Public-isolation test passed; a clean static-server boot reported `window.__qa` as `undefined` and zero page errors; no `research/` or `tests/` directory is shipped.

## Residual risks and bedside checks

- Laptop model, browser, display mode and webcam position in the ward are unknown; synthetic landmarks and desktop Chromium cannot reproduce them. Ask the therapist to open the game with `?perf=1` and photograph the HUD during a slow session.
- The lone-hand rule is a deliberate trade of strictness for availability in public mode; observe whether therapist hands are ever tracked during demonstration.
- 60 ms grasp confirmation adds roughly one frame of latency to pickup/release versus v97.
