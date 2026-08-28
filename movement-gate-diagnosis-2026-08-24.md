# Diagnose movement gate — Level 4 bowling / mahjong

**Scope:** source inspection plus the provided 71.8 s portrait screen recording. No source files were changed. Video was inspected from its attachment path; extracted diagnostic frames stayed under `/tmp` and were not placed in this repository.

## Executive finding

The selected-arm overlay is working, but it is not a game-input readiness indicator. It is drawn from the current selected pose before calibration succeeds. Both recorded games are correctly fail-closed because the shared Level 4 controller never obtains the required endpoint(s), so it emits `calibrated:false` / `gameReady:false` / `progress:0`.

This is **not** a bowling-ball or mahjong-rendering fault. The games receive the motion packet, but reject it at their shared readiness admission.

The recording contains two failures:

1. **Automatic bowling setup is rejected as `torso-moved/person-changed`.** This is a valid safety rejection at the time it happens, but there is also a definite recovery bug: an identity retry freezes the old patient anchor permanently. A retry cannot learn a new stable anchor without resetting the session.
2. **The later Mahjong manual fallback remains at “Capture flexed start from this fresh frame (0)” with both endpoints blank.** The code has a high-probability 60 fps race: manual capture requires the last pose inference to have exactly the latest decoded-frame generation. The frame monitor can advance after the last successful Pose inference but before the user taps. The handler then refuses the capture and injects an arm-less update, which falsely appears as a temporary selected-arm loss; the next inferred pose restores the overlay and instruction, hiding the failed tap.

Mahjong additionally needs a third shoulder-horizontal-abduction endpoint after flexed and extended. Bowling needs only flexed + extended.

## Evidence from the recording

- Around the opening bowling segment, the calibration overlay visibly reports `torso-moved/person-changed`; both captured endpoints remain `—` while the right-arm skeleton continues to follow movement.
- During the Mahjong segment the patient-facing hint remains `Capture flexed start from this fresh frame (0)`. At approximately 55–65 s, therapist details show `state NOT READY`, no captured endpoints, fresh decoded frames (`gen` increasing, `age 0ms`), raw elbow angle changing (about 86° to 133°), and `progress 0.00`.
- Therefore the pose pipeline is live, but it has no endpoint pair from which to normalize the raw angle. The overlay alone cannot make a game move.

## Exact gating chain

### Overlay is independent from readiness

- `updateLevel4ReachController()` assigns `level4SelectedOverlayPose` from `lm` before the controller outcome and draws it regardless of `calibrated`/`gameReady` (index.html:8275–8283; index.html:8285–8304).
- Thus a moving teal selected-arm overlay proves only that selected shoulder/elbow/wrist landmarks are usable, not that an endpoint map exists.

### Controller is intentionally fail-closed

- A fresh arm pose is required for capture; `capture()` refuses unless `lastPoseGeneration === frameGeneration` (level4-elbow-calibration.js:242–245; 363–368).
- Normalized elbow progress is calculated only after calibration from the captured flexed and extended angles (level4-elbow-calibration.js:259–273).
- Until then normal frame updates leave the controller at `capture-flexed`/`awaiting-flexed-capture`; guidance emits the exact recording text when `manual.flexed` is false (level4-elbow-calibration.js:350–360; 476–483).

### Games correctly refuse this uncalibrated packet

- The shared game admission returns false unless `motion.calibrated && motion.gameReady === true` (level4-three-games-module.js:151–179).
- Bowling returns before changing its state, or resets its uncommitted start to `await-start` (level4-three-games-module.js:198–208). A forward throw is admitted only after a fresh, ready, calibrated reach gate (level4-three-games-module.js:252–260).
- Mahjong likewise returns before movement/path credit when not ready (level4-three-games-module.js:331–339). Its actual tile motion requires an elbow-forward phase plus a calibrated active horizontal path (level4-three-games-module.js:377–416).
- Runtime calls both standalone games every tracking pass, including invalid motion specifically so partial credit fails closed (index.html:8430–8442).

## Root causes

### Root cause A — automatic identity retry is unrecoverable after `torso-moved/person-changed` (definite code defect)

The automatic flow freezes the pre-button torso signature at start:

- `start()` stores `state.lock` and sets `state.anchorFrozen=true` (level4-elbow-calibration.js:686–699).
- While frozen, `observePreAnchor()` categorically refuses to collect a new anchor (level4-elbow-calibration.js:661–677).
- A person/torso mismatch calls `retry('torso-moved/person-changed')` (level4-elbow-calibration.js:703–720).
- `retry()` only sets the phase/reason and clears endpoint stability credit; it **does not** clear `state.lock`, set `anchorFrozen=false`, or clear/rebuild `preAnchor` (level4-elbow-calibration.js:701–702).
- A later Auto press calls `start()` again and reuses the same frozen, old `preAnchor.signature` (level4-elbow-calibration.js:686–697).

I reproduced this directly: after an identity mismatch, eight stable frames of a returned/new torso left `anchorFrozen:true`; a second start immediately failed against the original lock. This is inconsistent with the on-screen instruction that the same patient can return to frame and retry.

**Safety effect:** no game inputs should be admitted after this rejection. The failure is that recovery is impossible without a session reset, not that the gate fails closed.

### Root cause B — manual capture has an exact-generation tap race (high confidence; recording behavior matches)

- `level4ManualCapture()` first polls the current `gameVideo` frame then requires `lastPoseFrameGeneration === frame.generation` (index.html:7843–7849).
- `lastPoseFrameGeneration` changes only after `detectPose()` successfully finishes inference (index.html:10200–10217).
- The frame monitor increments `generation` independently for decoded advances, using `requestVideoFrameCallback` first (level4-video-freshness.js:42–73; index.html:4682–4695). The supplied recording is 60 fps; handheld human taps cannot reliably land in the narrow interval where the newest decoded generation is also the latest completed pose inference.
- On mismatch, the handler calls `level4Controller.update()` with frame metadata but **no** landmarks (index.html:7849–7861). The controller interprets that as `selected-arm-lost` and refuses to mark (level4-elbow-calibration.js:301–321), instead of saying that inference is catching up. A later normal tracking iteration makes the overlay and “Capture flexed…” instruction return, so a failed tap looks like no action occurred.

This explains the observed combination: a live selected-arm overlay, fresh frames, changing raw angle, the manual fallback instruction still at flexed, and empty endpoints. A screen recording cannot prove that a particular manual button tap occurred, but if it did, this path can silently reject it under ordinary live timing.

### Root cause C — Mahjong has an additional, correctly enforced endpoint requirement (configuration precondition, not a rendering bug)

- Mahjong is a horizontal-path game (`isLevel4HorizontalPathGame()` is passed as `requireHorizontal`) (index.html:8251–8273).
- After a manual extended mark, `capture()` deliberately stays uncalibrated and changes to `capture-horizontal` (level4-elbow-calibration.js:413–424).
- The third mark is accepted only if outward range is sufficient and the elbow remains close to extended (level4-elbow-calibration.js:386–403); the UI only exposes that button in `capture-horizontal` (index.html:7985–7986).

So even after fixing manual flexed/extended capture, Mahjong must not move until its horizontal endpoint has also been recorded. Bowling does not have this third step.

## Minimal safe fixes (do not weaken stale-frame or identity protections)

### 1. Re-arm the auto pre-anchor only after a person/torso rejection

In `createAutoCalibration().retry()` (level4-elbow-calibration.js:701–702), for reason `torso-moved/person-changed` only:

```js
if (reason === 'torso-moved/person-changed') {
  state.lock = null;
  state.anchorFrozen = false;
  clearPreAnchor();
}
```

Keep endpoint/controller state untouched. This maintains fail-closed behavior: the next auto attempt must first observe six new pre-button fresh torso frames (`preAnchorMinFrames`) before `start()` will accept it. Do **not** apply this on transient stale-frame or selected-arm-loss paths, where preserving the identity lock remains safer.

Optional small UX improvement: after this specific retry, say “patient in frame, hold still while re-anchoring; then press Auto” rather than suggesting an immediate retry.

### 2. Make manual capture synchronously admit the current pose once, then mark it

In `level4ManualCapture()` (index.html:7843–7875), retain the requirement for a fresh decoded frame but remove the impossible requirement that background inference has already completed for the latest frame.

Recommended safe sequence:

1. Poll `frame = level4FrameStatus(gameVideo)` and fail closed if `!frame.fresh`.
2. If `lastPoseFrameGeneration !== frame.generation`, call `detectPose(gameVideo, frame.generation)` once from the explicit tap handler.
3. If it returns a usable pose for that exact generation, pass that pose and **the same `frame` object** through `updateLevel4ReachController()` (or a small shared packet-admission helper) before `markFlexed()` / `markExtended()` / `markHorizontal()`.
4. If no pose is available for that exact current frame, do not call `controller.update()` with an empty `lm`; leave existing endpoint state unchanged and show/log a specific “Waiting for current pose; tap again” status.
5. Log the boolean result of `mark*()` and its rejection reason in `researchLog('level4_manual_calibration', ...)` so field failures become observable.

This keeps the privacy/safety invariant: no old cached pose is captured, and a failed current-frame inference still blocks the mark. It merely allows a deliberate button press to cause the one current inference needed to make a safe decision.

A lower-risk alternative is accepting only an already-inferred pose younger than a tightly bounded age (e.g. <=100–150 ms). That is easier, but the synchronous current-generation approach better matches the existing “fresh frame” contract.

### 3. Preserve Mahjong’s third capture requirement, but surface it decisively

Do not make Mahjong accept uncalibrated horizontal motion. Once the extended capture succeeds, automatically bring the revealed `Manual horizontal end` button into view/focus and present “Step 3 of 3” wording. This avoids a second apparent “objects do not move” issue while preserving the ordered elbow-then-horizontal safety design.

## Regression scenarios

1. **Auto recovery after real reframe/person change**
   - Establish pre-anchor A, start auto, then supply a torso that trips `torso-moved/person-changed`.
   - Verify no endpoints/game readiness mutate.
   - Supply six fresh stable frames for torso B; verify a new auto start freezes B (not A), then can capture a valid flexed/extended pair.
   - Verify stale frame or selected-arm loss does not re-anchor automatically.

2. **Manual tap one decoded generation after the last completed inference**
   - Mock frame monitor at fresh generation 101 and cached pose at 100.
   - On manual-flex tap, mock `detectPose(...,101)` returning a selected arm; assert flexed endpoint generation 101 is captured.
   - Repeat for manual extended and for Mahjong horizontal.

3. **Manual tap with no usable current pose / stale frame**
   - Current inference returns null, or monitor says stale. Assert endpoints, `calibrated`, and `gameReady` are unchanged/false as appropriate; assert a precise deferred-capture reason, never a fake successful mark.

4. **Bowling end-to-end**
   - Two manual endpoints on distinct fresh generations with >=5° separation; a fresh flexed return; then a fresh extension past `reachEnter` (0.70). Assert one roll begins. Duplicate generation cannot begin another roll; return is needed to re-arm.

5. **Mahjong end-to-end**
   - Flexed -> extended -> outward-horizontal endpoints. Assert it stays locked after only two endpoints, becomes ready only after the third, rejects early lateral traces before elbow-forward reach, and advances tiles only on admitted forward horizontal motion.

6. **No safety regression**
   - Preserve existing assertions that stale decoded images, lost selected arm, duplicate generations, too-similar endpoints, and a true post-lock identity jump all fail closed.

## Test status

Focused existing tests passed without modification (47 tests): `level4-frame-freshness`, `level4-auto-calibration`, `level4-handsfree-v33`, `level4-games-behavior`, `level4-ordered-cycles`, `level4-generation-idempotence`, and `level4-two-pose-calibration`.

The current tests cover controller-level manual capture with deliberately matching generations, and auto rejection, but they do not cover (a) re-anchoring after a `torso-moved/person-changed` retry or (b) the live UI mismatch between current video generation and the last completed pose generation. Add the scenarios above before changing behavior.
