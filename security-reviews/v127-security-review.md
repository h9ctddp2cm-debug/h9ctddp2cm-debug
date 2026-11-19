# v127 Security / Safety Review — cashier scene: white background, bigger counter items

Date: 2026-11-19 · Marker `v127-20261119-cashier-white-bigger`

## Change
Public-gameplay only (`index.html`), plus `CACHE_VERSION` / `LEVEL_APP_BUILD` / manifest `start_url`
and a replaced image `img/shop_cashier_bg.jpg` (same cashier on a plain white background, 1280×720).
1. Counter items drawn at full shelf size on a wider counter (`cs = min(itemSize, counterW/slots)`).
2. `drawShopBgCover(..., fitHeight)`: landscape fits the cashier picture by height with white side
   fill and a drawn counter across the full width; portrait keeps cover.
3. Drawn card reader gains a stand on the counter.

## Gameplay / safety gates unchanged
- Story script, rep counts, shoulder-flexion controller, award and reward cycle untouched.
- Level 5 gameplay untouched. Level 6 chopsticks stays `gameType:'dwell'`; `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. Research track unchanged.
- No new network, storage, camera or permission code.

## Privacy / content
- No research / pilot wording added. Cashier is an AI illustration (no real person, no branding).
- `window.__qa` unchanged; stripped from `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 646 Node tests in four groups, 0 fail (new v127 suite 4).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 210 files; dist `index.html` has 0 `research|pilot` matches.
- Playwright: medium-list story walk on three viewports (22 raises → 訓練完成), 0 page errors
  (`ych_rehab_qa_artifacts/v127/v127-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing since v114, not user-visible).
