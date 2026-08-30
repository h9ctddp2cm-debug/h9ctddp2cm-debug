# v75 Security Review — `feature/level3-bilateral-sandbox` (build `v75-20260831-design`)

**Date:** 2026-08-31 (HKT) · **Reviewer:** pre-release security review (delegated)
**Scope basis:** `git diff` vs HEAD (all v75 changes uncommitted) + 22 untracked assets + `dist/public/` production bundle.

---

## Scope

Release delta reviewed:

| Area | Files |
|---|---|
| App | `index.html` (+524/−~130 lines: bowling enlargement, new basketball theme, teahouse redesign, flowers redesign, wide fridge, L6 adaptive tool-pinch `TOOL_ADAPT_*` / `updateToolPinchAdapt` / `resetToolPinchAdapt`, adv-panel CSS top 72→152px) |
| Versioning | `manifest.webmanifest`, `service-worker.js` (cache/build string v74→v75 only) |
| Validator | `sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs` (fridge-scoped `itemsDoNotCoverTargets` relaxation) |
| Tests | 9 modified test files + new `tests/v75-adaptive-tool.test.mjs` |
| Assets | 22 new PNGs: `flower_01–08`, `leaf_01–08`, `flower_vase`, `th_plate`, `th_tray`, `bball_court`, `bball_ball`, `fridge_wide` |
| Bundle | `dist/public/` rebuilt at `v75-20260831-design` (index.html, service-worker.js, offline-assets.js all consistent) |

Test suite: **386 tests, 383 pass, 0 fail, 3 skipped** (`node --test tests/`).

---

## Findings (severity-rated)

### HIGH / CRITICAL
None.

### MEDIUM
None.

### LOW

**L1 — Validator fridge relaxation is weaker than its own comment claims.**
`run-level4-6-technical-validation.mjs:44–51`: the new fridge branch returns `item.y > bottom`, i.e. the food circle's **centre** must be below the fridge rectangle. The comment says the food "SPAWNS fully below the fridge rectangle", which would be `item.y - item.r > bottom`. A spawn whose circle partially overlaps the fridge's bottom edge would still pass. Impact is cosmetic-QA only (spawn layout, not a clinical gate), and the branch is strictly scoped to `target.type === "fridge"` — the exact circle-vs-rect distance check is unchanged for every other target type (verified: the strict `Math.hypot(...) >= item.r` path at lines 52–54 still applies to all non-fridge targets, and `itemsDoNotCoverTargets` has only its two original call sites, lines 246/251). *Recommendation:* tighten to `item.y - item.r > bottom` or correct the comment.

**L2 — Adaptive thresholds take priority over therapist calibration.**
`index.html:7101–7103`: threshold priority in play mode is `toolPinchAdapt.thresholds → state.personalToolPinch → TOOL_PINCH_DEFAULTS`. Once the movement gate passes, the live-learned range silently supersedes the therapist's tool-in-hand calibration. This is the documented design intent (bedside 30 Aug reports: unreachable reopen threshold ⇒ item never releases) and it *loosens release toward the patient's own achievable range* rather than any force/contact judgement; research mode bypasses the adaptive path entirely (`!research.active` on both adaptive terms, and `updateToolPinchAdapt` is only fed when `!research.active`, line 7095). Fail-closed behaviour verified (see below). Flagged LOW so the clinical owner explicitly signs off on "adaptive overrides calibration" semantics.

### INFORMATIONAL

**I1 — Pre-existing `innerHTML` sink in `setActionPrompt`; v75 additions are safe.**
`setActionPrompt` writes `statusBar.innerHTML` (pre-existing, not introduced by v75). The v75 delta injects only: a hard-coded Cantonese warning string, and `'開合 ' + pct + '%'` where `pct = Math.round(100 * clamp01(...))` — a bounded integer. No user-controlled string reaches this sink via v75. The calibration too-close hint uses `hint.textContent` (safe sink).

**I2 — Flowers keepsake name/signature: no XSS, no persistence.**
`flowers.name` is set only from `nameEl.value.slice(0,12)` (line 15459) and QA `setName` (dev builds only). It flows exclusively into canvas `ctx.fillText` (lines 15421/15529), a client-side `a.download` filename (line 15594), and a boolean `'set'/'empty'` research-log flag (line 15789) — never into `innerHTML`/DOM markup. Signature is stored as in-memory stroke arrays. Nothing is written to storage or network.

**I3 — Flowers vase no longer positioned by affected side.**
`flowersSetup` removed the `affectedSideSign()` layout dependency (vase now always centred, palette in a bottom row). This is layout only — interaction gating never lived here — but it changes reach geometry (midline instead of affected-side placement). Clinical/UX sign-off item, not a security issue. Also note `flowers` was dropped from the L3/L4 `availableThemeOrder` list (replaced by `basketball`); it remains reachable via `THEME_ORDER` for its own levels.

**I4 — New assets are clean.**
All 22 new PNGs are plain 8-bit colormap PNGs containing only `IHDR/PLTE/tRNS/IDAT/IEND` chunks — no `tEXt/iTXt/eXIf` metadata, **0 trailing bytes after IEND** (checked byte-level on representative files incl. the two photos). Visual inspection of `bball_court.png`: empty housing-estate court, no people, faces, plates, or identifying text. No patient or personal data.

**I5 — No secrets / personal data in the delta.**
`git diff` grep for key/token/secret/password/bearer/private-key/AWS/`sk-` patterns: no hits. HKID/patient-name/DOB patterns: no hits (only the v75 date string in `progress.md`).

**I6 — Offline capability preserved.**
No `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, dynamic `import(`, `<script src>`, or `http(s)://` URL appears anywhere in the v75 diff; `dist/public/index.html` contains **zero** external URLs. The swish sound is WebAudio-synthesised (no audio file, no URL). All new images load from relative `img/` paths and are registered in the generated `dist/public/offline-assets.js` (`bball_court`, `bball_ball`, `fridge_wide`, `th_plate`, `th_tray`, all 17 flower/leaf/vase crops present). Cache version bumped (`fthue-rehab-v75-20260831-design`), manifest `start_url`, `LEVEL_APP_BUILD` and service worker all consistent.

---

## Safety invariant verification

**1. Only the selected affected hand can drive interaction — unchanged.**
The hand-selection gate in `interpretHandResults` is untouched by v75 (diff touches only one line in that function, adding the display-only `pinchScale` field). Fail-closed behaviour intact: anatomical-hand mismatch → `continue`; missing/low-confidence handedness (<0.55) → `continue`; no acceptable hand → `{detected:false, reason:'affected-hand-not-detected'}` (line 6746). No opposite-arm fallback exists; generation guard (`lastAcceptedToolHandGeneration`) untouched and still re-armed to −1 in `initGame`.

**2. Adaptive tracker only ever sees the affected hand.**
`computeToolPinchState` (the only caller of `updateToolPinchAdapt`) is invoked at line 6780 *after* the affected-hand/handedness/finite-landmark gates, so an assisting or therapist hand can never contribute samples to the learned range. `hasFiniteHandLandmarks(lm,[0,4,5,8,9,12,17])` still fails closed (`valid:false`, `isPinching:false`) on missing landmarks (line 7077).

**3. Adaptive tool-pinch fail-closed behaviour — verified in code and by behavioural tests.**
- Movement gate: thresholds are computed only when near, far AND combo histories each have ≥90 samples (`TOOL_ADAPT_MIN_SAMPLES`) and spans ≥0.030 / 0.024; otherwise `toolPinchAdapt.thresholds = null; return;` → calibrated/default thresholds stay in force (index.html ~7060–7066).
- Single drifting landmark cannot learn a range: `near = min(index,middle)` stays static if only one digit drifts → near-span gate fails → thresholds stay null.
- Single drifting landmark cannot release: release still requires `nearRatio >= t.nearExit && farRatio >= t.farExit` — **both** digits (line 7106) — under defaults, calibration, and adaptive thresholds alike.
- Behavioural tests in `tests/v75-adaptive-tool.test.mjs` execute the real extracted source: static posture ⇒ `thresholds === null` and small excursion stays held; genuine open/close ⇒ ordered in-range thresholds with `enter ≤ nearExit`; single-digit reopen under adaptive thresholds ⇒ stays held; `resetToolPinchAdapt` clears all three histories + thresholds. All pass.
- Reset call sites: `exitToLevelSelection` (line 6185) and `initGame` (line 9218) — every game start and every exit to level selection wipes the learned range, so a range learned on one patient/hand/tool cannot leak into the next session. Research mode never reads or writes the tracker.
- `toolPinchLiveHint` / 開合% overlay is display-only (feeds `setActionPrompt` text; never read by pickup/release logic).

**4. L3/L4 shoulder-flexion reward scenes contain no hand-contact/grip/release signals.**
The new basketball block (index.html 3052–3174) reads only `shoulderFlexionState` (`progress`, `selectedTargetDeg`) and its own animation state; `startBasketballShot()` is called from exactly one place — the existing target-reached award point in `updateShoulderFlexionGame` (guarded by the unchanged `shoulderFlexionCycleAwarded` logic), alongside `startBowlingStrike()`/`startTeahouseServe()`. `setupTargets` returns `targets=[]` for bowlinglane/basketball/teahouse, so no generic dwell target exists in these modes.
**Contract-test coverage includes basketball:** the banned-token test in `tests/v73-bowling.test.mjs:70` slices from the v73 scene header (line 2882) to `function drawShoulderFlexionGuide` (line 3175) — a region that fully contains the v75 basketball block — and asserts none of `heldItem, gripActive, dwellTarget, releaseItem, handContact, pinch, grabDistance, landmarks` appear. `tests/v74-teahouse.test.mjs:91–94` additionally pins `startBasketballShot` to the award point and `resetBasketballShot` to both reset sites (`initGame`, `setupTargets`-adjacent, per-rep advance). All pass.

**5. Bowling enlargement / teahouse / fridge / flowers changes are geometry+rendering only.** No changes to dwell, grip scoring, release logic, or hand gating in any of these hunks. Fridge enlargement (`fridgePlacedRadius`, `fridgeBoost`) *increases* item sizes — consistent with the existing "larger = easier, lighter grasp" Level-5 safety default.

---

## QA-hook verification

```
$ grep -cE 'window\.__qa\b|advanceTime|render_game_to_text|setLevel6ToolFrame|level67Layout|dimsumOrder:|laundryOrder:|fridgeGame:' dist/public/index.html
0
```

Production bundle contains **0** QA hooks. QA hooks in the source `index.html` remain inside `PUBLIC_BUILD_REMOVE` blocks (stripped by the build, as the grep proves); `window.__qa` usage in the sandbox validator targets dev builds only. `dist/public` is fully rebuilt at `v75-20260831-design` (index.html, service-worker.js, offline-assets.js, all 22 new images present) — no stale-bundle mismatch.

---

## Conclusion: **SHIP**

The v75 delta introduces no network calls, no third-party code, no analytics, no secrets, no personal/patient data, no XSS vectors, and no QA hooks in the production bundle. All clinical safety invariants (affected-hand-only gating, fail-closed on missing/low-confidence handedness and missing landmarks, no opposite-arm fallback, dual-digit release, reward scenes free of contact/grip/release signals) are preserved and remain enforced by passing contract + behavioural tests (383/383 executable tests pass). The two LOW findings are non-blocking: L1 is a comment/strictness nit in a dev-only layout validator; L2 is the documented design intent and should simply receive explicit clinical-owner sign-off on "adaptive range overrides therapist calibration" semantics.
