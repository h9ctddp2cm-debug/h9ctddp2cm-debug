# Level 4–6 Technical Validation Report

Generated: 2026-08-30T17:13:41.276Z

Result: **PASS** (168/168 checks passed)

| FTHUE level | Passed | Failed |
|---|---:|---:|
| 2 | 37 | 0 |
| 3 | 22 | 0 |
| 4 | 22 | 0 |
| 5 | 41 | 0 |
| 6 | 46 | 0 |

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

This is reproducible software technical verification only. It does not establish clinical validity, treatment efficacy, safety in real patients, or medical-device equivalence. All six normal-flow Level 6 activities use the selected affected hand and fresh Hand Landmarker frames for tripod-pinch open preparation, light/asymmetric close, hand-position transport and stabilized reopen. No shoulder or elbow angle controls readiness, pickup, progress, transport, release or scoring. Missing, uncertain, partial, stale, repeated-generation or wrong-side hand input fails closed. The software neither identifies physical tools nor measures pinch/grip force. The research-only tool path remains separate. Compensation, muscle tone and spasticity are never detected automatically: they are therapist observations entered manually. Safety-control behaviour verified here is software behaviour only and still requires supervised bedside testing on the target iPad.

## Checks

- PASS | Level 2 | launch matrix | bilateral launches with the correct engine
- PASS | Level 3 | launch matrix | bowlinglane launches with the correct engine
- PASS | Level 3 | launch matrix | basketball launches with the correct engine
- PASS | Level 3 | launch matrix | tsuenwan launches with the correct engine
- PASS | Level 3 | launch matrix | dimsum launches with the correct engine
- PASS | Level 3 | launch matrix | laundry launches with the correct engine
- PASS | Level 3 | launch matrix | cards launches with the correct engine
- PASS | Level 3 | launch matrix | mahjong launches with the correct engine
- PASS | Level 4 | launch matrix | bowlinglane launches with the correct engine
- PASS | Level 4 | launch matrix | basketball launches with the correct engine
- PASS | Level 4 | launch matrix | tsuenwan launches with the correct engine
- PASS | Level 4 | launch matrix | dimsum launches with the correct engine
- PASS | Level 4 | launch matrix | laundry launches with the correct engine
- PASS | Level 4 | launch matrix | cards launches with the correct engine
- PASS | Level 4 | launch matrix | mahjong launches with the correct engine
- PASS | Level 5 | launch matrix | flowers launches with the correct engine
- PASS | Level 5 | launch matrix | dimsum launches with the correct engine
- PASS | Level 5 | launch matrix | laundry launches with the correct engine
- PASS | Level 5 | launch matrix | fridge launches with the correct engine
- PASS | Level 5 | launch matrix | cards launches with the correct engine
- PASS | Level 5 | launch matrix | mahjong launches with the correct engine
- PASS | Level 6 | launch matrix | flowers launches with the correct engine
- PASS | Level 6 | launch matrix | chopstick_dimsum launches with the correct engine
- PASS | Level 6 | launch matrix | peg_laundry launches with the correct engine
- PASS | Level 6 | launch matrix | cards launches with the correct engine
- PASS | Level 6 | launch matrix | mahjong launches with the correct engine
- PASS | Level 6 | launch matrix | cooking launches with the correct engine
- PASS | Level 6 | availability | exact restored Level 6 catalog has six choices and no legacy duplicates
- PASS | Level 6 | locked activity | flowers stays locked from library through setup and launch
- PASS | Level 6 | locked activity | chopstick_dimsum stays locked from library through setup and launch
- PASS | Level 6 | locked activity | peg_laundry stays locked from library through setup and launch
- PASS | Level 6 | locked activity | cards stays locked from library through setup and launch
- PASS | Level 6 | locked activity | mahjong stays locked from library through setup and launch
- PASS | Level 6 | locked activity | cooking stays locked from library through setup and launch
- PASS | Level 6 | tripod pinch | flowers requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | flowers rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | tripod pinch | chopsticks requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | chopsticks rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | tripod pinch | peg requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | peg rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | tripod pinch | cards requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | cards rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | tripod pinch | mahjong requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | mahjong rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | tripod pinch | cooking requires open-light-close, hand transport, and reopen
- PASS | Level 6 | tool safety | cooking rejects stale, wrong-hand, partial and static-closed input
- PASS | Level 6 | activity library | no per-game difficulty label is rendered at any level in either language
- PASS | Level 5 | gesture | one curled finger cannot trigger grasp
- PASS | Level 5 | gesture | two curled fingers trigger configured grasp
- PASS | Level 5 | gesture | one reopened finger does not release held item
- PASS | Level 5 | gesture | two reopened major fingers release held item
- PASS | Level 6 | gesture (research track only) | pinch enters below normalized aperture threshold
- PASS | Level 6 | gesture (research track only) | pinch hysteresis retains hold between enter and exit thresholds
- PASS | Level 6 | gesture (research track only) | pinch exits above normalized release threshold
- PASS | Level 6 | gesture (research track only) | clearly separated fingers arm a new pinch
- PASS | Level 5 | safety | malformed grasp landmarks fail safely
- PASS | Level 6 | safety (research track only) | malformed pinch landmarks fail safely
- PASS | Level 2 | availability | exactly one Level 2 activity is available
- PASS | Level 2 | availability | unsupported direct launch fails closed to bilateral
- PASS | Level 2 | calibration | Level 2 never shows elbow calibration
- PASS | Level 2 | symmetry | left and right selected arms produce symmetric outward progress
- PASS | Level 2 | repetition | outward scores once and return to midline rearms
- PASS | Level 2 | tracking | recording-like supported slide starts moving without a fixed elbow ratio
- PASS | Level 2 | fail closed | meaningful torso translation is rejected
- PASS | Level 2 | fail closed | missing selected landmarks are rejected
- PASS | Level 5 | flow | prepared gesture and hold acquire an item
- PASS | Level 5 | flow | correct placement increments the correct count
- PASS | Level 5 | flow | prepared gesture and hold acquire an item
- PASS | Level 5 | flow | wrong placement increments only the wrong count
- PASS | Level 5 | tracking | brief tracking loss uses the 750 ms grace window
- PASS | Level 5 | tracking | sustained tracking loss clears detection safely
- PASS | Level 5 | safety | maximum carry duration defaults to a conservative 5 seconds
- PASS | Level 5 | safety | repeated release difficulty limit is configured
- PASS | Level 2 | safety gate | safety screen is shown before camera or game
- PASS | Level 2 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 2 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 2 | safety gate | acknowledgement enables the continue action
- PASS | Level 2 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 2 | safety gate | concise level-specific note is present
- PASS | Level 3 | safety gate | safety screen is shown before camera or game
- PASS | Level 3 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 3 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 3 | safety gate | acknowledgement enables the continue action
- PASS | Level 3 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 3 | safety gate | concise level-specific note is present
- PASS | Level 4 | safety gate | safety screen is shown before camera or game
- PASS | Level 4 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 4 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 4 | safety gate | acknowledgement enables the continue action
- PASS | Level 4 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 4 | safety gate | concise level-specific note is present
- PASS | Level 5 | safety gate | safety screen is shown before camera or game
- PASS | Level 5 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 5 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 5 | safety gate | acknowledgement enables the continue action
- PASS | Level 5 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 5 | safety gate | concise level-specific note is present
- PASS | Level 6 | safety gate | safety screen is shown before camera or game
- PASS | Level 6 | safety gate | continue is blocked until the checklist is acknowledged
- PASS | Level 6 | safety gate | clicking continue without acknowledgement does not proceed
- PASS | Level 6 | safety gate | acknowledgement enables the continue action
- PASS | Level 6 | safety gate | explicit acknowledgement is required and then proceeds
- PASS | Level 6 | safety gate | concise level-specific note is present
- PASS | Level 2 | safety copy | Level 2 concise note retains tabletop support and required landmarks
- PASS | Level 3 | safety copy | Level 3 concise note retains off-table arm and full framing
- PASS | Level 4 | safety copy | Level 4 concise note retains off-table arm and full framing
- PASS | Level 5 | safety copy | Level 5 concise note retains off-table reach and loose hand sequence
- PASS | Level 6 | safety copy | Level 6 concise note requires tripod pinch without shoulder/elbow wording
- PASS | Level 3 | setup | Level 3 keeps its 30–60 degree selector
- PASS | Level 4 | setup | Level 4 keeps its 60–180 degree selector
- PASS | Level 6 | setup | Level 6 hides the complete shoulder target selector panel
- PASS | Level 5 | safety copy | no patient-facing 握拳/握緊 wording remains in the interface
- PASS | Level 2 | rest/stop | large 休息 and 停止 controls are always visible during play
- PASS | Level 2 | rest/stop | rest pauses active game timing
- PASS | Level 2 | rest/stop | rest overlay shows the 放下雙手、放鬆肩膀 instruction
- PASS | Level 2 | rest/stop | game clock does not run while resting
- PASS | Level 2 | rest/stop | resume from rest is explicit and clears the pause
- PASS | Level 2 | rest/stop | stop ends the session safely with a recorded reason
- PASS | Level 2 | rest/stop | stable data-testid attributes exist for the safety controls
- PASS | Level 3 | rest/stop | large 休息 and 停止 controls are always visible during play
- PASS | Level 3 | rest/stop | rest pauses active game timing
- PASS | Level 3 | rest/stop | rest overlay shows the 放下雙手、放鬆肩膀 instruction
- PASS | Level 3 | rest/stop | game clock does not run while resting
- PASS | Level 3 | rest/stop | resume from rest is explicit and clears the pause
- PASS | Level 3 | rest/stop | stop ends the session safely with a recorded reason
- PASS | Level 3 | rest/stop | stable data-testid attributes exist for the safety controls
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
- PASS | Level 2 | compensation | a single observed compensation is logged without pausing
- PASS | Level 2 | compensation | the same compensation observed twice pauses and prompts a shorter distance
- PASS | Level 5 | hold timeout | carrying below the maximum duration does not interrupt play
- PASS | Level 5 | hold timeout | exceeding the maximum carry duration pauses the game
- PASS | Level 5 | hold timeout | hold timeout prompts 放下物件、張開手、放鬆
- PASS | Level 5 | hold timeout | hold_timeout is tracked in the session safety data
- PASS | Level 5 | release difficulty | consecutive delayed or failed releases are counted
- PASS | Level 5 | release difficulty | repeated release difficulty pauses and prompts reassessment
- PASS | Level 2 | camera error | UnsupportedError shows an in-page error with Retry and Return
- PASS | Level 2 | camera error | UnsupportedError shows a concise technical code without a raw stack
- PASS | Level 2 | camera error | UnsupportedError error can be dismissed on retry
- PASS | Level 2 | camera error | NotAllowedError shows an in-page error with Retry and Return
- PASS | Level 2 | camera error | NotAllowedError shows a concise technical code without a raw stack
- PASS | Level 2 | camera error | NotAllowedError error can be dismissed on retry
- PASS | Level 2 | camera error | NotFoundError shows an in-page error with Retry and Return
- PASS | Level 2 | camera error | NotFoundError shows a concise technical code without a raw stack
- PASS | Level 2 | camera error | NotFoundError error can be dismissed on retry
- PASS | Level 2 | camera error | SomeUnexpectedError shows an in-page error with Retry and Return
- PASS | Level 2 | camera error | SomeUnexpectedError shows a concise technical code without a raw stack
- PASS | Level 2 | camera error | SomeUnexpectedError error can be dismissed on retry
- PASS | Level 5 | data | session safety fields are present for export

