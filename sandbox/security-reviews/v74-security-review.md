# Security Review — v74-20260831-teahouse

**Repo:** ych_rehab_games_advanced · branch `feature/level3-bilateral-sandbox` (uncommitted change)
**Scope:** Dim sum「模擬茶樓」display mode for Levels 3/4 (shoulder flexion), reviewed 2026-08-30.
**Reviewed:** full `git diff` (12 modified files) + untracked `tests/v74-teahouse.test.mjs`, `img/teahouse_bg.png`, `img/steamer_empty.png`.

## 1. Safety invariants — PASS
- Extracted the v74 scene block (markers `v74 模擬茶樓場景` → `v73 保齡球場景`, 120 lines). Banned-identifier scan (`heldItem|gripActive|dwellTarget|releaseItem|handContact|pinch|grabDistance|landmarks`) returned **0 hits** inside the block.
- The only `shoulderFlexionState` access is a read of `selectedTargetDeg` for the target-angle label. The block also reads `foods` (item position/sprite for the fly animation) — read-only, visual.
- `startTeahouseServe()` is invoked only from the existing target-reached branch in `updateShoulderFlexionGame()` (immediately after `triggerFeedback(true)`, mirroring the v73 `startBowlingStrike()` pattern) and never feeds anything back into judgement. `resetTeahouseServe()` is called from `initGame()` and the existing arm-lowered rep-reset branch only.
- Target-reached judgement, pose validation, calibration, affected-side/hand-selection logic: **no hunks in the diff touch any of these**. The one `heldItem` line in the diff is the pre-existing `initGame()` reset line with `resetTeahouseServe()` appended.
- Audio uses the existing `speakCantonese` helper with a static string, wrapped in try/catch.

## 2. Gating correctness — PASS
- `isTeahouseDimsumMode()` = `isShoulderFlexionLevel() && state.theme==='dimsum' && state.dimsumSceneMode==='teahouse' && !research.active` — exactly as specified; research/pilot track keeps the original camera view.
- `drawShoulderFlexionGuide` dispatches bowling first, then teahouse, else the unchanged camera-view guide; `setupTargets()` widening (`bowlinglane || isTeahouseDimsumMode()`) sits inside the `isShoulderFlexionLevel()` branch only.
- Level 5 fridge, Level 67 dim sum order, laundry, and research code paths: untouched in the diff; `tests/v74-teahouse.test.mjs` test 12 ("L5 fridge and L67 dim sum order games untouched by v74 gating") passes.

## 3. XSS / injection — PASS
- `.dimsum-mode-bar` `innerHTML` is a single static string literal (label + two static buttons); no interpolation, no user data.
- Mode selection reads `b.dataset.dimsumMode` from those two static buttons only; the QA setter additionally whitelists `'teahouse'|'camera'`. `settingsTitle` suffix uses `textContent` with static ternary strings.
- Canvas code uses `fillText`/`drawImage` with static strings and preloaded static-path images; the only dynamic string is `a.toFixed(3)` inside an rgba color — safe.

## 4. QA hooks / debug code / version markers — PASS
- The new `__qa` option (`opts.dimsumSceneMode`) sits inside the QA block at lines 15495–16791, within `PUBLIC_BUILD_REMOVE_START/END`.
- `grep -cE 'window\.__qa\b|advanceTime|render_game_to_text|setLevel6ToolFrame|level67Layout|dimsumOrder:|laundryOrder:|fridgeGame:' dist/public/index.html` → **0**.
- Version markers consistent: `index.html` `LEVEL_APP_BUILD = "v74-20260831-teahouse"`, `manifest.webmanifest` `start_url=…?build=v74-20260831-teahouse`, `service-worker.js` `CACHE_VERSION = "fthue-rehab-v74-20260831-teahouse"`; dist/public rebuilt with all three aligned and new images copied + listed in generated `dist/public/offline-assets.js`.

## 5. New assets — PASS
- `file` reports both as plain 8-bit colormap PNGs (768×1625, 480×480), identical in src and dist; `strings` scan found no `<script`, `javascript:`, `onerror`, `eval(`, or iframe content.
- Referenced only via static `Image().src = 'img/…png'` assignments (index.html:7361–7362; same in dist).

## 6. Localization — PASS
- Three new entries in `localization.js` are static zh→en string pairs: 點心遊戲顯示模式 / 模擬茶樓 / 看到自己.

## 7. Duplicate keys — PASS
- Each new localization key appears exactly **once** in localization.js (programmatic count).
- `state` object: 29 keys, **0 duplicates**; new `dimsumSceneMode` key added once.

## 8. Tests — PASS
- `tests/v74-teahouse.test.mjs`: **12/12 pass**.
- Full suite (`node --test tests/`): **377 tests — 374 pass, 0 fail, 3 intentional skips**, matching progress.md claims. v73 bowling test regex correctly updated for the widened `setupTargets` branch.

## Notes (non-blocking)
- `sandbox/level4-6-technical-validation/level4-6-validation-results.json` diff is a regenerated validator run (168/168 PASS); label churn (青菜↔麵) is random spawn ordering, benign.
- In teahouse mode the patient no longer sees their camera image while pose tracking continues in the background; this is the intended design and is documented in progress.md, and use remains therapist-supervised. Worth keeping in the therapist-facing notes so supervising OTs know positioning feedback isn't visible to the patient in this mode.
- The Cantonese praise line and banner text are hard-coded zh strings drawn on canvas (not routed through localization.js); consistent with the v73 bowling scene, so no regression — flagged only for future localization completeness.

## Verdict: PASS
