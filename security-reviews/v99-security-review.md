# v99 Release and Security Review — Handedness-Check Switch, Calibration Hand Lock, Calibration Privacy Blur

Build marker: `v99-20260904-hand-check-switch-lock-privacy-blur`
Date: 2026-09-04 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `tests/`, `progress.md`, `dist/public`, new `img/fridge_apple.png`, `img/fridge_durian.png` (unreferenced until v100)

## Therapist requests addressed

1. Left/right hand check ON/OFF, and after calibration the game must stay on the participant's hand and not be captured by other objects, passing people or hands in the background.
2. Blur the calibration camera view so other patients in the ward are not exposed (video-call style).

## Changes

| # | Area | Change | Scope |
|---|------|--------|-------|
| 1 | Settings | `state.handednessCheck` (default ON each page load); ON/OFF buttons inside the 患側方向 card with an explanatory note; hidden for Level 3/4. | Public Level 5/6 only |
| 2 | Hand admission | `handLock` (last wrist + EMA hand span). Size gate 0.55–1.90× with 3 s forget; lock override against a far strict winner while the tracked hand is fresh; 400 ms re-acquisition debounce for a hand far from the lock after the track is stale. Cleared on camera start/stop, kept across rounds. | Public Level 5/6 only |
| 3 | Check OFF | Label ignored; follows the locked hand (continuity), else a lone hand, else the hand nearest the lock within 0.30. | Public Level 5/6 only |
| 4 | Calibration screen | Canvas privacy blur (two-stage down-scale, dark overlay) with a sharp rounded window around the detected hand (Level 5/6) or affected shoulder/elbow/wrist (Level 3/4). Toggle button, default ON. Video element hidden while active. | All levels, calibration screen only |

## Clinical and safety analysis

- Research mode: `handLockEnabled()` and `handednessCheckOff()` both derive from `affectedHandContinuityEnabled()`, which is false when `research.active`. Research strata keep the strict label rule and are unaffected by the switch, the lock and the size gate. Verified by the Level 4 default-page strict test and the existing v98/v96 admission tests.
- Default is the safer setting: the check is ON on every load; OFF must be chosen deliberately on the settings screen and the note states the intended population (alert participants who understand to use the affected hand, therapist present).
- OFF does not remove the affected-side selection; Level 5/6 placement geometry, target side and reporting remain tied to the selected side.
- The lock reduces, but cannot eliminate, capture by another hand: a second hand of similar size that enters within 0.30 of the participant's last position after the participant's hand has been absent for >1.5 s can be admitted (immediately with check OFF; with check ON only if labelled as the affected side or alone for 1 s per v98). Therapists should keep demonstration hands away from the participant's working area.
- Size gate uses only wrist→middle-MCP span from MediaPipe landmarks, no additional model or biometric storage; the value lives in memory and is reset when the camera stops.
- Level 6 chopsticks remains `gameType:'dwell'`; no flexion requirement added. Grasp/pinch thresholds, fresh-frame checks, open-before-close, tool-gate and release-dwell rules are unchanged.
- Privacy blur: all processing is on-canvas in the browser; no frames leave the device. The blurred image is a 40 px-wide resample (≈ 2–3 px across a face at normal ward distance). The sharp window reveals only the hand/arm bounding box (+28 % padding); a face directly behind the participant's hand would be visible inside that window — documented as a limitation. Mirror mode is applied consistently to blurred and sharp layers so the dot overlay still aligns.
- The game screen camera preview is not blurred in this release (documented for the therapist).

## Public build isolation

- Sanitizer output contains no `window.__qa`, `advanceTime`, `privacySharpWindow` or research tokens (`tests/v78-public-build-isolation.test.mjs` passed against the rebuilt `dist/public`; static-server boot check `typeof window.__qa === 'undefined'`, no page errors).
- New QA hooks (`setHandednessCheck`, `handLock`, `setPrivacyBlur`, `privacySharpWindow`, `state().handednessCheck/privacyBlur`) exist only in the source build.

## Validation

- Node suite: 510 total / 507 passed / 0 failed / 3 intentional skips (four bounded groups).
- `tools/checkjs.sh` all blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- Build markers aligned ×3 (`LEVEL_APP_BUILD`, `CACHE_VERSION`, manifest `start_url`) and the seven marker tests updated.
- iPad Playwright QA (820×1180, 1180×820) with `--use-fake-device-for-media-stream`: settings block ON/OFF and hidden for Level 4; calibration blur ON (video opacity 0, class set), simulated sharp window, blur OFF (video opacity 1, label 背景模糊：關). Screenshots in `ych_rehab_qa_artifacts/v99/` visually inspected.

## Residual risks

- Fixed blur strength; very close faces stay recognisable in outline.
- Lock cannot distinguish two similar-size hands entering the same place after a >1.5 s gap.
- Fake-camera QA cannot reproduce ward lighting or the real hand model; bedside check with `?perf=1` recommended (watch `check`, `lockSize`, `size`/`far` counters).
