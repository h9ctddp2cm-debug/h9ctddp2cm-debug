# Pre-Publish Security Review — v69 (FTHUE Rehab Games)

**Project path:** `/home/user/workspace/ych_rehab_games_advanced/dist/public`
**Context:** Static, offline-capable browser rehabilitation game for hospital iPad use. No backend, no accounts, no PII storage. Delta review focused on v68/v69 changes: Level 5 open-baseline calibration logic, new dim sum ordering game mode (state machine, canvas banner, WebAudio applause, Cantonese `speechSynthesis`), two new static PNGs (`img/beefball_real.png`, `img/rooster_plate.png`), and regenerated `offline-assets.js`.

**Verdict: PASS** — No BLOCK findings. No new WARN findings introduced in v68/v69. One informational note only.

---

## Check 1: Dependency Audit
N/A — this is a pre-built static bundle (`dist/public`) with no `package.json`/`node_modules` or `requirements.txt` present. No dependency-audit surface exists in this artifact.

## Check 2: Hardcoded Secrets
Grepped all JS/HTML/JSON/webmanifest files for API keys, AWS keys, GitHub/GitLab tokens, Slack tokens, PEM private keys, and hardcoded passwords. **No matches.** `image-sources.json` contains only public Wikimedia Commons attribution URLs (pre-existing, not a secret).

### PASS
- No hardcoded secrets, API keys, or credentials found anywhere in the bundle.

## Check 3: QA/Test Hooks Reachable in Production
Searched for `window.__qa`, `advanceTime`, `render_game_to_text`, `setLevel6ToolFrame`, and any `window.__*` hook across all JS/HTML files.

- Only pre-existing hook found: `window.__level4MiniGamesQA` in `level4-three-games-module.js:822` — this is the **known accepted WARN carried over from v67**, unchanged in v68/v69. It is a deterministic, camera-free QA harness hook that does not read/write any sensitive data and has no network or filesystem access.
- `state.qaMode` (index.html) defaults to `false`, is only ever explicitly set to `false` in code, and has no URL-parameter or UI toggle that could enable it in production. Not newly introduced; behaves identically to v67.
- No `window.__qa`, `advanceTime`, `render_game_to_text`, or `setLevel6ToolFrame` hooks found anywhere in the bundle.
- `window.__level4GameRuntime` is a pre-existing `Object.freeze()`-protected internal game-engine bridge (score/theme/reach helpers only) — not a QA hook, exposes no PII or secrets.

### PASS
- No new QA/test hooks introduced in v68/v69. Existing v67 QA hook remains isolated and inert in production use.

## Check 4: Dangerous Code Patterns (eval / new Function / XSS sinks)
- `eval(` / `new Function(` — **zero matches** anywhere in the bundle.
- `document.write(` — **zero matches**.
- `innerHTML =` — ~25 matches, all in `index.html`, all pre-existing UI-rendering patterns (banners, feedback overlays, rules text). Every one of them assigns strings built from **hardcoded template literals and internal state** (level number, tier count, fixed Cantonese/English label dictionaries, calculated numbers) — never from user-typed free text, URL parameters, or any externally fetched content. This includes the new dim sum ordering banner path (`banner.innerHTML = msg` at line 5436), which is populated only from static rule text and dynamic-but-internal `itemWord0`/`tier` values.
- Specifically verified the new dim sum order state machine (`dimsumOrder`, `dimsumOrderText()`, `newDimsumOrder()`): order lines are generated exclusively from a fixed local `DIMSUM_ORDER_MENU` array via `Math.random()` shuffling — no external or user-supplied strings enter the order text or the Cantonese TTS utterance.

### PASS
- No `eval`/`new Function` usage anywhere in `dist`.
- No exploitable XSS sinks — all `innerHTML` assignments use internally-generated, non-user-controlled content.

## Check 5: New Speech Synthesis / WebAudio Code (v68/v69 additions)
- `speakCantonese()` (index.html ~5283) builds `SpeechSynthesisUtterance` text from `dimsumOrderText()`/fixed Cantonese strings and an internal translation lookup (`window.YCHLanguage`) — no arbitrary text injection point; text originates from hardcoded menu labels and template strings only.
- `playApplauseSound()` (index.html ~7976) is a fully synthesized WebAudio noise-burst/bandpass-filter effect — no external audio file fetch, no network dependency.

### PASS
- Speech synthesis and applause audio are both self-contained, hardcoded/internal-state driven, with no injection surface.

## Check 6: Level 5 Open-Baseline Calibration Logic
Reviewed `calibLooksOpen()` and surrounding v68 calibration logic (index.html ~6548–6560). This change fixes a clinical/UX bug: the old blind 750ms timer could sample a closed-hand posture as the "open" baseline; the new logic validates `graspOpenCount`/`graspCurledCount`/`isOpenPrep` from live MediaPipe hand-tracking results before accepting the baseline. Purely local computer-vision gesture logic — no security implications, no new data persistence, no network calls.

### PASS
- Level 5 calibration change is a self-contained gesture-detection fix with no security surface.

## Check 7: External Network Calls
Searched all JS/HTML for `fetch(`, `XMLHttpRequest`, `WebSocket`, `importScripts`, remote `<script src>`/`<img src>`/ES module imports, and any `http(s)://` literal outside the MediaPipe vendor bundle.

- The only `fetch()` calls in the entire bundle are inside `service-worker.js`, used exclusively for same-origin asset caching (install/fetch handlers).
- No `http://`/`https://` literals exist in any application JS or `index.html`. The sole external URLs in the project are static attribution links in `image-sources.json` (Wikimedia Commons credits for pre-existing background photos) — these are never fetched at runtime, just metadata.
- `manifest.webmanifest` references only local, relative icon paths.

### PASS
- No external network calls are made or newly introduced by the app. The game is fully offline-capable as intended.

## Check 8: Service Worker Cache Poisoning Risk
Reviewed `service-worker.js` and the regenerated `offline-assets.js`:

- `offline-assets.js` lists 127 asset paths, all relative (`./...`), all resolving to same-origin files that exist in the bundle. The two new v68/v69 images (`./img/beefball_real.png`, `./img/rooster_plate.png`) are correctly included and match real files on disk.
- Cache versioning (`CACHE_VERSION = "fthue-rehab-v69-20260830-dimsum-order"`) correctly triggers `activate` cleanup of old cache keys — no stale-cache poisoning between releases.
- The service worker's `fetch` handler contains a generic cross-origin branch (lines 30–43) that will cache any cross-origin response, including opaque ones, keyed by the original request. This is **pre-existing boilerplate, unchanged since v67**, and is unreachable in practice because the application itself never issues a cross-origin request (confirmed in Check 7) — so this branch never executes during normal use. Noted for completeness but does not represent a new or exploitable risk in this offline, no-backend context.

### PASS (with informational note)
- No cache-poisoning risk from the v68/v69 asset-manifest regeneration. Generic cross-origin caching code path exists but is dead code given the app makes zero cross-origin requests.

## Check 9: New Image Assets — File-Type Verification
Verified both new PNGs with `file`, magic-byte inspection (`xxd`), and a `strings` scan for embedded script/polyglot content:

- `img/beefball_real.png` — genuine PNG, 464×464, 8-bit RGBA, valid `IHDR`, magic bytes `89 50 4E 47 0D 0A 1A 0A`. No embedded `<script>`, `javascript:`, `eval(`, or event-handler strings found.
- `img/rooster_plate.png` — genuine PNG, 799×799, 8-bit RGBA, valid `IHDR`, same clean magic bytes. No embedded script content found.

### PASS
- Both new image assets are plain, uncontaminated PNG files with no polyglot or embedded-script risk.

---

## Summary

### BLOCK (must fix before publishing)
- None.

### WARN (inform user, let them decide)
- None new. The only WARN carried forward is the pre-existing, already-accepted `window.__level4MiniGamesQA` hook from v67 (`level4-three-games-module.js:822`) — unchanged in this release, isolated, and does not expose sensitive data or a reachable production risk.

### PASS
- Dependency audit: N/A (static bundle, no package manifest).
- No hardcoded secrets, keys, or tokens anywhere in the bundle.
- No new QA/test hooks (`window.__qa`, `advanceTime`, `render_game_to_text`, `setLevel6ToolFrame`) — only the pre-accepted v67 hook remains, inert.
- No `eval`/`new Function` usage in `dist`.
- All `innerHTML` sinks (including the new dim sum ordering banner) use only hardcoded/internal-state content — no XSS injection surface.
- New Cantonese `speechSynthesis` and WebAudio applause code use only internally generated text/audio — no injection or external-fetch surface.
- Level 5 open-baseline calibration change is a self-contained, non-security-relevant gesture-detection fix.
- No external network calls anywhere in the app; service worker `fetch` usage is same-origin only in practice.
- Service worker cache manifest correctly versioned and regenerated; no cache-poisoning risk from the new assets.
- Both new PNG images verified as genuine, uncontaminated PNG files.
- Confirmed exactly the 2 expected "synthetic"-labeled comment lines pattern class in `level4-three-games-module.js` (plus 2 similarly-worded, equally harmless comments in `index.html` describing the same legacy QA-harness distinction) — all are comments only, no executable QA logic reachable from production UI.

**Overall verdict: PASS.** The v68/v69 changes (Level 5 open-baseline calibration, dim sum ordering game, new PNG assets, regenerated offline-assets.js) introduce no new secrets, no reachable QA/test hooks, no external network calls, no XSS sinks, no eval/new Function usage, and no service-worker cache-poisoning risk. The bundle is safe to publish.
