# v124 Security / Safety Review — laundry rack difficulty ladder (1 → 2 → 4 racks)

Date: 2026-11-18 · Marker `v124-20261118-laundry-rack-ladder`

## Change
Public-gameplay only (`index.html`), plus `CACHE_VERSION` / `LEVEL_APP_BUILD` / manifest `start_url`.
1. Level 6 晾衫 difficulty grows from 3 to 5 keys (`basic`, `zones2`, `zones`, `sort2`, `sort`).
   Two-rack variants reuse the v123 zones/sort rules via `laundryDifficultyMode()`; rack count
   comes from `laundryRackCount()` (1 / 2 / 4). Legacy `'complex'` still maps to `'zones'`.
2. `laundryMultiRackTargets()` lays out 2 racks side by side (taller rail crop 0.62) or the v123 2×2 grid.
3. Lit-rack picker skips full racks; two-rack sort labels 上身／下身.

## Gameplay / safety gates unchanged
- Level 5 gameplay untouched. Level 6 chopsticks stays `gameType:'dwell'`; peg/pinch thresholds,
  `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Research track unchanged: all new paths sit behind `isLaundryRackGame()` (requires `!research.active`).
- Wrong rack still = no penalty (`laundryRackRejectedWithoutPenalty()`), garment returns.
- No new network, storage, camera or permission code. No frames leave the device.

## Privacy / content
- No research / pilot wording added; new UI text is Cantonese gameplay only.
- `window.__qa` unchanged in shape (startGame accepts the new keys); stripped from `dist/public`
  (`rg -c "__qa"` → 0).

## Validation
- 627 Node tests in four groups, 0 fail (v123 suite 16, v71 suite 26, v81 updated).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files; dist `index.html` has 0 `research|pilot` matches.
- Playwright: 9 screenshots, 0 page errors; zones2/zones hang 6 garments in turn then clear
  (`ych_rehab_qa_artifacts/v124/v124-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing since v114, not user-visible).
