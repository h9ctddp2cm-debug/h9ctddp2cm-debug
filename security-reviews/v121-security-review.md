# v121 Security / Safety Review — 重新校準 button + backport of live v115–v120 into source

Date: 2026-11-18 · Marker `v121-20261118-recalibrate`

## Deployment context
Until v120 the public site (`https://dorothy-tang.github.io/`) carried dist-level patches (v115–v120)
that did not exist in this source repository, so a dist built from source could not be deployed.
v121 closes that gap: every live hunk is now in `index.html`, and the built `dist/public/index.html`
differs from the live v120 bundle only by minifier arrangement, the new 重新校準 button/listener and
the version markers (verified with `diff`). From v121 on the normal release path
(`./scripts/build-dist.sh` → copy `dist/public` to the Pages repo) is valid again.

## Rationale
Bedside report (18 Nov): while demonstrating to a patient, the tracker locked onto the therapist's
own hand/fingers during calibration; the only way to redo it was to leave the calibration screen.
A 重新校準 button on the calibration screen resets the hand calibration in place.

## What changed
- `#btnRecalibrate` (calibration screen, below 開始遊戲). `recalibrateFromCalibrationScreen()` resets
  the calibration state (normal or research path), tool-pinch adaptation, the v99 hand lock /
  admission gate, the gesture stabiliser, green-dot EMA, `calibDetectedOnce`, stall watchdog,
  force-start timer; disables 開始遊戲 and shows 「已重設 · 請患手再次入鏡」. The camera stream is not
  restarted (no new permission prompt).
- Backported from live: peg 400 ms un-pinched open-prep (v115); null-keepsake guards, public in-game
  camera-stall watchdog and hand-landmarker recovery after 20 failed detects (v116); bounded camera
  re-acquire (`CAMERA_REACQUIRE_MAX = 8`), calibration stall re-acquire (max 2) and the 10 s
  「校準未完成？直接開始」 escape hatch (v117); face-hide privacy mode always on with the toggle
  hidden (v118/v120).

## Threat / safety assessment
- **Privacy**: face-hide is forced on in the public build; the live camera is never drawn sharply
  (calibration canvas blurred except the tracked hand window; `#gameVideo` CSS blur 18 px and
  canvas `ctx.filter blur(14px)` on both draw sites). `localStorage` key `nivr.privacyMode.v118`
  is written but ignored on load. No frames leave the device; no new network calls.
- **Camera / permissions**: re-acquire paths call `getUserMedia` again only when a stream existed
  before (`hadStream`) and at most `CAMERA_REACQUIRE_MAX` times per page; `cameraRequestAttempted`
  still blocks repeated prompts when the first request failed. Stall watchdogs are rate-limited
  (`RETRY_GAP 6000`, `CALIB_STALL_MAX_ATTEMPTS 2`) and public-only (`!research.active && !state.qaMode`).
- **Recalibrate**: purely client-side state reset; it cannot start a game (開始遊戲 is disabled until
  the affected hand is detected again) and it hides the force-start button for another 10 s.
- **Clinical / gameplay invariants**: Level 5 gameplay unchanged; Level 6 chopsticks stays
  `gameType:'dwell'`; `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`,
  `PUBLIC_GAME_WORK_INTERVAL_MS = 1000/30`, `PUBLIC_CANVAS_MAX_EDGE = 1600` unchanged. Research
  modes untouched (all new behaviour is gated on `!research.active` or applies equally as in live).
- **Escape hatch**: 「校準未完成？直接開始」 is unchanged from live v117 (therapist-facing, logged to
  console; appears only after 10 s with 開始遊戲 still disabled).
- **Public build hygiene**: `rg -c "__qa" dist/public/index.html` → 0; no "research"/"pilot" strings
  added. Pre-existing comment in `dist/public/localization.js` (lines 20–21, "PILOT_TEXT research
  dictionary") is unchanged since v114 and noted for cleanup.
- **Dependencies / service worker**: no new third-party code; SW precache list unchanged apart from
  `CACHE_VERSION`.

## Validation
- 604 Node tests in four groups (118+191+188+109): 601 pass / 3 skipped / 0 fail, including the new
  `tests/v121-recalibrate-face-hide-always.test.mjs` (10) and 7 updated source-contract tests.
- `tools/checkjs.sh` OK; `node --check service-worker.js`; `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files; dist vs live v120 `diff` shows no logic differences.
- Playwright on the built dist with a fake camera (laptop 1413×653, iPad portrait 1024×1366, iPad
  landscape 1366×1024): L6 衣夾, L5 雪櫃, L3 保齡球 — 重新校準 visible, privacy toggle hidden,
  `.game-stage.face-hide` on, recalibrate disables 開始遊戲, games start with `#gameVideo`
  `blur(18px) saturate(0.85)`, `perf v121`, 0 console/page errors
  (`ych_rehab_qa_artifacts/v121/v121-qa-contact-sheet.png`).

## Residual risk
- Recalibrate does not restart the camera; if the camera itself has stalled the existing v117 stall
  watchdog handles it (status 「鏡頭畫面停頓，重新連接中…」).
- Status text 「已重設 · 請患手再次入鏡」 is replaced by the live detection status on the next frame
  (by design — the therapist immediately sees whether the patient's hand is detected).
