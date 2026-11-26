# v144 Security / Safety Review — Level 3 / 4 「香港遊」: binoculars and landmark shiny cards

Date: 2026-11-26 · Marker `v144-20261126-hk-tour-cards`

## Change
Therapist feedback after v143: a patient described Level 3 as "just reaching". The therapist asked
for at least 50 Hong Kong landmark photos presented as shiny collectible cards, and then proposed a
first-person story: arrive somewhere in Hong Kong, get off, and lift binoculars to look at the view.

1. On Levels 3 / 4 (public build) the 「荃灣街景相片」 scene becomes 「香港遊」. The view at each stop
   starts hazy. A pair of binoculars on screen rises with the patient's arm. Each completed lift
   clears one quarter of the view. After four lifts the landmark is named and becomes a shiny card
   (name, district, one to three stars, number) that flies into the album; a short ride then leads
   to the next stop, which is not announced beforehand.
2. 77 landmark cards (`img/cards/*.jpg`, 720×540). Stops are shuffled; every landmark is visited
   once before any repeats and the same stop never comes twice in a row.
3. The result page adds one sentence and a grid of the cards collected in this session.
4. New cover image for the scene card on Levels 3 / 4 (`img/advanced/hk_tour_thumb.jpg`).

## Safety / privacy
- Detection is unchanged and nothing is stricter. The new module is a drawing and sound layer: it
  reads `shoulderFlexionState.progress` to place the binoculars and is told when a lift has been
  counted, exactly like the v138 mahjong / cards scenes. The shoulder controller, target decision,
  v137 re-arm rules, score, timing, `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched.
- Level 5 gameplay is unchanged, including the Level 5 Tsuen Wan photo matching game and its six
  photos. Level 6 chopsticks stays `gameType:'dwell'`.
- No win or lose, no penalty, no time limit. The star level of a card is decoration only and does
  not depend on how the patient moves.
- Pace: three lifts in four take about 1.3 s of animation; the fourth (card, album, ride) takes
  about 6 s, during which no new lift is counted. Staff should know this acts as a short pause
  after every fourth lift.
- Visual load: while the binoculars are at the eyes the rest of the scene dims for under one
  second; the card then has a slow moving shine and a short confetti burst. Nothing flashes
  repeatedly.
- Photos: all 77 are freely licensed images from Wikimedia Commons (CC BY, CC BY-SA, CC0 or public
  domain). Each is listed in `image-sources.json` with title, author, licence, source page and the
  change made (cropped / resized); the in-page 「圖片來源」 section names the photographers and
  links to that file. No image from the tourism board website is used, because its terms require
  written consent. Photos were looked at on review sheets for recognisability and for the absence
  of political or sensitive content; a few are older photos chosen for nostalgia.
- Photos may show members of the public at a distance in street scenes, as published by their
  photographers under the stated licences. No patient or staff image is involved.
- No new data is collected or stored. The album lives in memory for the session only and is
  cleared when a game starts. No new network destination: card images are same-origin files and
  are added to the offline bundle automatically (about 6.5 MB more).
- No new dependency, permission or storage key.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v144-hk-tour-cards.test.mjs` (7): at least 50 unique cards with Chinese / English text,
  stars and a compact local file; every photo credited with an allowed licence and a Commons
  source page; four lifts collect one card and move to a different stop; a second trigger during
  the animation is ignored; every landmark once before repeats; the module does not write the
  controller state or decide a repetition and does not use canvas filters; scene card, result page
  and English text wired.
- `tests/tsuenwan-photo-assets.test.mjs` updated to check the six original photos separately from
  the cards. Marker assertions updated.
- Node tests in two groups: 297 + 515 = 812; 809 pass, 3 skipped, 0 failed. `tools/checkjs.sh`, `node --check
  service-worker.js`, `git diff --check` and `./scripts/build-dist.sh` (301 files) pass.
- Playwright contact sheet (iPad landscape / portrait, department laptop, phone) in
  `ych_rehab_qa_artifacts/v144/`. Simulated movement only; not tried on a real device or with
  patients.
