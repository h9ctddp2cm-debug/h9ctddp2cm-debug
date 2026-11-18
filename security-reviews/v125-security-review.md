# v125 Security / Safety Review — Level 3/4 supermarket story theme (去超市買餸)

Date: 2026-11-18 · Marker `v125-20261118-supermarket-story`

## Change
Public-gameplay only (`index.html`), plus `CACHE_VERSION` / `LEVEL_APP_BUILD` / manifest `start_url`
and ten new image assets under `img/` (three 1280×720 JPEG backgrounds, seven PNG props).
1. New Level 3/4 shoulder-flexion theme `supermarket`: a scripted story where each arm raise that
   reaches the therapist-set band advances one step (trolley → shelf items → cashier unload →
   Octopus tap → eco-bag hand-over → bag back → shelve at home). The story ends the game via the
   existing `endGame()`.
2. Therapist setting `state.shopListSize` (`short` 2 / `medium` 4 / `long` 6 items; 13 / 22 / 28
   raises) exposed in the library as a button bar; default `short`.
3. `shoulderRewardDurationMs()` gains a `supermarket` branch so the reward cycle covers the fly
   animation and the following scene; `setupTargets()` returns no generic targets for the theme.

## Gameplay / safety gates unchanged
- Shoulder-flexion angle controller (`shoulder-flexion-controller.js`), band selection, `targetReady`
  award point and `startShoulderRewardCycle()` are untouched; the story only hooks the award.
- Level 5 gameplay untouched. Level 6 chopsticks stays `gameType:'dwell'`; `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Research track unchanged: `isSupermarketTheme()` requires `isShoulderFlexionLevel()` and the theme
  is only listed for public Level 3/4; research modes never see it.
- No new network, storage, camera or permission code. No frames leave the device. Speech uses the
  existing `speakCantonese` path (on-device Web Speech).

## Privacy / content
- No research / pilot wording added; new UI text is Cantonese gameplay only.
- Octopus card artwork is a generic teal card with no logo or trademark; no retailer branding in
  the AI-generated backgrounds.
- `window.__qa` gains `shopStory` helpers and `startGame({shopListSize})`; stripped from
  `dist/public` (`rg -c "__qa"` → 0).

## Validation
- 637 Node tests in four groups, 0 fail (new v125 suite 10; v73/v74/v83/tracking-regression updated).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 209 files; ten new images listed in `offline-assets.js`;
  dist `index.html` has 0 `research|pilot` matches.
- Playwright: full story walk on three viewports (13 raises each → 訓練完成), 0 page errors
  (`ych_rehab_qa_artifacts/v125/v125-qa-contact-sheet.png`).

## Residual
- `dist/public/localization.js` comment "PILOT_TEXT research dictionary" (pre-existing since v114, not user-visible).
- Elbow flexion during the raise is not detected or cued (controller measures the shoulder→elbow
  vector only) — therapist informed; optional cue is a future change.
