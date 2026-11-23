# v138 Security / Safety Review — Level 3/4 mahjong "draw to win" and playing-card "reveal the hand" scenes

Date: 2026-11-23 · Marker `v138-20261123-mahjong-cards-deal`

## Change
Therapist feedback: patients are bored with the Level 3/4 mahjong and playing-card scenes — each lift
only raised one tile / card into a slot, with no consequence, suspense or end point. The therapist
approved redesigning the five flat scenes one at a time (mahjong → cards → laundry → 德華公園 album →
dim sum order sheet). This release covers the first two.

Public patient mode only (`isDealTableTheme()` = `isShoulderFlexionLevel() && !research.active` and
theme `mahjong` / `cards`); other modes keep the generic target panel:
1. Mahjong — each round is generated as a valid winning hand (4 sets + a pair, at most four copies of
   a tile, weighted patterns). Two sets are already on the rack; every lift that reaches the set angle
   draws one tile (flip → name → flies to its place). A finished set gets a small banner, the last
   tile is 自摸食糊 with the simplified training fan names (`mjScoreCombo`, not an official ruling),
   confetti and applause, then a new round starts — a win about every eight lifts.
2. Cards — a five-card hand of a pre-drawn type (pair … straight flush, common hands weighted higher,
   never "nothing") is revealed one card per lift; the fifth card shows the hand name. No win / lose.
3. Progress text on the table (第 N 鋪 · 仲差 X 隻食糊), one extra line on the result screen
   (this session only — no comparison with earlier sessions), level-aware goal text on the two
   activity cards, English strings for every new canvas / speech text.
4. The centre tick overlay is skipped in these two scenes because it covered the revealed tile; the
   confirmation chime is kept.

## Safety / privacy
- Visual / audio reward layer only, attached to the existing reward cycle the same way as the v73
  bowling and v125 supermarket scenes (`startShoulderRewardCycle` → `startDealTableDraw`,
  `shoulderRewardDurationMs` → `dealTableRewardMs`, `finishShoulderRewardCycle` → `finishDealTableDraw`).
  It reads `shoulderFlexionState.progress` and the reward-cycle flag and writes nothing back:
  `shoulder-flexion-controller.js` is untouched, the target decision, scoring (+10 per repetition),
  the v137 rules (held arm keeps scoring, 10° drop-from-peak re-arm) and detection leniency are
  unchanged. Nothing is stricter; there is no penalty, timer pressure or fail state.
- Longest animation hold is the win celebration (≈4.7 s reward window instead of 2.6 s), once per
  round; the patient may rest during it as before.
- No new data, storage, network, permission or image assets (existing `mahjong_atlas.png` /
  `cards_atlas.png`). Sounds are WebAudio-synthesised. No camera-pipeline change: `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Public mode shows no degree figures in the new scene. Clinical wording unchanged:
  網頁不識別實體工具，亦不量度握力或捏力.
- Level 5 / Level 6 mahjong and card modules, chopsticks (`gameType:'dwell'`), and all other
  Level 3/4 scenes are untouched.
- QA hook `__qa.dealTable` lives inside the QA-only block removed from the public build:
  dist/public `__qa` 0 occurrences; banned-wording scan of dist/public 0 files.

## Verification
- `tests/v138-mahjong-cards-deal.test.mjs` (11 tests: 3000 seeded mahjong hands re-checked by the
  independent `mjEvaluate`, 4000 seeded card hands, degenerate random sources, read-only wiring,
  English strings, markers) + full Node suite green (two groups).
- Playwright public flow at laptop 1413×653, iPad 1180×820 and portrait 820×1180, Chinese and
  English: lift → flip → place → set complete → 聽牌 → 食糊 → new round → result line. Contact sheet
  `ych_rehab_qa_artifacts/v138/v138-qa-contact-sheet.png`.
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check`, `./scripts/build-dist.sh` OK.
