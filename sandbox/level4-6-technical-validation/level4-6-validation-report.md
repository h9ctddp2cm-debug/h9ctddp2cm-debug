# Level 4–6 Technical Validation Report

Generated: 2026-08-11T16:23:30.019Z

Result: **PASS** (47/47 checks passed)

| FTHUE level | Passed | Failed |
|---|---:|---:|
| 4 | 13 | 0 |
| 5 | 17 | 0 |
| 6 | 17 | 0 |

## Verified scope

- Six-theme launch matrix and correct engine selection.
- Level-specific gesture or dwell thresholds and full placement flows.
- Correct versus incorrect placement accounting.
- Tracking-loss grace and sustained-loss reset.
- Malformed hand-landmark fail-safe behaviour.

## Interpretation boundary

This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. Level 6 measures normalized thumb-index aperture state and does not measure pinch force.

## Checks

- PASS | Level 4 | launch matrix | flowers launches with the correct engine
- PASS | Level 4 | launch matrix | dimsum launches with the correct engine
- PASS | Level 4 | launch matrix | laundry launches with the correct engine
- PASS | Level 4 | launch matrix | cards launches with the correct engine
- PASS | Level 4 | launch matrix | mahjong launches with the correct engine
- PASS | Level 4 | launch matrix | cooking launches with the correct engine
- PASS | Level 5 | launch matrix | flowers launches with the correct engine
- PASS | Level 5 | launch matrix | dimsum launches with the correct engine
- PASS | Level 5 | launch matrix | laundry launches with the correct engine
- PASS | Level 5 | launch matrix | cards launches with the correct engine
- PASS | Level 5 | launch matrix | mahjong launches with the correct engine
- PASS | Level 5 | launch matrix | cooking launches with the correct engine
- PASS | Level 6 | launch matrix | flowers launches with the correct engine
- PASS | Level 6 | launch matrix | dimsum launches with the correct engine
- PASS | Level 6 | launch matrix | laundry launches with the correct engine
- PASS | Level 6 | launch matrix | cards launches with the correct engine
- PASS | Level 6 | launch matrix | mahjong launches with the correct engine
- PASS | Level 6 | launch matrix | cooking launches with the correct engine
- PASS | Level 5 | gesture | one curled finger cannot trigger grasp
- PASS | Level 5 | gesture | two curled fingers trigger configured grasp
- PASS | Level 5 | gesture | partial reopening does not release held item
- PASS | Level 5 | gesture | three open major fingers release held item
- PASS | Level 6 | gesture | pinch enters below normalized aperture threshold
- PASS | Level 6 | gesture | pinch hysteresis retains hold between enter and exit thresholds
- PASS | Level 6 | gesture | pinch exits above normalized release threshold
- PASS | Level 6 | gesture | clearly separated fingers arm a new pinch
- PASS | Level 5 | safety | malformed grasp landmarks fail safely
- PASS | Level 6 | safety | malformed pinch landmarks fail safely
- PASS | Level 4 | layout | targets remain forward of tabletop source items
- PASS | Level 4 | flow | dwell pickup acquires an item
- PASS | Level 4 | flow | correct placement increments the correct count
- PASS | Level 4 | flow | dwell pickup acquires an item
- PASS | Level 4 | flow | wrong placement increments only the wrong count
- PASS | Level 4 | tracking | brief tracking loss uses the 750 ms grace window
- PASS | Level 4 | tracking | sustained tracking loss clears detection safely
- PASS | Level 5 | flow | prepared gesture and hold acquire an item
- PASS | Level 5 | flow | correct placement increments the correct count
- PASS | Level 5 | flow | prepared gesture and hold acquire an item
- PASS | Level 5 | flow | wrong placement increments only the wrong count
- PASS | Level 5 | tracking | brief tracking loss uses the 750 ms grace window
- PASS | Level 5 | tracking | sustained tracking loss clears detection safely
- PASS | Level 6 | flow | prepared gesture and hold acquire an item
- PASS | Level 6 | flow | correct placement increments the correct count
- PASS | Level 6 | flow | prepared gesture and hold acquire an item
- PASS | Level 6 | flow | wrong placement increments only the wrong count
- PASS | Level 6 | tracking | brief tracking loss uses the 750 ms grace window
- PASS | Level 6 | tracking | sustained tracking loss clears detection safely

