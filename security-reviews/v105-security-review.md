# v105 Release and Security Review — Therapist Cartoon GIFs, Orange Level Tags

Build marker: `v105-20260905-therapist-gifs-orange-tags`
Date: 2026-09-05 (HKT)
Scope: `img/advanced/` (4 new GIFs, 1 removed), `index.html` (demo `<img>` sources/alts, `.lv-tag` CSS, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist request

Level 3 and Level 4 cup demos as two- and four-frame GIFs of the approved therapist cartoon, matching side-view「舉棒」bar GIFs for both levels, and Level tags as bold orange text without a background.

## Change summary

| Area | v104 | v105 |
|------|------|------|
| Level 3 active demo | v103 3-frame GIF | `level3_therapist_cup.gif` (0°→30°) |
| Level 3 assisted demo | SVG animation | `level3_therapist_bar.gif` (0°→30°) |
| Level 4 active demo | SVG animation | `level4_therapist_cup.gif` (0°→90° and back) |
| Level 4 assisted demo | SVG animation | `level4_therapist_bar.gif` (0°→90° and back) |
| `.lv-tag` | teal pill, white text, 800 | orange text `var(--orange)`, no background, 900 |

## Safety and privacy analysis

- Static image assets and CSS only. No change to camera handling, tracking, handedness check, privacy blur/segmentation, game logic, storage or network behaviour.
- GIFs are generated cartoon illustrations of the therapist (no patient likeness, no photographs, no metadata). Total added ~0.9 MB, served same-origin and cached by the service worker under the new cache version.
- Research mode untouched; only landing-card assets and tag styling changed.
- Sanitizer sweep over `dist/public` passed; `window.__qa` undefined and no research UI on the dist boot check.

## Verification

- Node suite in four groups: 539 passed, 3 intentional skips, 0 failed. `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `dist/public` rebuilt (199 files); isolation test 5/5 after the build; iPad Playwright QA at 1180×820 and 820×1180 with computed-style check of all five tags and natural-width check of all four GIFs.
