# v134 Security / Safety Review — Level 6 cooking: sink with running tap for the "wash" step

Date: 2026-11-19 · Marker `v134-20261119-sink-wash`

## Change
Public Level 6 cooking task rendering only (`cookRenderDigiflex` wash step, new `drawCookTapWater` /
`drawCookTapSplash`, constants `COOK_SINK_SPOUT` / `COOK_SINK_BASIN_V` / `COOK_SINK_ASPECT`, portrait
background anchoring `stoveView`), new asset `img/cook_sink.png`, markers, tests.
- Therapist request after v133: the spring onion should be washed at a sink, with water running from the tap.
- The wash step now draws a stainless sink + gooseneck tap cutout on the counter, a continuously
  running water stream with moving highlights, splashes on the onion held under the tap, and the
  onion dips on each squeeze. In portrait the background pans to the painted stove only for the
  seven stove steps; other steps are centred so the sink never overlaps the burner.
- Detection (`cookDigiflexDetect`, v132 rules) untouched.

## Gameplay / safety gates unchanged
- Research mode, Level 5, other Level 6 tasks, chopsticks `gameType:'dwell'` untouched.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. Rep counting, calibration, timings unchanged.
- Disclaimer unchanged: the page does not identify equipment and does not measure grip or pinch force.
- No new network, storage, camera or permission code; one new local image asset (AI-generated
  sink cutout, no people, no brands, no text).

## Privacy / content
- No research / pilot wording added; `window.__qa` stripped from `dist/public`.

## Validation
- Full Node suite in four groups, 0 fail (new `tests/v134-sink-wash.test.mjs`; v133 test updated to
  the new anchor expression; marker tests bumped).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean; `./scripts/build-dist.sh`
  (`dist/public/img/cook_sink.png` present).
- Wash-step screenshots on laptop, iPad landscape and iPad portrait in
  `ych_rehab_qa_artifacts/v134/v134-qa-contact-sheet.png`.

## Residual
- Water is drawn every frame during the wash step (a few dozen small canvas primitives); no
  measurable change to frame time in the QA runs, but check the `perf v134` label on the department
  iPad if the wash step ever stutters.
