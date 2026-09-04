# v106 Release and Security Review — Flower Names/Artwork, 荃灣保齡球場 Sign

Build marker: `v106-20260905-flowers-bowling-sign`
Date: 2026-09-05 (HKT)
Scope: `img/flower_06.png`, `img/flower_07.png`, `img/flower_08.png` (replaced), `img/bowling_sign.png` (new), `index.html` (`FLOWER_KINDS` names, `bowlingLaneGeometry`, `drawBowlingSign`, `drawBowlingPins` size, roll start point, public bowling lane `top`, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist request

Rename two flowers (粉玫瑰, 雛菊), replace the 雛菊／百合／蘭花 pictures with versions that have no dropped petals, and hang the「荃灣保齡球場 · 懷舊風情」logo above the bowling pins while the bowling game is played so elderly patients are oriented to place.

## Change summary

| Area | v105 | v106 |
|------|------|------|
| Flower names | 粉紅玫瑰, 小雛菊 | 粉玫瑰, 雛菊 (others unchanged) |
| `img/flower_06/07/08.png` | earlier artwork with loose petals | therapist photos cut out, ≤200 px, 9–10 KB |
| Bowling sign | none (background sign hidden by HUD/pins) | `img/bowling_sign.png` drawn above the pins, HUD-aware band, text fallback |
| Pin rack | `pinBaseY=ch*0.390`, `ph=topH*0.45` | `pinBaseY=ch*0.540`, `ph=topH*0.40` |
| Ball rest / roll start | fixed `ch*0.34` | `ballTopY=pinBaseY-ch*0.05` (public bowling lane only) |

## Safety and privacy analysis

- Visual reward layer only: `updateBowlingStrike`, the shoulder-flexion angle estimation, target/`targetReady` logic, handedness check, privacy blur/segmentation, storage and network behaviour are untouched. The lane `top` change is guarded by `state.theme==='bowlinglane'&&!research.active`; research scenarios never use `bowlinglane`.
- New assets are therapist-supplied illustrations (no patient likeness, no photographs of people, no EXIF — re-encoded PNG). Total added ≈ 90 KB, served same-origin and precached via the regenerated `offline-assets.js` under the new cache version.
- `bowlingLaneGeometry` reads `gameCanvas.clientWidth` and `imgBowlingSign.naturalWidth` with safe fallbacks (0 → canvas width; unloaded image → 845:428), so the sign never throws or renders with NaN geometry; the sign is skipped when the band is smaller than 20×10 px.
- Public build sanitizer output unchanged in kind: `window.__qa`/`advanceTime` absent, no research strings, isolation test 5/5.

## Verification

- `tools/checkjs.sh` all blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- Node tests in four groups: 544 passed / 3 skipped / 0 failed (run before the dist build). New `tests/v106-flowers-bowling-sign.test.mjs`; `v73`, `v81`, `v82`, and the eight marker tests updated.
- `./scripts/build-dist.sh` → 200 files; `tests/v78-public-build-isolation.test.mjs` 5/5 after the build; fresh `http.server` on `dist/public`: title loads, `window.__qa` undefined, zero page errors, `img/bowling_sign.png` 200.
- iPad Playwright QA (1180×820 and 820×1180): sign centred above the pins, clear of the score chips, control buttons and the 現在／目標 panel; roll and strike animations play; flowers palette shows the eight names and the new 雛菊／百合／蘭花 artwork. Screenshots `ych_rehab_qa_artifacts/v102/v106-bowl-*.png`, `v106-flowers-*.png`.
