# v102 Release and Security Review — Kung-fu Theme, Level 2 Archive, Level 3 Therapist GIF, Certificate

Build marker: `v102-20260905-kungfu-theme-certificate`
Date: 2026-09-05 (HKT)
Scope: `index.html`, `localization.js`, `manifest.webmanifest`, `service-worker.js`, `scripts/build-dist.sh`, `certificate.html` (new), `img/cert/*` (new), `img/advanced/level3_therapist_shoulder_30_60.gif` (new), `img/beefball_real.png`, `tests/`, `progress.md`, `dist/public`

## Therapist request (D-3)

Hong Kong kung-fu theming of the landing page and Level 3–6 card names, no dim-sum overlap in the chopstick game, hide the Level 2 card without deleting it, a Level 3 animated demo using the therapist's cartoon, and a printable A4 landscape participation certificate for day 10 with the approved wording.

## Change summary

| Area | v101 | v102 |
|------|------|------|
| Landing title | 仁濟醫院職業治療部 / 中風上肢訓練 | 仁濟醫院職業治療部 / 中風上肢復康訓練 (larger) / FTHUE-HK 港式神功修煉 / 欲要成功，必先勤功！ |
| Level cards | clinical names, Level 2 shown | Level 2 hidden (`display:none`, code retained); Levels 3–6 show kung-fu name + slogan + clinical name |
| Level 3 active demo | deterministic SVG | therapist cartoon GIF (4 frames, 660×570, 300 KB); assisted SVG unchanged |
| Chopstick foods | pseudo-random grid (could overlap) | three fixed slots per orientation, grid fallback |
| Certificate | none | `certificate.html` static page, print CSS, one image + one logo, JS only fills the year |

## Safety and privacy analysis

- No change to camera handling, MediaPipe configuration, hand admission/lock, handedness check (default ON), privacy blur/segmentation, grasp/pinch thresholds, Level 6 dwell rules (`gameType:'dwell'`), adaptive progression or research mode. Research-mode strings and the `#researchLevel` selector are untouched; the Level 2 hide is a CSS class on the public landing card only.
- `certificate.html` is a self-contained static page: no forms, no storage, no network requests beyond same-origin images, no query-string echo into the DOM except a whitelisted 4-digit `?year=` value converted to Chinese numerals. Patient name and date are handwritten after printing, so no patient data is entered or stored.
- The certificate link opens in a new tab with `rel="noopener"`; same origin.
- New assets are same-origin static files (GIF, JPG, PNG). The GIF was generated from the therapist's own cartoon likeness with her request; it contains no patient imagery. The department logo is the existing public asset from the assistive-aids site with the white background removed.
- Sanitizer: `certificate.html` contains none of the forbidden research/QA strings; the `grep -rIEqi` sweep over `dist/public` passed. `window.__qa` is undefined on the dist boot check.
- Service worker: runtime cache only; version bump forces refresh of the old landing page and adds the new files on first visit.

## Verification

- Node suite in four bounded groups: 538 passed, 3 intentional skips, 0 failed (`ui-layout` and `shoulder-flexion-levels` updated for the archived Level 2 and the GIF; new `v102-kungfu-theme-certificate` 8 tests).
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `dist/public` rebuilt (196 files); `tests/v78-public-build-isolation.test.mjs` passed after the build; fresh static server on 4184 served `certificate.html` (200) and `index.html` without `window.__qa` or research UI.
- iPad Playwright QA at 820×1180 and 1180×820 on the dist build: title block, four cards, Level 3 GIF (naturalWidth 660), certificate link; certificate PDF A4 landscape single page, visually inspected.

## Residual risks / notes

- Level 2 is hidden rather than removed; its JS paths remain reachable only through research mode.
- Kung-fu English renderings are the developer's own translations.
- Certificate printing depends on the browser「背景圖形」setting; the toolbar hint states this.
