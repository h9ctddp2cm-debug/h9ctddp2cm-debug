# Security Review — v71 (laundry order revamp) + v72 (fridge game)

Date: 2026-08-30 (HKT) · Reviewer: automated security review subagent
Scope: uncommitted working-tree changes in `/home/user/workspace/ych_rehab_games_advanced` (index.html +693/-~60 lines, localization.js +3, manifest.webmanifest, service-worker.js version bumps, 21 new img/*.png, 2 new test files) and production bundle `dist/public`.

## Verdict: **PASS**

## Checklist results

### 1. Secrets / credentials / personal data — PASS
- Keyword scan of all added lines in the index.html diff (`token|secret|password|api[_-]?key|crypto|localStorage|sessionStorage|indexedDB`) → zero matches.
- localization.js adds only three zh→en UI strings for the fridge theme; manifest/service-worker changes are version-string bumps only (`v70-…-tool-pinch` → `v72-20260830-laundry-fridge`).
- No personal or patient data in source, assets, or dist.

### 2. No new network calls / third-party code — PASS
- No `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, dynamic `import(`, or `<script` in any added line.
- `dist/public/index.html`, `dist/public/service-worker.js`, and `dist/public/offline-assets.js` contain **zero** `http(s)://` URLs — the app is fully same-origin/offline.
- New assets are pre-cached via same-origin relative paths in `offline-assets.js` (all 21 `./img/fridge_*.png` / `./img/laundry_*.png` entries present).

### 3. No QA hooks in dist — PASS
- `grep -cE 'window\.__qa\b|advanceTime|render_game_to_text|setLevel6ToolFrame|level67Layout|dimsumOrder:|laundryOrder:|fridgeGame:' dist/public/index.html` → **0**.
- The new `laundryOrder:`/`fridgeGame:` QA-state additions live inside the `window.__qa` block in source (between PUBLIC_BUILD_REMOVE markers) and are confirmed stripped from the public bundle. Feature code itself is present in dist (FRIDGE_ORDER_DEFS, fridgeTryPlace, laundryOrder logic counts match source minus the stripped QA block).

### 4. Hand-safety invariants — PASS
- The diff adds **no** new input paths: zero added lines touching `addEventListener`, pointer/touch/mouse/key handlers, landmarks, handedness, `cursorX/Y =`, `gripActive =`, `isGrasping =`, or `heldItem =` assignments.
- Both `fridgeTryPlace` call sites (dwell-drop path in `updateGameLogic`, release path in `updateGraspLogic`) and the laundry `laundryOrderAccepts`/`laundryOrderPlace` calls are new branches inside the **existing** drop logic, consuming existing state only (`heldItem`, `heldPoint`/`cursorX,cursorY`, `gripActive`, release-dwell/`handOpenPrep` gating). Pickup is unchanged; laundry/fridge items are ordinary entries in the existing `foods` array spawned via `ensureFoodCount()`.
- Therefore only the already-validated affected-hand pipeline (with its jitter/dwell protections) can pick up, move, or place items — no path for the opposite hand or a stray landmark to drive interaction.

### 5. Fridge auto-restart timer — PASS
- `fridgeRoundTimerId` is cleared and nulled in `resetFridgeGame()`, which is called from `initGame()` alongside the dimsum/laundry resets.
- The `setTimeout(…, 2600)` callback is double-guarded: `if(isFridgeGame() && state.running) newFridgeRound();` — after `endGame()` sets `state.running = false`, a pending timer fires as a no-op. No zombie rounds possible. (Minor note: `endGame()` does not itself clear the timer, but the guard plus reset-on-next-start makes this harmless.)
- Same pattern applies to the parallel `laundryOrderTimerId` (cleared in `resetLaundryOrderGame()`, guarded callback).

### 6. No eval / new Function / innerHTML — PASS
- Zero occurrences in the added index.html lines. All new UI (banners, crash hints, celebration text) is drawn on canvas via `ctx` text/graphics; Cantonese speech goes through the existing `speakCantonese()` helper. `new Function` appears only in tests/ (not shipped).

### 7. Image assets — PASS
- All 21 new PNGs verified as plain raster PNGs (mostly 8-bit palette, ≤116 KB, ≤779 px). PNG chunk inspection: only standard chunks (IHDR/PLTE/tRNS/IDAT/IEND) — **no** EXIF/tEXt/iTXt/zTXt metadata, no location or device info.
- Visual inspection (contact sheet at `/home/user/workspace/v72_asset_contact_sheet.png`): stock-style cut-out photos of groceries (veg, meat, milk carton, shrimp…), clothing items, an empty open fridge, and a drying rack. **No faces, no people, no identifying information.** The milk carton shows generic product artwork only.

### 8. Diff scope — PASS
- `git diff --stat`: 14 modified files (index.html, localization.js, manifest, service-worker, progress.md, sandbox validation artifacts, 6 test files) + untracked: 21 img/*.png and 2 new test files. All consistent with the declared v71/v72 feature work.
- index.html hunks reviewed: new image loaders, laundry-order module (~line 7857+), fridge module (~7940–8090), theme availability, initGame resets, setupTargets/food-spawn integration, drop-branch additions in the two placement paths, banner drawing incl. the landscape y-floor `isPortrait() ? 10 : 76` (present in exactly 3 banner functions — pure layout, keeps banners below the top HUD in landscape), QA-state block (stripped from dist), and version-string bump. Nothing outside the declared scope.

## Notes (non-blocking)
- `endGame()` could also call `resetFridgeGame()`/`resetLaundryOrderGame()` for belt-and-braces timer cleanup; current guards already prevent any behavioral issue.
- `fridgeBannerRect` rejection zone correctly prevents food from being hidden behind the instruction banner in landscape — a usability/safety positive for patients.
