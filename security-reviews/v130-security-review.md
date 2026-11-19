# v130 Security / Safety Review — Level 6 bare-hand reopen after auto-place, pinch/relaxed cursor

Date: 2026-11-19 · Marker `v130-20261119-bare-reopen-after-place`

## Change
Public Level 6 grasp-style tasks only (flowers / cards / mahjong), `index.html` + two new cursor
images + markers.
- Idle reopen rule (`level6BareReopenEnabled()` = `level6AutoPlaceEnabled() && !level6AnyItemHeld()`):
  when nothing is held and the pinch ratio stays at or above 40% of the calibrated range
  (`PUBLIC_BARE_IDLE_REOPEN_RANGE`) for 300 ms (`PUBLIC_BARE_REOPEN_PREP_MS`), the hand is
  treated as open so the next pick-up can arm. Patients hold a real clothes peg, so the 70%
  exit threshold was unreachable after an auto-place.
- Prompt "先張開手" (instead of "揸實") and voice "張開手" when the hand is still pinched over an
  item after placing.
- Cursor: pinch picture only while `isGrasping`; new relaxed-hand picture otherwise
  (`img/level6_open_right.png`, `img/level6_open_left.png`). Picture only — no detection change
  for laundry / chopsticks.

## Gameplay / safety gates unchanged
- Research mode, Level 5, Level 6 cooking, Level 6 chopsticks (`gameType:'dwell'`) untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`,
  `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Release while holding is unchanged (rest at target 400 ms, or open to the 70% exit threshold);
  the 40% rule only runs when nothing is held, so a relaxed grip never drops an item (e2e tested
  1.5 s relaxed hold).
- Pick-up still requires closing below the 40% mark plus the existing 80 ms hold and 100 ms arm.
- Timer resets on `resetToolPinchAdapt()`; no new network, storage, camera or permission code;
  no new data recorded.

## Privacy / content
- No research / pilot wording added. `window.__qa` stripped from `dist/public` (`rg -c "__qa"` → 0).
- New images are generated illustrations (no faces, no patient data).

## Validation
- 664 Node tests in four groups, 0 fail (new v130 suite 4 incl. Playwright e2e for flowers and cards;
  v128 / v76 / v78 regex updates).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 212 files; dist `index.html` 0 `research|pilot` matches; both
  `level6_open_*.png` present in dist.
- Playwright, three viewports, five-step flowers / cards walk + laundry relaxed vs squeeze cursor,
  0 page errors (`ych_rehab_qa_artifacts/v130/v130-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing, not user-visible).
- 40% / 300 ms are first estimates; tune `PUBLIC_BARE_IDLE_REOPEN_RANGE` / `PUBLIC_BARE_REOPEN_PREP_MS`
  after bedside use.
