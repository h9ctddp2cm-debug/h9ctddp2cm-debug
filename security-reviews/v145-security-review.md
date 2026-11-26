# v145 Security / Safety Review — Level 3 / 4 「茶樓飲茶」: open the steamer, 30 dim sum, order sheet with the family

Date: 2026-11-27 · Marker `v145-20261127-yum-cha`

## Change
Therapist feedback after v143 / v144: patients said the tea house always serves the same few
dishes; the therapist asked for at least 30 kinds of dim sum and for the play that had been agreed
earlier (an order sheet and the family at the table).

1. On Levels 3 / 4 (public build), the simulated tea house view of 「茶樓飲茶」 becomes a round
   table with four family members (grandmother, grandfather, mother, child; no name labels). An
   order sheet lists the six dishes of this table. A closed steamer arrives; its lid rises with
   the patient's arm and only steam is visible. Each completed lift opens the steamer, names the
   dish (also spoken), passes it to one family member who says a short line, and ticks one box on
   the order sheet. After six ticks the bill is paid (「食飽喇，埋單！」) and a new table starts.
2. 30 dishes (`img/dimsum/<id>.png`). They are dealt from a shuffled bag, six per table: all 30
   appear before any repeat, and the first table after a reshuffle never repeats the table just
   finished.
3. The result page adds one sentence and a grid of the dishes eaten in this session.
4. New cover image for the scene card on Levels 3 / 4 (`img/dimsum/yum_cha_thumb.jpg`).

## Safety / privacy
- Detection is unchanged and nothing is stricter. The new module is a drawing and sound layer: it
  reads `shoulderFlexionState.progress` to place the lid and is told when a lift has been counted,
  exactly like the v138 mahjong / cards and v144 tour scenes. The shoulder controller, target
  decision, v137 re-arm rules, score, timing, `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched.
- The camera-view option of the same scene (「看到自己」) keeps the previous game. Level 5 gameplay
  is unchanged. Level 6 chopsticks stays `gameType:'dwell'`.
- No win or lose, no penalty, no time limit. Which dish is inside a steamer and which family
  member receives it do not depend on how the patient moves.
- Pace: a normal lift is followed by about 2.7 s of animation; the sixth lift of a table (bill and
  new table) by about 5.1 s. No new lift is counted during the animation, so staff should know
  it acts as a short pause after every lift and a slightly longer one after every sixth.
- Visual load: soft steam, a short confetti burst when a dish is revealed and a stamp when the
  bill is paid. Nothing flashes repeatedly. Canvas filters are not used.
- Images: all 37 files in `img/dimsum/` (30 dishes, steamer, lid, four family members, cover) are
  computer-generated illustrations, not photos of real food or real people; four dishes are
  reduced copies of illustrations already in the project. The in-page 「圖片來源」 section says
  so. The family members are generic cartoon figures and do not depict any patient or staff
  member.
- Food content: the dishes are familiar local dim sum (including pork, beef and offal dishes).
  They are pictures only; no dietary advice is implied. Staff may wish to know this for patients
  with dietary or swallowing restrictions who could find food pictures unhelpful.
- No new data is collected or stored. The list of dishes eaten lives in memory for the session
  only and is cleared when a game starts. No new network destination: images are same-origin files
  and are added to the offline bundle automatically (about 2.1 MB more).
- No new dependency, permission or storage key. Speech uses the existing in-page speech helper
  and settings.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v145-yum-cha.test.mjs` (8): 30 unique dishes with Chinese / English names and a compact
  local file; steamer, family and cover files present and nothing extra in the folder; six lifts
  finish one table, the family take turns, and the next table has different dishes; a second
  trigger during the animation is ignored; all 30 before any repeat over three rounds; nothing
  starts outside the simulated tea house; the module does not write the controller state or
  decide a repetition, does not use canvas filters and sends canvas text through the language
  helper; scene card, result page and English text wired.
- Marker assertions updated in 18 test files.
- Node tests in two groups: 297 + 523 = 820; 817 pass, 3 skipped, 0 failed. `tools/checkjs.sh`,
  `node --check service-worker.js`, `git diff --check` and `./scripts/build-dist.sh` (338 files)
  pass.
- Playwright contact sheet (iPad landscape / portrait, phone, department laptop) and a sheet of
  all 30 dishes in `ych_rehab_qa_artifacts/v145/`. Simulated movement only; not tried on a real
  device or with patients.

## Residual notes
- On a phone held upright the order sheet is small (it sits on the left to leave the camera
  preview window clear).
- Dish names are spoken through the device's speech voice; pronunciation depends on the device.
