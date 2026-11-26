# v143 Security / Safety Review — simpler setup page; fewer words on the game screens; larger mahjong; Level 6 peg laundry story

Date: 2026-11-26 · Marker `v143-20261126-simple-setup`

## Change
Therapist feedback after v142: the assistants find the setup page has too many settings; the game
screens show too many rules and extra words for patients to read (the angle may stay); the
mahjong win screen is especially wordy; the session can simply use the long time because a tired
patient stops by themselves.

1. Setup page: only the affected side is shown, plus the shoulder target on Levels 3 / 4 (Level 4
   shows 60 / 90 / 120 / 150 / 180 first; 「更多角度」 shows all thirteen). Every other setting
   moves into one closed section 「進階設定（治療師用）」, which closes again each time a game is
   chosen. The shopping-list length, laundry load and dim sum display mode bars move from the
   game-picker page into that section. All default values are unchanged except the game time.
2. Game time default is 15 minutes instead of 5. The 5 and 10 minute choices remain.
3. Game screens in normal play show fewer words (`simpleScreenText()`): one action sentence on
   the story banners, one line beside the mahjong / cards table, a win banner with the name only,
   no instruction pill / rule panel / streak counter on Levels 5 / 6, one-line toasts, and a
   celebration screen with a title, the picture and at most one short line.

4. Second round of therapist feedback: the game time card is back on the setup page next to the
   affected side and shoulder target (5 / 10 / 15 minutes, default 15).
5. Level 3 / 4 mahjong tiles are larger (two rows) and the win banner names the hand and its fan
   (for example 「對對糊 3 番」). The reach decision that draws a tile is unchanged.
6. Level 6 peg laundry now defaults to the 洗衫晾衫 picture story used on Levels 3 / 4, played
   with the peg: move the hand to the dashed orange spot, squeeze to pick up, carry, and stay
   0.4 s at the destination to place automatically. The washer start button is one squeeze.
   The earlier rack game is unchanged and still selectable in the advanced section
   (「晾衫版面」).

## Safety / privacy
- Detection is unchanged and nothing is stricter: the shoulder controller, target decision, re-arm
  rules, grasp / pinch / gripper thresholds, `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched. Level 5 gameplay is
  unchanged; Level 6 chopsticks stays `gameType:'dwell'`. Scoring, timing, tier progression and
  the records kept are unchanged; only what is drawn or shown changes.
- Level 6 peg laundry story: pick-up reuses the same shared picker and thresholds as Level 6
  cards / mahjong (v140) — the hand picture is always drawn, the red ring shows the camera sees
  the hand, a hand resting on the garment becomes ready after 0.3 s, and a squeezed hand resting
  on the garment also picks it up. No threshold was tightened and no new threshold was added.
  This game is more lenient than the rack game: once picked up, the garment stays with the hand
  picture when the hand relaxes or the camera loses the hand (the stay timer simply pauses while
  the hand is not seen). No penalty, no time limit, no drop. Staff should know the story checks
  a squeeze at pick-up only, not a sustained hold; the page still does not identify the physical
  peg or measure pinch force.
- Level 3 / 4 laundry story and all shoulder detection are untouched by the peg module; the peg
  module only runs for Level 6 `peg_laundry` with the story option on.
- Longer default session: the default rises from 5 to 15 minutes. Stop, Rest and Pause stay on
  screen during every game and the pre-game safety screen is unchanged. A therapist can still pick
  5 or 10 minutes in the advanced section. Staff should be told that the default is now the long
  session.
- Affected side must still be chosen before the game can start (same check and error message).
  The left / right hand check keeps its default (on) and its lock behaviour; only its place on the
  page changes.
- Wording that is no longer on screen during play: the fried-rice celebration sentence and its
  small disclaimer line are part of the hidden detail paragraph. The same statement
  (網頁不識別實體工具，亦不量度握力或捏力) is still shown on the pre-game safety screen before
  every gripper game. The angle readout keeps its note 「相機估算，只供參考」.
- Spoken guidance is unchanged, so patients who relied on the instruction sentence still hear it.
- The level-up recommendation card is unchanged; only the running streak counter is hidden.
- No new data, network request, asset, dependency, permission or storage key. The advanced
  section's open / closed state is not stored.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v143-simple-setup.test.mjs` (16): markers; 15-minute default with shorter choices kept;
  only the two cards outside the advanced section; five common angles with all thirteen
  available; scene bars in the advanced section; banner / prompt / celebration wording rules;
  detection settings untouched; Playwright runs of the Level 3 / 4 / 5 / 6 setup pages and of the
  Level 3 / 4 and Level 5 game screens.
- Three older tests updated for the new layout and wording (`v74-teahouse`,
  `v99-hand-check-lock-privacy`, `v141-story-auto-repeat`); marker assertions updated.
- `tests/v143-peg-laundry-story.test.mjs` (7): source wiring; Playwright runs of pick-up, carry
  with a relaxed hand, hand lost while carrying, the start button, a whole round of 25 squeezes,
  layout clear of the buttons and time badge, and the rack game / Level 3–4 story still working.
  Older tests that start the rack game now select it explicitly.
- Node tests in two groups: 297 + 508 = 805; 802 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` and `./scripts/build-dist.sh` (223 files) pass.
- Playwright before / after contact sheet (iPad landscape / portrait, department laptop, phone
  for the setup page) in `ych_rehab_qa_artifacts/v143/`. Simulated movement and simulated hand frames only; the new
  Level 6 laundry detection has not been tried on a real device, with a real peg or with patients.
