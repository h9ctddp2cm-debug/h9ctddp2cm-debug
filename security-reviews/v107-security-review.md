# v107 Release and Security Review — Lone-Hand Admission and Grasp Stability

Build marker: `v107-20260907-lone-hand-grasp-stability`
Date: 2026-09-07 (HKT)
Scope: `index.html` (hand-lock constants, `handSizeAdmissible`, `selectedAffectedHandIndex`, `stabiliseDetectedGesture`, `detectionLostGraceMs`, tracking-loop grace check, QA probe, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist request

On the department laptop (HP ProBook 440 G8, Edge, 720p webcam, participant inside 1 m) the public Level 5 cursor vanished for seconds and the ✋/✊ cue flickered although frame rate and tracking latency were healthy. The `?perf=1` overlay showed the only visible hand being rejected by the v99 size and far gates. The therapist asked for admission that is "唔好咁嚴但係又玩到".

## Change summary

| Area | v106 | v107 (public Level 5/6 only) |
|------|------|------|
| Size window, exactly one hand visible | 0.55–1.90 × locked size | 0.40–2.50 × locked size |
| Locked size forgotten, one hand visible | after 3000 ms of rejections | after 1000 ms |
| Far-from-lock debounce (400 ms) | every re-appearance | skipped when the lone hand carries a confident affected label; still applied to ambiguous hands and to every frame with ≥2 hands |
| Far debounce timer | not reset after admission (later far hand admitted instantly) | reset on admission |
| Detector-miss grace (cursor held, interactions paused) | 750 ms | 1500 ms (`detectionLostGraceMs()`); Level 3/4 and research keep 750 ms |
| Level 5 open/closed cue confirmation | 60 ms (2 frames) | 180 ms (~6 frames); research keeps 60 ms |
| Frames with ≥2 hands | v99 rules | unchanged |

## Safety and privacy analysis

- Wrong-hand protection is preserved where it matters: the relaxations apply only when `allLandmarks.length === 1`. As soon as a second hand (carer, therapist) is in view, the crowded window 0.55–1.90, the 3 s forget time and the 400 ms far debounce apply unchanged, and `level67-interactions` still proves the opposite hand plus a second hand cannot pick anything up (now for 1700 ms > the 1.5 s grace).
- The lone-hand relaxation admits the hand only through the existing strict / continuity / lone paths; the handedness check (`check on`) and `HANDEDNESS_OPPOSITE_REJECT 0.80` are untouched.
- The longer grace changes what is displayed, not what is scored: `detectionHeldGrace` still blocks pick-up and release, so a stale open/closed state cannot complete an action; verified by the existing Level 5 grace test and the new v107 test (`held` stays null through the grace).
- The 180 ms confirmation only debounces the open/closed cue and pick/release trigger in public Level 5; Level 6 already used 180 ms. Research strata use `GESTURE_CONFIRM_MS 60`, `DETECTION_LOST_GRACE_MS 750` and the v99 lock constants — every new branch is behind `!research.active` (`handLockEnabled()`, `detectionLostGraceMs()`, `stabiliseDetectedGesture`).
- No new network, storage, camera or asset behaviour; camera constraints, landmarker options (`numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`), `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE`, privacy blur/segmentation are unchanged.
- Public build sanitizer output unchanged in kind: `window.__qa`/`advanceTime` absent, no research strings, isolation test 5/5.

## Verification

- Four Node test groups (59 files): 549 passed / 3 skipped / 0 failed, including the new `tests/v107-lone-hand-grasp-stability.test.mjs`.
- `tools/checkjs.sh` all blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- `./scripts/build-dist.sh` → 200 files; markers aligned ×3; `tests/v78-public-build-isolation.test.mjs` 5/5 after the build.
- Fresh static server on `dist/public`: `window.__qa` undefined, marker `v107-20260907-lone-hand-grasp-stability` present, no page errors.
- Playwright QA (fake camera, swiftshader) iPad 820×1180, 1180×820 and laptop 1413×653: Level 5 fridge and dim sum, cursor still shown 1 s after a detector miss, HUD `perf v107`, no page errors; screenshots inspected.
