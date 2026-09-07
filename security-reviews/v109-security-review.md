# v109 Release and Security Review — Equal-Height Result-Screen Cartoons

Build marker: `v109-20260907-cheer-cartoon-equal-height`
Date: 2026-09-07 (HKT)
Scope: `index.html` (result-screen cartoon markup and CSS, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, re-composed `img/advanced/result_cheer_like.png` / `result_cheer_go.png` (297×771), tests, `progress.md`

## Therapist request

After v108 the blue-uniform fist-pump cartoon rendered visibly shorter than the thumbs-up cartoon, and the department runs 試玩 mode, where the result card has no video panel and is short, so figures taller than the card looked unbalanced.

## Change summary

| Area | v108 | v109 |
|------|------|------|
| Cartoon canvases | 250×720 and 278×720, different figure heights | one 297×771 canvas, head-to-feet 716 px for both, shared foot baseline |
| Cartoon markup | bare `<img class="result-cheer">` | `<div class="result-cheer"><img></div>` slot per figure |
| Sizing | width clamp, `height:auto`, bottom-aligned | slot stretches to card height; image `object-fit:contain`, bottom-anchored → never taller than the card, still width-clamped |
| Peg release logic, HUD content, Level 5, research strings | — | unchanged |

## Safety and privacy analysis

- Presentation-only change: no game logic, detection thresholds, camera, storage, recording or upload code touched. The peg-release relaxation and its guards from v108 are byte-identical apart from the version label in the HUD.
- The cartoons remain static local PNGs with descriptive alt text and `pointer-events:none`; hidden in research mode via the existing `.result-stage.research-mode .result-cheer{display:none}` (now applied to the slots), so the strict flow is visually unchanged.
- The new CSS comment contains no sanitizer-forbidden words; the `.result-cheer img{` rule is present in `dist/public`, and `__qa` remains absent from the public build.
- Service worker: `CACHE_VERSION` bumped so clients fetch the re-composed images and CSS.

## Verification

- Unit tests, four sequential groups: 113/113, 168/171 (3 skipped, pre-existing), 172/172, 109/109 — 562 passed / 3 skipped / 0 failed across 60 files, `tests/v108-peg-release-relaxation.test.mjs` 13/13 with the new slot/CSS assertions.
- `tools/checkjs.sh` 11 blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- `./scripts/build-dist.sh` → 202 files; isolation test 5/5 after build; marker ×3 in dist; `window.__qa` undefined on a fresh static server.
- Playwright (iPad 820×1180, 1180×820, laptop 1413×653) × {trial, video panel, research} on source and trial on dist: both figures identical rendered size and shared bottom edge (landscape trial 151×393 each, equal to the card height; video 177×459 bottom-aligned with the card), research mode hides both, no horizontal overflow, no page errors. Contact sheet: `ych_rehab_qa_artifacts/v108b/v108b-qa-contact-sheet.png`.

## Residual risk

- None beyond v108. Untracked `v91_*.md` / `v92_*.md` stay outside version control; `dist/` remains gitignored.
