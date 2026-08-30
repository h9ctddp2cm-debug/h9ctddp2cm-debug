# v73 Security Review — Bowling Lane Theme (v73-20260830-bowling)

**Date:** 2026-08-30 (HKT)
**Scope:** Working-tree diff since `153ab7b` (`index.html`, `localization.js`, `scripts/build-dist.sh`, `tests/`), new assets (`img/bowling_*.png`, `audio/haobo_cheer.mp3`), and production bundle `dist/public/`.

## Verdict: PASS WITH NOTES

All required security and clinical-safety checks pass. Two minor non-security notes below.

---

## Required checks

### 1. Secrets / tokens / PII — PASS
- Pattern scan of the full diff plus `tests/v73-bowling.test.mjs` for `api_key`, `secret`, `token`, `password`, `bearer`, AWS `AKIA`, private-key headers, `sk-…`, `ghp_…`, `xox[bap]`: **no matches**.
- `audio/haobo_cheer.mp3` (8,492 B, MPEG L3 mono 24 kHz): ID3 contains only encoder tags (`Lavf62.3.100` / `Lavc62.11`, i.e. ffmpeg) — no artist/location/personal metadata.
- All three PNGs (8-bit palette, ffmpeg/pngquant-style output) contain **no** `tEXt`/`zTXt`/`iTXt`/`eXIf` chunks — no embedded metadata or EXIF.

### 2. fetch() calls — PASS
- The only new fetch is `fetch('audio/haobo_cheer.mp3')` in `preloadHaoboCheer()` — a hard-coded, same-origin **relative** path; no external URL, no string concatenation, no user-controlled input.
- The production bundle contains exactly **one** `fetch(` occurrence — this same call (dist line 2736). A second fetch in the source tree (line ~16847, font-to-data-URI helper in the dev capture tool) is pre-existing, inside the `PUBLIC_BUILD_REMOVE` block, and is correctly stripped from dist.

### 3. eval / new Function — PASS
- `grep -cE 'eval\(|new Function' dist/public/index.html` → **0**.
- `new Function` appears only in `tests/v73-bowling.test.mjs` (lines 50, 91) for sandboxed source evaluation — allowed per policy.

### 4. QA hook stripping — PASS
- `grep -cE 'window\.__qa\b|advanceTime|render_game_to_text|setLevel6ToolFrame|level67Layout|dimsumOrder:|laundryOrder:|fridgeGame:' dist/public/index.html` → **0**.

### 5. Clinical safety invariant (Level 3/4 pure-reward layer) — PASS
- The new scene block (168 lines between the `==================== v73 保齡球場景` marker and `function drawShoulderFlexionGuide`) contains **zero** references to `heldItem`, `gripActive`, `landmarks`, `pinch`, `grip`, `release`, `handContact`, `fingers`, or `thumb`.
- It reads only `shoulderFlexionState.progress` and `shoulderFlexionState.selectedTargetDeg`; the strike is triggered exclusively from the existing `targetReady` award path in `updateShoulderFlexionGame()` (`if(state.theme==='bowlinglane')startBowlingStrike();`). No hand-contact/grip/release signal is introduced into the Level 3/4 branch, and the target-reached judgment itself is unchanged.
- `themeAvailableForLevel` correctly restricts `bowlinglane` to levels 3 and 4 only.

### 6. Service worker / manifest version alignment — PASS
- `v73-20260830-bowling` present in `dist/public/index.html` (`LEVEL_APP_BUILD`), `dist/public/manifest.webmanifest` (`start_url=./index.html?build=v73-20260830-bowling`), and `dist/public/service-worker.js` (`fthue-rehab-v73-20260830-bowling`). No stale `v72-20260830` markers remain in any of the three dist files.
- `dist/public/offline-assets.js` includes `./audio/haobo_cheer.mp3`, so the cheer plays offline via the SW cache.

### 7. Audio decode fail-safe — PASS
- `preloadHaoboCheer()`: promise chain ends in `.catch(()=>{haoboCheerLoading=false;})` and the synchronous body is wrapped in `try/catch` — no unhandled rejection possible; a failed fetch/decode simply allows a later retry.
- `playHaoboCheer()` and `playPinCrashSound()` are fully wrapped in `try/catch` and are called from the animation/update path, so audio failure cannot break the game loop. Missing image assets also degrade to painted fallbacks (`complete && naturalWidth>0` guards).

### 8. localization.js injection vectors — PASS
- Six new entries, all plain English literal strings (theme title, goal, item/target labels, difficulty, thumbnail alt). No HTML tags, no `<script>`, no template/interpolation syntax, no URLs.

### 9. Build script — PASS
- `build-dist.sh` adds only `cp -R "$ROOT/audio" "$DIST/audio"`; no new network calls or shell-injection surface. Source and dist copies of all four new assets are byte-identical (md5 verified).

### 10. Tests — PASS
- `node --test tests/v73-bowling.test.mjs`: **8/8 pass**. Version pins and the THEME_ORDER assertion across the four updated test files match the shipped v73 values.

---

## Notes (non-blocking, not security issues)

1. **Duplicate localization key `'保齡球'`** — `localization.js` now defines `'保齡球':'Bowling ball'` (line 291, new in v73) and the pre-existing `'保齡球':'Bowling'` (line 296). In a JS object literal the later entry wins, so the English UI will show "Bowling" (the old theme title) rather than "Bowling ball" for the item label. Cosmetic i18n bug only; consider disambiguating the key (e.g. `'保齡球（物件）'`).
2. **`preloadHaoboCheer()` is called every frame from `drawBowlingAlleyScene()`** — this is safe (guarded by `haoboCheerBuffer||haoboCheerLoading`), but on a persistent fetch failure it retries once per frame after each `.catch` resets the flag. Same-origin asset only, so worst case is local SW-cache churn; harmless, flagged for awareness.

---

*Reviewed against: repo `/home/user/workspace/ych_rehab_games_advanced` working tree, diff base `153ab7b` (v72), bundle `dist/public`.*
