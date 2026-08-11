# FTHUE Level 4–6 Technical Validation

This suite verifies the production single-page game's Level 4, Level 5, and Level 6 interaction engines independently.

## Scope

- Level 4: tabletop midline dwell pickup, forward transfer, and dwell placement.
- Level 5: open-hand preparation, grasp hold, transport, and sustained open-hand release.
- Level 6: thumb-index aperture hysteresis, separated preparation, pinch hold, transport, and sustained separation release.
- All three levels: six-theme launch matrix, correct and incorrect placement, tracking-loss grace, and malformed landmark fail-safe behaviour.

Level 6 detects normalized thumb-index aperture. It does not measure pinch force. Passing this suite is technical verification only; it is not clinical validation, medical-device validation, or evidence of treatment efficacy.

## Run

Start the web app on a local HTTP server, then run:

```bash
node run-level4-6-technical-validation.mjs http://127.0.0.1:4173
```

The runner writes:

- `level4-6-validation-results.json`
- `level4-6-validation-report.md`

Any failed assertion exits with a non-zero status.

