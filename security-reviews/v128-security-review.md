# v128 Security / Safety Review — Level 6 peg: relative release

Date: 2026-11-19 · Marker `v128-20261119-peg-relative-release`

## Change
Public peg task only (`publicPegReleaseRelaxationEnabled()`), `index.html` + markers.
A held garment now also drops when both digits and the combined aperture reopen by
≥ 30% of the calibrated range (floor 0.010) above the smallest median-smoothed aperture
of the current hold, after ≥ 300 ms of holding. Absolute release paths, the 220 ms drop
dwell and the re-arm rule for the next pick-up are unchanged. `?perf=1` HUD gains one line.

## Gameplay / safety gates unchanged
- Research mode, Level 5, Level 6 chopsticks (`gameType:'dwell'`), other tasks untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`,
  `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Single drifting landmark cannot release (all three apertures must move); a static
  posture has zero delta and can never release — verified by sweep tests.
- No new network, storage, camera or permission code; no new data recorded.

## Privacy / content
- No research / pilot wording added. `window.__qa` stripped from `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 652 Node tests in four groups, 0 fail (new v128 suite 6 incl. Playwright e2e).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 210 files; dist `index.html` 0 `research|pilot` matches.
- Playwright `?perf=1`, three viewports, five-step laundry walk, 0 page errors
  (`ych_rehab_qa_artifacts/v128/v128-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing, not user-visible).
- Threshold 30% is a first estimate from the bedside description; verify with `?perf=1` readings.
