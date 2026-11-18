# v123 Security / Safety Review — laundry four racks, larger flowers, L6 mahjong/cards = L5, larger plate dim sum

Date: 2026-11-18 · Marker `v123-20261118-laundry-four-racks`

## Change
Public-gameplay only (`index.html`), plus `CACHE_VERSION` / `LEVEL_APP_BUILD` / manifest `start_url`.
1. Level 6 晾衫: 「較複雜」replaced by two selective-attention four-rack modes (`zones` lit rack,
   `sort` category racks). Wrong rack = no penalty, garment returns. Legacy `'complex'` → `'zones'`.
2. Level 5/6 插花: patient palette flowers enlarged (≤180px; portrait 2×4; iPad landscape 6 per row).
3. Level 6 麻雀／啤牌 run the Level 5 modules (same interface, Level 6 tripod-pinch gesture kept).
4. Level 6 點心: pieces on the plate drawn at 0.21 of the plate size (was 0.135).

## Gameplay / safety gates unchanged
- Level 5 gameplay untouched (flowers palette sizing is the only shared change and is patient-mode only).
- Level 6 chopsticks stays `gameType:'dwell'`; peg/pinch thresholds, `numHands:2`, confidences
  0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Research track unchanged: every new laundry path is behind `isLaundryRackGame()` (requires
  `!research.active`); `usesAdvancedThemeModule()` change applies to Level 6 only; the generic
  two-pile cards engine is retained for research.
- No new network, storage, camera or permission code. No frames leave the device.

## Privacy / content
- No research / pilot wording added to public strings; new UI text is Cantonese gameplay only.
- `window.__qa` additions (`laundryRack.hang/tryRack`, `dimsumPlate.place`, cards/mahjong layout
  export) are stripped from `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 623 Node tests in four groups, 0 fail (new `tests/v123-laundry-four-racks-flowers-cards.test.mjs`, 14).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files; dist `index.html` has 0 `research|pilot` matches.
- Playwright 17 screenshots (laptop, iPad landscape, iPad portrait) with 0 page errors:
  `ych_rehab_qa_artifacts/v123/v123-qa-contact-sheet.png`.

## Residual
- `dist/public/localization.js` comment still mentions "PILOT_TEXT research dictionary" (pre-existing since v114).
- Two therapist assumptions pending confirmation: 較複雜 removed outright; fourth sort rack is 內衣襪.
