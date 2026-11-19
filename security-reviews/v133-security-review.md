# v133 Security / Safety Review — Level 6 cooking: wok on the painted stove, visible flames, rice without plate

Date: 2026-11-19 · Marker `v133-20261119-wok-on-stove`

## Change
Public Level 6 cooking task rendering only (`cookRenderDigiflex` wok steps, `drawCookFlames`,
new constants `COOK_BG_BURNER` / `COOK_BG_KNOB`, new asset `img/cook_rice_only.png`), markers, tests.
- Therapist report after v132: no fire visible, wok not on the gas stove, rice sprite (which
  includes its own plate) was being placed on the serving plate.
- The wok is now anchored to the burner painted in the kitchen background using fractions of the
  background image, so it sits on the stove in every viewport; the background is shifted so the
  stove stays in view in portrait. Flames are drawn behind and in front of the pan bottom, lit
  from the first squeeze of "heat", fading out during "off". The rice sprite is a cutout without
  the plate, used inside the wok and on the serving plate.
- Detection (`cookDigiflexDetect`, v132 rules) is not touched — the therapist explicitly chose to
  keep it lenient so patients are not discouraged.

## Gameplay / safety gates unchanged
- Research mode, Level 5, other Level 6 tasks, chopsticks `gameType:'dwell'` untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. Rep counting, calibration, timings unchanged.
- Disclaimer unchanged: the page does not identify equipment and does not measure grip or pinch force.
- No new network, storage, camera or permission code; one new local image asset only.

## Privacy / content
- No research / pilot wording added; `window.__qa` stripped from `dist/public`.

## Validation
- Full Node suite in four groups, 0 fail (new `tests/v133-wok-on-stove.test.mjs`; marker tests bumped).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean; `./scripts/build-dist.sh`
  (`dist/public/img/cook_rice_only.png` present).
- Screenshots of heat / oil / pour / off / plate on laptop, iPad landscape and iPad portrait in
  `ych_rehab_qa_artifacts/v133/v133-qa-contact-sheet.png`.

## Residual
- Burner / knob fractions are tied to the current `img/cook_kitchen_bg.jpg`; if the background image
  is replaced, re-measure `COOK_BG_BURNER` and `COOK_BG_KNOB`.
