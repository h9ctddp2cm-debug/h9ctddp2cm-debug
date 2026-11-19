# v129 Security / Safety Review — Level 6 auto hang / auto place at target

Date: 2026-11-19 · Marker `v129-20261119-laundry-auto-hang`

## Change
Public Level 6 grasp-style tasks only, `index.html` + markers.
- Laundry (`laundryAutoHangEnabled()` = `!research.active && isLaundryRackGame()`): a held
  garment hangs after the cursor rests inside the rack's valid area for 400 ms
  (`laundryAutoHangOver`: upper half of the single rack; own rack box for 2/4 racks) plus the
  existing 220 ms drop dwell. Releasing the peg still hangs it (whichever comes first).
- Flowers / cards / mahjong (`level6AutoPlaceEnabled()`): the carried item is placed after its
  centre rests inside the vase / collection zone for 400 ms; opening the hand still places it.
  Auto-place feeds the same drop event, so scoring, wrong-card and win handling are unchanged.
- Prompt / voice wording updated ("舉高去衣架", "對準衣架，自動掛上", "移到目標停住", "停住").

## Gameplay / safety gates unchanged
- Research mode, Level 5, Level 6 cooking, Level 6 chopsticks (`gameType:'dwell'`) untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`,
  `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Next pick-up still requires `handOpenPrep` (open / relax), so an auto-hung garment cannot be
  re-grabbed by the same static posture. Laundry sort-mode rules (wrong rack) unchanged.
- Timers reset on leaving the target, on pick-up and on drop; a garment held at the basket or
  only touching the rack legs never auto-hangs (e2e tested).
- No new network, storage, camera or permission code; no new data recorded.

## Privacy / content
- No research / pilot wording added. `window.__qa` stripped from `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 660 Node tests in four groups, 0 fail (new v129 suite 8 incl. Playwright e2e for all four games
  and a Level 5 flowers no-auto-place guard).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 210 files; dist `index.html` 0 `research|pilot` matches.
- Playwright, three viewports, four-step walk per game, 0 page errors
  (`ych_rehab_qa_artifacts/v129/v129-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing, not user-visible).
- 400 ms rest time is a first estimate; tune `LAUNDRY_AUTO_HANG_MS` / `LEVEL6_AUTO_PLACE_MS` after bedside use.
