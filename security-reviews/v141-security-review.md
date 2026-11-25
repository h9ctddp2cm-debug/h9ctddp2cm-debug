# v141 Security / Safety Review — story games repeat until the session time is up

Date: 2026-11-25 · Marker `v141-20261125-story-repeat`

## Change
Therapist feedback: the supermarket story (Level 3/4), the laundry story (Level 3/4) and the
fried-rice gripper game (Level 6) stopped as soon as the patient finished the story once (about two
minutes for most patients), although a longer session time (5 / 10 / 15 minutes) had been chosen.

1. Supermarket and laundry: when the closing scene has played and at least 8 s of session time are
   left (`storyRoundCanRepeat()`), the story starts again from its first scene instead of ending the
   game. The opening banner of a later round names the round (第 N 轉). With less than 8 s left the
   game ends on the closing scene exactly as before.
2. Fried rice: when a dish is finished and at least 15 s are left (this includes the 6.5 s
   celebration), the celebration says 「稍後自動繼續」 and the next dish starts from step 1 when it
   closes. Otherwise the finished screen stays until the time is up, as before.
3. Result page: one sentence says how many rounds / dishes were completed and how far the
   unfinished one got. It reports this session only; nothing is compared with earlier sessions.

## Safety / privacy
- Session length is still decided only by the time the therapist chose and by the Stop / Rest /
  Pause buttons, which are unchanged. The game never runs longer than the chosen time; the change
  only removes the early stop. Therapists who want a short session can choose a shorter time or
  press Stop.
- Fatigue: a repeating game means more lifts / squeezes within the chosen time than before. The
  rest scenes inside each story (washing, sun-drying, cashier packing, the 6.5 s celebration) repeat
  with every round, and the Rest button is always available.
- Detection is unchanged and nothing is stricter: the shoulder controller, the target decision, the
  re-arm rules, the gripper squeeze thresholds, `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched. The next dish keeps
  the relaxed-hand baseline learnt in the first dish, so squeezes are judged exactly as before.
- Scores and repetition counts keep adding up across rounds; nothing is reset or discarded.
- Clinical honesty: the result sentence counts completed story rounds only. The page still does not
  identify the physical tool and does not measure grip or pinch strength
  (網頁不識別實體工具，亦不量度握力或捏力); the on-screen angle remains a camera estimate.
- No new data: the round counters live in memory for the current game only, are cleared when a game
  starts, and are never stored, exported or sent anywhere. No new network request, asset,
  dependency, permission or storage key.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks
  (`setTimeLeft`, `closeReward`) are absent from `dist/public/index.html`.

## Verification
- `tests/v141-story-auto-repeat.test.mjs` (16) — time rule; wiring of the three games; later rounds
  use the same story steps; result sentences; end-to-end for Level 3 and 4 supermarket and laundry
  (finish → round 2 starts by itself → real lifts still score → ends on the closing scene with 6 s
  left) and for fried rice (dish 1 → dish 2 with the same baseline → no dish 3 with 10 s left).
- Full suite 755 tests: 752 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` and `./scripts/build-dist.sh` (223 files) pass.
- Playwright contact sheet (iPad landscape / portrait, department laptop) in
  `ych_rehab_qa_artifacts/v141/`. Simulated movement only; not yet tried on a real device with a
  patient.
