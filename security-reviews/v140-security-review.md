# v140 Security / Safety Review — Level 6 playing cards / mahjong: hand picture always shown

Date: 2026-11-25 · Marker `v140-20261125-cursor-stays`

## Change
Therapist bedside feedback: in Level 6 playing cards and mahjong the hand picture (cursor) takes a
long time to come back, so patients believe their pinch failed when the card was in fact picked up.

Cause: the hand picture was drawn only while the camera reported a hand. After 1.5 s without a hand
the tracking state is cleared and the picture disappeared; the held card / tile group stayed held in
the game state but was drawn back at its starting place because there was no hand position.

Public Level 6 playing cards and mahjong only (`level6CursorAlwaysShown()`), drawing only:
1. While the camera does not report a hand, the hand picture stays at the place where the hand was
   last seen, drawn lighter (alpha .62 pinch / .54 relaxed, against .84 / .72 when seen).
2. Before the first sighting it waits in the middle of the table.
3. A held card / tile group and its "已拿住" label are drawn at that same place instead of snapping
   back to the starting place.

## Safety / privacy
- Display layer only. `picker.update` still returns early while no hand is reported, so an unseen hand
  cannot pick up, move, place or release anything, and no time is accumulated toward the pick-up,
  release or stay-to-place timers. Scores are written only when the hand is seen again.
- Detection is not stricter and not looser: hand admission, the 1.5 s grace, thresholds
  (0.20 / 0.18 / 0.18), `numHands:2`, `runningMode:'VIDEO'`, work interval and canvas limit are
  untouched. Level 5 (all games) and the other Level 6 games (flowers, peg laundry, chopsticks
  `gameType:'dwell'`, fried-rice gripper) are unchanged.
- Clinical honesty: the lighter picture tells the patient and therapist that the position is the
  last known one, not a live one. The page still does not identify the physical tool and does not
  measure grip or pinch strength (網頁不識別實體工具，亦不量度握力或捏力).
- No new data: the last-seen point lives in memory for the current game only, is cleared when a
  game starts or is torn down, and is never stored, exported or sent anywhere. No new network
  request, asset, dependency, permission or storage key.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v140-cards-mahjong-cursor-stays.test.mjs` (7) — held item and hand picture stay at the last
  seen place past the grace, nothing is placed while unseen, placed and scored once the hand
  returns; relaxed picture when nothing is held; centre before first sighting; flowers and Level 5
  cards unchanged.
- Full suite 732 tests: 729 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` clean.
- Playwright contact sheet with a synthetic hand at 1180×820, 820×1180 and 1413×653, including a
  v139 / v140 before-after pair.

## Residual
- Not exercised with a real camera and hand. How quickly the camera finds a pinched hand again is
  unchanged; the `?perf=1` overlay can be used at the bedside to read the accept / reject counts.
- Level 6 flowers and peg laundry (the `carrier` module) still hide the hand picture while the hand
  is unseen; left for a separate decision.
