# v146 Security / Safety Review — short colloquial instructions; a wrong card is taken away

Date: 2026-11-27 · Marker `v146-20261127-plain-instructions`

## Change
Therapist feedback: a patient did not understand the game instructions; the spoken sentences
were too long and not colloquial enough. A second request concerned the playing-card game: a
wrong card that the patient has put down should disappear instead of going back to where it was.

1. Public Level 3–6 games: the rules screen now shows a title, two or three numbered short lines
   (one action per line, at most 12 characters, colloquial Cantonese) and one closing line. The
   text read aloud is exactly those lines.
2. The second spoken instruction at the moment the game starts is removed on the public page. It
   repeated the rules and, on Levels 3 / 4, described a grasp or tabletop movement that those
   levels do not use.
3. Shorter spoken lines while playing: after picking an item up, praise, cooking steps, fridge
   and laundry openings, mahjong and card rounds, the animal reminder. On-canvas "holding" labels
   use the same words as the speech.
4. Playing cards (Level 5 and Level 6): a card of the wrong suit put down in the collecting area
   is removed from the table. Before, it returned to its place.
5. 104 English entries added for the new lines.

## Safety / privacy
- Detection is unchanged and nothing is stricter: no threshold, timing, hand or pose setting,
  score rule or game step was edited. `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched. Level 6
  chopsticks stays `gameType:'dwell'`.
- The words changed, not the task: each line still describes the same movement the game already
  required (raise / lower the arm; fist, carry, open hand; three-finger pinch, carry, stay;
  squeeze and relax the exerciser).
- Clinical statements are kept where staff read them: the therapist brief on the calibration
  page still says that the page does not identify the physical tool and does not measure grip
  or pinch force, and the level picker still says that angles are camera training estimates.
  They are no longer shown on the rules screen or read aloud to the patient before each game.
  Staff should know the patient no longer hears those sentences.
- The closing line 「慢慢嚟，唔使急」 keeps the "no rush" message in every start instruction.
- Cards: removing a wrong card cannot block a round. A round needs only cards of the asked suit,
  and those are never removed by this rule. The wrong-card feedback (sound, short spoken reminder,
  −3 points, never below zero) is the same as before. Letting go outside the collecting area
  still returns the card, as before. Mahjong is unchanged.
- The other flow of the page keeps its standard wording through `plainSay(plain, formal)`; its
  sentences are still in the source and are covered by a test.
- No new data is collected or stored; no new network destination, dependency, permission or
  storage key. Speech uses the existing in-page speech helper and settings.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v146-plain-instructions.test.mjs` (11): every setting combination gives 2–3 lines of at
  most 12 characters with no arrows, brackets or staff wording; speech equals the lines plus the
  closing line; every line has an English entry; the other flow's wording is intact; the short
  in-play lines exist with English entries; wrong card removed (source and browser run on Level 5
  and Level 6, the round still completes); release outside the area unchanged; rules screen of
  all 28 games read in the browser; the start of a game does not repeat the instruction.
- Node tests in two groups: 297 + 534 = 831 → 828 pass / 3 skip / 0 fail.
- `tools/checkjs.sh` 11 OK; `node --check service-worker.js`; `git diff --check` clean;
  `./scripts/build-dist.sh` → 338 files; dist has no `__qa`; dist loads with no page error.

## Not verified
- Not tried on a real device or with a patient. How the lines sound depends on the Cantonese
  voice installed on the tablet; pronunciation of colloquial characters (嚟, 揸, 攞, 嗰) was not
  heard on a real device.
- Whether patients find the new lines easy to follow is a clinical judgement for the therapist.
