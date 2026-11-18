# v126 Security / Safety Review — supermarket shelf display, palm marker, default medium list

Date: 2026-11-19 · Marker `v126-20261119-shelf-heap-hand`

## Change
Public-gameplay only (`index.html`), plus `CACHE_VERSION` / `LEVEL_APP_BUILD` / manifest `start_url`
and one new image asset `img/shop_hand.png` (AI-generated open palm, transparent PNG, 218×360).
1. Default `state.shopListSize` is now `medium` (4 items ≈ 22 raises); short/long still selectable.
2. Aisle display: fruit heaps in a drawn crate (take from the top), other goods stand in a row
   (take the front one). Pure canvas drawing (`shopShelfLayout`, `drawShopCrate`).
3. Raise marker draws the palm image instead of the orange 手 circle (`drawShopArmMarker`).

## Gameplay / safety gates unchanged
- Shoulder-flexion controller, band, `targetReady` award, reward cycle and the v125 story script
  (step order and rep counts) are untouched.
- Level 5 gameplay untouched. Level 6 chopsticks stays `gameType:'dwell'`; `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Research track unchanged (theme only exists for public Level 3/4).
- No new network, storage, camera or permission code.

## Privacy / content
- No research / pilot wording added. Palm image is a generic illustration (no real person).
- `window.__qa` shape unchanged; stripped from `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 642 Node tests in four groups, 0 fail (new v126 suite 5; v125 suite updated for the default).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 210 files; `shop_hand.png` listed in `offline-assets.js`;
  dist `index.html` has 0 `research|pilot` matches.
- Playwright: full medium-list story walk on three viewports (22 raises each → 訓練完成),
  0 page errors (`ych_rehab_qa_artifacts/v126/v126-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing since v114, not user-visible).
- Elbow flexion during the raise still not detected or cued (therapist informed in v125).
