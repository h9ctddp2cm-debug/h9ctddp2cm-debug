# v113 Security / Ethics Review — public build has no participation-certificate feature

Date: 2026-09-12 · Branch `feature/level3-bilateral-sandbox` · Marker `v113-20260912-public-no-certificate`

## Rationale
The therapist flagged that the participation certificate ("參與嘉許狀") functions as a reward/incentive
for participants, but it is not mentioned anywhere in the Protocol, PIS/ICF, or the HA Portal submission.
IRBs are sensitive to any item given to participants that could be read as an inducement to participate.
v113 therefore removes the certificate feature from the public build entirely: no entry link, no
`certificate.html` file, no related wording — while keeping it in the source/research tree in case a
future, ethics-approved version of the study explicitly documents and approves it.

## What changed
| Area | Source / research build | Public build (`dist/public`) |
| --- | --- | --- |
| `.cert-entry` link ("頒發參與嘉許狀") on the landing page | present, inside `PUBLIC_BUILD_REMOVE` markers | stripped |
| `.cert-entry` CSS rules | present | stripped by sanitizer selector filter |
| `certificate.html` (standalone printable page) | present in repo root | not copied to `dist/public` |
| `localization.js` `'頒發參與嘉許狀'` key | present (used by source build only) | stripped by localization sanitizer |
| Research entry, recording feature (v112) | unchanged | unchanged (already absent from public) |

## Fail-closed guards added
- `scripts/sanitize-public.cjs` CSS selector filter now also drops any rule whose selector matches `cert-entry`.
- `scripts/sanitize-public.cjs` HTML forbidden-pattern list now fails the build if `cert-entry`, `lnkCertificate`, `certificate.html`, or `嘉許狀` remain in the public index.
- `scripts/sanitize-public.cjs` localization sanitizer fails the build if `嘉許狀` or `Certificate of participation` remain in the public `localization.js`.
- `scripts/build-dist.sh` no longer copies `certificate.html` and additionally fails the build outright if `dist/public/certificate.html` exists for any reason (hard-exclusion guard, mirrors the existing `research/` and `sandbox/` checks).
- `scripts/build-dist.sh`'s existing authoring/research grep guard on `dist/public/index.html` was extended with the certificate identifiers as a second line of defence.

## Unchanged
Recording removal (v112), research-mode gating, privacy constants (`numHands:2`, confidences, `runningMode:'VIDEO'`, canvas/interval limits, calibration blur/segmentation), Level 5 gameplay, handedness check default, chopstick `slotRatios`, theming strings — all untouched by this release.

## Validation
- Node test suite (65 files) in four groups — 582 passed / 3 skipped / 0 failed; one grasp-stability test flaked once under parallel-run CPU load (timing-based, unrelated to this diff) and reran clean both standalone (×3) and as part of a clean full-group rerun.
- `tools/checkjs.sh` 11 OK, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 201 files (previously 202; `certificate.html` no longer shipped).
- `tests/v78-public-build-isolation.test.mjs` 5/5, `tests/v113-public-no-certificate.test.mjs` 6/6 run after the final build.
- `rg` on `dist/public`: no `cert-entry|lnkCertificate|certificate\.html|嘉許狀` in `index.html`; no `嘉許狀|Certificate of participation` in `localization.js`; `dist/public/certificate.html` does not exist; `__qa` still absent from the public index.
- Playwright QA on laptop 1413×653 (scrolled to the bottom of the level-selection screen) and iPad 1180×820 / 820×1180 (full page), public and source builds: zero page errors; public DOM has zero `.cert-entry` elements and zero `嘉許狀` text anywhere on the page; source DOM keeps exactly one `.cert-entry` link plus the `研究模式` entry directly below it.

## Residual notes
- `certificate.html`, `img/cert/*` and the certificate-specific tests remain in the source repository untouched, available for a possible future ethics-approved version of the study.
