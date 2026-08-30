# v70 Pre-Publish Security Review — YCH Rehabilitation Games

- **Date:** 2026-08-30 21:14 HKT
- **Build under review:** `/home/user/workspace/ych_rehab_games_advanced/dist/public` (build marker `v70-20260830-tool-pinch`, aligned across `index.html`, `service-worker.js`, `manifest.webmanifest`)
- **Source diff under review:** uncommitted `git diff HEAD` in `/home/user/workspace/ych_rehab_games_advanced` (index.html +173/−20, service-worker.js, manifest.webmanifest, progress.md, 4 test files updated, 1 new test file `tests/v70-tool-pinch.test.mjs`)
- **Deployment context:** static, offline-capable PWA on public GitHub Pages; supervised OT use with stroke inpatients; no backend, no accounts, no data submission; MediaPipe served from bundled local `vendor/` assets.

## Security Review Results

### BLOCK (must fix before publishing)
- None.

### WARN (inform user, let them decide)
- None blocking. Two informational notes:
  1. **Inert QA plumbing remains in the build (dead code, not exploitable).** `dist/public/index.html` still contains internal identifiers `state.qaMode` / `qaHand` / `qaFrameGeneration` (39 lines, e.g. lines 2303, 5153, 8897–8964). Verified inert: `state.qaMode` is never assigned `true` anywhere in the build, `qaHand` is only ever assigned `null` (lines 5645, 8897), and the sole injection surface (`window.__qa`) is fully stripped (0 matches). No action required; optionally strip the dead branches in a future build for hygiene.
  2. **Service worker has a cross-origin runtime-cache branch (currently unreachable).** `service-worker.js` fetch handler contains a `url.origin !== self.location.origin` branch that would cache-first any cross-origin GET, including opaque responses. The precache list (`offline-assets.js`) is 100% same-origin relative paths (0 `http(s)://` entries), and the app makes zero cross-origin requests (0 external URLs in all HTML/JS — the only `https://` strings in the build are Wikimedia/Creative Commons attribution URLs inside the data file `image-sources.json`). The branch is therefore dead in practice. Optionally replace it with a plain network pass-through to make the same-origin-only caching policy structural.

### PASS
1. **QA/debug hooks stripped (required check).** `grep -E 'window\.__qa\b|advanceTime|render_game_to_text|setLevel6ToolFrame|level67Layout|dimsumOrder:' dist/public/index.html` → **0 matches**, as required. Same grep across every other file in `dist/public` (all `*.js`, `offline.html`, `manifest.webmanifest`) → 0 matches. `PUBLIC_BUILD_REMOVE` markers: 10 in source `index.html`, **0** in the built `dist/public/index.html` — stripping ran.
2. **No hardcoded secrets.** Grep for API-key/token/private-key/password patterns (sk-, AKIA, ghp_, glpat-, xox*, BEGIN PRIVATE KEY, password=…) across all JS/HTML/JSON/webmanifest in `dist/public` → 0 matches. No `.env` files in the published tree.
3. **No external analytics/trackers/telemetry.** Grep for gtag, google-analytics, googletagmanager, mixpanel, segment, sentry, hotjar, plausible, posthog, facebook.net, doubleclick, sendBeacon, WebSocket, EventSource → 0 matches. Zero external `<script>`/`<link>`/`<iframe>` src/href in `index.html` and `offline.html`.
4. **No eval of remote code.** `eval(` / `new Function(` → 0 matches in first-party code AND in the bundled MediaPipe files (`vendor/mediapipe/vision_bundle.mjs`, both `vision_wasm*_internal.js`). Dynamic `import()` targets only the local `./vendor/mediapipe/vision_bundle.mjs`. The only `importScripts` is the service worker loading the local `./offline-assets.js`. No `fetch()` of remote URLs anywhere in app code. MediaPipe models/wasm are bundled locally (32 MB `vendor/`), consistent with offline-first design.
5. **Service worker caches only same-origin assets in practice.** Precache list is entirely relative same-origin paths; the app issues no cross-origin requests (see WARN note 2 for the defensive-hardening suggestion). Cache version bumped to `fthue-rehab-v70-20260830-tool-pinch` with old-cache cleanup on activate; SW registered with `updateViaCache:"none"`.
6. **XSS surface review.** ~28 `innerHTML` assignments in `index.html`; all consume hardcoded localization strings or internally generated values. The only user-typed value reaching `innerHTML` (`record.participantId`, index.html:4192) is sanitized upstream to `[A-Z0-9_-]` and rejected on mismatch (`rawId.replace(/[^A-Z0-9_-]/g,'')`, source lines 4643–4660) — not exploitable. No user accounts, no server, no stored data leaves the browser.
7. **Dependency audit.** N/A by design — no `package.json` / `requirements.txt` in the project root; the site ships zero third-party runtime dependencies beyond the pinned, locally bundled MediaPipe assets.
8. **Open CORS / missing auth.** N/A — fully static site, no server code, no CORS headers, no mutation endpoints; grep for CORS patterns in `dist/public` → 0 matches.

## v70 Source Diff — Safety-Invariant Review

Scope of the diff: new tool-in-hand pinch path (`computeToolPinchState`, `isLevel6RealToolTask`, `TOOL_PINCH_DEFAULTS`, tool calibration sampling + per-digit threshold derivation), Cantonese wording changes, version-string bumps, tests. No changes to hand-identity gating, frame-freshness/generation guards, or hold-timeout code.

| Invariant | Verdict | Evidence |
|---|---|---|
| Only the selected affected hand may drive interaction | **PASS** | The new `computeToolPinchState(lm, …)` call sits inside `interpretHandResults` **after** the untouched `selectedAffectedHandIndex(...)` gate, which returns `{detected:false, reason:'affected-hand-not-detected'}` when the affected hand is absent; the diff does not modify hand-identity code. |
| Fail-closed on stale frames / duplicate generations / missing landmarks | **PASS** | `computeToolPinchState` opens with the same `hasFiniteHandLandmarks(lm,[0,4,5,8,9,12,17])` guard as `computePinchState` and returns `{isPinching:false, valid:false}` on failure; `interpretHandResults` additionally nulls `results` for the pinch mode's required-landmark set before either interpreter runs. Frame-generation/freshness guards (`generation <= lastAcceptedToolHandGeneration` rejection, `fresh && generation >= 3`, 750 ms max age) are untouched by the diff. |
| Release requires BOTH digits; a single drifting landmark must never release | **PASS** | Release condition is `bothReopened = nearRatio >= t.nearExit && farRatio >= t.farExit` where `nearRatio = min(indexRatio, middleRatio)` — a strict AND: if either the index or the middle fingertip alone drifts open, the minimum stays below `nearExit` and the hold persists. This is at least as strict as the pre-existing bare-hand `computePinchState` (which also offers an OR-style asymmetric reopen path); the tool path has no such secondary path. Note both digit ratios are anchored on the thumb tip (lm[4]), identical to the pre-existing bare-hand implementation — no regression. `tests/v70-tool-pinch.test.mjs` (16 tests) covers single-digit-drift safety and threshold derivation. |
| Fail-closed calibration (no poisoned baselines, no static-posture pass) | **PASS** | Tool calibration requires ≥12 samples spanning ≥0.030 aperture range (p08/p92) before any "open" sample qualifies, so a static posture never completes the open stage; dropout (>1.5 s) clears `toolVals`/`openNear`/`openFar`/`closedNear`/`closedFar`; the v68 rebaseline path also clears the new per-digit buffers. |
| Research track isolation | **PASS** | `isLevel6RealToolTask()` requires `isLevel6()`, which requires `!research.active`; `computeToolPinchState` additionally falls back to fixed `TOOL_PINCH_DEFAULTS` unless `!research.active && state.personalToolPinch` — the research pipeline is untouched. |
| No new capability claims | **PASS** | New code paths are camera-observed hand motion only; diff comments and patient-facing copy explicitly state the software does not identify the physical tool or measure force. No new network, storage, or permission surface introduced. |

Remaining diff files are benign: `manifest.webmanifest` / `service-worker.js` are version-string bumps only; test changes are version-string updates plus the new v70 test file; `progress.md` / sandbox validation files are documentation and QA-result updates.

## Verdict

All required checks pass: 0 QA/debug hook matches in the published build, no secrets, no trackers, no remote code execution, same-origin-only caching in practice, and no regressions to the affected-hand-only / fail-closed / both-digit-release safety invariants in the v70 source diff.

**VERDICT: PASS**
