# v136 Security / Safety Review — Level 6 arrival-arms-pickup (peg games) + male cashier image

Date: 2026-11-20 · Marker `v136-20261120-cashier-arrive-arm`

## Change
1. Public Level 6 grasp-style games (clothes-peg laundry; flowers / cards / mahjong), nothing held:
   staying over the next item for `LEVEL6_ARRIVE_ARM_MS = 700` ms while the hand is NOT squeezing
   prepares the pick-up by itself (orange halo, voice 夾住). The next squeeze picks the item up.
   - Therapist bedside report after v135: the voice kept saying 張開手 although the clothes peg had
     been relaxed. A real peg only lets the fingers reopen a little; that posture stays below the
     calibrated "separated" point, so `handOpenPrep` never became true.
   - Gate `level6ArriveArmEnabled()` = `!research.active && isLevel6() && isGraspStyleMode()
     && (level6AutoPlaceEnabled() || isLevel6RealToolTask()) && !level6AnyItemHeld()`.
   - Shared poller `level6ArriveArmPoll(ctl, best, now, canArm)` for `picker` / `carrier`; the foods
     engine (`updateGraspLogic`, peg laundry) has the same rule with `basicArrive*` globals.
2. `img/shop_cashier_bg.jpg` replaced by an AI-generated male cashier (same composition, 1280×720).
   Image swap only.

## Safety rules kept
- A hand parked CLOSED on an item never picks it up by itself: the dwell only arms while
  `!isGrasping`, and an arrival-prepared pick-up still requires a squeeze (`arriveArmed && !isGrasping`
  → no grasp timer). The v78 static-grasp rejection tests still pass.
- Placed flowers (`best.placed`) are excluded, so a closed hand lingering on the vase after an
  automatic placement does not re-grab the flower. Cards / mahjong placed items are already gone.
- The dwell only advances while really in contact (`directContact`), not during the 700 ms contact
  grace after drifting off, so an item never jumps to a hand that has left it.
- Release rules while holding (v119 relaxed-hand release, v128 relative release, v129 auto-place,
  v130 idle reopen) are untouched; chopsticks (`gameType:'dwell'`), cooking, Level 5 and research mode
  are excluded by the gate.
- `numHands:2`, confidences 0.20/0.18/0.18, `runningMode:'VIDEO'`, `PUBLIC_GAME_WORK_INTERVAL_MS`,
  `PUBLIC_CANVAS_MAX_EDGE` unchanged. Disclaimer unchanged: the page does not identify equipment
  and does not measure grip or pinch force.
- No new network, storage, camera or permission code. The new image is a static asset served like
  the previous one (no EXIF / embedded metadata of concern: generated file, re-encoded JPEG).

## Privacy / content
- No research / pilot wording added; `window.__qa` stripped from `dist/public`
  (`rg -c "__qa" dist/public/index.html` → 0; `rg -c "research|pilot"` → 0).

## Validation
- Full Node suite (two groups), 687 pass / 0 fail, including new `tests/v136-arrival-arms-pickup.test.mjs`
  and updated v129 reset-pattern assertions; marker tests bumped.
- `tools/checkjs.sh`, `node --check service-worker.js`, `git diff --check` clean; `./scripts/build-dist.sh`.
- Playwright QA (laptop 1413×653 and iPad portrait): peg half-open 0.4 s → no halo; 0.9 s → halo +
  armed; squeeze → picked up; flowers / cards parked closed → not picked up; cashier scenes.
  Contact sheet `ych_rehab_qa_artifacts/v136/v136-qa-contact-sheet.png`.

## Residual
- A participant whose hand never leaves the "squeezing" state (fingers cannot relax the peg at all)
  still cannot pick up — the same as before; arming requires at least a small relaxation.
- The 700 ms dwell is a fixed constant; if therapists report it as too slow or too quick it can be
  tuned without touching detection.
