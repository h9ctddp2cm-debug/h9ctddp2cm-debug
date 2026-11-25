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

Follow-up before release (therapist: the red ring is the patient's "ready, squeeze now" signal and
must come with the hand picture): in the same two games (`level6QuickReadyEnabled()`)
4. the stay-on-the-card preparation for a relaxed hand takes 300 ms here instead of 700 ms; the
   ring has a white edge and is slightly thicker;
5. (superseded in part by the second follow-up below) the ring is drawn whenever the camera sees
   the hand and nothing is held; no ring while the hand is unseen.

## Safety / privacy
- The hand picture is display only. `picker.update` still returns early while no hand is reported,
  so an unseen hand cannot pick up, move, place or release anything, and no time is accumulated
  toward the pick-up, release or stay-to-place timers. Scores are written only when the hand is
  seen again.
- Rule changes (both more lenient, never stricter; see the second follow-up below): the shorter
  stay-on-the-card preparation (300 ms), and a squeezing hand resting on a card / tile group picks
  it up. A wrong card picked up can simply be put down again; there is no penalty beyond the
  existing gentle cross mark.
- Otherwise detection is unchanged: hand admission, the 1.5 s grace, thresholds
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

## Follow-up before release: ring with the seen hand, squeezing hand picks up
- Therapist decision at the bedside: in Level 6 playing cards and mahjong a patient who keeps
  squeezing must not be asked to let go first ("我哋係鼓勵佢夾，因為夾出力"; a tired patient lets go
  naturally). The red ring is drawn whenever the camera sees the hand and nothing is held.
- New interaction rule, these two games only: a squeezing hand in direct contact with one card /
  tile group picks it up after resting there (300 ms while still, 900 ms at most). This replaces,
  for these two games, the earlier rule that a hand parked closed on an item never picks it up.
  Flowers, peg laundry, chopsticks, fried rice and every Level 5 game keep the earlier rule.
- Fail-closed input is unchanged and still tested for both games: an unseen hand, the grace window
  with a held-over cursor, the wrong hand, a repeated frame, missing landmarks and uncertain
  handedness cannot build rest time and cannot pick anything up.
- Nothing is stricter: open → squeeze and relax → squeeze still work with the same timings.
- Known trade-off, accepted by the therapist's request: a squeezing hand that rests on a wrong
  card picks that card up; a quick pass does not.
- No new data, network request, asset, dependency, permission or storage key.

## Verification
- `tests/v140-cards-mahjong-cursor-stays.test.mjs` (14) — held item and hand picture stay at the last
  seen place past the grace, nothing is placed while unseen, placed and scored once the hand
  returns; relaxed picture when nothing is held; centre before first sighting; flowers and Level 5
  cards unchanged.
- Full suite 739 tests: 736 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` clean.
- Playwright contact sheet with a synthetic hand at 1180×820, 820×1180 and 1413×653, including a
  v139 / v140 before-after pair.

## Residual
- Not exercised with a real camera and hand. How quickly the camera finds a pinched hand again is
  unchanged; the `?perf=1` overlay can be used at the bedside to read the accept / reject counts.
- Level 6 flowers and peg laundry (the `carrier` module) still hide the hand picture while the hand
  is unseen; left for a separate decision.
