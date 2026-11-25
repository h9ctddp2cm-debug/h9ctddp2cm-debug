# v142 Security / Safety Review — story rounds bring the next items; cheer kept for the ball games

Date: 2026-11-25 · Marker `v142-20261125-story-rotate`

## Change
Therapist follow-up to v141 (stories repeat until the session time is up):

1. Each repeated round of the supermarket story and the laundry story uses the next items instead
   of the same list again (`storyRoundPick`). Round 1 is exactly as before. The supermarket
   rotation uses eight items that already existed in the game (apple, soy sauce, orange, milk, choy
   sum, eggs, rice, toilet paper); the laundry story rotates through its six garments.
2. The 「好波」 cheer recording is played for bowling and basketball only. The supermarket and
   laundry stories keep the applause at their closing scene.
3. The fried-rice celebration sentence for the gripper version now names what was actually done
   (squeeze the gripper, then relax) instead of listing movements of the earlier gesture version.

## Safety / privacy
- Detection is unchanged and nothing is stricter: the shoulder controller, the target decision, the
  re-arm rules, the gripper squeeze thresholds, `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched. The change only
  decides which pictures appear in a later round.
- Workload: a laundry round has the same number of lifts in every round. A supermarket round
  without fruit has fewer lifts than round 1 (fruit needs two lifts each), never more than the
  longest existing list. Session length is still decided only by the chosen time and the Stop /
  Rest / Pause buttons.
- Clinical honesty: the celebration sentence no longer claims wrist circles, forearm rotation,
  elbow movement or reaching, which the gripper version does not ask for. It states that the page
  does not identify the physical tool and does not measure grip or pinch strength
  (網頁不識別實體工具，亦不量度握力或捏力).
- Sound: one fewer recording is played in the two stories; no new audio. The cheer file is still
  shipped for bowling and basketball and is no longer fetched by the two stories.
- No new data, network request, asset, dependency, permission or storage key. The round number
  that selects the items lives in memory for the current game only.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v142-story-rotate-no-cheer.test.mjs` (12) — rotation rule; round 1 lists unchanged; later
  lists differ from the round before and contain no item twice; later rounds are built from their
  own list; the cheer call exists in exactly two places (bowling, basketball); celebration
  sentence; end-to-end three rounds for Level 3 and 4 supermarket and laundry (the items put away
  match each round's list).
- Full suite 767 tests: 764 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` and `./scripts/build-dist.sh` (223 files) pass.
- Playwright contact sheet (iPad landscape / portrait, department laptop) in
  `ych_rehab_qa_artifacts/v142/`. Simulated movement only; the sound change is verified by tests
  only and has not been listened to on a real device.
