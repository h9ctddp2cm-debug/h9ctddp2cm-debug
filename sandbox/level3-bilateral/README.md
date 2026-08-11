# Level 3 Bilateral Diagnostic Sandbox

Developer-only prototype for Pose-driven bilateral tabletop shadow testing. It is isolated from the patient-facing pilot application and must not be treated as a validated medical device.

## Browser run

```bash
python -m http.server 4173
```

Open `http://localhost:4173`. The camera path uses MediaPipe Pose Landmarker Lite, 480 × 360 capture, alternate-frame inference, world-coordinate wrist separation, and no MediaPipe Hands instance or full skeleton rendering.

## Block export contract

- One JSON file represents exactly one randomized block.
- AB maps Block 1 to ST and Block 2 to DT; BA reverses that order.
- ST is 5 planned minutes with `NONE_CONTROL`; DT is 8 planned minutes with an active cognitive tier.
- Repetitions use block-relative ordering and `l3_max_vertical_y_deviation_normalized`.
- T0, T1 pre-rest, T1 post-rest, and T2 fatigue fields remain raw.
- `subjective_enjoyment_vams_score` stores an integer from 1 to 10 after the end-session prompt.
- DTC, aggregate summaries, and inferential results are intentionally absent from browser exports.

## JavaScript verification

```bash
node Level3BilateralDataCollector.test.js
node Level3BilateralSandbox.test.js
```

## R pipeline

With R and `jsonlite` installed:

```bash
Rscript Level3_Bilateral_Production_Pipeline.R sandbox_block_exports
```

Disposable synthetic validation:

```bash
Rscript Level3_Bilateral_Production_Pipeline.R sandbox_block_exports_test \
  --generate-synthetic \
  --force-synthetic \
  --run-edge-case-tests
```

The synthetic mode creates 20 paired block files and one deliberate orphan. Edge checks cover tied ranks, all-zero differences, a zero denominator, a missing paired block, and fewer than five valid repetitions. The pipeline writes a linked participant CSV and a plain-text statistical summary.

## Interpretation guardrails

- ST early versus DT early is the primary temporally matched cognitive-motor contrast.
- DT early versus DT late is an exploratory within-DT fatigue contrast, not proof of a fatigue mechanism.
- Warning density per planned minute and per observed active minute are exported separately.
- Rank-biserial effect size and confidence intervals supplement rather than replace transparent reporting of sample size, missingness, and raw distributions.
- The 1–10 enjoyment item is a subjective covariate. Its standardized presentation does not establish equal motivation across participants.
