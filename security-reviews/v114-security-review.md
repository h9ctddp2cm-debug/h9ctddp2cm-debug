# v114 Security / Ethics Review — public build has no flower-arranging "keepsake" feature

Date: 2026-09-14 · Branch `feature/level3-bilateral-sandbox` · Marker `v114-20260914-public-no-keepsake`

## Rationale
The therapist flagged that the flower-arranging activity's ending "留念" (keepsake) screen — which
collects the participant's typed name plus a handwritten signature and lets them download a PNG —
is not mentioned anywhere in the Protocol, PIS/ICF, or the HA Portal submission. This is the same
reasoning class as v113's certificate removal: IRBs are sensitive to any item given to, or personal
data collected from, participants that is not documented in the approved study materials, and a
named/signed keepsake image is both a potential inducement and a piece of identifiable information.
v114 therefore removes the keepsake flow from the public build entirely — no name/signature capture,
no PNG download, no related wording — while keeping it in the source/research tree in case a future,
ethics-approved version of the study explicitly documents and approves it.

A second, unrelated issue was fixed in the same release: `img/cert` (the Yan Chai logo and ink-wash
background, originally used only by the certificate feature) became an orphaned asset once v113
stopped copying `certificate.html` into `dist/public`, but the build script never stopped copying the
folder itself. v114 excludes it and adds a fail-closed guard so it cannot silently reappear.

## What changed
| Area | Source / research build | Public build (`dist/public`) |
| --- | --- | --- |
| Keepsake DOM (`.keepsake` name input, signature pad, PNG preview) | present, inside `PUBLIC_BUILD_REMOVE` markers | stripped |
| Keepsake logic (`bindKeepsake`, `drawKeepsake`, `ksDateStr`, `ksRedraw`, `ksDataURL`, `ksDownload`, `startFlowersKeepsake`) | present, inside `PUBLIC_BUILD_REMOVE` markers | stripped |
| `flowersFinish()` call site | routed through `flowersFinishApi` facade | same facade; falls back to a direct "作品完成" applause + `endGame()` since `startFlowersKeepsake` no longer exists |
| In-activity hint text mentioning writing a name / downloading a PNG (`flowersPanel()` metric, `rewardSmall()` progress label) | shows the keepsake-aware wording | shows a generic "按「完成作品」結束" / "按「完成作品」" wording |
| `img/cert/` (orphaned certificate assets) | present in repo, unused since v113 | excluded from the copy step; hard-fails the build if it ever reappears |

## Fail-closed guards added
- `scripts/build-dist.sh` forbidden-string grep on `dist/public/index.html` extended with
  `bindKeepsake|drawKeepsake|ksPreview|ksName|ksSig|ksDownload|ksDataURL|ksRedraw|ksDateStr|留念`.
  `startFlowersKeepsake` is deliberately **not** in this list: the `flowersFinishApi` facade keeps a
  `typeof startFlowersKeepsake === 'function'` guard in the public bundle so it can detect its own
  absence at runtime, exactly mirroring the v112 `movementRecordingApi` / `startMovementRecording`
  precedent.
- `scripts/build-dist.sh` now runs `rm -rf "$DIST/img/cert"` right after copying `img/`, plus a new
  hard-exclusion guard that fails the build outright if `dist/public/img/cert` exists for any reason.
- New `tests/v114-public-no-keepsake.test.mjs` asserts (a) the source markers exist and wrap the
  correct code, (b) the facade falls back correctly when `startFlowersKeepsake` is undefined, (c) the
  build script excludes `img/cert` and fails closed on both the orphaned folder and the forbidden
  identifiers (while explicitly *not* forbidding the bare `startFlowersKeepsake` identifier), and (d)
  — gated on a fresh `dist/public` — the shipped index has none of the removed identifiers, the
  facade/`flowersFinishApi.run()` call site is present, `img/cert` does not exist in dist, and
  `offline-assets.js` / `service-worker.js` reflect the cleanup and the new cache marker.

## Unchanged
Certificate removal (v113), recording removal (v112), research-mode gating, privacy constants
(`numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
`PUBLIC_CANVAS_MAX_EDGE`), calibration blur/segmentation, Level 5 gameplay, handedness-check default,
chopstick `slotRatios`, theming strings — all untouched by this release. `flowers.name` /
`flowers.sigStrokes` remain initialized to `''` / `[]` and are never written in the public build now
(the only writer, `bindKeepsake()`'s input/pointer listeners, is stripped); the pre-existing
`if(o.name){...}` guard in `drawVaseScene` and the separately-marked QA-hooks block already handled
this safely and needed no changes.

## Validation
- Node test suite (65 files, four groups) — 587 passed / 3 skipped / 0 failed.
- `tools/checkjs.sh` 11 blocks OK, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files (previously 201; `img/cert`'s 2 files no longer shipped).
- `tests/v114-public-no-keepsake.test.mjs` dist-gated subtests pass after the rebuild.
- `rg -c "__qa" dist/public/index.html` → 0.
- Playwright QA on laptop 1413×653 (first) then iPad 1180×820 / 820×1180, public build only: landing
  page → Level 5 → flowers activity setup screen, three screenshots per viewport — zero page errors,
  zero `.keepsake` DOM elements at any point, zero occurrences of "留念" anywhere in page text.
  Contact sheet: `ych_rehab_qa_artifacts/v114/v114-qa-contact-sheet.png`.

## Residual notes
- `.keepsake` CSS rules remain in the shared stylesheet as inert dead code in the public build (still
  needed by the source/research build); they contain no PII and are unreachable without the stripped
  DOM, so they are left in place — consistent with how v112/v113 left other now-unused shared CSS.
- `certificate.html`, the keepsake source functions, and their tests remain in the source repository
  untouched, available for a possible future ethics-approved version of the study.
