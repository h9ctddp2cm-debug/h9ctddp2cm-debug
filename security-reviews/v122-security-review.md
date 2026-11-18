# v122 Security / Safety Review — larger calibration sharp window

Date: 2026-11-18 · Marker `v122-20261118-privacy-window`

## Change
`drawPrivacySharpWindow` constants only: `PRIVACY_WINDOW_PAD` 0.28 → 0.50, `PRIVACY_WINDOW_MIN`
0.18 → 0.45 (fraction of the canvas short side). No change to detection, calibration thresholds,
gameplay, camera handling or the service worker beyond `CACHE_VERSION`.

## Rationale
Therapist report: in face-hide mode the only sharp area on the calibration screen was a square the
size of one fingertip (the hand model had fitted its 21 points to a small part of a too-close hand),
so the therapist could not see the thumb / index / middle fingers or the peg.

## Privacy assessment
- Face-hide remains always on: the whole frame is blurred; only the window around the tracked hand
  is sharp. The window is larger (≥ 45% of the short side instead of 18%), so more of the
  surroundings around the hand becomes visible. If the hand is held directly in front of the face
  part of the face may now fall inside the window; bedside guidance is to keep the hand away from
  the face (also required for reliable hand detection). No frames leave the device.
- Game screens unchanged (`#gameVideo` still blurred, canvas draw sites still `blur(14px)`).

## Validation
- 609 Node tests in four groups, 0 fail (new `tests/v122-privacy-window-larger.test.mjs`, 3).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files; `rg -c "__qa" dist/public/index.html` → 0.
- Playwright on dist (fake camera, Level 6 衣夾, laptop): `perf v122`, 重新校準 present, face-hide
  on, 0 console/page errors.
