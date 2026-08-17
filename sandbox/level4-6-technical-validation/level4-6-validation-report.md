# Level 4–6 Technical Validation Report

Generated: 2026-08-17T05:20:26.691Z

Result: **PASS** (121/121 checks passed)

| FTHUE level | Passed | Failed |
|---|---:|---:|
| 4 | 44 | 0 |
| 5 | 40 | 0 |
| 6 | 30 | 0 |

## Verified scope

- Six-theme launch matrix and correct engine selection.
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

- PASS | Level 4 | launch matrix | flowers launches with the correct engine
- PASS | Level 4 | launch matrix | dimsum launches with the correct engine
- PASS | Level 4 | launch matrix | laundry launches with the correct engine
- PASS | Level 4 | launch matrix | cards launches with the correct engine
- PASS | Level 4 | launch matrix | mahjong launches with the correct engine
- PASS | Level 5 | launch matrix | flowers launches with the correct engine
- PASS | Level 5 | launch matrix | dimsum launches with the correct engine
- PASS | Level 5 | launch matrix | laundry launches with the correct engine
- PASS | Level 5 | launch matrix | cards launches with the correct engine
- PASS | Level 5 | launch matrix | mahjong launches with the correct engine
- PASS | Level 6 | launch matrix | flowers launches with the correct engine
- PASS | Level 6 | launch matrix | dimsum launches with the correct engine
- PASS | Level 6 | launch matrix | laundry launches with the correct engine
- PASS | Level 6 | launch matrix | cards launches with the correct engine
- PASS | Level 6 | launch matrix | mahjong launches with the correct engine
- PASS | Level 5 | gesture | one curled finger cannot trigger grasp
- PASS | Level 5 | gesture | two curled fingers trigger configured grasp
- PASS | Level 5 | gesture | one reopened finger does not release held item
- PASS | Level 5 | gesture | two reopened major fingers release held item
- PASS | Level 6 | gesture | pinch enters below normalized aperture threshold
- PASS | Level 6 | gesture | pinch hysteresis retains hold between enter and exit thresholds
- PASS | Level 6 | gesture | pinch exits above normalized release threshold
- PASS | Level 6 | gesture | clearly separated fingers arm a new pinch
- PASS | Level 5 | safety | malformed grasp landmarks fail safely
- PASS | Level 6 | safety | malformed pinch landmarks fail safely
- PASS | Level 4 | layout | targets remain forward of tabletop source items
- PASS | Level 4 | compound movement | 90-degree supported start calibrates the reach controller
- PASS | Level 4 | compound movement | shoulder elevation alone cannot lift the game object
- PASS | Level 4 | compound movement | shoulder flexion plus elbow extension moves the object upward
- PASS | Level 4 | compound movement | shoulder extension plus elbow flexion returns the object downward
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
- PASS | Level 5 | safety | maximum carry duration defaults to a conservative 5 seconds
- PASS | Level 5 | safety | repeated release difficulty limit is configured
- PASS | Level 3 | safety gate | safety screen is shown before camera or game
- PASS | Level 3 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 3 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 3 | safety gate | acknowledgement enables the continue action
- PASS | Level 3 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 3 | safety gate | level-specific safety note is visible on the screen
- PASS | Level 4 | safety gate | safety screen is shown before camera or game
- PASS | Level 4 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 4 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 4 | safety gate | acknowledgement enables the continue action
- PASS | Level 4 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 4 | safety gate | level-specific safety note is visible on the screen
- PASS | Level 5 | safety gate | safety screen is shown before camera or game
- PASS | Level 5 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 5 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 5 | safety gate | acknowledgement enables the continue action
- PASS | Level 5 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 5 | safety gate | level-specific safety note is visible on the screen
- PASS | Level 6 | safety gate | safety screen is shown before camera or game
- PASS | Level 6 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 6 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 6 | safety gate | acknowledgement enables the continue action
- PASS | Level 6 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 6 | safety gate | level-specific safety note is visible on the screen
- PASS | Level 3 | safety copy | Level 3 note requires towel movement and prohibits trunk compensation
- PASS | Level 4 | safety copy | Level 4 note requires a clear environment and safe board distance
- PASS | Level 5 | safety copy | Level 5 note specifies off-table functional reach and loose simulated grasp
- PASS | Level 6 | safety copy | Level 6 note specifies off-table functional reach and empty-hand pinch
- PASS | Level 5 | safety copy | no patient-facing 握拳/握緊 wording remains in the interface
- PASS | Level 4 | rest/stop | large 休息 and 停止 controls are always visible during play
- PASS | Level 4 | rest/stop | rest pauses active game timing
- PASS | Level 4 | rest/stop | rest overlay shows the 放下雙手、放鬆肩膀 instruction
- PASS | Level 4 | rest/stop | game clock does not run while resting
- PASS | Level 4 | rest/stop | resume from rest is explicit and clears the pause
- PASS | Level 4 | rest/stop | stop ends the session safely with a recorded reason
- PASS | Level 4 | rest/stop | stable data-testid attributes exist for the safety controls
- PASS | Level 5 | rest/stop | large 休息 and 停止 controls are always visible during play
- PASS | Level 5 | rest/stop | rest pauses active game timing
- PASS | Level 5 | rest/stop | rest overlay shows the 放下雙手、放鬆肩膀 instruction
- PASS | Level 5 | rest/stop | game clock does not run while resting
- PASS | Level 5 | rest/stop | resume from rest is explicit and clears the pause
- PASS | Level 5 | rest/stop | stop ends the session safely with a recorded reason
- PASS | Level 5 | rest/stop | stable data-testid attributes exist for the safety controls
- PASS | Level 6 | rest/stop | large 休息 and 停止 controls are always visible during play
- PASS | Level 6 | rest/stop | rest pauses active game timing
- PASS | Level 6 | rest/stop | rest overlay shows the 放下雙手、放鬆肩膀 instruction
- PASS | Level 6 | rest/stop | game clock does not run while resting
- PASS | Level 6 | rest/stop | resume from rest is explicit and clears the pause
- PASS | Level 6 | rest/stop | stop ends the session safely with a recorded reason
- PASS | Level 6 | rest/stop | stable data-testid attributes exist for the safety controls
- PASS | Level 4 | compensation | a single observed compensation is logged without pausing
- PASS | Level 4 | compensation | the same compensation observed twice pauses and prompts a shorter distance
- PASS | Level 5 | hold timeout | carrying below the maximum duration does not interrupt play
- PASS | Level 5 | hold timeout | exceeding the maximum carry duration pauses the game
- PASS | Level 5 | hold timeout | hold timeout prompts 放下物件、張開手、放鬆
- PASS | Level 5 | hold timeout | hold_timeout is tracked in the session safety data
- PASS | Level 5 | release difficulty | consecutive delayed or failed releases are counted
- PASS | Level 5 | release difficulty | repeated release difficulty pauses and prompts reassessment
- PASS | Level 4 | camera error | UnsupportedError shows an in-page error with Retry and Return
- PASS | Level 4 | camera error | UnsupportedError shows a concise technical code without a raw stack
- PASS | Level 4 | camera error | UnsupportedError error can be dismissed on retry
- PASS | Level 4 | camera error | NotAllowedError shows an in-page error with Retry and Return
- PASS | Level 4 | camera error | NotAllowedError shows a concise technical code without a raw stack
- PASS | Level 4 | camera error | NotAllowedError error can be dismissed on retry
- PASS | Level 4 | camera error | NotFoundError shows an in-page error with Retry and Return
- PASS | Level 4 | camera error | NotFoundError shows a concise technical code without a raw stack
- PASS | Level 4 | camera error | NotFoundError error can be dismissed on retry
- PASS | Level 4 | camera error | SomeUnexpectedError shows an in-page error with Retry and Return
- PASS | Level 4 | camera error | SomeUnexpectedError shows a concise technical code without a raw stack
- PASS | Level 4 | camera error | SomeUnexpectedError error can be dismissed on retry
- PASS | Level 5 | data | session safety fields are present for export

