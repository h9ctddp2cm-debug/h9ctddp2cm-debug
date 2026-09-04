# v103 Release and Security Review — Level 3 Demo GIF (palmar grasp, running shoes)

Build marker: `v103-20260905-l3-demo-palmar-grasp`
Date: 2026-09-05 (HKT)
Scope: `img/advanced/level3_therapist_shoulder_30_60.gif` (replaced), `index.html` (marker + HUD string only), `service-worker.js` (cache version), `manifest.webmanifest` (start_url), marker tests, `progress.md`

## Therapist request

Level 3 demo character should wear white running shoes without socks and hold the cup body in a whole-hand palmar grasp (not the handle), matching how FTHUE Level 3 patients grasp.

## Change summary

| Area | v102 | v103 |
|------|------|------|
| Level 3 active demo GIF | nursing shoes, fingers on cup handle | white running shoes, no socks, handle-less cup wrapped in the palm |
| Code / markup | — | unchanged apart from the three build markers and HUD label |

## Safety and privacy analysis

- Asset-only release. No change to camera handling, tracking constants, handedness check, privacy blur/segmentation, game logic, research mode, certificate page or storage.
- The GIF is a same-origin static file generated from the therapist's own cartoon likeness at her request; no patient imagery.
- Cache version bump ensures previously cached copies of the GIF are replaced on the next visit.
- Sanitizer sweep over `dist/public` passed; `window.__qa` undefined on the dist boot check.

## Verification

- Node suite in four groups: 538 passed, 3 intentional skips, 0 failed. `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `dist/public` rebuilt (196 files); `tests/v78-public-build-isolation.test.mjs` 5/5 after the build; iPad Playwright QA at 1180×820 and 820×1180 inspected.
