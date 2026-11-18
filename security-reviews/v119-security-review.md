# v119 Security / Safety Review — public cloth-peg release for a relaxed hemiplegic hand

Date: 2026-11-18 · Marker `v119-20261118-peg-release-35`

## Deployment context
The live public site (`https://dorothy-tang.github.io/`, repo `Dorothy-Tang/Dorothy-Tang.github.io`) was
patched at dist level in another session to v115 (peg 40% / 50% / 36%, 6% hysteresis, decisive 22%,
adaptive floor 20%, 400 ms un-pinched → open-prep), v116 (Level 5/6 null-keepsake draw fix + camera
and hand-tracking watchdog), v117 (calibration camera recovery / start-anyway) and v118 (遮面 face-hide
mode). Those changes are NOT yet back-ported to this source repository (v114b base), so a dist built
from source must not be deployed. v119 is therefore applied twice, identically: in source (tested) and
as a minimal patch on the live v118 bundle (constants, pair floor, `releasing` ternary, markers).

## Rationale
Bedside report (18 Nov): with the real cloth peg in the affected hand, a participant whose hand had
visibly relaxed (fingers resting on the opened peg, no longer squeezing) could not drop the garment
on the rack; the game kept treating the garment as held. Tool calibration had been done holding the
peg. The feature is the public Level 6 peg task only.

## Investigation
Two stacked causes:
1. Public release points (v108/v110) required BOTH digits to reopen to 50% of the calibrated
   揸實→鬆開 range (re-arm 62%, combined entry 40% + 10% gate). A tired hand resting on the opened
   peg often reaches 30–45% of the range shown during calibration.
2. More importantly, the held-item update dropped the garment only when `handOpenPrep` was true.
   For tool tasks `handOpenPrep = !pinchHeld && pinch.valid && pinch.isSeparated`, and
   `isSeparated` needs both digits ≥ the RE-ARM points (62%). So even after the pinch state had
   released at 50%, the garment stayed attached to the cursor until 62% — the observed symptom.

## What changed (public peg task only; `publicPegReleaseRelaxationEnabled()`)
| Item | Before | After |
| --- | --- | --- |
| `PUBLIC_PEG_RELEASE_RATIO` | 0.50 (source) / 0.40 (live) | 0.35 |
| `PUBLIC_PEG_REARM_RATIO` | 0.62 / 0.50 | 0.47 |
| `PUBLIC_PEG_ENTER_RATIO` | 0.40 / 0.36 | 0.25 (gate = 25% + 10% = 35%) |
| `PUBLIC_PEG_HYSTERESIS_RATIO` | 0.10 / 0.06 | 0.10 |
| `PUBLIC_PEG_DECISIVE_OTHER_RATIO` / `ADAPT_FLOOR` | 0.30 / 0.25 (source) | 0.22 / 0.20 (as live) |
| `publicPegNearFloor` near cap | 0.62 literal (live 0.50) | public re-arm ratio 0.47 |
| held-item `releasing` | `handOpenPrep` (= separated ≥ re-arm) | `!isGrasping` (stabilised pinch release + combined gate) |
| `openPrep` before next pick-up | `handOpenPrep` | unchanged |

Research mode keeps the v70 values (0.56 / 0.62 / 0.74) and the `handOpenPrep` release rule.
Chopsticks (`gameType:'dwell'`), Level 5, hand-tracking configuration (`numHands:2`, confidences,
`runningMode:'VIDEO'`, work interval, canvas edge) are untouched.

## Safety analysis
- No-flicker guarantee (v110) preserved: entry 25% + 10% hysteresis = 35% = per-digit release, so
  no static aperture is both "closed" and "reopened"; the sweep test (0.20–0.70, five digit spreads,
  both previous states) shows zero flips.
- A dropped garment cannot be re-grabbed from the same relaxed posture: the next pick-up still needs
  a positively separated hand (≥ 47%) followed by a squeeze (≤ 25%). Verified end-to-end in Playwright.
- False drops while carrying: the real peg has a hard stop, so a squeezed grip sits at the closed
  baseline; a 20% loosening for 2 s is shown to keep the garment. Release still needs the stabilised
  gesture state and the 220 ms drop dwell.
- No new inputs, storage, network, permissions or DOM surfaces; no QA hooks ship (`__qa` count 0 in
  dist). No participant data or "research/pilot" wording added to the public bundle.

## Validation
- Node suite 66 files in four groups: 596 tests, 593 passed / 3 skipped / 0 failed.
- New `tests/v119-peg-release-relaxed-hand.test.mjs` (6) incl. the v110 regression reproduction and
  a Playwright end-to-end flow; `v108`/`v110` constant regexes updated; 9 marker tests bumped.
- `tools/checkjs.sh` 11 blocks OK, `node --check service-worker.js`, `git diff --check` clean.
- `./scripts/build-dist.sh` → 199 files; `rg -c "__qa" dist/public/index.html` → 0; dist contains the
  three v119 markers, the `.35/.47/.25` constants and the new `releasing` ternary.
- Playwright `?perf=1` at laptop 1413×653 / iPad 1180×820 / iPad 820×1180: squeeze → held, light
  carry 60 frames held, relax to 40% → released and 配對成功 ×1, exactly two transitions, zero page
  errors — `ych_rehab_qa_artifacts/v119/v119-qa-contact-sheet.png`.

- Deployable bundle (`/tmp/v119/`, live v118 + patch): 9 inline scripts `node --check` OK, SW and
  manifest OK, `__qa` 0, markers ×3; Playwright route-swap smoke test of the live site with the v119
  files at the three viewports — zero page errors.

## Residual risk
Re-arm stays at 47%; if a bedside session shows "dropped but cannot pick up the next garment", review
`PUBLIC_PEG_REARM_RATIO` alone. Therapists can read live 近指／遠指／合併 ratios vs thresholds with
`?perf=1`.
