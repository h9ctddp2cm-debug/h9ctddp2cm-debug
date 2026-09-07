# v108 Release and Security Review — Level 6 Peg Release Relaxation and Result-Screen Cartoons

Build marker: `v108-20260907-peg-release-cheer-cartoons`
Date: 2026-09-07 (HKT)
Scope: `index.html` (peg release constants, `publicPegNearFloor`, `publicPegEffectiveThresholds`, `publicPegReleaseRelaxationEnabled`, `decisiveReopen` in `computeToolPinchState`, `framePerfToolSnapshot` / `updateFramePerfOverlay`, result-screen markup and CSS, `endGame`, QA probes, markers, HUD label), `service-worker.js`, `manifest.webmanifest`, two new PNG assets under `img/advanced/`, tests, `progress.md`

## Therapist request

1. A stroke participant (affected hand, all three calibration steps ticked) playing the public Level 6 real-peg task could pick items up but could never put them down — "拎得起，但放手都放唔低".
2. Two cheering therapist cartoons (thumbs-up and fist-pump, drawn from the therapist's own reference photos) should flank the 成績單 on the result screen.

Level 5 was explicitly declared good ("no need change at this moment") and is untouched.

## Change summary

| Area | v107 | v108 (public real-peg task only) |
|------|------|------|
| Release point (each digit) | 62% of calibrated closed→open range (`nearExit` / `farExit`) | 50% (`PUBLIC_PEG_RELEASE_RATIO`); re-arm 62% (`PUBLIC_PEG_REARM_RATIO`) |
| Release rule | BOTH digits past their exit point | both digits past exit, OR one digit past re-arm while the other has moved ≥30% of its own range (`PUBLIC_PEG_DECISIVE_OTHER_RATIO`) |
| Single-landmark drift guard | implicit (both digits required) | explicit pair-baseline floor `publicPegNearFloor()` = min(nearClosed + 0.62·R, farClosed + 0.12·R) on every relaxed NEAR threshold |
| Adaptive lowering | after enough in-play samples, no explicit floor | only downwards, never below 25% of calibrated range (`PUBLIC_PEG_ADAPT_FLOOR_RATIO`), never touches `enter` |
| Entry threshold | calibrated `enter` | unchanged |
| Chopstick flex path, research mode, Level 5 | — | unchanged (0.62 / 0.74 literals intact) |
| `?perf=1` overlay | no tool line | 衣夾 line with live near/far ratios and effective thresholds; overlay hidden in `endGame` |
| Result screen | card only, centred (top could sit −55 px on iPad landscape with the movement-review panel) | `.result-stage` row: cartoon + card + cartoon; card top ≥ 24 px, scrollable; cartoons hidden in research mode |

## Safety and privacy analysis

- Wrong-release protection: the decisive-digit path still requires BOTH digits to move (the "other" digit must have travelled ≥30% of its own calibrated range), and the pair-baseline floor means a static digit plus one drifting landmark cannot produce a release that v107 would have rejected. Tests assert the floor for a static near digit and the research literals.
- Scope gating: every relaxation is behind `publicPegReleaseRelaxationEnabled()` (`!research.active && isLevel6RealToolTask()`) and requires calibrated ranges; the generic `TOOL_PINCH_DEFAULTS` and chopstick flex path are unaffected. Research-mode strings and logic are unchanged, so the pilot flow is not altered.
- Entry is never widened: `enter` remains the calibrated value, so the fix cannot cause false pick-ups.
- Result-screen cartoons are static local PNGs (no network, no third-party assets, no personal data); alt text is descriptive and contains no participant information. They are hidden in research mode via CSS class toggled in `endGame`, keeping the strict flow visually identical.
- The sanitizer (`scripts/sanitize-public.cjs`) still strips every `__qa` probe, research/pilot CSS rule and comment from `dist/public`; the new `.result-stage` comment was reworded so the public layout rule survives sanitisation (a v108 test guards this). `window.__qa` is undefined on the built dist.
- No changes to camera handling, privacy constants (`numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`, `PUBLIC_CANVAS_MAX_EDGE`), storage, recording, or upload behaviour. The perf overlay remains debug-only (`?perf=1`) and contains no identifying data.
- Service worker: only `CACHE_VERSION` bumped; the two new images are served from `img/advanced/` like existing assets.

## Verification

- Unit tests, four groups run sequentially, never concurrently with the build: group 1 113/113, group 2 168 pass / 171 (3 skipped, pre-existing), group 3 172/172, group 4 109/109 — total 562 passed / 3 skipped / 0 failed across 60 files, including `tests/v108-peg-release-relaxation.test.mjs` 13/13.
- `tools/checkjs.sh` 11 blocks OK; `node --check service-worker.js`; `git diff --check` clean.
- `./scripts/build-dist.sh` → 202 files; `tests/v78-public-build-isolation.test.mjs` 5/5 after the build; marker present ×3 in dist (`index.html`, `service-worker.js`, `manifest.webmanifest`); `.result-stage{` rule present in dist; `__qa` absent from dist; fresh static server: `window.__qa` undefined, marker read back, cartoons resolve.
- Playwright (chromium, fake camera, service workers blocked) on iPad 820×1180, iPad 1180×820 and laptop 1413×653: public result screen shows both cartoons (250×720 and 278×720 rendered at equal scale), no horizontal overflow, card top 24 px (landscape/laptop) / 171 px (portrait); research result screen hides both cartoons; dist row layout verified; peg HUD screenshot shows `衣夾 近指 0.366 放手≥0.325 張開≥0.339  遠指 0.404 放手≥0.364 張開≥0.377  門檻 校準+自適應降低` after a closed grasp (near .270) followed by a partial open that now releases. Contact sheet: `ych_rehab_qa_artifacts/v108/v108-qa-contact-sheet.png`.

## Residual risk

- The relaxed release increases the chance of a release when the participant's grip momentarily loosens; the shared 180 ms tool-gesture confirmation timer and the ≥30% other-digit requirement limit this to genuine partial openings. Therapist to observe the first sessions with `?perf=1` if drops look premature.
- Untracked `v91_*.md` / `v92_*.md` reports remain outside version control by design; `dist/` remains gitignored and is deployed via the pages repo.
