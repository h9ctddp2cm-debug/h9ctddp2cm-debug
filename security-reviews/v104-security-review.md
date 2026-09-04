# v104 Release and Security Review — Landing Copy Simplification, Horizontal Certificate

Build marker: `v104-20260905-landing-copy-horizontal-cert`
Date: 2026-09-05 (HKT)
Scope: `index.html` (landing-card copy, markers, HUD label), `localization.js` (5 EN strings), `certificate.html` (layout), `service-worker.js`, `manifest.webmanifest`, tests, `progress.md`

## Therapist request

Shorter lead line, patient-friendly「膊頭」wording, removal of three clinical sub-lines on the Level 4–6 cards, plain captions「拿杯」/「雙手舉棒」under the shoulder demos, and a horizontal certificate layout.

## Change summary

| Area | v103 | v104 |
|------|------|------|
| Lead line | 請選擇 Level 開始修煉 | 請選擇 Level |
| Level 3/4 clinical line | 肩屈曲 … | 膊頭屈曲 … |
| Level 4 action line, Level 5/6 clinical line | shown | removed from the landing cards |
| Demo captions | 主動肩屈曲 / 主動輔助肩屈曲 | 拿杯 / 雙手舉棒 |
| Certificate | vertical writing | horizontal, same wording |

## Safety and privacy analysis

- Copy and CSS only. No change to camera handling, tracking, handedness check, privacy blur/segmentation, game logic, storage or network behaviour.
- Research mode untouched: `research.levelLabel`, camera-setup hints and in-game headers keep the clinical wording; only the public landing cards changed.
- `certificate.html` still has no forms, no storage and no network requests beyond same-origin images/fonts; the only script fills the year and triggers print.
- Sanitizer sweep over `dist/public` passed; `window.__qa` undefined and no research UI on the dist boot check.

## Verification

- Node suite in four groups: 538 passed, 3 intentional skips, 0 failed. `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean.
- `dist/public` rebuilt (196 files); isolation test 5/5 after the build; iPad Playwright QA at 1180×820 and 820×1180; certificate PDF A4 landscape single page inspected.
