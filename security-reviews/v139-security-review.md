# v139 Security / Safety Review — Level 3/4 laundry story (wash → hang → sun-dry → collect → fold → wardrobe)

Date: 2026-11-24 · Marker `v139-20261124-laundry-story`

## Change
Therapist feedback (third of the five flat Level 3/4 scenes): the laundry scene should be a whole
household story, not one garment rising to a pole — put the clothes into the washer one by one, press
the button (one lift), take them out one by one, hang them one by one, watch the sun rise and dry them
(a rest animation: dripping → dry and shining), take them down one by one, fold them one by one and put
them into the wardrobe one by one. Standing instruction: every Level 3/4 scene keeps the same game
setting as the supermarket scene, whose detection works well.

Public patient mode only (`isLaundryStoryTheme()` = `isShoulderFlexionLevel() && !research.active`
and theme `laundry`); other modes keep the generic target panel:
1. Story script (`buildLaundrySteps`) in the v125 supermarket pattern: `scene` steps play by
   themselves (rest), `rep` steps need one lift to the set angle. Intro → load ×N → press ×1 →
   washing 3.8 s → unload ×N → balcony → hang ×N → sun 6.2 s → collect ×N → bedroom → fold ×N →
   store ×N → closing scene, then the session ends by itself as the supermarket story does.
2. Lifts = 6N + 1: 3 garments = 19, 4 garments = 25 (default), 6 garments = 37. A "衫量" bar on the
   laundry activity card lets the therapist choose.
3. Three illustrated scenes, a seven-step progress strip, one extra line on the result screen (this
   session only — no comparison with earlier sessions), Level 3/4 card title 洗衫晾衫 and goal text,
   English strings for every new canvas / speech text.
4. The centre tick overlay is skipped in this scene because it covered the garment; the confirmation
   chime is kept.

## Safety / privacy
- Visual / audio reward layer only, attached where the supermarket action is attached
  (`startLaundryStoryAction()` just before `startShoulderRewardCycle()`,
  `shoulderRewardDurationMs` → `laundryStory.rewardMs`). It reads `shoulderFlexionState.progress`
  and writes nothing back: `shoulder-flexion-controller.js` is untouched; the target decision,
  scoring (+10 per repetition), the v137 rules (held arm keeps scoring, 10° drop-from-peak re-arm)
  and detection leniency are unchanged. Nothing is stricter; there is no penalty, timer pressure or
  fail state. Stopping early is allowed at any time and the result line simply names the step reached.
- Rest scenes: washing 3.8 s and sun-drying 6.2 s need no movement and are announced as rest
  (「休息一陣」). The longest reward window is therefore about 7.5 s (last garment hung → sun scene);
  lifts made during it are not required and not penalised.
- Workload is visible to the therapist before starting (「約 19 / 25 / 37 次抬手」) and is lower by
  default (25) than an open-ended timed session; the therapist can still stop or rest with the
  existing buttons.
- No new data, storage, network or permission. Six new static images (three backgrounds, washer,
  wardrobe, basket) are generated illustrations with no people, faces, brands or patient data.
  Sounds are the existing WebAudio-synthesised ones. No camera-pipeline change: `numHands:2`,
  confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged.
- Degree readout: at the therapist's request (「顯示，不過字體細個啲」) public Level 3/4 shows the
  live 現在 / 目標 angles again, in a compact small-type panel with the caption 相機估算，只供參考
  (camera estimate, for reference only). This supersedes the v137 decision to hide them. It is a
  display-only change (`readouts.hidden=false` + a CSS class); the numbers are the same values the
  result screen already reports. Spoken / on-screen prompts and the canvas target label still carry
  no degree figures. Clinical wording unchanged: 網頁不識別實體工具，亦不量度握力或捏力.
- Therapist follow-up on size: garments, washer, wardrobe and basket are drawn larger and the
  instruction banner moved beside the appliance in landscape (drawing geometry only). Three missing
  English labels (完成次數, 自拍, 白色背景) now have translations instead of the generic fallback.
- Level 5 / Level 6 laundry modules (cloth-peg laundry, laundry sorting), chopsticks
  (`gameType:'dwell'`) and all other Level 3/4 scenes are untouched; the v138 block and its hooks are
  byte-identical apart from the release marker.
- QA hook `__qa.laundryStory` lives inside the QA-only block removed from the public build:
  dist/public `__qa` 0 occurrences; banned-wording scan of dist/public 0 files.

## Verification
- `tests/v139-laundry-story.test.mjs` (14 tests: script order, each garment once per stage, 19/25/37
  lifts, rest scenes, stage strip, hook placement, read-only wiring, English strings, assets, markers)
  + full Node suite green (two groups).
- Playwright public flow from intro to the result screen at laptop 1413×653 (4 garments), iPad
  1180×820 (English, 3 garments) and portrait 820×1180 (6 garments); assisted-stick hint checked.
  Contact sheet `ych_rehab_qa_artifacts/v139/v139-qa-contact-sheet.png`.
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check`, `./scripts/build-dist.sh` OK.
