# v101 Release and Security Review — Level 5/6 Content Update (fridge, laundry, chopsticks, cards)

Build marker: `v101-20260904-level56-fridge-laundry-cards`
Date: 2026-09-04 (HKT)
Scope: `index.html`, `manifest.webmanifest`, `service-worker.js`, `img/fridge_apple.png`, `img/fridge_durian.png` (new), `tests/`, `progress.md`, `dist/public`

## Therapist request (D-2)

Fridge: tofu → apple, add durian, all foods 2×, a harder six-zone lit-target mode without animals. Level 5 laundry: one garment at a time with larger, well-separated baskets (up to four). Level 6 laundry: one garment at a time, clear the rack after six pieces and announce「又有新衫要晾喇」without lag. Basic chopsticks uses the rooster plate. Card instructions 3× without covering cards. Handedness selection stays required.

## Change summary

| Area | v100 | v101 |
|------|------|------|
| Fridge foods | 13 defs incl. tofu, 1× | 13 defs (apple, durian; no tofu), placed 2×, tray 2× portrait / ~1.2× landscape (lane-limited, name label kept inside the lane), 6 per round |
| Fridge difficulty | any shelf | `basic` (any shelf) or `zones` (random lit cell of a 3×2 / 2×3 grid must receive the food; grid top clamped below the HUD buttons via `fridgeZoneBounds`) |
| L5 laundry (public patient cues) | up to 4 garments, small baskets stacked above | 1 garment centre-bottom, 2–4 large baskets spread over the display with ≥4 % corridors |
| L6 laundry | garments accumulated on a rack 1.6× wider than the canvas (mostly off-screen) | 6 visible slots on an on-screen rail, clear after 6 + speech, batch counter |
| L6 chopsticks basic | vector bowl「大碗」 | rooster plate photo「大碟」 (same as complex) |
| Cards chip | 26 px, 236×44 | 78 px auto-fit chip below HUD / above cards; L6 two-pile chip; L6 bubble text corrected |

## Safety and privacy analysis

- No change to camera handling, hand admission, hand lock, handedness check, privacy blur/segmentation, grasp/pinch thresholds, Level 6 dwell rules (`gameType:'dwell'`, finger flexion not required) or research mode. Research strata keep their own laundry layouts (`isLaundrySingleGarmentMode` requires the public Level 5 vertical flow and patient-cue mode).
- New timers: `laundryRackClearTimerId` (single `setTimeout`, cleared on stop/restart and before rescheduling) — no timer accumulation, no per-frame allocation. Rack clear happens after the applause pause so the sixth garment is seen on the rack; speech uses the existing `speak()` queue.
- New images are static PNGs served from the same origin and listed for the service-worker cache; no external requests added.
- Zone mode picks a random zone with `Math.random()` (non-security use); the lit zone never repeats consecutively so each placement requires a new shoulder angle.
- Pickup radii are unchanged; only visual radii grew, so grasp/drop tolerances behave as in v98–v100.
- The tray-food 2× limit in landscape is a deliberate layout cap (lane height) rather than a bug; noted for the therapist with an alternative (narrower fridge + side tray).

## Public build isolation

- Rebuilt `dist/public`: sanitized index 713 993 bytes, 192 files (`img/fridge_tofu.png` still shipped but unreferenced). `tests/v78-public-build-isolation.test.mjs` 5/5 after the build. Fresh static-server boot: `typeof window.__qa === 'undefined'`, no `#btnResearchMode`, `#fridgeDifficultyCard` present, no console errors.
- No new QA hooks in the public build; `__qa.level67Layout().laundryRack` and `__qa.laundryRack.hang()` exist only in the source build.
- Sanitizer forbidden-token scan (`__qa`, `advanceTime`, `qaSyntheticHand`, `研究`) on `dist/public/index.html`: 0 hits.

## Validation

- Node suite in four groups: 95 + 158 + 168 + 109 = 530 passed, 3 intentional skips, 0 failed.
- New `tests/v101-level56-visual-updates.test.mjs` (6 tests) including geometric non-overlap of baskets/garment/HUD across 1180×820, 820×1180, 1024×768, 768×1024, 1366×1024.
- `tools/checkjs.sh` all blocks OK; `node --check service-worker.js`; `git diff --check` clean; markers aligned ×3; seven marker tests updated; HUD `perf v101`.
- iPad Playwright QA (820×1180, 1180×820) screenshots inspected: fridge basic/zones, laundry L5 tiers 1–4, L6 rack 5 and 6 garments, basic chopsticks rooster plate, L5/L6 cards chips (no HUD or card overlap; L6 chip auto-shrinks in portrait).

## Residual risks

- Landscape tray food is ~1.25× rather than 2×; therapist to decide on a narrower-fridge layout if a full 2× is required.
- Speech「又有新衫要晾喇！」depends on device TTS availability (same as existing prompts).
- Six-zone mode has not yet been tried bedside; zone size (roughly 1/6 of the interior; top row shortened by the HUD clamp) may need tuning for reach-limited participants.
