# v137 Security / Safety Review — Level 3/4 shoulder-flexion re-arm after reward, 10° drop-from-peak return, no public degree figures

Date: 2026-11-20 · Marker `v137-20261120-shoulder-rearm-drop10`

## Change
Therapist bedside report after v136: Level 3/4 patients who lifted the arm past the target saw no
response and had to lower the arm fully to the captured rest pose before the game reacted; wheelchair
users start with the hands on the lap. Root cause (reproduced in a Node simulation): when the reward
animation ended, `finishShoulderRewardCycle()` called `setTarget()`, which forces `await-start` even
when the patient was already half-way into the next lift; the strict return gates (≤45 % of the
excursion AND settled at the lowest observed angle) plus the slow lowering filter then made every
re-arm feel like "back to 0°".

Public patient mode only (`patientAssist` / `!research.active`); research sessions are unchanged:
1. The public reward end no longer resets the controller (`setTarget()` is now research-only), so a
   lift already under way keeps counting. New `completeHeldRepetition()` (therapist rule: patients may
   keep the arm up instead of lowering it) — when the reward animation has finished and the lift is still
   waiting for its return at or above the set angle, the repetition is counted and the next one is
   admitted at once, so a held arm scores once per animation. Hold (dwell) mode still requires the hold
   to complete first.
2. `CONFIG.patientRearmDropDeg = 10` (therapist rule 「只要比啱啱舉高個下嗰個點低 10° 就得喇」) — the
   controller tracks the highest estimate of each lift (`cyclePeakDeg` / `startPeakDeg`); a repetition
   completes and the next lift is admitted (`outward`) as soon as the estimate is 10° below that peak,
   with no return to the start pose and no floor settling. If the arm is still at the target at that
   moment the new lift is credited straight away. `relativeReturnCap` 0.45 and the research gates are
   untouched.
3. `CONFIG.patientDownSmoothAlpha` 0.16 → 0.25.
4. Public prompts carry no degree figures (抬高 / 慢慢放低 / 放低啲再抬高); the 現在／目標 readouts are
   hidden; the canvas 目標 xx° label is drawn only in research mode. Therapist decision: the camera
   estimate is relative to the captured rest pose and not accurate enough to show.

## Safety / privacy
- No new data, storage, network or permission use. No camera-pipeline change: `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Clinical wording unchanged: the camera estimate is training feedback, not goniometric ROM; public
  mode now shows fewer numbers, not more. 網頁不識別實體工具，亦不量度握力或捏力.
- Level 5 / Level 6 gameplay, chopsticks (`gameType:'dwell'`), cooking and all v128–v136 rules untouched.
- Research mode: `setTarget()` after a reward, strict return gates, degree prompts and readouts all
  unchanged (guarded by `research.active` in index.html and `patientAssist` in the controller).
- dist/public: `__qa` 0 occurrences; `research|pilot` 0 occurrences (a controller comment was reworded).

## Verification
- `tests/v137-shoulder-rearm-drop10.test.mjs` (12 tests) + full Node suite green (two groups).
- Playwright public Level 4 bowling (laptop / portrait) and Level 3 德華公園 (iPad): arm held up through
  two animations scores once each → 14° drop counts → lift to 110° credited at once → return to lap counts;
  supermarket + 2 s hold mode also scores a held arm once per animation; no `xx°` strings in the DOM. Contact sheet `ych_rehab_qa_artifacts/v137/v137-qa-contact-sheet.png`.
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check`, `./scripts/build-dist.sh` OK.
