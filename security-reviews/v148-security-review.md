# v148 Security / Safety Review — wording review, speech order, tracking prompts

Date: 2026-11-27 · Marker `v148-20261127-wording`

## Change
Therapist wording review after patient feedback, plus short prompts when the camera loses the
patient.

1. Wording. Start lines, spoken cues, rules cards and correction sentences use the agreed everyday
   verbs: hand exerciser "squeeze once, relax"; clothes peg "pinch the peg, pick up the garment";
   three fingers "pinch"; chopsticks keep their own verb; Level 6 waits with「等一等」. Retired
   words (收牌區, 花盤, 閃燈, 閃咭, 揸實, 停一停, 再嚟過) no longer reach the patient in the public
   flow. English entries were added for every new sentence.
2. Speech order. Step instruction > correction > tracking prompt > praise. A lower sentence never
   cuts a higher one. Praise and tracking prompts are skipped while a step is being read; a
   correction waits (up to 5 s) and is read right after the step ends.
3. Spoken numbers. The Cantonese voice is given「做兩次」「第二碟」; the screen keeps digits.
4. Cooking (hand exerciser). Squeezes per dish are 13 / 22 / 35 (was about double). After a dish
   there is a 20 s rest; the next dish starts only when the patient squeezes once. No new dish
   starts with under 40 s left. Each step has its own short sound.
5. Dim sum (Level 6, order mode). One order at a time, always shown at the top. Because the
   strip is now on screen for everyone, its placement was made safe: it no longer treats its own
   previous position as an obstacle (it used to slide down frame by frame), it cannot reach the
   side dim sum in landscape, and when the middle place does not fit the third dim sum goes to a
   fixed place under the left one instead of a random spot (on the 1413×653 laptop two dim sum
   used to sit on top of each other). Picking and placing rules are unchanged.
6. Peg laundry story. The washing step runs by itself; the round is 24 moves.
7. Pause after repeated mistakes. One short sentence; the screen shows exactly what is read. In
   the order game the sentence names the dim sum on the order, never the one just misplaced, so
   the patient is not told to repeat the mistake.
8. Tracking prompts T1–T9. A small chip in the top row of the game plus one spoken sentence when
   the hand or shoulder is not seen, the patient is too close / too far, the other hand is used,
   the picture is unstable or the camera stalls. After 15 s the prompt asks for the therapist.
   The therapist asked for the chip to cover nothing, so it is placed in the row of the buttons
   (landscape) or the row above them (portrait), as near the middle as the free space allows. It
   measures the buttons, the numbers on the left, the language button, the cooking step label and
   the dim sum picture strip, and takes the nearest free place; if the row is too short the text
   gets slightly smaller (never below 18 px) or, in the cooking game, the chip goes right under
   the step label. The chip is display only (`pointer-events:none`), reads layout only, and the
   placement runs when the chip appears and at most twice a second while it is shown.
9. Step repeat. A step instruction is read again after 10 s with no movement, at most twice.
10. Voice note. The calibration page tells the therapist when the device has no Cantonese voice.

## Safety / privacy
- Nothing is stricter for the patient's movement. No detection threshold, confidence, dwell time or
  score rule was edited. `numHands:2`, confidences 0.20 / 0.18 / 0.18, `runningMode:"VIDEO"`, the
  work interval and the canvas limit are untouched; Levels 5 / 6 still have no smoothing; Level 6
  chopsticks stays `gameType:'dwell'`. The cooking change lowers the number of squeezes only; how a
  squeeze is recognised is the same.
- Tracking prompts only observe. The runtime block does not change the score, the mistake count,
  the pause state or the end of a game, and it does not feed back into hand or pose selection. It
  reads values the page already had (number of hands, the existing left / right label and its
  confidence, hand span, shoulder distance, the existing camera-stall flag).
- Prompts are rate-limited so they cannot nag: 3 s before the first one, 15 s between repeats of a
  sentence, at most two spoken sentences per problem, then only the chip. Nothing in the first 5 s
  of a game, during a pause, a reward, a rest scene or the cooking rest.
- "Use the other hand" is conservative: it needs the existing side check to be on and a confident
  label (0.80; 0.90 when that hand is already playing), and it is never used while both hands hold
  the stick. Too close / too far compare with the patient's own size at the start of the game; the
  ratios are first values and have not been tuned on site.
- Fatigue. Fewer squeezes, a compulsory 20 s rest, and the patient decides when the next dish
  starts ("if you are tired, rest"). The existing grip-release safety pause is unchanged apart
  from its title wording.
- The chip is not interactive (`pointer-events:none`) and does not cover a HUD button at the three
  tested screen sizes.
- Privacy / storage / network: no new stored value, no new network destination, dependency or
  permission. Prompts are generated in the page; no frame or landmark is stored or sent. Speech
  uses the browser's built-in voice as before.
- The voice note is informational and only appears when a voice list is available and has no
  Cantonese entry; it is not shown in English mode.
- Older iPad Safari: the new text handling uses no regular-expression lookbehind.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v148-wording-tracking.test.mjs` (29): markers; start lines for every setting combination
  (agreed verbs, length, retired words); English entries; speech order and the waiting correction;
  spoken numbers; the nine prompts in both languages; timing rules of the prompts (3 s, 15 s, two
  sentences, help after 15 s, recovery sentence only after a spoken prompt, immediate stall,
  unstable picture, reset while suppressed); step repeat; the prompt code does not score, pause or
  touch a threshold; cooking counts, rest and patient-started next dish in the browser; single dim
  sum order; the order strip stays at the top and the three dim sum never stack, sit under the
  strip or on the plate (laptop 1413×653, tablet landscape and portrait, 1024×768); pause overlay
  text equals the spoken sentence, and in the order game it names the dim sum on the order rather
  than the one just misplaced; live prompt sequence in a running game
  with score and mistake count unchanged; the chip covers no button, number, step label or
  picture strip in six games at four screen sizes and its text is never cut; "use the other
  hand" rules for hand and pose; chip
  geometry; voice note.
- Updated for this change: the wording and marker assertions of the earlier test files (see
  `progress.md`).
- Node tests in two groups: see `progress.md` for the counts of this build.
- `tools/checkjs.sh`; `node --check service-worker.js localization.js`; `git diff --check`;
  `./scripts/build-dist.sh`; dist has no `__qa`.

## Not verified
- Not tried on the department tablet, the TV laptop or with a patient. All prompt timing was
  checked with injected hand / pose data and a virtual clock, not with a real camera.
- How the Cantonese voice pronounces「捏」and「夾」on the department devices has not been heard.
- The too close / too far ratios (hand 2.2× / 0.40×, shoulders 1.5× / 0.6×) and the label
  confidences for "use the other hand" are first values; false or missing prompts on site are
  possible and should be reported.
- The camera-stall prompt (T7) depends on the real camera loop and was only exercised through the
  timing logic.
- English mode: the supermarket story steps are still spoken in Cantonese only (as before).
