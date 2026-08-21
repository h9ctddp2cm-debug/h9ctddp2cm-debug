# Level 4–6 Technical Validation Report

Generated: 2026-08-21T10:22:34.764Z

Result: **FAIL** (0/1 checks passed)

| FTHUE level | Passed | Failed |
|---|---:|---:|
| 4 | 0 | 0 |
| 5 | 0 | 0 |
| 6 | 0 | 0 |

## Verified scope

- Level-filtered launch matrix and correct engine selection.
- Level-specific gesture or dwell thresholds and full placement flows.
- Correct versus incorrect placement accounting.
- Tracking-loss grace and sustained-loss reset.
- Malformed hand-landmark fail-safe behaviour.
- Mandatory safety acknowledgement gate for Levels 3–6.
- Always-visible rest and stop controls, rest pausing active timing, and safe stop.
- Therapist-confirmed compensation prompt, Level 5 hold timeout and repeated release difficulty.
- In-page camera failure handling with Retry and Return for every getUserMedia error class.

## Interpretation boundary

This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. Level 6 measures normalized thumb-index aperture state and does not measure pinch force. Compensation, muscle tone and spasticity are never detected automatically: they are therapist observations entered manually. Safety-control behaviour verified here is software behaviour only and still requires supervised bedside testing on the target iPad.

## Checks

- FAIL | Runtime | page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/
Call log:
  - navigating to "http://127.0.0.1:4173/", waiting until "domcontentloaded"

    at /home/user/workspace/ych_rehab_games_advanced/sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs:202:14

