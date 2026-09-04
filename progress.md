# 上肢功能復康訓練 · 多活動遊戲 — 開發記錄

Original prompt: Fix Level 6–7 interactions: make light clothes-peg press detection easier without claiming tool/force sensing; keep bare three-finger pinch held through transport until a stabilized reopen; enlarge Level 6–7 dim sum and steamers 1.5× without collisions; and make Home/Back/Stop safely return to level selection.

## 2026-09-01 v78 release-blocker repair
- Replaced the Level 5 dim-sum public spawn positions with deterministic responsive slot/radius geometry. Portrait uses one centred upper-lower-half source plus two lower sources; landscape uses three lower-row sources. Radius is maximised subject to canvas edges, the complete lower-half boundary and a 12–24 px responsive visible gap, preserving large patient-facing images.
- Five browser geometry regressions now cover **390×844, 820×1180, 768×1024, 320×568 and 1180×820**. Every size has exactly **3** source objects and **2** steamers; all complete source circles are below the midpoint, all complete steamers are above it, every source is in bounds, and the measured minimum pairwise gaps are respectively **15.6, 20.5, 19.2, 12.0 and 20.5 px** with deterministic restart geometry.
- Added a deterministic public-build sanitizer. Complete research setup/results/protocol/export modules are removed with `PUBLIC_BUILD_REMOVE` regions; the shared script is specialized with research mode fixed off and whole-program dead-code elimination. A checksum-pinned Terser 5.44.0 bundle is vendored for reproducible offline builds.
- `scripts/build-dist.sh` now sanitizes both `index.html` and research-only localization, then fails closed on residual research/pilot DOM, state, constants, functions, handlers, exports, protocol copy or hidden/direct routes anywhere in `dist/public`. The final build contains **189 files (88M)**; whole-dist static audits found **0** research/pilot/protocol-copy and **0** forbidden DOM/state/handler/export/route matches.
- A browser isolation probe loaded `dist/public/index.html` with intervention/autostart/participant query parameters plus `#research`, dispatched load/history/hash activation events and attempted to reveal/click matching hidden nodes. No research DOM/global or calibration route existed, while Level 5 navigation and the retained rest, stop and safety-pause controls remained functional (**4/4 isolation tests passed**).
- Final validation: complete Node suite **441 total / 438 passed / 0 failed / 3 intentional skips**; Level 2–6 technical validator **168/168**; all source inline blocks, sanitizer, test modules and rebuilt-public JavaScript parsed; `git diff --check` passed.
- Fresh, visually inspected initial-state previews for **820×1180**, **768×1024** and **1180×820**, five-size geometry JSON, browser/static/build/syntax/test logs and technical-validator results are stored outside the repository at `/home/user/workspace/v78_blocker_fix_evidence_20260901/`. No deployment, commit or push was performed.

## 2026-09-01 v76 Level 5–6 patient visual cues
- Bedside feedback identified three barriers in Levels 5–6: the play objects were still too small, the top of the screen contained too many competing words, and the abstract circle did not clearly show when to grasp or release.
- Public Level 5–6 gameplay now uses one large high-contrast action cue. The top rule strip, verbose canvas order banners and non-essential score counters are hidden during play; only the timer remains at the lower left. Advanced activity buttons remain available without their multi-line instruction panel.
- The tracked cursor now shows a large `✋` when the patient should keep the hand open and a large `✊` when the hand should close or keep holding. A short Traditional Chinese action phrase is always shown with the emoji, so meaning never depends on the platform-specific emoji alone.
- Standard Level 5 objects are enlarged from a 1.18× to 1.36× public-mode boost. Standard Level 6 objects and Level 5–6 targets gain a further 1.16× boost; the wide three-item cloth-peg layout uses a collision-safe 1.10× boost and wider fixed slots. Cooking props, mahjong tiles and flower-palette items are also enlarged.
- Gesture meaning is classified from the fixed internal action key before language translation, so English open/waiting prompts keep the correct `✋` cue. The large canvas hands and all advanced-layout enlargements are explicitly public-only; research sessions retain their pre-v76 cursor and geometry.
- Interaction thresholds, affected-hand-only admission, fresh-frame checks, open-before-close arming, stabilized release dwell and Level 6 dual-digit reopen requirements are unchanged.
- Final automated validation: full suite **394 total / 391 passed / 0 failed / 3 intentional skips**; focused Level 6 plus v76 suite **52/52**, including direct English-browser cue verification; technical validator **168/168**; JavaScript syntax and `git diff --check` passed.
- iPad visual QA passed at **820×1180 portrait** and **1180×820 landscape** for Level 5 fridge and Level 6 cloth-peg laundry. All four views had one visible HUD item, no prompt/control overlap, no item overlap and no horizontal overflow.
- `dist/public` was rebuilt with **185 files (87M)** and aligned v76 app, manifest and service-worker markers. The callable `window.__qa` block is absent from production; no external URL is present.
- Independent release security review returned **SHIP** with no Critical, High, Medium, or release-blocking Low findings.

## 2026-08-28 v66 Level 6 calibration fresh-frame repair
- Reproduced the bedside symptom from the supplied iPhone recording: the selected hand is clearly visible in the calibration camera, but all three checks remain incomplete and the status stays `尚未偵測`.
- Confirmed two linked v65 regressions. First, `detectWrist(videoEl, frame)` became fail-closed for stale or missing frame authority while `startCalibLoop()` still called it without the current decoded-frame status. Second, the legacy `isGrossTabletop()` route initialized Pose instead of Hand Landmarker for normal Level 6. Either defect kept a clearly visible hand permanently at `尚未偵測`.
- The calibration loop now polls `level4FrameStatus(video)` once per animation iteration and passes that exact fresh-frame result into every hand-detection path. Normal Level 6 is excluded from the Pose-only model-loading branch and initializes Hand Landmarker before calibration. Camera startup also starts/rebinds the freshness monitor for the calibration video and for a reused stream.
- Preserved selected-affected-hand admission, two-hand handedness filtering, low-confidence rejection, fresh-generation safeguards, all-six tripod-pinch interaction, no shoulder/elbow dependency, and one camera-permission request per page session.
- Added focused regressions for calibration frame propagation, decoded-frame startup, and calibration-to-game stream reuse. Version markers are aligned to `v66-20260828-level6-calibration-fresh-frame`.
- Final validation passed: complete Node suite **273 total / 270 passed / 0 failed / 3 intentional skips**; focused Level 6/camera/tracking suite **81/81**; technical validator **165/165** including Level 6 **46/46**; embedded/module JavaScript syntax, `git diff --check`, production marker alignment and QA-hook exclusion all passed. `dist/public` was rebuilt with **134 files (83M)**.
- Rebuilt-production iPad visual QA passed at **820×1180 portrait** and **1180×820 landscape**. The exact six-card Level 6 catalog, selected task lock, hidden angle panel, absent duplicate picker/difficulty labels, no horizontal overflow and no console/page errors were confirmed and the screenshots were visually inspected.
- Independent release security/privacy review returned **PASS with no BLOCK or WARN findings**. The official GitHub Pages `gh-pages` branch was updated at commit `dba38d0`, and the live URL was verified to serve v66 in Traditional Chinese with the correct six Level 6 activities.
- Remaining limitation: automated landmark tests and layout verification do not replace supervised bedside testing of real affected-hand visibility, tripod aperture, tool occlusion, ward lighting and handedness confidence on the target iPad.

## 2026-08-28 v65 all Level 6 games use tripod pinch
- Changed all six normal-flow Level 6 activities (`flowers`, `chopstick_dimsum`, `peg_laundry`, `cards`, `mahjong`, `cooking`) to `gameType:'pinch'`. The selected affected hand and fresh Hand Landmarker generation now exclusively control open preparation, pickup, hand-position transport and release. Pose/shoulder/elbow state cannot arm, move, gate or score a Level 6 task; the pilot research tool-mode routing remains unchanged.
- Unified chopstick and cloth-peg interaction with the same normalized thumb–index/thumb–middle tripod aperture. The detector accepts either two moderately closed digits or one clearly closed plus one moderately close digit, preserves close/reopen hysteresis and personalized calibration, and requires a stabilized open observation before a sustained light closure. Both digits must visibly reopen for release.
- Normal Level 6 rejects stale/repeated generations, missing/partial landmarks, missing or low-confidence handedness, and the wrong anatomical side. Invalid frames clear partial pickup/release dwell and never receive the detector-loss grace used by easier levels.
- Replaced normal Level 6 shoulder/index-middle-flexion wording with concise Chinese/English tripod-pinch wording. The six catalog cards remain the only task picker; legacy `dimsum`/`laundry`, the duplicate setup picker and difficulty labels remain absent.
- Added deterministic all-six-task coverage for `gameType:'pinch'`, open-before-close, asymmetric light closure, static-close rejection, fresh-generation admission, wrong/missing/uncertain hand rejection, hand-position transport with missing shoulder/elbow/wrist pose, and stabilized reopen release. Corrected the two-target landscape spacing exposed when every task adopted the pinch sizing profile.
- Version markers are aligned to `v65-20260828-level6-tripod-pinch-all-games`; `dist/public` was rebuilt with **134 files (83M)**.
- Final validation: focused Level 6 suite **44/44**; full Node suite **271 total / 268 passed / 0 failed / 3 intentional skips**; technical validator **165/165** (Level 6 **46/46**); all `tools/checkjs.sh` blocks, `git diff --check`, build and source/dist version assertions passed.
- Practical Playwright QA passed at **820×1180 portrait** and **1180×820 landscape**: exact six-card catalog, all-six setup copy free of shoulder/elbow instructions, no duplicate picker/angle panel/difficulty labels, asymmetric light pickup, missing-pose hand transport and reopen scoring, no horizontal overflow, and no console/page errors. Screenshots and JSON evidence are in `/home/user/workspace/ych_rehab_qa_artifacts/v65-level6-tripod-pinch-all-games/`.
- Limitation: automated camera inputs are deterministic synthetic Hand Landmarker frames. Real iPad lighting, occlusion, handedness confidence and an individual stroke participant’s available aperture still require supervised bedside confirmation before release.

## 2026-08-27 v64 Level 6 duplicate task picker removed
- Removed the complete Level 6 setup `任務 / Task` card, including its selected summary, six task buttons, task description, and therapist-details subsection. The six Level 6 activity-library cards remain the sole public task-selection surface in Traditional Chinese and English.
- Added an explicit activity-library lock (`level6LockedTheme`) that binds the selected Level 6 theme and task before setup and reasserts the pair before calibration and gameplay. Affected-side and other setup controls cannot rewrite it; returning from calibration or the library and re-entering the same card preserves it.
- Kept all six Level 6 games and their existing interaction engines, selected-hand tracking, fixed internal shoulder endpoint, and the separate research tool-mode path unchanged. QA-only selection/screen helpers remain inside the stripped `window.__qa` block.
- Added normal-card regressions for every Level 6 activity in both languages, including matching setup title/instructions, absent duplicate picker, affected-side persistence, calibration back flow, library back/re-entry, and same-task game launch. Extended the technical validator with the six locked-library flows.
- App, manifest, and service-worker identifiers are aligned to `v64-20260827-level6-no-duplicate-task-picker`.
- Final validation: focused Level 6 suite **36/36**; full Node suite **263 total / 260 passed / 0 failed / 3 intentional skips**; source technical validator **157/157** (Level 6 **38/38**); all inline/module syntax checks and `git diff --check` passed. `dist/public` was rebuilt with **134 files (83M)** and contains no duplicate picker markup or QA/runtime test hooks.
- Rebuilt-public Playwright QA passed all **24/24** Level 6 card/language/viewport flows at **820×1180 portrait** and **1180×820 landscape**, with no console/page errors or horizontal overflow. The affected-side and library back/re-entry checks kept the selected title unchanged; screenshots were visually inspected and showed the compact setup with no task-selector card. Evidence is under `/home/user/workspace/ych_rehab_qa_artifacts/v64-level6-no-duplicate-task-picker/`.

## 2026-08-26 v58 Level 2 original horizontal table-wiping lane
- Restored the original dim-sum table-wiping screen logic for Level 2: one object starts at the patient's midline, moves horizontally toward the selected affected side, and returns to midline to re-arm.
- Replaced the incorrect vertical dashed lane and upward arrow with a horizontal lane and side-specific arrow: right affected side points right; left affected side points left.
- The guide, object path, and target now share one geometry helper so their positions cannot drift apart.
- Added regression coverage for horizontal direction and guide/object/target alignment.

## 2026-08-26 v56 Level 2 shoulder horizontal abduction only
- Level 2 now exposes exactly one activity: the selected affected forearm remains supported on the tabletop, moves from midline outward toward the affected side through shoulder horizontal abduction, then returns to midline to re-arm.
- Added `level2-horizontal-abduction-controller.js`. Progress uses aspect-corrected selected wrist and elbow displacement relative to the shoulder-centred outward torso axis and shoulder span. Elbow displacement is permissive upper-limb confirmation only; elbow angle never controls progress.
- The controller fails closed for missing selected shoulder/elbow/wrist or torso landmarks, meaningful torso translation/lean, incoherent wrist-only/forearm-only or elbow-only movement, duplicate/stale/out-of-order generations, and unavailable module state. It never substitutes the unaffected arm/hand or a therapist hand; display mirroring does not alter anatomical selection.
- Level 2 availability, all fallbacks and QA launch paths are locked to `bilateral`. Pickup, grasp/release, forward reach, circle, second-hand and legacy elbow-calibration dependencies were removed from Level 2 copy, scoring, HUD, results and localization. Scoring uses `correctCount` repetitions with outward-once/return-rearm hysteresis.
- Level 2 no longer invokes or displays the legacy flexed/extended elbow calibration and is excluded from elbow-calibration adaptive invalidation. Levels 3–7 and standalone legacy module code remain intact.
- Camera permission remains enabled. One active stream and the promise-cached Hand/Pose models are reused across screens, levels and games in the same page session; navigation suspends frame admission without stopping tracks. The single page-session camera request still begins from the explicit participant gesture, and hardware is released only on non-bfcache page teardown.
- App, manifest and service-worker identifiers are aligned at `v57-20260826-level2-horizontal-abduction-clean-ui`; `dist/public` was rebuilt with **134 files (83M)** and includes the new controller in the offline inventory.
- Validation: focused camera/Level 2/browser suite **35/35**; deterministic Level 2 matrix **11/11**; full Node suite **226 total / 223 passed / 0 failed / 3 intentional skips**; embedded JavaScript and module syntax checks passed; source technical validator **142/142** (Level 2 **37/37**); `git diff --check` passed. The production dist intentionally removes `window.__qa`, so that browser validator is unsupported against dist; dist marker, asset, offline-inventory and QA-exclusion checks passed. Physical iPad camera/framing and bedside clinical movement remain required.
- Final release QA confirmed the single Level 2 game and concise setup at **1180×820 landscape** and **820×1180 portrait**, with no elbow calibration, pickup/grasp/release, circular-path or timing controls, no horizontal overflow and no console/page errors. Security review found **0 BLOCK** issues. The verified v57 distribution was published to the official HTTPS GitHub Pages site from commit `17cce74`.

## 2026-08-26 v55 Level 2 outward shoulder horizontal abduction
- Confirmed the easier Level 2 activity matches the supplied bedside example: the forearm remains supported and slides from midline outward toward the affected side, then returns to midline.
- The selected affected wrist directly drives one large dim-sum object. No virtual pickup, grasp, release or dwell gate is used.
- Level 2 remains limited to two non-duplicated graded activities: easier outward shoulder horizontal abduction, and harder supported forward reach followed by horizontal abduction/adduction circles.
- App, manifest and service-worker identifiers are aligned at `v55-20260826-level2-outward-abduction`.
- Focused Level 2/tracking/adaptive tests passed **57/57**; the full Node suite and embedded JavaScript checks passed. Source technical validation passed **202/202** (Level 2: **97/97**). iPad landscape and portrait QA showed both cards, loaded images and no horizontal overflow.

## 2026-08-26 v54 Level 2 simplified to two graded games
- Reduced the Level 2 library to two non-duplicated supported activities only.
- Easier: tabletop shoulder horizontal abduction/adduction from midline toward the affected side and back.
- Harder: supported forward shoulder flexion with elbow extension, followed by shoulder horizontal abduction/adduction in a circular path.
- Reused the existing selected-affected-arm-only tracking and ordered path safeguards; removed the visible Level 2 show/hide and auto-rotation picker.
- App, manifest and service-worker identifiers are aligned at `v54-20260826-level2-two-graded-games`.

## 2026-08-26 v53 Level 2 shoulder horizontal flexion/extension restored
- Restored the first Level 2 supported game’s patient-facing name as 「肩水平屈曲／伸展」 instead of the ambiguous internal legacy label 「雙手患側外滑」.
- Clarified the movement sequence: supported outward slide toward the affected side = shoulder horizontal extension; return to midline = shoulder horizontal flexion.
- The game remains the first independent Level 2 activity and continues to track only the selected affected wrist while allowing the unaffected hand to assist.
- Added a regression test that locks the visible picker label, theme title, movement wording and first-position registration.
- App, manifest and service-worker identifiers are aligned at `v53-20260826-level2-horizontal-flexion-extension`.

## 2026-08-26 v52 Level 5 right-hand label correction
- Fixed the v51 selected-side-only regression that rejected the anatomical right hand. Current MediaPipe Tasks Hand Landmarker labels the raw unmirrored decoded camera frame anatomically; v51 incorrectly applied the legacy MediaPipe Hands swap a second time.
- CSS `scaleX(-1)` remains presentation-only and cannot change side selection. The conversion now swaps only when inference pixels are explicitly mirrored.
- Level 5 still requests two candidates and fails closed when handedness is missing or only the opposite hand is present; candidate zero, the unaffected hand and a therapist hand are never fallbacks.
- Deterministic tests cover selected right and left hands for unmirrored and actually mirrored inference inputs, plus missing/opposite-only rejection.
- App, manifest, and service-worker identifiers are aligned at `v52-20260826-right-hand-label-fix`.

## 2026-08-26 v50 fixed zero-degree start
- Level 3 and Level 4 now use the participant-specific calibrated 0° position as the only start and return position for every object and repetition. The previous 10°/20° randomized starts were removed from controller logic, setup details, rules and English localization.
- Target choices are unchanged: Level 3 remains 30°/40°/50°/60° and Level 4 remains 60°–180° in 10° increments. Automatic baseline calibration, target hold, selected-arm-only tracking and scoring-after-return remain unchanged.
- App, manifest and service-worker markers are aligned to `v50-20260826-zero-degree-start`.

## 2026-08-26 v49 offline clinical release
- Public/offline packaging now removes the Research Mode button and backend placeholder code and excludes all research, diagnostic sandbox, QA, test, archive and secret/config paths.
- The deterministic build makes every release file readable and generates a complete same-origin service-worker inventory. The v49 app, manifest and cache markers are aligned to `v49-20260826-offline-release`.
- Full Node suite passed **205 total / 202 passed / 0 failed / 3 intentional skips**. Source and rebuilt-public Level 2–7 technical validation each passed **211/211**. Embedded JavaScript checks and `git diff --check` passed.
- Offline audit passed: **133 public files**, zero external URL dependencies, zero research/backend markers, zero sandbox directories, zero unreadable files, and all **132** pre-existing static assets represented exactly once in the generated offline inventory.
- Tablet browser QA at **1180×820** confirmed no horizontal overflow, no broken images and no Research Mode entry. After service-worker takeover, all **133** requests were cached and the v49 page reloaded successfully under simulated offline mode with no console/page errors.
- A clean downloadable ZIP was created from `dist/public` only, with a Traditional Chinese offline-use guide. The archive contains **134 files**, passed `unzip -t`, and contains no forbidden public paths. Physical tablet camera tracking and first-install timing still require bedside verification.

## 2026-08-25 v48 in-memory language switch and Level 3–4 paired demonstrations
- Added one fixed, accessible globe menu with 「繁體中文」 and “English”. Every load starts in Traditional Chinese; the selection stays in memory only and is never written to browser storage.
- Added document, dynamic DOM, accessibility-attribute, canvas-label and speech localization. The existing research language renderer now follows the same global selection. Chinese mode removes routine duplicate English lines; English mode renders English interface copy and selects an English speech voice where available.
- Replaced each Level 3 and Level 4 card’s single GIF with two deterministic animated SVG demonstrations: active shoulder flexion with one cup on the left, and active-assisted shoulder flexion with both hands on a yellow flexible resistance bar on the right. The Level 3 pair depicts the 30–60° range and the Level 4 pair depicts movement from 60° or above; the fixed patient/body geometry contains no therapist or unrelated people.
- Source identifiers are aligned to `v48-20260825-language-demos`; `dist/public` was rebuilt with **140 files (84M)**.
- Final validation passed: focused language/demonstration/layout suite **49/49**; full Node suite **205 total / 202 passed / 0 failed / 3 intentional skips**; source and rebuilt-public technical validation **211/211 each**; JavaScript syntax, all **10** `tools/checkjs.sh` blocks, source/dist markers/assets and `git diff --check` passed.
- Tablet browser QA passed **17/17** checks at **820×1180 portrait** and **1180×820 landscape**, with no console/page errors or horizontal overflow. It covered the default/reset language, menu state and Escape path, exact locale labels, paired demo order/loading, English-only setup/game surfaces, target-hold selection and no globe/game-control overlap. Screenshots and reports are under `/home/user/workspace/ych_rehab_qa_artifacts/v48-language-demos/`.
- Visual review confirmed clean, fixed-camera patient figures, one-cup active and yellow-bar bilateral active-assisted movements, consistent proportions across sampled animation frames, readable labels and side-by-side layout. Physical iPad camera, microphone/speaker/TTS voice availability and bedside movement/occlusion still require device testing.

## 2026-08-25 v47 Level 3–4 target hold and concise patient UI
- Added a distinct Level 3–4 target-hold setting with exactly 「不用保持」 and 1–5 seconds; legacy object dwell remains available only to other levels. Fixed the CSS hidden-state and selected `aria-pressed` state after iPad QA exposed both timing rows.
- Reaching the prescribed shoulder target now gives an immediate large green check and positive sound, then (when hold is enabled) a large centred grey 5→1 countdown with Cantonese hold/count voice cues. Dropping below tolerance or receiving stale/invalid frames cannot advance hold; a drop resets/restarts it. Repetitions still score only after the required return.
- Removed the centre degree badge, retained the large left live readout, compacted the patient panel below the HUD, and moved iPad-portrait controls below the timer. Patient-facing setup, calibration, safety and game copy is substantially shorter; pain/discomfort reminders were removed from patient UI while internal safety and researcher/therapist detail remain.
- Aligned app, manifest and service-worker identifiers to `v47-20260825-target-hold-concise-ui`; rebuilt `dist/public` (135 files, 84M).
- Validation passed: focused final suite **43/43**; full Node suite **199 total / 196 passed / 0 failed / 3 intentional skips**; source and rebuilt-dist technical validation **211/211 each**; syntax, `tools/checkjs.sh`, source/dist markers and `git diff --check` passed.
- Browser QA passed at **1180×820 landscape** and **820×1180 portrait** with exact hold choices, real selection state, centred countdown, unobscured timer, contained left panel, no centre degree badge, no horizontal overflow and no console/page errors. Evidence is outside the repository at `/home/user/workspace/ych_rehab_qa_artifacts/v47-target-hold-concise/`. Synthetic camera/audio QA cannot replace bedside verification of real iPad camera tracking, speaker/TTS behaviour, lighting, occlusion or clinical movement tolerance.

## 2026-08-25 Level 3–4 relative shoulder start/end repair
- Repaired the failure reproduced in three tablet recordings: a camera/world arm-down reading near 25° is now captured automatically as the participant's camera zero instead of being compared directly with the displayed 0°/10°/20° object start.
- Shoulder gameplay uses one consistent selected-arm image-plane signal relative to that baseline. MediaPipe world angle remains diagnostic only, preventing unstable 116°–131° estimates from prematurely completing a target.
- Endpoint detection now uses normalized fresh-frame gates (86% outward, participant-specific return window) and latches a reached endpoint during target dwell. No therapist confirmation button is required.
- Whole-patient translation no longer triggers `torso-moved/person-changed`; torso continuity uses translation-invariant torso shape. A sustained shoulder-landmark rise is reported for therapist review without freezing valid shoulder elevation.
- Selected anatomical affected-arm indices, display-only mirroring, no opposite-arm fallback, stale-frame blocking and assisted-stick behavior are preserved. Level 3–4 now use direct shoulder-flexion control with a continuously moving large object, visible camera-estimated degrees, and no virtual grasp/release gate. Build/cache/manifest identifiers are aligned to `v45-20260825-live-shoulder-angle`.
- Controller hardening locks the selected side on the first admitted fresh frame (or the configured side), rejects any later side mismatch without switching arms, and rejects duplicate or older frame generations so replayed frames cannot accumulate target dwell credit.
- Final validation: full Node suite **190 total / 187 passed / 0 failed / 3 intentional skips**; focused shoulder/assisted/tracking suite **50/50**; source and rebuilt-public technical validation **211/211**; JavaScript syntax, `tools/checkjs.sh`, build and `git diff --check` passed. iPad landscape (1180×820) and portrait (820×1180) browser QA showed no page errors or horizontal overflow. Physical bedside testing remains required because browser/synthetic validation cannot establish medical-grade ROM accuracy.

## 2026-08-25 Level 3–4 patient-and-therapist GIFs
- Replaced the simplified geometric figures on the Level 3 and Level 4 cards with fictional detailed clinical illustrations matching the Level 2 visual language: an older seated patient and a female occupational therapist supervising from behind.
- Level 3 demonstrates unsupported forward shoulder flexion within 0°–60°. Level 4 demonstrates 0°–180°. The therapist remains hands-off and does not obscure the affected arm.
- Retained concise degree badges and the existing clinical target logic. Build/cache/manifest identifiers are aligned to `v43-20260825-patient-therapist-gifs`.
- Final focused regression suite passed 35/35; the full suite passed 182/185 with 3 intentional skips and 0 failures. Rebuilt-dist technical validation passed 211/211.
- Chrome tablet visual QA passed at 820×1180 portrait and 1180×820 landscape. Both GIFs loaded at 720×405, their moving frames showed shoulder elevation with both patient and therapist visible, and no horizontal overflow or card clipping was found.
- The rebuilt `dist/public` preview was redeployed for tablet testing.

## 2026-08-25 Concise assisted-stick labels
- Shortened the Level 3–4 patient-facing choices to 「主動 / Active」 and 「雙手持 1 磅棍（主動輔助） / Both hands: 1 lb stick (active-assisted)」, with one short selected-mode instruction only.
- Moved the longer selected-affected-arm-only tracking caveat into the existing camera setup/calibration guidance. Tracking logic and target ranges are unchanged.
- Build/cache/manifest identifiers are aligned to `v42-20260825-concise-stick-mode`.
- Focused tests passed 16/16; full Node suite passed 182/185 with 3 existing skips; source and rebuilt-dist technical validation each passed 211/211; build produced 133 files (80M); syntax and diff checks passed.

## 2026-08-25 Level 3–4 active-assisted stick mode
- Level 3 and Level 4 setup now offer two explicit bilingual choices: affected-arm active shoulder flexion, or active-assisted shoulder flexion with both hands holding a 1 lb stick. The choice is unavailable at all other levels.
- The selected mode persists from setup through calibration, rules and gameplay, then resets to the conservative active default when a new level/session or Home reset begins. Existing target choices remain unchanged: Level 3 30°/40°/50°/60°; Level 4 60°–180° in 10° steps.
- Assisted mode does not alter tracking identity: controller admission ignores arbitrary arm overrides and continues to use only the therapist-selected anatomical affected shoulder/elbow chain. The unaffected hand is assistance only and is explicitly reported as `unaffectedHandFallback:false`.
- Setup, calibration, spoken trial/training instructions, `render_game_to_text`, controller snapshots and QA state expose the movement mode and selected-arm-only invariant. Copy retains the camera-estimate/not-automatic-FTHUE boundaries.
- Added `tests/assisted-stick-mode.test.mjs` with 6 deterministic regressions for availability, state, wording, selected-arm-only tracking, persistence/reset and preserved targets. Focused tests passed 16/16; full Node suite passed 182/185 with 3 existing skips and 0 failures.
- `tools/checkjs.sh`, `git diff --check` and `scripts/build-dist.sh` passed; final build contains 133 files (80M). Final source and rebuilt-dist technical validation each passed 211/211 (L2 106, L3 20, L4 20, L5 40, L6 25). Build/cache/manifest identifiers are aligned to `v41-20260825-assisted-stick-mode`.
- Browser QA at 1180×820 confirmed the Level 4 assisted choice, selected styling, bilingual tracking warning and no horizontal overflow. Limitation: software tests use synthetic pose/browser inputs; bedside verification is still required for stick handling, occlusion, camera angle, lighting and the participant’s actual movement.

## 2026-08-25 Geometric shoulder-flexion GIF correction
- Replaced the approximate Level 3 and Level 4 pose illustrations with deterministic side-view GIFs generated from a fixed shoulder pivot and explicit shoulder-flexion geometry.
- The visual convention is now clinically legible: 0° is the upper arm vertically beside the trunk, 90° is forward horizontal, and 180° is overhead.
- Level 3 cycles through 0°, 30°, 40°, 50° and 60° and returns to 0°. Level 4 demonstrates 0°, 60°, 90°, 120°, 150° and 180° and returns to 0°.
- The generator is retained at `tools/generate_shoulder_flexion_gifs.py` so the diagrams can be reproduced without AI pose variation.
- Build/cache/manifest identifiers are aligned to `v40-20260825-geometric-shoulder-flexion-gifs`.

## 2026-08-25 Level 2 supported illustration and Level 3 30–60° correction
- The forearm-skateboard illustration is now used only on the FTHUE Level 2 card because the affected forearm is strapped and supported on the tabletop.
- Level 3 now offers 30°, 40°, 50° and 60° camera-estimated shoulder-flexion targets, while preserving deterministic object starts of 0°, 10° or 20°.
- Level 3 and Level 4 use separate illustrations showing the affected arm unsupported and away from the table. Level 4 remains 60°–180° in 10° increments.
- Build/cache/manifest identifiers are aligned to `v39-20260825-level2-supported-level3-30-60`.
- Final source and rebuilt-public technical validation each passed **211/211** (Level 2: 106; Level 3: 20; Level 4: 20; Level 5: 40; Level 6: 25).
- Chrome tablet QA passed at 820×1180 portrait and 1180×820 landscape. Level 2 displayed only the supported forearm-skateboard illustration; Level 3 displayed the unsupported shoulder-flexion illustration and exactly 30°/40°/50°/60° target controls; no browser errors or horizontal overflow were observed.
- The rebuilt `dist/public` preview was redeployed for office-tablet testing.

## 2026-08-21 Chrome tablet update takeover
- **原因**：公開網站已是 v29，但長時間開啟的 Chrome 分頁不會因新 service worker 完成安裝而自動重新載入，所以畫面可繼續執行記憶體內的舊 JavaScript。
- **修正**：頁面現在監聽 `controllerchange`，新 worker 接管後只自動重新載入一次；分頁由背景返回前景或經 back-forward cache 恢復時，亦主動執行更新檢查。
- **強制辨識新 worker**：註冊 URL 加入 v30 build query，並保持 `updateViaCache:"none"`；service-worker cache 升至 `fthue-rehab-v30-20260821-chrome-update-takeover`。

## 2026-08-19 Level 4 巴士拍卡示範動作更新
- 巴士拍卡設定頁及主題卡改用新的合成實景 GIF，清楚示範「屈肘下方起點 → 向前伸肘 → 保持伸肘向外畫弧 → 對準讀卡器拍卡」。
- 最終 GIF 已裁走頭面，只保留肩以下動作、卡及無品牌讀卡器；alt text 明確標示為合成實景示範，不會當作真人臨床證據。

## 2026-08-19 Level 4 即時保齡出波及 45° 外展弧線修正
- **保齡球即時出波**：完成個人化伸肘終點後，只要共享平滑進度出現明確屈肘反向（較 peak 回落至少 0.08，並持續向下），立即釋放保齡球；不再等待幾乎完全返回屈肘起點。細小 endpoint 抖動仍不會誤出波，原有 `returnReady` 保留作後備。
- **外展保持伸肘**：抹窗、洗麻雀及巴士拍卡在外展階段，以個人化 2D 手肘關節角作主要保持訊號。45° 鏡頭下會隨肩外展明顯變形的 `spanRatio/worldSpan` 只在肘角未能於校準中分離時作後備，不再以最差投影訊號錯誤否定有效外展。
- **較短外展幅度**：外展弧線的參與者化最低 scale 由 0.30 調至 0.18、啟動門檻由 0.35 調至 0.28，配合獨立 deadband；同時延長 arc hold 上限，讓慢速 supported tabletop 大圈不會中途失效。
- **回歸保障**：新增「world projection 失真但肘角仍伸直」及「明確開始屈肘即出波」兩項 deterministic tests；cache 更新至 `fthue-rehab-v24-20260819-level4-live-arc-release`。

## 2026-08-19 Level 4 抗抖動、有序弧線相位及遊戲玩法升級
- **訊號 A（伸手／reach）**：在兩姿勢校準的融合進度之上加入抗抖動處理 — 每個訊號 5 格滾動中位數、以校準幅度為基準的離群格拒收、死區、方向確認、隨幅度自適應 EMA、每格最大變化限制，以及屈肘 0／伸直 1 兩端的吸附。反應速度保留：一次順暢伸手（20 格）仍可達到 0.8 以上，快速反向亦即時跟隨。
- **訊號 B（肩外展／弧線）**：新增獨立的側向訊號 `lateral`，以患側方向鏡像計算（右患側向右為外、左患側鏡像），完全不進入 reach 融合，因此畫弧不會令點心物件左右滑動或抖動。弧線期間 reach 會被凍結（`arc-hold`），避免手臂投影變形被誤判為屈肘回收。
- **最終遊戲分類**：直線屈伸 = 茶樓點心、保齡球；先伸直再肩外展畫弧 = 抹窗、洗麻雀、巴士拍卡。三個路徑遊戲共用 `level4PathGateOpen` / `level4MotionPathReady`：必須先達到參與者自己的校準伸直終點，之後才計算方向正確的弧線訊號。
- **有序循環（Category 2）**：屈肘起點 → 伸直至個人終點 → 保持伸直下向外畫弧 → 沿弧線返回 → 屈肘回起點；`cyclePhase / cycleOrdered / cycleCount` 反映次序。若弧線期間手肘明顯屈曲（保留度低於個人校準幅度的 0.45），側向計分會暫停並歸零（`arc-paused-elbow-flexed`），不會誤給分。不要求解剖學上完全伸直。
- **保齡球玩法**：真實感球道透視、會旋轉的保齡球沿球道滾動；撞瓶後以確定性 2D 物理令球瓶倒下及散開，settle 後自動重排。出球仍然必須完成穩定化的「伸直 → 屈肘收手」循環。
- **巴士拍卡**：巴士車廂場景（車窗、吊環扶手、座椅、黃色扶手）加通用非品牌拍卡機（畫面顯示「請拍卡 TAP」／「已付款 PAID」）；有效拍卡時以 Web Audio 播放單一「嘟」聲並顯示簡短成功提示。音效在使用者互動時解鎖，不可用時靜默降級但仍計分。每次有效拍卡只響一次，需回到屈肘起點才重新武裝。
- **示範 GIF**：`img/advanced/level4_bowling_illustrated.gif`、`level4_buspay_illustrated.gif`、`level4_mahjongwash_illustrated.gif` 依遊戲對應顯示（抹窗及點心維持原有 Level 4 前滑 GIF），以精簡 inline figure 顯示於設定頁，不覆蓋遊戲畫面，並隨 `img/` 一併打包及離線預快取。三個新素材均由 PIL 繪圖指令產生，不含真人影像。
- **測試**：`tests/level4-stabilization-arc.test.mjs`（11 項：靜止抖動、單格 landmark 跳動、順暢伸屈不延遲、快速反向、右患側 45° 完整循環、左患側鏡像、弧線期間屈肘暫停、無伸直的純外展不計分、debug 文字、遊戲分類）及 `tests/level4-games-behavior.test.mjs`（7 項：球到瓶及倒瓶狀態、物理可重現、每次有效拍卡只一次「嘟」、無音效降級、GIF 對應與離線打包）。
- **驗證結果**：`tools/checkjs.sh` 全部 OK；`node --test tests/*.mjs` 107 項／104 通過／0 失敗／3 項為原有 skip；Level 4–6 技術驗證 **143/143**（L4 65、L5 40、L6 31），`runtime_errors: []`；`scripts/build-dist.sh` 產生 `dist/public` 119 files。
- **Cache**：service worker 升級至 `fthue-rehab-v22-20260819-level4-safe-gifs`。
- Level 3 及 Level 5–7 邏輯未改動，相關測試與驗證項目全部維持通過。

## 2026-08-19 Level 4 participant-specific two-pose elbow calibration

- **Two-pose capture:** Level 4 no longer infers elbow range from one frame or from lowered thresholds. `level4-elbow-calibration.js` runs an explicit staged capture — framing check, supported flexed/start capture (any available range, not a fixed 90°), then an extended/end capture — each from multiple stable median-filtered samples (`minStableSamples` 3, up to 12, stability window 5).
- **Signal fusion:** each endpoint stores five signals: normalized 2D elbow angle, 2D arm-span ratio `dist(shoulder,wrist)/(upperArm+forearm)`, MediaPipe world/3D span ratio, wrist-to-shoulder radial distance in shoulder-span units, and a depth signal from world Z or image Z. A signal is used only when the two endpoints separate it by at least its minimum (angle 12°, span 0.08, world span 0.08, radial 0.10, depth 0.06); its weight scales with the observed separation times a reliability prior, and supporting signals (radial, depth) are capped at 15% while any primary signal qualifies. Direction is learned from the endpoints, so a signal that decreases with extension still maps flexed to 0.
- **Normalized progress:** the fused value is normalized flexed endpoint = 0 to extended endpoint = 1 regardless of sign, with a 0.12 dead zone, exponential smoothing (alpha 0.55), and hysteresis (engage 0.20/0.06, reach 0.62/0.28, return 0.18, complete 0.94) that stays responsive on iPad.
- **No silent calibration:** if the two poses do not separate any signal, the controller enters a `retry` stage, names the signals that were too similar or unavailable, and shows concise Cantonese/English retry guidance instead of calibrating on noise. Holding only the start pose waits for the extended capture rather than failing.
- **Therapist fallback:** two compact buttons (`記錄屈肘起點 / Mark start`, `記錄伸直終點 / Mark end`) mark the current pose as either endpoint when automatic capture struggles. No extra safety page or verbose text was added.
- **One shared progress for all five games:** ordinary dim-sum transport keeps a fixed carry lane X and vertical Y; wipe-window, bowling, mahjong-wash and bus-pay keep their clinically coherent real-wrist mechanics but take their reach gate and return state from the same normalized progress. Elbow motion is never interpreted as horizontal movement.
- **Diagnostics:** the debug panel and `render_game_to_text` hook now expose calibration stage, raw signals, both endpoints, per-signal separation and selected weights, per-signal and fused progress, depth source, reason, and shoulder-hike warning.
- **Deterministic coverage:** `tests/level4-two-pose-calibration.test.mjs` adds 13 synthetic-pose tests, including a front-facing case where the 2D angle and 2D span are identical between the two poses and only the world/depth signals separate them, reversed signal direction, jitter, missing world landmarks, inadequate separation, manual fallback, shoulder hike, and the five game mappings.
- **Verification:** `bash tools/checkjs.sh` passed (blocks 0–5). `node --test tests/*.mjs` passed 86/89 with 3 pre-existing skips, 0 failures. Level 4–6 technical validation passed **142/142** (Level 4: 64, Level 5: 40, Level 6: 31) with no runtime or console errors. `bash scripts/build-dist.sh` produced `dist/public built: 116 files, 68M` including the new module in the offline precache manifest.
- **Cache:** service worker cache is `fthue-rehab-v20-20260819-level4-two-pose-calibration`.
- **Bedside caveat:** all of the above is synthetic-pose software verification. On the real iPad, confirm framing (device upright on the same table, ~1 m, affected-side front angle), that shoulder, elbow and wrist stay visible over the forearm skateboard, that the participant's available extension produces visible endpoint separation, and re-run calibration if the seating, camera angle or lighting changes. No real-person QA media was created.

## 2026-08-19 Level 4 all-game vertical elbow mapping clarification

- **Shared signal:** Level 4 now excludes screen X from the individualized reach-estimator vector. Its smoothed elbow progress is presented consistently as vertical on-screen forward movement: extension moves up; flexion returns down. A fixed-X vertical guide is visible in all five Level 4 games.
- **Dimsum and ordinary transport:** the unheld selection cursor remains the real affected-wrist position. Pickup locks the item and carry ring to its stable lane X, while `level4Reach.progress` alone controls carried Y.
- **Independent mechanics preserved:** wipe-window and mahjong-wash retain their intrinsic real-wrist paths; bus-pay keeps its real precision cursor; bowling’s ball now visibly rises with extension and lowers with flexion before it can roll, and release requires the reach-return cycle.
- **Deterministic coverage:** technical validation adds one extension/flexion, fixed-X regression assertion for each of dimsum, wipe-window, bowling, mahjong-wash and bus-pay, plus the existing unheld selection and held-item carry-lane checks.
- **Cache and validation:** cache version is `fthue-rehab-v19-20260819-level4-vertical-all-games`. `bash scripts/build-dist.sh` passed (115 files, 68M); `bash tools/checkjs.sh` and `git diff --check` passed; focused Level 4 tests passed 36/36; full tests passed 72/72 with 3 skips; technical validation passed 138/138 (Level 4: 60, Level 5: 40, Level 6: 31).
- **Bedside caveat:** this is synthetic-pose software verification only. Confirm the target front-facing iPad’s framing, illumination, complete shoulder–elbow–wrist visibility, practical extension range, and the readability of the vertical guide with the intended participant. No real-person QA media was created.

## 2026-08-19 Level 4 elbow-controlled transport lane repair

- **Standard Level 4 transport:** the real affected-wrist cursor remains available for selecting an unheld item. On pickup, the game records a stable carry lane (the pickup X when it is target-aligned, otherwise the matching target’s X for replenishment layouts) and moves the held item and visible carry ring only from the smoothed `level4Reach.progress`. Extension moves upward toward the target; flexion returns downward. Raw screen X/Y can no longer make a held standard Level 4 item drift sideways.
- **Scope protection:** Level 3 and Levels 5–7 retain their prior controllers. Level 4 wipe-window and mahjong-wash keep real wrist paths, bowling still consumes reach progress, and bus-pay keeps its precision real-cursor target.
- **Deterministic coverage:** source contracts cover the carry-lane controller and special-game routing. Runtime Level 4–6 validation explicitly checks unheld real-wrist selection, fixed held X across extension/flexion, upward/downward progress mapping, wipe/mahjong paths, bowling progress, and bus precision cursor.
- **Cache:** bumped service worker cache to `fthue-rehab-v18-20260819-level4-elbow-lane` so installed iPads receive the controller repair.
- **Bedside caveat:** verify the chosen carry lane and extension range using the target front-facing iPad, participant seating, lighting, and complete shoulder–elbow–wrist visibility. This automated work uses synthetic pose inputs only and contains no real-person media.

## 2026-08-19 Level 6–7 interaction, layout and navigation repair

- **Clothes-peg:** calibration and runtime now use the same composite hand-aperture score (thumb-to-index and thumb-to-middle observable gaps). A smaller sustained calibrated change enters a press; separate lower exit threshold preserves hysteresis. All relevant copy states that the camera observes visible hand motion only, and does not identify a tool or measure force.
- **Bare three-finger transport:** the stabilized pinch state is now the sole held/reopen source. A raw `isOpenPrep` fluctuation cannot immediately release an item. Bare-pinch transport uses a slightly faster adaptive cursor EMA while carrying, with low-speed jitter filtering retained.
- **Dim sum:** Level 6–7 dim sum and steamer dimensions are 1.5× with viewport caps. iPad layouts use two separated bottom steamers; compact portrait stacks two left-side steamers vertically to avoid the inline camera preview and preserve a clear source-to-target lane.
- **Navigation:** result Home, game Back, safety-pause Home and stop-confirmation Home all use one complete level-selection exit path. It clears safety/rest/stop overlays, timers, tracking/camera state, held-item state and animation work. Safety pause retains both Continue and Stop actions.
- **Deterministic coverage:** added `tests/level67-interactions.test.mjs` for light-press hysteresis, 1.5× layout at iPad landscape/portrait and compact portrait, and safety/result Home cleanup. Updated tracking assertions and cache version (`v17`).
- **Validated:** `bash tools/checkjs.sh`; `git diff --check`; `NODE_PATH=/home/user/node_modules node --test tests/level67-interactions.test.mjs` (5/5); and full `node --test tests/*.mjs` (71 passed, 0 failed, 3 pre-existing skips). Browser visual QA saved in `qa/level67-interactions-ipad-landscape.png`, `qa/level67-interactions-phone-final.png`, and `qa/level67-interactions-safety-home.png`; no page errors observed.
- **Bedside caveat:** thresholds are intentionally easier, but still need confirmation against the target iPad camera angle, lighting, finger visibility and each participant’s available hand-opening range. MediaPipe cannot observe actual peg force or confirm physical tool contact.

## 2026-08-18 Level 4 五款遊戲正式顯示

- Level 4 活動庫預設直接顯示五款獨立遊戲：茶樓飲茶、抹窗擦霧、保齡球、洗麻雀及巴士拍卡，不再只顯示兩款。
- 保留治療師按需要隱藏個別遊戲的設定，但移除「每節最多 2 款」限制。
- 離線快取更新至 v15，避免已安裝 iPad／Android tablet 繼續顯示舊的兩款遊戲選單。

## 2026-08-18 Level 4／5 臨床角色及每節活動選擇

- Level 4 的介面及遊戲目標統一定位為 reach、transport、持續伸肘、側向控制及終點準確度；不把抓握或手指功能列作 Level 4 成功條件。
- Level 5 保留完整的伸手、輕輕合手、搬運及張手放下流程，清楚承接 Level 4 已建立的接近目標及穩定停留能力。
- Level 4 保留五款互補活動：點心、抹窗、保齡球、洗麻雀及巴士拍卡。每節預設只顯示兩款，由治療師選 1–2 款或使用自動輪替，減少選項負擔。
- 修正首次按「自動輪替」仍顯示原本兩款的介面問題；現在每次按下都會切換到下一組活動。
- 回歸測試同步改用 `visibleThemeOrder()` 驗證本節活動，並鎖定最新離線快取版本，避免測試誤報舊版行為。

## 2026-08-18 Level 4 iPad 即時診斷模式

- 網址加入 `?debug=1` 後，只有進入 Level 4 遊戲才在右上角顯示半透明診斷面板；正常遊戲網址不顯示。
- 面板直接讀取現有 `window.render_game_to_text()`，顯示校準、患側肩／肘／腕入鏡、肘角、啟動狀態、前伸、伸肘、總進度、聳肩及抹窗有效動作／清潔度。
- 校準持續 8 秒仍未完成時，畫面短暫提示保持患側肩、手肘及手腕完整入鏡並穩定手臂；只提供診斷，不改動動作門檻或計分。

## 2026-08-18 Level 4 抹窗獨立遊戲分類

- 「抹窗擦霧」是 FTHUE Level 4 活動庫內的一個獨立遊戲，不會取代 Level 4 的茶樓、插花、衣物、啤牌或麻雀遊戲。
- 只有選取 `wipewindow` 活動卡後才會啟動霧面、擦除進度及伸肘畫弧提示；其他 Level 4 活動繼續使用原有拾取及放置流程。
- 抹窗活動只會在 Level 4 顯示，Level 3、5、6–7 不會出現該入口。

## 2026-08-18 點心移位及舊版快取修正

- 修正普通點心在目標外放手後強制彈回出生位置的錯誤；現在點心及動物均可移到最近的安全空白位，並避開目標、提示區、畫面邊界及其他物件。
- 空白位放手被記錄為成功放手及 `drop_parked`，不再錯誤計入 premature release 或 pinch maintenance failure。
- 點心圖像再縮小，減少遮擋目標及患肢畫面。
- 離線 PWA 快取更新至 v7，service worker 註冊時略過 HTTP cache 並主動檢查更新，避免 iPad 長期停留在舊版。

## 2026-08-18 Level 4 真實影片：漂移、提早完成及屈肘返回

- 根據 27.6 秒真實 iPad 遊戲影片，Level 4 舊控制器會被細小角度雜訊啟動，而且目標重疊判定可在手肘未接近伸直時提早放下點心。
- 手肘角度改為 5 幀中位數平滑；必須比起點增加至少 6° 並連續確認 3 幀，點心才開始向上，避免靜止時自行漂移。
- 點心上下位置改由同一條平滑手肘角度尺度直接控制：伸肘向上，屈肘沿原路向下；鏡頭深度只保留作輔助資料，不再主導正式遊戲位置。
- Level 4 只有在接近預計伸直終點、控制進度至少 94% 時才可在目標放下；未達門檻會顯示「繼續伸直手肘」。
- 離線 PWA 快取版本更新至 v5，避免 iPad 繼續載入舊控制器。

## 2026-08-18 Level 4 同枱相機距離實測

- 真實 iPad 測試確認：iPad 與 forearm skateboard 可放在同一張枱，iPad 垂直面向病人；病人與鏡頭距離約 1 米時，可同時拍到患側手指、手肘及手臂。
- Level 4 入鏡不足提示已精簡為「iPad 同枱直放 · 約 1 米」及「患側肩・手肘・手腕全部入鏡」，取代容易令人誤解的「鏡頭向下／拉遠」。
- 離線 PWA 快取版本已更新，確保已安裝裝置取得新提示。

## 2026-08-17 Level 6–7 三種獨立玩法

- Level 6–7 設定新增三個獨立玩法：空手（三指）、夾仔及筷子；選擇後會切換各自校準、提示及遊戲偵測路徑，不再共用同一個輕捏門檻。
- 空手模式以拇指、食指及中指的平均 aperture 判定三指輕捏與重新張開；夾仔模式以可見手部開合估算按下及放鬆；筷子模式以食指尖方向游標在物件及目標上停留完成拿取與放下。
- 研究模式按「無工具／夾仔／筷子」自動套用相同玩法，QA 狀態亦輸出 `toolMode` 及對應 `gameType`。
- 限制：單鏡頭不會辨認實體夾仔或筷子，亦不量度夾力。夾仔模式只觀察手部開合；筷子模式只追蹤指尖方向及停留。

## 2026-08-17 Level 4 個人化方向及 Level 6–7 輕捏修正

- Level 4 不再假設直立 iPad 的固定 X／Y 方向代表向前。完成起始校準後，系統會由患者第一次合資格的「肩屈曲配合肘伸直」動作，學習該裝置、座位及滑板角度下的實際向前方向，再把相反方向視為返回。
- 個人化方向同時使用患腕相對患肩的畫面 X、Y、深度 Z 及肩寬標準化距離，因此側坐、斜放滑板或鏡頭輕微偏角時仍可回應；單純抬肩或只有肩部位移不會令點心上移。
- Level 6–7 修正輕捏校準錯誤：舊程式曾強制假設至少 0.12 的張合差距，可能把重新張開門檻設得高過患者實際可達幅度。新門檻完全按當次張開與輕捏中位數計算，最小有效變化為 0.035 或張開值的 5.5%，不要求指尖完全碰合。
- iPad 1180×820 合成動作驗證：Level 4 前伸進度由 0 升至 0.999，返回起點後降至 0.000004；肩部位移但沒有肘伸直時維持 0，患側聳肩時鎖住並顯示「患側聳肩 · 請治療師即時糾正」。輕捏 ratio 0.50 判定為捏取，0.70 可放開，0.76 判定為重新張開。
- 畫面沒有水平或垂直溢出；完整 Node 測試 45 passed、0 failed、3 skipped，Level 4–6 技術驗證 121/121。
- 待床邊確認：需用同一部直立 iPad、同一座位及滑板角度完成首次方向學習。患者肩、肘、腕及手指必須持續入鏡；真實衣物遮擋、低光及指尖重疊仍可能影響 MediaPipe。

## 2026-08-17 Level 4 真實裝置校準及正式遊戲動作修正

- 找到正式遊戲無反應的主因：舊校準只接受肘角 50–135°，病人若起始手肘已較伸直，系統會每幀清空樣本，導致測試頁看得到動作但正式遊戲永遠未完成校準。
- Level 4 現接受 25–178° 的有效起始姿勢並以 10 幀中位數校準；起始肘角大於或等於 138° 時，使用「維持伸直」而非強迫再增加肘伸角度。
- 上移仍須先確認肩向前伸展配合主動肘伸直，或配合已伸直並維持的手肘；回程須偵測向後返回及肘屈曲。單純肩部移動不會啟動，患側聳肩時物件維持原位並提示治療師。
- iPad 1180×820 合成姿勢實測：90°起始及約175°起始均成功校準，向前時 progress 由 0 升至 0.993，回程降至 0.001；肩前移但沒有肘伸直時 progress 維持 0，聳肩時 progress 維持 0。無 runtime／console error，畫面無水平或垂直溢出。
- 回歸結果：完整 Node 測試 86 passed、0 failed、3 skipped；Level 4–6 技術驗證 121/121。
- 待床邊確認：同一部直立 iPad 重新試 5 次向前／返回。演算法現已覆蓋兩種常見起始肘位，但真實鏡頭角度、衣物遮擋及患者可動幅度仍須以目標裝置確認。

## 2026-08-17 Level 3 主題拾放及 Level 4 正式遊戲追蹤修正

- Level 4 測試頁與正式遊戲的偵測路徑已統一：正式遊戲在 Level 3–4 只執行 Pose Landmarker，不再每幀同時執行 Hand Landmarker，降低 iPad CPU 負荷及追蹤延遲。
- Level 4 上移必須同時具備肩向前伸展及肘伸直；向前距離綜合腕點相對肩膀的垂直、深度及肩寬標準化半徑變化，改善側坐及斜向滑板視角下單靠畫面 Y 軸偵測不到的問題。回程的肩伸展配合肘屈曲會令點心向下。
- Level 4 肩聳時仍會停止物件移動並提示治療師，不會把肩膀抬高當成向前滑動。
- Level 3 的點心、收衫、啤牌、麻雀及插花全部改用同一個標準化桌面引擎：中央停留拾取、向患側外滑、在目標停留放下。Level 4–7 的進階主題玩法維持不變。
- 回歸結果：完整 Node 測試 85 passed、0 failed、3 skipped；Level 4–6 技術驗證 121/121；iPad 1180×820 瀏覽器合成動作實測 Level 3 五個主題均完成拾取及正確放下，0 runtime／console error。
- 待床邊確認：以同一部直立 iPad、完整拍到患側肩–肘–腕，實測 Level 4 向前及返回各 5 次。如仍有漏判，只調整個人校準與幅度門檻，不改變「肩屈曲＋肘伸直上移／肩伸展＋肘屈曲下移」的複合動作規則。

## 2026-08-16 方向偵測及動作示範更新

- Level 3 首次外滑會先按實際鏡頭方向完成左右綁定，不會在校正前被「向內偏移」提示錯誤攔截；鏡像方向、自動綁定及完整動作循環測試通過。
- 蛋炒飯活動只供 FTHUE Level 6–7 選擇；Level 4 及 Level 5 活動庫不再顯示或接受蛋炒飯入口。
- 蛋炒飯 12 個動作指令均在右上角同步顯示獨立手部動作 GIF；示範與指令卡、跳過按鈕及下方目標區互不重疊。
- iPad 1024×768 及 768×1024 視覺 QA 通過，無 console／runtime error；Level 4–6 技術驗證 120/120、Level 3 39/39。

## 2026-08-16 Level 4 側坐及患側旁枱修正

- Level 4 教學圖改為病人側坐，桌面只放在患側旁邊，不橫跨病人正前方。
- 起始姿勢顯示患側肘屈曲約 90°，前臂承托於 forearm-based skateboard；大紅箭嘴顯示沿側枱向前及返回。
- 紅箭嘴移至枱面上方的白色空間，並按滑板透視改為輕微斜向；加粗及提高不透明度，確保縮細卡片仍清楚可見。
- 卡片及詳情文字同步標明向前滑時結合輕微肩外展、肩屈曲及肘伸直；動畫不合成手臂位移，以免出現手臂離開滑板或錯誤關節姿勢。

## 2026-08-16 統一模式、研究回傳及離線安裝

- 四個 FTHUE 分級入口統一為「試玩」及「訓練」；不再分治療師／病人。試玩保留相機追蹤及遊戲但不錄影、不顯示治療師姿勢提醒；訓練會本機錄影並保留人工代償記錄。
- 遊戲返回研究表格時，會傳回 pre/post FTHUE、錄影狀態／大小／格式、追蹤失敗、持握逾時、放手延遲，以及治療師確認的聳肩、軀幹傾斜、手指收緊和疼痛次數。
- 同時傳回 single-task／dual-task 的 motor correct placements/min 及 cognitive accuracy 原始值，研究表格按既定公式計算 DTC；基準為零或缺失時顯示不可計算並保留原始數據。
- 新增可安裝 PWA 外殼、離線頁、本機 MediaPipe bundle／WASM／模型及完整預快取清單。首次有網絡載入後，公開的 Level 3–7 試玩／訓練可在同一裝置離線開啟；受保護研究工作區不會打包進公開離線快取。
- 訓練／研究錄影先把相機畫面頂部 30% 裁走，再由 Canvas 串流交給 MediaRecorder；影片只保留肩膀以下的上肢與軀幹區域。若瀏覽器不支援安全裁剪，系統寧願停用錄影，不會退回錄製完整頭部畫面。

## 2026-08-16 每級治療師／病人試玩模式

- Level 3、4、5、6–7 主頁卡各新增「治療師試玩」及「病人試玩」。
- 試玩模式在遊戲畫面顯示單一「試玩模式 · 不錄影」標示，程式不會建立 MediaRecorder、結果頁不會出現回看或下載。
- Level 4–6 活動選擇頁會顯示目前是「治療師試玩／病人試玩 · 不錄影」；Level 3 獨立頁在頁首顯示同等標示。
- 原有 Level 主按鈕及研究流程維持正式模式；只有新試玩入口停用錄影。
- Level 3 動作文字已修正為「肩外展向患側外滑；手肘按能力保持或逐步伸直，身體保持正中」；肩外旋並非指定訓練方向，所有可見的「外旋／內旋」動作描述已移除。
- 由主頁進入 Level 3 會直接略過重複的安全確認頁，但遊戲內停止準則及安全提示保留。
- 最終 QA：Level 3 35/35、Level 4–6 120/120、UI／追蹤回歸 21/21；兩段 inline JavaScript 均通過語法檢查。390×844 的 8 個試玩按鈕均為 48px 高，無橫向溢出；治療師 Level 3 及病人 Level 6–7 試玩標示、無錄影流程均以正常點擊驗證。

## 2026-08-16 明亮相機背景及本機動作影片

- 遊戲畫面改用全亮度、鏡像的 live camera 作背景，Canvas 保持透明，治療師可在遊戲期間直接觀察患者。
- 每節遊戲開始時自動以現有相機串流錄製無聲影片；沒有錄音、沒有自動上傳、沒有 browser storage。
- 結果頁提供即時回看、下載／儲存及刪除。iPad 優先開啟系統分享面板以「儲存到檔案」；Android／其他瀏覽器使用標準下載。
- 檔名只使用匿名 Participant ID（如有）、FTHUE Level 及 ISO 時間；下載後的保留、轉移及刪除須依研究方案與機構私隱要求處理。
- 錄影片段在頁面記憶體內以約 650 kbps 暫存；離開或重新整理頁面會撤銷暫存 URL。正式 pilot 前仍須以目標 iPad／Android tablet 測試 15 分鐘錄影的記憶體、格式及「儲存到檔案」流程。

## 2026-08-16 FTHUE Level 3–7 最終動作定義

- Level 3 統一為「雙手外側滑動」：雙手及前臂放在檯面毛巾上，由好手帶動患手向患側外滑；毛巾跟手，身體保持正中。
- Level 4 統一為「患手向前滑動」：患手放在離身約 10–15 cm 的檯面滑板上向前滑；清空桌面、避免聳肩。
- Level 5 統一為「患手握放練習」：手臂離桌，伸手、輕輕合手、張手；維持空手模擬及個人化 release calibration。病人提示不使用「握拳／握緊」，以免鼓勵過度用力。
- Level 6–7 統一為「患手捏放練習」：手臂離桌，伸手、手指輕捏、張開手指；提供三種可選玩法：頭三隻手指空手捏放、衫夾、筷子。鏡頭只追蹤可見的手指動作與位置，不量度捏力。
- 主頁卡、必讀安全提示、遊戲內 level 名稱及 action label 已同步；新增跨 iPhone／iPad 的用語一致性回歸測試。
- Level 3–4 教學 GIF 改為同一套虛構職業治療師卡通風格。Level 3 顯示好手疊在患手上、雙前臂置於毛巾及水平外滑方向；Level 4 顯示藍色 forearm-based skateboard（前臂托、三條固定帶）及直線向前方向。為避免生成影片出現軀幹側彎、彎曲路徑或肢體變形，最終 GIF 固定正確姿勢，只以非遮擋式動態箭嘴提示方向。
- QA：inline JavaScript syntax 通過；Level 3 共 31/31；Level 4–6 共 120/120；版面及用語測試 8/8。iPad 1180×820 與手機 390×844 均沒有水平溢出；Level 3 安全提示、確認框及繼續按鈕沒有重疊。

## 用戶原始需求（廣東話原文，第一次）

> 啱啱俾咗我屋企人玩，佢哋覺得有啲悶，覺得個concert係OK但係啲遊戲有啲單一，可唔可以將個點心遊戲只係變成其中一個遊戲例如一打開個網頁就會變成係兩個選項：FTHUE level 4-5(加埋現有嘅標注 e.g. 適合…) 同埋FTHUE level 6-7(加埋現有嘅標注)，然後撳入去先至會有仁濟茶樓而家嘅點心遊戲。然後我想加嘅遊戲係麻雀、啤牌、煮飯、插花、收衫/晾衫 （都係配對遊戲）

## 用戶最新需求（本次修改，逐項照錄）

### A. 活動要有真正玩法（不再只是配對）

1. **煮飯** = 模擬完成一碟蛋炒飯，一次只做一個引導步驟，大字指示 + 廣東話 TTS + 進度 1/12。步驟順序固定：
   `準備食材：現在將隔夜冷飯完全抓鬆 → 將雞蛋打散 → 將雞蛋液拌入白飯中（讓每一粒米飯都裹上蛋液） → 現在洗青蔥 → 切蔥變成蔥花 → 現在開火熱鍋 → 落油 → 倒入有蛋液的白飯 → 落鹽 → 落蔥花 → 熄火 → 上碟`
   每步必須偵測到相應動作才可前進；加入 MediaPipe **Pose Landmarker**（肩／肘／腕）同時保留 Hand Landmarker；以手部方向（腕／食指／小指／拇指）＋肘腕向量**估算**前臂旋前／旋後，並明確標示為螢幕訓練估算、非醫學量度。每步動作目標：抓鬆飯 3 次握放、打蛋 3 次手腕畫圈、拌飯 4 次旋前旋後交替、洗蔥 3 次手肘屈伸、切蔥 5 下垂直手腕控制、熱鍋肩膀前伸並停 1.5 秒、落油手腕傾斜停住、倒飯前臂傾倒再轉回、落鹽 4 下輕抖、落蔥花捏起放入鍋、熄火伸手去大型爐頭旋鈕停留、上碟 3 次由鍋舀到碟。需要即時動作回饋、次數、肩–肘–腕小骨架、步驟成功提示、治療師「跳過此步」按鈕、以及無相機 QA 模擬。保留 FTHUE 對應：Level 4–5 用握放、門檻較闊；Level 6–7 用較精細手部動作門檻。
2. **麻雀** = 簡化香港式挑戰，加上番數與和牌牌型解釋，並且**（最新加強要求）**：
   - 每局不同牌型 + 候選牌池，病人要自己「拼」出一手有效和牌，不再只係固定一隻聽牌。
   - 有時有多條和牌路線、手牌大小／番數不同；觀察與選擇可以追求更大／更高分的糊。
   - 每次完成即時顯示所拼成的完整牌／牌型名稱、番數、強烈視覺慶祝、廣東話正面回饋，再鼓勵下一局。
   - 用可重現／生成式但**永遠有效**的牌局集，不假裝係完整官方規則引擎，計分標明簡化。
   - 參考用戶提供的 17 張麻雀圖片（花糊、平糊／門清／自摸、混一色、對對糊、小三元、小四喜、清一色、字一色、十三么、大三元、大四喜、十八羅漢、刻刻糊）：實作策展組合，並以 **細糊 / 中糊 / 大糊 / 上限糊** 作獎勵級別；每局提供 2–4 個候選牌組，盡量有多於一條有效路線、番數不同；獎勵畫面必須顯示完成的牌、牌型名稱、總番數、下一個目標進度。
3. **啤牌** = 花色收集：場上多張真實牌面，指定花色，收集夠數即得分、清場、換新花色。升級：Tier 1 收 3 張 → Tier 2 收 4 張（干擾更多）→ Tier 3 收 5 張（牌更多）→ Tier 4 限時獎勵回合。
4. **收衫** = 顏色分類：真實透明衣物 PNG（襪、短褲、背心、外套、T恤、長褲）＋ 3–4 個真實顏色衫籃，把衣物搬去同色籃。升級：顏色 2→3→4、衣物數量／款式增加、顏色提示逐步減弱，但保留超大目標及顏色文字標籤（不單靠顏色）。
5. **插花** = 自由創作、刻意最簡單、不計分：多款寫實透明花材 + 長葉，自由擺放／旋轉／縮放插入花瓶。Level 4–5 握放；Level 6–7 停留／捏取。提供 Undo / Clear / Finish。完成後開留念畫面（可打名 + 手寫簽名），用最終 canvas 下載 PNG（不用外部截圖服務），匯出必須包含花瓶、作品、名字／簽名、日期及「仁濟上肢復康訓練」頁腳。名字只留在當前頁面記憶，不作儲存。

### B. 全站正向強化系統（所有遊戲）

即時視覺獎勵、慶祝音效／廣東話語音、具名成就與分數、下一階段解鎖進度、鼓勵繼續動的提示；語氣為成人尊重式，避免兒語。

### C. 資產

麻雀、啤牌、煮飯、插花、收衫的程式化卡通刺激物，改為透明背景寫實 PNG（與現有動物／點心剪影一致），存放於 `img/advanced/`。麻雀／啤牌可程式化繪製為有立體感的牌面（花色必須準確、易讀）。

### D. 發佈要求（最新）

保留舊「仁濟茶樓」現有連結不變：**本次不部署、不發佈**；主 agent 會把完成的專案複製到新目錄、開新的獨立發佈 URL，不更新原有 site_id。

---

## 本次完成內容

### 1. 資產（`img/advanced/`，共 50 個檔案、約 1.2MB）

| 來源 | 內容 |
|---|---|
| GPT Image 1.5（`background: transparent`）6 張 2×2 嚴格排版 contact sheet | 煮飯：冷飯碗、雞蛋、青蔥、油瓶、蛋液碗、蔥花、白碟、鹽碟、炒鍋、蛋炒飯、爐頭旋鈕、砧板刀；花材：玫瑰、菊花、太陽花、非洲菊、鬱金香、百合、長葉、尤加利葉；衣物：T恤、襪、短褲、背心、長褲、外套、衫籃、玻璃花瓶（全部純白，方便上色） |
| Python/PIL 後處理 | 依象限切割 → alpha 清邊（<8 alpha 歸零）→ 裁邊 → 最長邊 300px → ImageMagick 192 色量化。已逐個檢查透明度百分比 |
| 顏色變體 | 白色衣物／衫籃以 multiply 上色，得紅／藍／黃／綠共 28 個變體（保留布料陰影質感） |
| 程式化 atlas | `mahjong_atlas.png`（9×4 格，筒／索／萬 1–9 + 東南西北中發白，象牙色立體斜邊、藍／綠／紅點）、`cards_atlas.png`（13×4 格，A–K × ♠♥♦♣，角位點數＋倒轉重複＋中央大花色） |

工具：`tools/build_assets.py`、`tools/build_tiles.py`（可重現）。

### 2. 玩法（五個各自獨立的遊戲模組）

- 進階活動改由 `advInit / advUpdate / advRender / advTeardown` 調度，與原有點心配對引擎並行；沿用同一 webcam、cursor、EMA 平滑、stillness、暫停、計時、結果頁。
- **選取／搬運引擎**：`picker`（點選：Level 4–5 握拳觸發、Level 6–7 停留 dwell）、`carrier`（搬運：抓起→跟隨→放下，握放模式有 400ms release dwell）。
- **煮飯**：12 步資料表（動作類型、次數、廣東話 TTS、道具圖），偵測器包括握放循環、手腕畫圈（角度累積 2π）、旋前／旋後交替（手掌橫軸對前臂向量的相對角，**標明估算**）、手肘屈伸（Pose 肩–肘–腕夾角）、垂直切擊、肩膀前伸並停留、手腕傾斜停留、傾倒再轉回、輕抖、捏放入鍋、爐頭旋鈕停留、鍋→碟舀取往返。畫面有真實炒鍋／碟／爐頭旋鈕、12 步進度圓點、右上肩–肘–腕小骨架與角度、即時 metric 文字、治療師「跳過此步」。門檻表 `COOK_TH`（Level 4–5 較闊 / Level 6–7 較細）。
- **麻雀 · 拼牌挑戰**：內建**真正的和牌驗證器**（遞歸拆解 4 組 + 1 眼）及簡化番數計分（清一色 7、混一色 3、字一色 10、大三元 10、小三元 5、大四喜 10、小四喜 6、對對糊 3、平糊 1、雞糊 1，總番上限 13）。8 個策展牌局（base 9–12 隻 + 2–4 個候選牌組，含互斥標籤處理牌張供應），每局枚舉出的路線經 QA 驗證**全部有效**；多數牌局有 2–3 種不同番數路線。和牌後全螢幕慶祝：綠檯分組顯示（順子／刻子／眼括號）、牌型名稱、番數、獎勵級別（細／中／大／上限糊）、連勝、累積番數、下一個目標進度、廣東話回饋，並提示「如果揀 X 可以做到 Y（更高番）」的教學訊息。另有「退回上一組」、「換一局」、超過 14 隻的保護提示。
- **啤牌 · 花色收集**：4 個 Tier（3/4/5/5 張，8→11→14 張場面，Tier 4 加限時雙倍分獎勵段），完成一輪換新花色、升級有 banner；錯花色扣分並語音提示正確花色；連續正確 combo 追蹤。
- **收衫 · 顏色分類**：2→3→4 色、衣物 4→7 件、款式 3→6 款、顏色提示強度 4 級遞減，但顏色文字標籤永遠保留；放錯籃衣物返回原位並語音說明。
- **插花 · 自由創作**：8 款花材兩欄排列、花瓶、旋轉／放大／縮小／復原／清除／完成；插入花瓶時按 x 偏移自動傾斜。完成後留念畫面：預覽 canvas（1000×1300）、名字輸入（最多 12 字、只在記憶中）、pointer 事件手寫簽名、下載 PNG（`canvas.toDataURL` + `<a download>`），匯出含花瓶、花束、名字、簽名、日期及「仁濟上肢復康訓練」頁腳。

### 3. 正向強化系統（共用）

`rewardSmall()`：具名成就 toast + canvas confetti / 光環粒子 + 音效 + 選擇性廣東話鼓勵（成人語氣，`ENCOURAGE` 輪播）+ 下一階段進度文字。
`rewardBig()`：全螢幕慶祝（級別／標題／牌型或成就／自繪 canvas／進度條／繼續按鈕／掌聲＋TTS）。
已套用到：麻雀（每次和牌）、啤牌（每張＋每輪＋升級）、收衫（每件＋升級）、煮飯（每步＋每個 rep＋整道菜完成）、插花（每枝＋作品完成）、以及原有點心配對（`dimsumReward()`，每次配對成功顯示「配對成功 ×N」及距離下一階段次數）。

### 4. 技術 / 安全

- Pose Landmarker 使用相同 `@mediapipe/tasks-vision@0.10.14` CDN 與 `pose_landmarker_lite.task`；hand / pose 各自維持單調遞增時間戳（`nextTs('hand' | 'pose')`），避免重複 `detectForVideo` timestamp；pose 每兩幀執行一次。
- 校準畫面就開始預載 pose 模型（約 5.8MB）；載入中顯示「正在載入姿勢追蹤…」，成功顯示「姿勢追蹤已啟用」，失敗顯示「已轉為手部動作練習：追蹤有限」並可用「跳過此步」，**不阻塞其他活動**。
- 無姿勢追蹤時，手肘步驟改以手部上下大幅移動代替、伸手步驟改以伸手到炒鍋代替，畫面明示追蹤有限。
- 全部文案標明：前臂旋前／旋後屬螢幕訓練估算，非醫學量度；煮飯屬虛擬練習；麻雀番數屬簡化訓練計分，非官方規則裁判。
- 沒有 localStorage / sessionStorage / cookies；名字與簽名只存在記憶體。TTS 全部保留。

### 5. QA hooks（deterministic）

`window.render_game_to_text()` 加入 `advTextState()`（各遊戲狀態、座標、獎勵記錄）。
`window.__qa` 新增：
`adv.{state, game, rewardOpen, closeReward, pickAt, carryTo}`、
`cook.{step, simulate, completeStep, skip, runAll, forcePose, posePing}`（`simulate` 以合成手部 21 點／姿勢 33 點真實觸發偵測器）、
`mj.{state, pick, pickTiles, pickAtGroup, round, evaluate, verifyAll}`、
`cards.{state, pickCorrect, pickWrong, clearBoard}`、
`laundry.{state, sortOne, sortMany}`、
`flowers.{state, placeOne, rotate, scaleUp, scaleDown, undo, finish, setName, signStroke, exportPNG}`。
輪次轉場改用虛擬時鐘（`cards.pendingBoardAt`、`cook.announceAt`），不再依賴 `setTimeout`，確保可重現。

---

## 測試結果（Playwright，1280×900 / 1194×834 iPad 橫向 / 390×844）

- **inline JS 語法**：兩個 script block 全部 `node --check` 通過（`tools/checkjs.sh`）。
- **麻雀牌局驗證**（`__qa.mj.verifyAll()`）：8 局、共 27 條枚舉路線，**全部有效**（validRoutes = totalRoutes）；番數分布 1/3/7、1/3、1/3、1/5、10/13、3/9/13、6/10、3/4/8 → 多路線且番數不同。
- **麻雀實玩**（虛擬手部點選）：8 局全部和牌，獎勵級別覆蓋 上限糊 ×3、大糊 ×2、中糊 ×3，另單獨驗到 細糊 ×1；累積 57 番；顯示牌型分組、番數、連勝、下一目標；未取最高番時出現「觀察一下…可以做到更高番」教學提示；超過 14 隻有保護提示；「退回上一組」按鈕由 12 隻退回 9 隻。
- **煮飯**：Level 4–5 及 Level 6–7 均以合成動作**真實觸發全部 12 步**（無強制跳步），最後彈出「蛋炒飯完成！12 / 12」慶祝畫面；治療師「跳過此步」按鈕實測有效並顯示提示；`forcePose(false)` 時顯示「姿勢追蹤未啟用」並仍可完成。
- **真實相機路徑**（Chromium fake camera）：hand + pose 同時執行 40 秒以上、無 console／page error；`posePing(8)` 8 次呼叫全部無異常（假鏡頭無人所以 0 landmarks）→ 確認無時間戳衝突。模型下載狀態：`hand_landmarker.task` 200 (7.8MB)、`pose_landmarker_lite.task` 200 (5.8MB)；在無 GPU 的 headless 沙盒中 pose 初始化約 40 秒，實機（iPad GPU）會快得多。
- **啤牌**：連續 8 輪清場，Tier 1→2→3→4 升級 banner 全部出現（收 3→4→5 張、8→11→14 張場面、Tier 4 限時雙倍），換新花色正常，錯花色 combo 歸零。
- **收衫**：14 件連續分類，Tier 1→4 升級（顏色 2→3→4、件數 4→7、cue 1→4）三個 banner 全部出現；放錯籃 wrong+1 且衣物返回原位；Level 6–7 停留模式亦可完成。
- **插花**：8 款花材全部可見並可插入（桌面／iPad／手機三種尺寸），旋轉／放大／縮小／復原正常；留念畫面打名「陳女士 / 王先生」、合成簽名筆劃、匯出 dataURL 長度 636,962 / 687,714 bytes（非空、`data:image/png;base64,` 前綴），Playwright 收到 download 事件。
- **點心（回歸）**：原有握放配對流程正常（score 10、correct 1、補回物件），新獎勵 toast 顯示「配對成功 ×1 · 得分 10 · 再 4 次到下一階段」；由進階活動切回點心時進階 UI 會清走（已修 bug）。
- **導覽**：level → library（六張卡描述已更新為各自玩法）→ settings（標題／context 顯示「麻雀 · 拼牌挑戰 · 停留夾取」）→ rules（每個活動有專屬規則文字＋TTS）→ game → result 全部正常。
- **標準遊戲測試 client**：`web_game_playwright_client.js` 執行成功，輸出於 `qa/gameclient/`（shot-0..2.png、state-0..2.json）。
- **截圖**（存於 `qa/`）：`adv_mj_board_desktop / adv_mj_reward_desktop / adv_mj_tier_limit / adv_cook_step3_desktop / adv_cook_done_desktop / adv_cook_reward_desktop / adv_cards_desktop / adv_laundry_desktop / adv_flowers_desktop / adv_flowers_keepsake_desktop / ipad_*（6 個活動）/ m2_*（5 個活動手機版）/ camera_calib / camera_cooking / camera_cooking_pose / assets_preview / prev_mahjong / prev_cards`。
- 已逐張檢視截圖並修正：麻雀手牌被面板遮擋（下移至 0.48ch）、分數列位置、窄螢幕元素被面板遮擋（卡牌／衣物／花材起始 y 依 `advNarrow()` 下移）、花材由單欄改雙欄（8 款全部在畫面內）、留念畫面簽名與頁腳重疊、toast 由頂部移到底部避開 HUD、390px HUD 字級縮小。

## 限制

- 沙盒無 `apply_patch` 工具；所有手動修改以精確字串替換（`tools/patch_integrate.py` 及後續 Python 腳本）完成，每步都有 `node --check` 驗證。
- 前臂旋前／旋後、肩膀前伸距離只是由 2D landmarks 估算，**不能作臨床運動學量度**；介面已明示。
- 沙盒無真人鏡頭：肩–肘–腕骨架 overlay 與 pose 驅動的步驟（洗蔥、熱鍋）以合成 landmarks 驗證邏輯，未能用真人影像驗證偵測靈敏度；建議治療師實機調整 `COOK_TH` 門檻。
- 麻雀為策展牌局 + 真驗證器：所有設計路線皆有效，因此「未能和牌」自動退回只是保護機制（正常玩法不會遇到死局）；並非完整官方規則引擎（無吃／碰／花牌／十三么等特殊牌型判定）。
- 未部署／未發佈（依指示）：主 agent 會複製到新目錄並開新的獨立 URL，原有 仁濟茶樓 site_id 不變。

---

## 2026-08-10 Neuroscience Research Mode v5.0.0

- Pilot Study 訓練節改為先由治療師按當日 FTHUE Level 4–7 篩選，再讓患者自行選擇五個動作需求相近的情境：插花、茶樓飲茶、衣物分類、啤牌及麻雀；煮飯不納入研究訓練。
- T0、T1 及可選出院前追蹤評估固定使用「茶樓飲茶」，避免不同遊戲刺激影響前後比較。
- 組別統一為「主動動作對照組」及「遊戲介入組」：前者記錄兩項各 15 分鐘傳統上肢動作活動；後者記錄一項 15 分鐘傳統活動加一節 15 分鐘遊戲。額外活動只在患者可耐受時記錄。
- 加入中英文 Neuroscience Framework，清楚連結 motor learning、speed–accuracy control、cognitive-motor interference、movement variability 及 behavioural mechanism chain；明示沒有 EEG、fMRI 或 TMS 時不能直接聲稱神經可塑性。
- 研究 CSV 新增螢幕對角線標準化準確度及路徑、完成時間標準差與變異係數，並保留正確／錯誤放置、grasp／pinch／release、追蹤中斷、認知正確率及反應時間等指標。
- 修正啤牌、衣物分類及插花的結果計數，讓成功、嘗試及錯誤事件可納入研究摘要。

### 最終 QA

- `tools/checkjs.sh` 兩個 inline JavaScript block 通過，`git diff --check` 通過。
- 標準 `web_game_playwright_client.js` 回歸測試成功，兩輪均進入研究模式並輸出可讀狀態。
- 桌面 1440px、iPad 橫向 1180×820 及手機直向 390×844 完成視覺及水平溢出檢查；五個研究情境全部可選，煮飯未出現。
- T0 評估只顯示已鎖定的「茶樓飲茶」；中文／英文切換及 Neuroscience Framework 內容均可正常顯示。
- 沒有 console error、重複元素 ID，亦沒有 localStorage、sessionStorage 或 IndexedDB。

### 研究限制

- 這些數據支援可行性、接受程度、task-specific motor learning、movement control 及 cognitive-motor interference 的探索性分析，但不能單獨證明皮質重組或神經可塑性。
- MediaPipe 指標屬 2D webcam-based movement estimates；正式收數據前仍須以目標中風長者完成 usability run，鎖定鏡頭距離、光線、門檻及研究版本。

---

## 2026-08-08 試玩回饋修訂

- 規則頁改為進入後自動播放廣東話，播放完畢自動開始；只保留「跳過規則，立即開始」，移除「讀出規則」及遊戲內喇叭按鈕。
- 大獎勵／升級畫面移除所有「繼續下一局／下一輪」按鈕，預設 4.2 秒後自動繼續；炒飯完成畫面停留 6.5 秒後自動關閉。
- 連續錯誤提示同樣改為讀完後自動恢復遊戲，不再要求病人按「繼續」。
- 進階提示面板縮短並設為不攔截遊戲操作；手機面板約 101–159px 高，遊戲物件由畫面 34% 以下開始；重複的姿勢追蹤技術浮層隱藏，避免遮住物件。
- 移除煮飯、麻雀、啤牌及收衫面板內的「再讀一次／讀出提示」按鈕；煮飯只保留「跳過這一步」，不再使用「治療師」字眼。
- 炒飯動作加入 1.4 秒準備期、每次計數 700ms 冷卻，以及更高幅度門檻。旋前／旋後及傾倒必須完成「中立位停留 → 達到幅度 → 返回中立位停留」才計一次，未返回不計數。
- 炒飯每完成一步會暫停偵測 2.8 秒，顯示相應的實物成果圖；炒鍋內及上碟後會持續顯示蛋炒飯。
- QA：`probePronateCycle()` 驗證到達旋轉幅度但未返回時為 0 次，返回中立位後才為 1 次；12 步合成動作全部真實通過，完成畫面會自動關閉。啤牌及收衫手機面板無朗讀按鈕、無遮擋；升級畫面無繼續按鈕並自動進入下一輪。

---

## 2026-08-08 握放門檻及長者視覺修訂

- Level 4–5 改為完整動作循環：「張手準備至少 420ms → 在同一物件上持續握拳至少 480ms → 拿起 → 持續張手至少 620ms → 放下」。靠近物件、短暫握拳或手部追蹤中斷都不會自行拿起／放下。
- 握拳分類收緊：一般抓握至少要偵測到兩隻手指彎曲；完整抓握至少三隻，降低未真正 grasp 已拿取的情況。
- 啤牌每頁限制 4–6 張：Tier 1 為 4 張、Tier 2 為 5 張、Tier 3–4 為 6 張；手機固定兩欄，桌面最多三欄，牌面全面放大。
- 麻雀手牌及候選牌組放大；手機手牌改為最多五張一行、候選區上移，所有候選牌組均保持完整可見。
- 收衫每局顯示 3–4 件大型衣物，洗衣籃改為大型兩欄排列；完成後新衣物會重新排位，不會互相重疊。
- 插花每頁只顯示四款大型花材，使用兩乘兩排列，並提供「換一批花材」。
- 指示、分數、按鈕及動作狀態文字同步放大；正在拿住的牌以金色粗框、光暈及抬起效果清楚顯示。

### 本輪 QA

- 握放狀態逐步驗證通過：張手只會準備；握拳 300ms 不拿；持續至 600ms 才拿；張手 300ms 不放；持續至 700ms 才放。
- 收衫搬運逐步驗證通過：未真正握拳不拿，移動期間保持拿住，未完成張手不放，完整放手才分類。
- 錯誤路徑：放錯洗衣籃只增加一次 `wrong`、衣物數目維持不變；揀錯花色啤牌不增加 `got`、牌數維持不變。
- 啤牌連續八輪驗證：場面依序為 4、4、5、5、6、6、6、6 張。
- 手機 390×844 及桌面 1280×900 已逐一檢視啤牌、麻雀、收衫及插花；沒有物件重疊、底部裁切或提示面板遮擋。
- 兩個 inline JavaScript block 均通過語法檢查，`git diff --check` 通過；標準 `web_game_playwright_client.js` 回歸測試成功，輸出於 `qa/grasp_accessibility/`。

### 待實機確認

- 仍建議以目標病人的實際手部能力、鏡頭距離及光線測試 480ms 握拳與 620ms 放手門檻；如太難或太容易，可只微調這兩個數值而不改變完整動作循環。

---

## 2026-08-09 Pilot Study 研究模式

### 標準化流程

- 主頁新增獨立「研究模式（Pilot Study）」入口；一般遊戲入口及六項活動保持不變。
- 治療師只輸入匿名 Participant ID、Session 1–5、FTHUE 4–5／6–7、患側及本節協助程度；輸入欄拒絕空格及姓名常用符號，只接受英文字母、數字、底線及連字號。
- 研究活動固定為「仁濟茶樓」點心配對、15 分鐘、字體大、dwell 1 秒，不容許臨場更改訓練重複次數或活動。
- 每節分為 7.5 分鐘單一任務及 7.5 分鐘雙重任務，450 秒時自動切換。Session 1、3、5 採單一→雙重；Session 2、4 採雙重→單一，以降低固定次序效應。
- 雙重任務的 distractor 升級按該階段內的正確次數計算；由雙重轉回單一時會立即移除未拿取的 distractor，避免條件污染。

### 校準及動作判定

- 研究校準要求手部連續被偵測 2 秒；FTHUE 4–5 另要求持續張手 2 秒及持續握拳 2 秒，三項均完成才可開始。
- 基本點心握放改為與其他搬運遊戲一致的完整循環：同一物件上張手準備 420ms、持續握拳 480ms 才拿取、持續張手 620ms 才放下。
- 開局／升級提示縮為右上角兩行，手機及 iPad 會避開 HUD；遊戲物件生成區下移，避免物件與分數或提示重疊。
- 插花在橫向／直向轉換時按花瓶比例重新定位已插花材，花材不會懸空或消失，仍可再次拿起調整。

### 匿名事件記錄及 CSV

- 所有研究資料只存在當次頁面的記憶體，不使用 localStorage、sessionStorage 或 cookies，亦沒有雲端上載。重新整理前必須由治療師下載 CSV。
- CSV 採 UTF-8 BOM，Excel 可直接開啟；每列包括版本、ISO timestamp、匿名編號、節數、FTHUE、患側、協助程度、階段、模式、事件、分數、正確、拿取、錯誤、追蹤狀態、游標位置及詳細資料。
- 事件包括 session／phase 開始與結束、校準完成、tracking lost／restored、pickup、正確／錯誤／目標外 drop、pause／resume。
- 結果頁顯示兩階段的正確、拿取及錯誤次數、追蹤中斷秒數及暫停次數，並提供具匿名編號及 Session 的 CSV 檔名。

### 本輪 QA

- 兩個 inline JavaScript block 均通過 `tools/checkjs.sh`；`git diff --check` 及禁止瀏覽器儲存檢查通過。
- Session 2 虛擬時鐘測試：起始次序為 dual→single；450 秒自動進入第二階段；900 秒自動完成，CSV 有兩個 phase summary 及 session end。
- 握放逐步測試：握拳 200ms 不拿；完成 480ms 後才拿；張手 300ms 不放；完成 620ms 後才正確放下並得 10 分。事件順序為 tracking detected → pickup → drop correct。
- CSV 實際下載成功：20 欄、8 列標準空白 session 事件，Participant ID 全部保持匿名代碼。
- 六項活動 × 兩個 FTHUE 級別共 12 個啟動回歸測試全部通過，沒有 browser page error。
- 桌面 1280×800、iPad 橫向 1180×820、手機直向 390×844 已完成視覺檢查；手機提示與 HUD 無互相重疊。
- 插花由 iPad 橫向轉直向後，已插花材數量、選取狀態及相對花瓶位置保持有效。

### 仍需實機 pilot 前確認

- 必須以目標中風長者的真實手部、照明、衣袖遮擋、鏡頭角度及患側擺位測試 MediaPipe 靈敏度；目前自動測試只驗證程式門檻及狀態流程。
- 建議先做 1–2 位非研究正式樣本的可用性演練，記錄需要口頭提示的位置，再鎖定 pilot 版本及不再更改門檻。

---

## 2026-08-10 動作提示及長者版控制項

### 指示精簡與動作優先

- 規則頁只保留核心動作次序；FTHUE 4–5 顯示「張開手 → 握緊拿取 → 張開手放下」，配對規則縮為一行。
- 遊戲中以大型動態提示顯示「握緊拿取」、「繼續握緊」、「保持握緊」及「張開手放下」，並顯示握放完成百分比。
- 次要配對提示固定於右上角，以較小字顯示，不再遮擋主要遊戲區。

### 控制項及手機版面

- 新增大型「返回」及「暫停」按鈕；暫停後按鈕清楚變為黃色「繼續」。
- 大型動作提示移至目標區上方，避免遮住點心碟及碟名。
- 手機 HUD 改為四個等寬欄位，完整顯示得分、正確、拿取及時間。
- 手機直向目標上移並加入高對比碟名描邊，避免底部裁切及黑底低對比。

### 本輪 QA

- iPad 橫向 1180×820 及手機直向 390×844 均沒有 HUD、控制項、右上角提示或動作提示互相重疊。
- 手機四個 HUD 欄位均完整位於 390px 畫面內，頁面沒有水平或垂直溢出。
- 握放門檻逐步測試通過：未完成握拳不拿取，未完成張手不放下；完成動作後才計分。
- 返回、暫停／繼續、規則跳過及點心遊戲啟動流程通過；瀏覽器沒有 console 或 page error。
- 兩個 inline JavaScript block 均通過 `tools/checkjs.sh`，`git diff --check` 通過。

---

## 2026-08-10 Pilot Study 專用雙重任務分流

- 研究模式改為校準後固定進行 15 分鐘 Motor + Cognitive Dual Task，不再於 7.5 分鐘時切換單一及雙重任務。
- 治療師可在開始前選擇並鎖定簡單版 `Sorting + Motor`，或進階版 `Sorting + Motor + Inhibition`。
- 簡單版只需辨認兩款點心並配對到同款碟；進階版由開始時加入 1 隻動物，按該節正確完成數逐步增加至 2 隻及最多 3 隻。
- 設定頁提醒同一參加者的五節訓練應使用同一版本，分流仍由治療師按理解、疲勞、視覺搜尋及動作安全作臨床判斷。
- 研究事件、摘要、文字狀態及 CSV 新增 `dual_task_level`；CSV 檔名加入 `simple` 或 `advanced`，研究版本更新為 `pilot-2.0.0`。

### 本輪 QA

- 以真實介面點擊驗證簡單版／進階版可來回選擇，開始校準後所選版本正確鎖定；空白 Participant ID 會顯示匿名編號格式錯誤。
- 簡單版由 900 秒開始至剩餘 449 秒仍維持同一個 dual-task phase，干擾物數量為 0；不會在 7.5 分鐘轉換任務。
- 進階版開始時有 1 隻動物；正確完成數達 5 及 10 時，干擾物分別增加至 2 及 3 隻。
- 900 秒後只產生一個 `dual` phase summary 並完成 session；CSV 實際下載成功，檔名為 `pilot-PCSV-session-2-advanced.csv`，所有列均包含 `dual_task_level=advanced_sort_motor`。
- 桌面 1280×800、iPad 橫向 1180×820、手機直向 390×844 均完成視覺檢查；手機沒有水平溢出，碟名完整顯示，進階物件改以兩欄多列安全分佈。
- `tools/checkjs.sh`、`git diff --check` 及標準 `web_game_playwright_client.js` 回歸測試全部通過；最終測試沒有 console 或 page error。

---

## 2026-08-10 首頁及遊戲情境精簡

- 首頁標題改為「中風復康：上肢功能日常生活訓練」，副標題改為「請選擇訓練模式」。
- FTHUE Level 4–5 及 Level 6–7 的臨床建議預設收起，以「顯示詳情」箭嘴按需展開。
- 研究模式入口只保留「治療師使用」，刪除首頁上的匿名編號、五節流程及 CSV 長句。
- 活動頁以 FTHUE 級別及訓練類型作主標題，副標題統一為「請選擇一個遊戲情境」，返回鍵改為「返回主頁」。
- 六個遊戲情境按最容易至最困難排列：插花、茶樓飲茶、衣物分類、啤牌、麻雀、煮蛋炒飯。
- 每張遊戲卡只顯示遊戲名稱、單句任務及難度，移除 FTHUE、動作模式及詳細玩法等重複資訊。
- 茶樓飲茶目標由白碟改為透明背景竹蒸籠 PNG，蒸籠內直接顯示相應點心。
- 手機直向的大型動作提示上移至物件與蒸籠之間，避免遮蓋蒸籠目標。

### 本輪 QA

- 已測試桌面 1280 × 800、iPad 橫向 1180 × 820，以及手機 390 × 844；主頁、遊戲選單及茶樓遊戲均沒有水平溢出或程式錯誤。
- 手機版的大動作提示已置於點心與蒸籠之間，不再遮擋蒸籠目標。
- 已確認六個遊戲依難度排列為：插花、茶樓飲茶、衣物分類、啤牌、麻雀、煮蛋炒飯。
- `tools/checkjs.sh`、`git diff --check` 及標準遊戲自動測試均通過。

## 2026-08-10 首頁及遊戲卡視覺優化

- 首頁改為三層標題：「仁濟醫院職業治療部」、「中風上肢功能訓練」及「請選擇訓練模式」。
- Level 4 及 Level 5 的螢幕距離說明縮短為半個手臂及一個手臂遠。
- 六張遊戲卡加入對應透明 PNG：向日葵、燒賣、衣物、啤牌、麻雀牌及蛋炒飯。
- 遊戲選單改為兩欄大卡片，圖片置於短文字旁，手機則維持單欄大觸控範圍。
- 已測試桌面 1280 × 800、iPad 橫向 1180 × 820 及手機 390 × 844；六張圖片均成功載入，沒有水平溢出或程式錯誤。

## 2026-08-10 訓練動作 GIF 及麻雀圖片

- FTHUE Level 4–5 卡加入張手及握拳的真人手部循環 GIF。
- FTHUE Level 6–7 卡並排加入筷子夾取及衫夾捏取的真人手部循環 GIF。
- Level 6–7 說明改為「建議訓練時拿夾子或筷子練習手指捏取」，並將「拿夾子或筷子」加粗。
- 麻雀遊戲縮圖改為透明背景、實物質感的香港麻雀牌。
- 六個遊戲的單句標註均移除句末句號。
- 已確認三個 GIF 各有 40 幀並成功循環載入；桌面及手機沒有水平溢出或程式錯誤。

## 2026-08-10 Pilot Study 多情境及每日 FTHUE 記錄

- Pilot Study 不再連續五節固定使用同一個「茶樓飲茶」情境，改為預先寫死的標準化輪替：Session 1 茶樓飲茶、Session 2 衣物分類、Session 3 啤牌分類、Session 4 衣物分類、Session 5 茶樓飲茶。
- 三個情境共用相同的配對引擎、15 分鐘訓練及預設重複次數、動作判定及簡單／進階雙重任務規則，只改變視覺情境，以減少沉悶感而不任意改變介入內容。
- 治療師於每日開始前記錄當日 FTHUE Level 4、5、6 或 7；Level 4–5 自動進入握放訓練，Level 6–7 自動進入精細動作訓練。
- 每節完成後可選擇記錄 post-session FTHUE Level 4–7，或選擇「未有重新評估」，避免強迫每日進行完整評估。
- 研究介面加入繁體中文及英文切換，所有 Pilot Study 設定、方案說明、結果摘要及 CSV 欄位均支援雙語工作流程。
- CSV 新增 `pre_fthue_level`、`post_fthue_level`、`scenario_id` 及 `scenario_name`，研究版本更新為 `pilot-2.1.0`。
- 「仁濟茶樓」已從活動名稱移除，統一使用「茶樓飲茶」。
- 三個真人手部 GIF 已重新製作為無明顯毛髮及無外框版本。

### 本輪 QA

- 已驗證 Session 2 會載入衣物分類，Session 3 會載入啤牌分類；Level 4–5 與 Level 6–7 均會自動載入正確的動作模式。
- 已完成繁體中文及英文介面切換、研究結果 post-session FTHUE 記錄，以及 CSV 實際下載驗證。
- 已測試桌面 1280 × 800、iPad 橫向及手機 390 × 844；研究設定、遊戲畫面及結果頁沒有水平溢出或程式錯誤。
- `tools/checkjs.sh`、`git diff --check` 及標準 `web_game_playwright_client.js` 回歸測試全部通過。

## 2026-08-10 精細動作 GIF 修正

- 還原上一版筷子及衫夾 GIF，移除新版本中筷子錯誤接觸手部及衫夾方向不合理的畫面。
- 已用八格接觸圖核對完整循環；筷子開合、手指位置、衫夾夾口及彈弓方向一致。

## 2026-08-10 Pilot Study 患者選擇及研究資料管理

- 研究模式加入核心介入描述：「由治療師按照患者當日的 FTHUE level 篩選合適遊戲，再由患者自行選擇遊戲情境的個人化上肢 motor-cognitive dual-task 訓練」，並提供完整英文版本。
- 取消預設固定情境次序；治療師輸入當日 FTHUE Level 後，系統只顯示合資格情境，再由患者自行選擇茶樓飲茶、衣物分類或啤牌分類。
- 五節安排改為彈性而標準化：Session 1 完整基線評估；Session 2–4 簡短 FTHUE 確認；Session 5 完整終期評估。每節均保留相同訓練重複次數、核心分類規則、動作判定及指定 dual-task 難度。
- 設定頁新增紀錄用途：正式研究資料、治療師試玩、病人練習／系統測試。
- 新增本次頁面資料管理器，可把紀錄標示為完成、退出研究、篩選不合格或排除，亦可刪除無用 trial。
- 只有「正式研究資料＋完成」會納入主要分析；試玩、練習、退出及排除紀錄會與正式分析資料分開匯出。
- CSV 版本更新為 `pilot-2.2.0`，新增 `data_use`、`record_status`、`include_primary_analysis` 及 `scenario_selection`。
- 所有 profile 只保留於本次頁面記憶體；重新整理頁面會清除資料，離開前必須匯出 CSV。

### 本輪 QA

- 已以正常介面完成正式研究及治療師試玩兩種 trial，確認正式完成紀錄納入主要分析，試玩紀錄不納入。
- 已驗證把正式紀錄改為 dropout 後會自動排除主要分析，並可刪除治療師試玩 trial。
- 已實際下載非正式／排除 CSV，確認包含資料用途、紀錄狀態及是否納入主要分析欄位。
- 已驗證 FTHUE 改變後情境選項即時更新，患者選擇會寫入紀錄及 CSV。
- 桌面 1280 × 800 及手機 390 × 844 已完成視覺檢查；三個情境及五節安排均沒有水平溢出或互相重疊。
- 兩個 inline JavaScript block、`git diff --check` 及資料管理流程均通過。

## 2026-08-10 Pilot Study 即時回饋及整體體驗

- 網站內的「劑量／dose」統一改為「訓練重複次數／training repetitions」。
- 每節結果頁加入三組可選填即時紀錄：病人意見、OT／OTA 動作品質觀察，以及治療師操作意見。
- 病人意見可記錄難度、趣味、活動動機、繼續使用意願及補充意見。
- OT／OTA 觀察可記錄軀幹代償、分離動作、主動關節活動幅度及具體動作描述。
- 治療師操作意見可記錄操作困難、技術問題及建議改善項目。
- Session 5 額外顯示整體體驗問題，包括整體趣味、感知幫助、繼續使用意願、最喜歡情境及整體意見。
- 所有回饋均加入中英文介面及 CSV，研究版本更新為 `pilot-2.3.0`。
- 研究結果卡在平板及桌面加闊至 720px，手機仍自動改為單欄，以減少欄位擠迫。

### 本輪 QA

- 已用正常表單操作填寫三組即時回饋及 Session 5 整體體驗，並實際下載 CSV 核對所有欄位與內容。
- 已確認 Session 5 整體體驗只在第五節顯示。
- 已確認桌面及手機沒有水平溢出，英文版及繁體中文版標籤均能正確切換。

## 2026-08-10 Pilot Study 研究量度框架 v4.2.0

- 結果頁新增 84 個結構化研究欄位，完整匯出至同一份 CSV；未量度項目保持空白，不以 0 代替。
- T0／T1 加入握力及捏力各三次測試，三次均有數值時才自動計算平均值；任何一次缺失，平均值保持空白。
- 加入評估者盲法、組別猜測、盲法破壞、ADL 完成時間、身體協助、口頭提示次數及任務完成情況。
- 加入訓練暴露及完成情況：實際休息、延長原因、第二區組完成情況、相隔日數、OT／PT／其他上肢訓練、自主練習、住院日數及 T0 至 T1 日數。
- 加入 intervention fidelity checklist，記錄患手、指定工具、姿勢、工具握法、拿取閉手、放置張手、認知流程及回饋設定是否依 protocol 執行。
- 加入不良事件嚴重程度、與訓練關聯、結果、研究偏差、偏差原因、資料影響、修正措施及缺失資料代碼。
- 病人接受程度增加理解度、可操作性及推薦意願，並保留趣味、難度、活動動機及再次使用意願。
- 訓練時間定義為 13 分鐘畫面流程加 2 分鐘即時回顧，合共 15 分鐘；CSV 分開記錄計劃時間及實際畫面流程時間。

### 本輪 QA

- 修正研究結果外層表格沒有顯示的問題；T0／T1 可見探索性結果，Session 5 隱藏評估專用欄位並顯示整體體驗。
- 握力 10、12、11 kg 自動平均為 11.0 kg；捏力 2、3、4 kg 自動平均為 3.0 kg。移除任何一次測試後，平均值即時清空。
- CSV 實際下載成功，共 179 欄；84 個表單欄位全部存在於匯出清單，Session 5 的 900／120／720／600 秒計劃時間正確寫入。
- 桌面 1440 × 1000、iPad 橫向 1180 × 820 及手機 390 × 844 已完成視覺檢查，沒有水平溢出；標準 browser-game client 回歸測試通過。
- 兩個 inline JavaScript block、`git diff --check`、重複 ID、禁止瀏覽器儲存及禁用字詞檢查全部通過。

### 研究限制

- 研究紀錄只存在當次頁面記憶體，重新整理前必須下載 CSV。
- MediaPipe 數據是螢幕互動及追蹤指標，不可當作臨床級運動學量度。
- 完整量度框架可提升 scientific rigour 及報告可分析性，但不能保證課程評分。

## 2026-08-10 Blinded pilot data-collection system（研究模式重建）v5.0.0

### 架構決定 Architecture

- 研究模式由單一頁面重建為 **四個獨立頁面／bundle**，放在 `research/`：
  - `research/index.html` — 角色入口 hub，只有三個大按鈕：盲法評估員、介入治療師、研究員／資料管理。
  - `research/assessor.html` + `assessor.js` — 盲法評估員 10 步 wizard（T0／T1）。
  - `research/intervention.html` + `intervention.js` — 介入治療師 Session 1–5 紀錄及 fidelity checklist。
  - `research/researcher.html` + `researcher.js` — passcode barrier、randomization、allocation、進度、合併及匯出。
  - `research/research.css` + `research/research-common.js` — 共用樣式及工具，內含 **零** allocation／組別／訓練資料。
- 主頁「研究模式」按鈕改為導向 `research/index.html`；原本頁內治療師設定畫面保留，並改由 `index.html?role=intervention` 深層連結開啟，確保現有全部遊戲、患者自選情境及 CSV 流程不受影響。
- 全部相對路徑（`../index.html`、`research.css`），可直接部署到 S3 靜態網站。

### Blinding 設計

- Assessor bundle 不載入、不參照、不 fetch、不儲存任何 allocation／group／session-training 資料；QA 實測 assessor 頁面對 `intervention.js`／`researcher.js` 的網絡請求為 0。
- Assessor DOM／JS state／匯出檔案的違禁字詞掃描結果為空（遊戲介入組、對照組、conventional、adherence、fidelity、Session 1、chosen_scenario、difficulty_track 等）。唯一出現「研究組別」的地方是 protocol 指定的盲法確認句「我不知道participant的研究組別」。
- 研究員頁使用 client-side passcode barrier，只儲存 SHA-256 雜湊（Web Crypto 比對）。臨時預設通行碼只在交付訊息中提供，不寫入網站檔案。頁面已顯示警告：此為 operational blinding barrier，並非 production authentication，正式使用前必須更改。Assessor bundle 完全沒有此 passcode。

### 評估員 wizard（Step 1–10）

- 每頁一個主要任務、`Step N of 10` 進度條、大按鈕 Previous／Save draft／Next、speechSynthesis 語音指示、可摺疊詳細指引、全部互動元素有 `data-testid`、繁體中文＋英文臨床詞、高對比大字。
- 持續顯示的 participant-responsive 休息控制（所有步驟可用）：暫停 condition 計時、開始休息計時、必須選擇原因（Fatigue／Pain／Discomfort／Postural adjustment／Participant request／Therapist safety decision／Other）、Resume 按鈕文字為「患者已準備好，繼續評估」，記錄次數、每次時長、總時長、原因及是否已繼續。**沒有固定 1 分鐘休息。**
- Step 1 匿名 ID 嚴格 `[A-Z0-9_-]`，拒絕空格／姓名／MRN 並顯示警告；盲法確認及「可能已解除盲法」（需原因＋評估員代碼，資料保留並記錄 breach）。
- Step 2 疼痛／疲勞 0–10 大按鈕（數字＋非顏色圖示標籤），包含指定粵語指導語；不安全或未準備好即封鎖 Next、顯示暫停評估並要求原因。
- Step 3 FTHUE-HK 只記錄醫院正式評估結果，顯示指定提示語，不自訂評分規則。
- Step 4／5 握力及捏力三次測試，unable 記為 N.A.（永不為 0），三次齊全才自動平均；設有 start rest 及 ready-next-trial 控制。
- Step 6 ADL 三個內部小畫面（進食／梳洗／穿上衣），採用醫院正式分數；T1 顯示指定一致性提示語。
- Step 7 標準化設定：固定情境「茶樓飲茶」，T0 只可隨機排序一次後鎖定；T1 必須上載 `ParticipantID_T0_settings.json`，核對 ID 後載入並鎖定患側、motor task、工具、pinch type、食物／碟大小、相機位置、認知任務及難度、時間及次序，T1 沒有隨機排序。
- Step 8 每次只顯示一個 `Condition N of 3`，依鎖定次序；三段指導語按 protocol 原文；自動 correct/min、accuracy=(hits+CR)/total×100、Motor DTC 及 Cognitive Accuracy DTC，分母為 0 時顯示「不能計算，請報告raw scores」。
- Step 9 休息紀錄檢視；Step 10 評估後疼痛／疲勞、新症狀、AE、完成情況、自動 delta 及 active／rest 時間、驗證畫面（缺失、範圍、unable 無原因、T0／T1 不一致、active time 不足）、返回修改／確認鎖定；鎖定後只能透過 append-only audit trail 更正（保留原始值、更正值、原因、時間、評估員代碼）。

### 匯出

- T0：`P001_T0_assessment.csv`、`P001_T0_settings.json`；T1：上載 settings JSON 後下載 `P001_T1_assessment.csv`。
- 另設 data dictionary、condition-level raw CSV、rest／adverse-event（含更正紀錄）CSV。全部 UTF-8 BOM、CSV 注入防護、可重新解析。
- 顯著「尚未下載」狀態、下載成功提示，以及未下載時的 beforeunload 警告。

### 介入治療師及研究員

- 介入治療師頁標題「介入治療師模式：Session 1–5」，記錄組別、節次、FTHUE、遊戲／傳統治療、患者選擇的情境、工具、難度、實際 active 時間、participant-responsive 休息、表現、協助、軀幹代償、疼痛／疲勞、技術問題、AE、deviation 及 8 項 fidelity checklist；active 與 rest 時間分開；可於新分頁開啟現有訓練遊戲。
- 全站刪除固定「休息 1 分鐘」：`PILOT_REST_SECONDS` 改為 0，休息階段改為向上計時並等待「患者已準備好，繼續訓練」按鈕；中英文 protocol 文字同步更新。
- 研究員頁：passcode → 1:1 permuted-block randomization（block 2／4／混合，seed 可重現）、分配標籤在按「揭示」前隱藏、參加者進度（T0／T1／S1–S5／缺失／breach／deviation）、CSV／JSON 匯入、只以匿名 ID 合併、分開匯出 `merged_dataset_anonymized.csv` 及 `allocation.csv`。

### 測試模式

- Assessor 及 intervention 均設 TEST001（完整）、TEST002（休息／暫停）、TEST003（捏力 unable＋缺失資料）預設；研究員可一次載入 TEST001–TEST003。測試資料以斜紋橫額及 `test_record=TEST` 欄清楚標示。

### 本輪 QA

- `node --check`：4 個 research JS 檔及 index.html 兩個 inline block 全部通過；無重複 id／data-testid。
- 公式實測：握力 10／12／11 → 11.00；捏力 2／3／4 → 3.00；single motor 20 correct／120 s = 10 CPM，dual 15／120 s = 7.5 CPM → Motor DTC 25%；single cognitive 9／1／2／18 → 90%，dual 7／3／4／16 → 76.7% → Cognitive DTC 14.8%；pain Δ 2、fatigue Δ 3。
- TEST003：捏力 unable → mean 及 trial 全部空白（非 0）；握力缺一次 → 平均值空白；single 表現為 0 → 兩個 DTC 顯示「不能計算，請報告raw scores」。
- 下載實測：5 個檔案成功下載，assessment CSV 117 欄、含 UTF-8 BOM，settings JSON 21 個欄位可重新解析並於 T1 載入及鎖定；ID 不符時顯示明確錯誤及預期檔名。
- 流程實測：ID 格式警告、breach 必填、暫停評估封鎖、休息原因必填、休息期間 condition 計時暫停、ADL 三個小畫面、Condition 1→3 依序、鎖定後輸入停用並可 append 更正（原始值保留）。
- 研究員實測：錯誤 passcode 被拒、臨時通行碼可解鎖、序列 6A／6B 平衡且同 seed 可重現、指派後仍隱藏、按揭示才顯示、匯入評估 CSV 後進度表更新、匯出資料集不含 allocation 欄位。
- beforeunload 實測：有未下載資料時彈出瀏覽器離開確認。
- 版面：1440×900 及 1180×820 四頁均無水平溢出、無 console error、所有互動元素 ≥44px；瀏覽器儲存 API 使用量為 0（localStorage／sessionStorage／cookie 皆空）。
- 標準 browser-game client 回歸測試通過（`qa/blinded-pilot/`），主頁遊戲、`?role=intervention` 深層連結及情境選擇正常。

### 已知限制

- 靜態 client-side passcode 只是 operational blinding barrier，任何人檢視原始碼即可看到雜湊值；不是 production authentication，正式研究前必須更換並配合行政管控。
- 資料只存在於當前頁面記憶體，重新整理或關閉前必須下載；沒有伺服器備份。
- Blinding 依賴使用流程（評估員只用 assessor 頁面、不接觸 allocation.csv），技術上無法防止人為在同一部裝置開啟研究員頁面。
- ADL 及 FTHUE-HK 只記錄醫院正式評估結果，系統不提供評分規則，亦不可取代正式評估。
- 本系統為 pilot／research prototype，並非醫療儀器，不能保證任何臨床療效或課程評分。

### 交付前補充 QA 與修正

- 修正 `/research` clean URL 的 base path、CSS 及三個角色入口連結；`/research` 與 `/research/index.html` 均可正常顯示並開啟正確頁面。
- 研究入口卡片取消瀏覽器預設底線，維持清晰的醫院系統視覺層級。
- 研究員頁不再顯示或記錄臨時通行碼明文；網站檔案只保留 SHA-256 雜湊值，通行碼只於交付訊息提供。
- 再次完成 research JavaScript 語法、主頁 inline JavaScript、實際瀏覽器儲存 API、assessor 禁止披露字詞、assessor script imports 及通行碼明文掃描，全部通過。
- 以標準 browser-game Playwright client 再測 FTHUE Level 4–5 遊戲庫；六個情境、圖片、難度標籤及返回主頁按鈕正常，`render_game_to_text` 回報的 level、mode、duration 及 activities 與畫面一致。

## 2026-08-11 Session 自動回填流程

- 介入資料頁改為最短操作：匿名編號、組別、Session、當日 FTHUE、患側及安全確認後，遊戲組只需選擇情境、工具及難度，再按「開始遊戲」。
- 遊戲完成後新增「返回資料記錄並自動填寫」，自動帶回實際遊戲時間、得分、正確、錯誤、跌落、拿取、暫停、追蹤中斷及技術故障資料。
- 自動回填後只需按「保存並下載 CSV」；檔名包含匿名編號及 Session。
- 協助程度及軀幹代償不會由相機推斷，預設為「未觀察」；病人反應及治療師觀察收進「選填：如有時間再填」。
- 傳統治療組沒有遊戲自動數據，因此保留簡短計時及選填活動名稱。

## 2026-08-11 右側追蹤及提示位置修正

- 將相機畫面中央安全區擴展至整個遊戲畫布：手腕到達相機橫向 12%–88%、縱向 8%–86% 時，已可觸及畫布四邊，毋須把手移到容易漏失的鏡頭邊界。
- 降低 MediaPipe hand detection、presence 及 tracking confidence 至 0.35，改善右半畫面及高齡／慢速手部的偵測連續性。
- 加入五幀中位數濾波、3px dead zone 及按移動距離調整的 EMA；接近目標時加強穩定，較大 reaching movement 仍保持反應速度。
- 短暫漏失偵測的 grace period 增至 750ms；期間保留上一個 cursor 及 grasp 狀態，避免到右下角時突然掉牌。
- 遊戲主要指示改為右上角 270px 內的兩行短提示，次要配對規則縮小放在其下；desktop、iPad 橫向及直向均不與底部目標重疊。
- QA：右下角糯米雞 grasp → carry → release 成功，得分 0→10、correct 0→1、held 回復 none；相機座標 (0.88, 0.86) 映射至 1366×768 畫布的 (1366,768)；七個邊緣雜訊樣本經濾波後最後三點 spread 為 x=0px、y<1px。
- QA：1366×768、1180×820、820×1180 均無水平溢出或提示／目標重疊；暫停→繼續→返回使用正常按鈕操作通過；inline JavaScript syntax、`git diff --check` 及標準 browser-game client 全部通過，console error 為 0。
- 已知限制：雲端無法接駁病房實際 iPad 相機，因此 MediaPipe 的最終手部偵測仍需在 Safari 實機以患側手測試。

## 2026-08-11 右上角提示安全區修正

- 遊戲會量度右上角狀態提示、主要指示及次要規則的實際範圍，並把整個範圍設定為禁止生成物件的安全區。
- 第一局在提示顯示後會再次檢查所有遊戲物件；如有物件落在提示下方，系統會立即重新安排位置。
- 最終瀏覽器測試：1180×820 橫向及 820×1180 直向均為 0 個提示／點心重疊，直向版沒有水平溢出，console error 為 0。
- 視覺檢查確認右上角提示下方保持空白，右側點心仍位於可觸及的遊戲範圍。

## 2026-08-11 防止過早放手

- 握住物件後，不再因一至兩隻手指的短暫追蹤抖動而開始放手；四隻主要手指中至少三隻必須清楚伸直。
- 放手確認時間由 620ms 增至 1000ms，並同步套用於點心、麻雀、啤牌、收衫及插花等握放遊戲。
- 自動測試：拿取成功後持續握拳 1.25 秒仍保持物件；張手 650ms 仍不放下；持續張手超過 1 秒才完成放手；console error 為 0。

## 2026-08-11 Pilot Study 密碼入口

- 首頁按下「研究模式（Pilot Study）」後先顯示大型密碼對話框。
- 密碼使用 SHA-256 比對，不放入網址；正確輸入 `DT123` 才前往資料收集頁。
- 錯誤密碼會停留在首頁並顯示「密碼不正確」，可取消或按 Esc 關閉。
- 820×1180 平板／手機版自動測試通過：對話框顯示、錯誤密碼阻擋及正確密碼跳轉均正常，console error 為 0。

## 2026-08-11 物件邊緣拿取及手抖容錯

- 拿取範圍改為物件半徑加可見手圈半徑；手圈外邊一碰到物件外邊便可開始拿取。
- 接觸目標會保留 450ms，手抖令手圈短暫離開時不會立即清除拿取進度。
- 張手準備時間由 420ms 縮短至 280ms，但仍必須真正握拳並維持 480ms 才會拿到，避免自動吸取。
- 同步套用至點心及使用共用選取器的麻雀、啤牌、收衫和插花等遊戲。
- 自動測試：只在物件邊緣接觸時保持張手不會拿取；模擬短暫抖離後握拳可成功拿取；console error 為 0。

## 2026-08-11 患側定向搬運版面

- 正常遊戲開始前必須選擇左患側或右患側；Pilot Study 直接使用該次記錄內的患側設定。
- 點心配對、衣物分類及插花的可搬運物件由身體中線附近開始，放置目標改到患側外下方。患側名稱直接對應畫面方向：右患側向畫面右外下方，左患側向畫面左外下方。
- 主要提示簡化為「中線拿取 → 向左／右外下方放置」，減少患者不必要地跨越中線或反覆向內側搬運。
- 此版面只提供患側肩外展向外滑動的空間提示，不能單靠鏡頭證明承重質素或肌張力下降；治療師仍需觀察肩胛抬高、軀幹代償及實際 movement quality。
- QA：1180×820 及 820×1180 均已核對患側方向；右患側的籃／花瓶位於畫面右外側，左患側位於畫面左外側。衣物及花材由中線開始；正常流程未選患側時會阻止繼續，選擇後提示清除。

## 2026-08-11：花瓶、麻將及啤牌患側外展方向

- 插花維持花枝由畫面中間拿取；右患側的花瓶放在畫面右側，左患側的花瓶放在畫面左側。
- 麻將及啤牌的候選牌集中在畫面中間，新增患側外下方「放牌區／收牌區」。患者必須先拿牌、移到患側外方，再放手或停留確認，系統才會處理選牌及計分。
- Level 4–5 已驗證完整握住、搬運及持續張手放牌流程；Level 6–7 已驗證停留拿牌、搬運及在放牌區停留確認流程。
- 橫向 1180×820 及直向 820×1180 已檢視左、右患側版面，候選牌、花瓶及放牌區沒有互相遮擋。
- inline JavaScript、`git diff --check`、標準 browser-game client 及 tablet portrait browser QA 全部通過。

## 2026-08-11：修正患側方向及麻將重疊

- 按臨床使用者回報，取消患側方向的鏡像反轉：右患側所有目標固定在畫面右邊，左患側固定在畫面左邊。
- 麻將橫向畫面由兩欄改為最多三欄單行排列，縮小候選組外框並把整組候選牌稍微移離患側放牌區，避免上下兩行互相重疊。
- 手部偵測狀態移到左上方分數列下方，避免遮住右上角遊戲指示。

## 2026-08-11：正式 Pilot Study 納入標準改為 FTHUE Level 5–7

- 正常模式的 Session 1–5 只可選擇 FTHUE Level 5、6或7，Level 4不能開始正式研究訓練。
- T0正式評估如記錄為Level 1–4，資料仍可如實保存，但系統會標示不符合正式納入標準。
- T1仍可記錄實際FTHUE Level 1–7，以保留病人訓練後可能升跌的真實結果。
- Level 4一般遊戲功能保留作治療試用，不納入正式 Pilot Study 主要分析。

## 2026-08-11：Level 4桌面中線模式及Level 5–7手勢分級

- 首頁把舊有Level 4–5合併選項拆成三個入口：Level 4桌面中線、Level 5握放、Level 6–7拇食指捏取。
- Level 4所有情境使用桌面承托概念：物件由畫面下方中線開始，沿中央視覺走廊向前方目標放置；不使用患側外展版面及速度壓力。
- 茶樓飲茶、煮飯、麻雀、啤牌、收衫及插花均加入同一條中央走廊及向前箭嘴；Level 4左右患側均維持中線路徑。
- Level 5使用張手準備、握緊拿取、維持搬運及持續張手放下。
- Level 6–7改用真正的拇指尖與食指尖距離判定：分開準備、捏合拿取、維持捏合搬運及重新分開放下；此判定不代表捏力測量。
- 正式Pilot Study仍只納入FTHUE Level 5–7；Level 4保留為一般臨床試用模式。
- Level 4詳情加入簡短停止提示：如出現肩聳、軀幹傾斜、手指愈握愈緊或疼痛，先暫停；不把桌面承托描述為必然降低張力。
- 修正麻雀放牌區遮擋、Level 4啤牌底部裁切及插花空白花架框。
- 已完成inline JavaScript語法、`git diff --check`、標準browser-game client、1180×820六個遊戲畫面及820×1180關鍵畫面QA；Level 4=`dwell`、Level 5=`grasp`、Level 6–7=`pinch`，console error為0。

## 2026-08-12：Level 4–6 獨立技術驗證

- 建立可重現的 Level 4–6 Playwright 技術驗證套件，不再用舊有 Level 4–5／6–7 合併測試代替逐級證據。
- Level 4 獨立驗證桌面中線停留拿取、向前搬運、正確／錯誤放置及 750ms 追蹤中斷容錯。
- Level 5 獨立驗證張手準備、至少兩指屈曲拿取、hysteresis 防誤放、持續張手放下及異常 landmark 安全失敗。
- Level 6 獨立驗證正規化拇食指 aperture 的 enter／hold／exit hysteresis、分指準備、完整捏取搬運放下及異常 landmark 安全失敗；此功能不量度 pinch force。
- 修正大型 Level 4 物件令兩個目標碰撞區重疊時，程式固定選第一個目標的錯誤；現在從所有相交目標中選最近者。
- 修正左上 HUD 與右上指示被合併成整幅大禁區的幾何錯誤；改為獨立安全區，並以標準化三槽位置防止 Level 5–6 點心重疊及減少隨機 path-length 變異。
- 最終單輪結果為 47/47：Level 4 13/13、Level 5 17/17、Level 6 17/17；同一全套測試連續 30 輪全通過。
- 原有 Level 3 Data Collector 10/10 及 Sandbox Engine 10/10 回歸測試保持全通過；標準 browser-game client 三輪、1180×820 橫向及 820×1180 直向視覺 QA 全通過，console error 0、水平／垂直 overflow 0。
- 結論只屬 software technical verification，不代表臨床效度、病人安全性、治療成效或醫療儀器等效性；仍需真實 iPad Safari、相機距離、病房光線及目標患者作實機驗證。

## 2026-08-12：Level 3–6 單一網站入口、教學影片及手勢偵測改善

- 主頁新增 FTHUE Level 3 卡片，直接連到保留原有驗證邊界的 `Level 3 Bilateral Sandbox`；Level 3–6 現由同一網站入口進入，但不把 Level 3 引擎硬併入 Level 4–6 手勢引擎。
- Level 3、4、5、6 各加入一段 8 秒、960×540、H.264／yuv420p 的無聲教學動畫，分開交代環境設定及受訓動作；每張首頁卡片的 GIF／動作示意旁均有播放按鈕。
- Level 5 修正個人化 grasp calibration 錯誤綁定舊 Level 4 stratum 的問題；Research Mode 及普通模式現均要求持續張手與握拳各 2 秒，再套用該次 session 的個人 enter／exit threshold。
- Level 6 改用掌長及掌寬的較穩定 normalization、降低 MediaPipe presence／tracking confidence、加入 120ms gesture confirmation，以及個人化 pinch enter／exit／open threshold；校準及失敗提示要求手腕、拇指及食指同時入鏡。
- Level 6 明確提示先以裸手校準；如筷子或夾子遮擋指尖，改用裸手螢幕捏取。系統只量度 normalized thumb-index aperture，不量度 pinch force。
- 最終 QA：Level 3 回歸測試 20/20、Level 4–6 技術驗證 47/47、標準 browser-game client 通過；820×1180 iPad 直向版有 4 張 Level 卡及 4 個影片按鈕，影片 metadata／播放、Level 3 路由、水平及垂直 overflow、console error 全部通過。

## 2026-08-12：臨床安全檢討 P0 修改（Level 3–6）

### 1. 共用強制安全確認畫面
- Level 4、5、6 進入相機／遊戲前，以及 Level 3 進入相機／Session 前，均先顯示 `#screen-safety`（Level 3 沙盒為頁內 `#safetyGate`）。
- 內容為繁體中文、治療師監督框架，逐項列出：醫學狀況穩定並可安全坐穩、患側上肢已有承托、已檢查疼痛／疲勞／手部繃緊基線、先做三次練習、患者隨時可休息或停止、重視動作質素而非分數。
- 必須勾選「治療師確認」後「確認，繼續」才會啟用；重要安全資訊全部直接顯示，不再收藏在「顯示詳情」內。
- 明確聲明本程式不會自動偵測代償、肌張力或痙攣。

### 2. Level 4–6 遊戲畫面常設「休息」／「停止」
- 遊戲 HUD 常設大按鈕 `button-game-rest`、`button-game-stop`，另有 `button-compensation-observe`。
- 「休息」會暫停計時（`state.paused`）並顯示「放下雙手、放鬆肩膀」，必須按明確的「繼續」才恢復。
- 「停止」先要求選擇停止原因（患者要求／疼痛／疲勞／技術問題／其他），記錄 `stop_reason`、`stopped_early` 後安全結束並返回結果畫面，不會意外匯出或遺失資料。

### 3. Level 4：距離校準與代償提示
- 校準畫面加入治療師簡報：必須先做 3 次練習，採用「無肩膊抬高、無軀幹傾斜、無疼痛、手指無愈來愈繃緊」的最遠距離；用語改為「慢慢向前滑」，不施加速度壓力。
- 治療師可人手記錄觀察到的代償；同一項代償第二次被記錄時暫停並提示縮短距離或降低難度。此為人手觀察確認，**程式不會自動偵測代償**。

### 4. Level 5：輕握用語、個人化放手門檻、最長持物時間
- 所有面向患者的「握拳／握緊」用語改為「輕輕合手拿起」「保持輕握」；只有內部變數與程式註解保留舊命名。
- 介面明確說明放手採用患者自己校準的張開幅度，不需要張到完全伸直；判定邏輯使用該次 session 的個人 threshold。
- 加入保守的最長持物時間（預設 5 秒），逾時暫停並提示「放下物件、張開手、放鬆」，需治療師／患者明確恢復；記錄 `hold_timeout`。
- 連續延遲或未能放手達設定次數時暫停並提示重新評估，記錄 `repeated_release_difficulty`。
- Level 5 預設使用較大物件及較短距離。

### 5. Level 6：裸手 aperture 為預設
- 明示裸手拇食指張開幅度偵測為預設方式；實物木釘或筷子屬治療師可選的額外練習，軟件**不會偵測夾力**，亦不把筷子描述為標準。
- 提示改為「只需輕輕捏合，不要用盡力」；個人化 aperture 校準保留。
- 指尖被遮擋導致追蹤失敗時，明確指示改用裸手。

### 6. Level 3 沙盒
- 面向患者的「雙手合攏／互扣／保持合攏」用語，全部改為患手在承托下輕輕擺放、手指不需互扣或用力握住。
- 頁面頂部加入顯眼紅色警告：肩膊拉扯、手部愈來愈繃緊、軀幹側傾或疼痛須立即停止；原有「只供治療師與工程人員作影子測試」的監督警告保留。
- 「目標抬高角度 30/45/60」改名為中性的「節次協議標籤 A/B/C」，因實際任務是桌面橫向滑行；舊有數值欄位（`targetElevationDeg`／`therapist_selected_target_elevation_deg`）以 `PROTOCOL_VARIANT_LEGACY_DEG` 映射保留，向後相容既有匯出與 R pipeline。
- 橫向距離預設改為「短」，並提示由治療師選出無疼痛、無代償的範圍。

### 7. 相機失敗處理
- Level 4–6 及 Level 3 均以頁內錯誤面板顯示，附「重新嘗試」與「返回」按鈕，不再只用 alert 或無限等待。
- 分別處理 getUserMedia 不支援、權限被拒、找不到裝置、裝置被佔用及一般錯誤；只向患者顯示簡短技術代碼，不顯示原始錯誤堆疊。

### 8. 資料欄位與研究安全性假設
- Session CSV 追加（向後相容）欄位：`safety_ack_level`、`rest_count`、`rest_total_sec`、`stop_reason`、`stopped_early`、`tracking_failure_count`、`hold_timeout_count`、`release_delay_count`、`repeated_release_difficulty`、`difficulty_reduced_count`、`therapist_observed_compensation`。
- 研究入口新增安全性假設段落：在治療師全程監督、個別化無痛範圍、上肢有承托、緩慢自訂節奏及即時休息的條件下進行；結果指標為可接受的完成率、無介入相關 SAE、無持續屈肌張力惡化訊號，**不表述為「沒有傷害」**。
- 同時列明程式不會自動量度肌張力或痙攣。

### 9. 測試結果
- Level 4–6 技術驗證（Playwright，`sandbox/level4-6-technical-validation`）：**120/120 通過**（Level 4 41、Level 5 41、Level 6 31），console error 0，新增安全確認、休息／停止、代償提示、hold timeout、放手困難、相機錯誤及資料欄位檢查。
- Level 3 沙盒 node:test：**29/29 通過**（原有 20 項回歸 + 9 項新安全與用語測試）。
- `index.html` 兩個 inline script 及 research／sandbox 全部 JS 通過 `node --check`。
- 未引入任何新依賴或後端。

### 10. 仍需真實 iPad 床邊驗證的限制
- 相機權限、裝置佔用及 Safari 私隱提示的實際行為，只能在真機測試。
- 5 秒最長持物時間及放手困難門檻為保守預設值，須按實際患者反應調整。
- 代償、肌張力及痙攣全部依靠治療師臨床觀察，程式無法自動判斷。

## 2026-08-12：桌面相機偵測及 participant-first 精簡介面

- Level 3 不再把 `poseWorldLandmarks` 缺失視為追蹤失敗；改以肩寬正規化的 2D 手腕距離判定，讓直立但稍向下傾的 iPad 可在桌面視角繼續運作。
- Level 3 放手只會在側滑進行中觸發物件消失，不會被雙手非同步警告攔截；中央準備階段仍保留非對稱防線。
- Level 4 掌部偵測只要求 wrist 與四個掌指基部 landmarks，不因桌面視角下指尖短暫遮擋而整體失效。
- Level 5 放手門檻改為按患者當日校準的可達張手幅度，降低近乎完全伸指才可放手的要求。
- 相機要求提升至 960×720 ideal、24–30 fps，校準提示明確要求直立 iPad 稍向下傾，肩、肘、手及完整路徑入鏡。
- 參與者主要流程已大幅減字：Level 卡、設定、安全確認、校準、規則及結果畫面只保留動作與安全關鍵詞；重複圖說隱藏，活動目標及校準長說明改為摺疊詳情。
- 保留治療師全程監督、停止準則、Level 3 影子測試限制、私隱及臨床／技術限制，不以減字換取安全資訊缺失。
- 回歸結果：Level 3 Data Collector + Sandbox **31/31**、Level 4–6 **120/120**、iPhone／iPad 版面 **7/7**；inline JavaScript 語法檢查通過。
- 真實 iPad Safari 的鏡頭高度、向下傾角、病房光線、衣袖／桌面遮擋及患者手部姿勢仍需床邊驗證。

## 2026-08-12：iPad 左右映射、桌面備援及握放校準修復

- 修正普通模式校準畫面把鏡像影片及已映射 overlay 同時反轉的錯誤；現在影片只鏡像一次，綠點、遊戲座標及患者看到的方向一致，並保留「左右反轉」按鈕作真機例外處理。
- 修正 Level 3 原本未鏡像相機、但方向選單仍預設為相反 X 軸符號的錯誤；相機、Pose landmarks、中央線及左右目標現在使用同一顯示座標。
- Level 4 在桌面遮擋指尖或 Hand Landmarker 單幀失效時，新增患側 Pose wrist 備援；Hand 模型失敗不再阻止可用的 Pose 模式開始。
- iPad／iPhone 預設使用 MediaPipe CPU delegate，其他裝置先試 GPU，失敗後亦會重試 CPU；Hand 及 Pose confidence 降至較適合桌面遮擋視角的保守門檻。
- 修正 Level 5 舊 grasp score 因距離比例被 clamp 而令張手與屈曲手接近同分的問題；現在至少兩指屈曲才進入握取，至少三隻主要手指重新張開才放手，並保留患者當日個人化 threshold。
- 修正 Level 5／6 校準的循環依賴：舊版要先通過未校準的通用手勢判定，才會收集 closed samples；新版先量度張手／張指基線，再以同一人的相對變化收集輕合手／輕捏數據。
- Level 3 預設畫面移除研究參數、遙測、console、圖例及長篇 footer，只保留安全提示、相機、校準、Session 控制、目標、分數及一句動作提示；目標改成高對比圓形並使用「中央／向左／向右」。
- 回歸結果：Level 3 **31/31**、Level 4–6 **120/120**、鏡像／CPU／Pose fallback／握放規則 **5/5**、iPhone／iPad 版面 **7/7**，inline JavaScript 及 `git diff --check` 通過。
- 以上仍屬軟件與模擬驗證。真實 iPad 相機曝光、桌面遮擋、個別中風手姿勢及 Safari MediaPipe 行為，必須由同一部實機重新測試後才可判定是否真正解決。
## 2026-08-16 — Level 3 安全確認文字定稿
- Level 3 進入遊戲前的標題改為「開始前安全確認（FTHUE Level 3）」。
- 動作要點明確列出：雙前臂置於桌面毛巾、好手帶動患手向患側肩外展及外側滑動、毛巾跟手、軀幹不側彎或旋轉。
- 共用安全清單合併成五項：坐姿及承托、開始前評估、3 次無痛試做、可隨時休息／停止、慢穩而不追求次數。
- 回歸結果：介面及 iPad 版面 **8/8**、Level 3 **31/31**、Level 4–6 **120/120**；直向及橫向安全畫面均無橫向溢出，確認後「繼續」按鈕正常啟用。

## 2026-08-16 — Level 3 動作品質警示及 Level 5 放手偵測修正
- Level 3 訓練提示修正為：肩外展向患側外滑；手肘按能力保持或逐步伸直；避免左右不對稱及軀幹代償。肩外旋不是此遊戲的指定訓練方向。
- 在可見肘部 landmarks 足夠穩定時，加入持續伸肘角度下降及患側手腕向內偏移的影像提示。提示只代表 screen-space 動作品質警示，不是肩關節旋轉、肌張力或痙攣的臨床量度。
- 錯誤模式持續約 350 ms 才觸發，降低單幀誤報；相機框邊緣短暫閃動並在既有提示欄顯示「治療師請即時檢查」，不新增遮蓋手部或目標的浮動視窗。
- Level 5 進入握取仍要求至少兩指屈曲；持物後只需兩隻主要手指重新張開便可放手。張手／輕合手校準採用患者當日範圍，並縮短校準及放手等待時間。
- 保留真機限制：單鏡頭不可直接判定肩關節旋轉、承重質素、tone 或 spasticity；上述提示必須由治療師觀察確認。
- 最終 iPad 1180×820 視覺驗收：警示同步顯示於首屏頂部安全列，安全列及相機邊框短暫閃動；不覆蓋相機畫面，亦無水平 overflow。
- 最終回歸：Level 3 **23/23**、tracking/layout **14/14**、Level 4–6 **120/120**；全部 inline script 語法檢查通過。

## 2026-08-16 — Level 3 安全確認三項精簡
- 開始前安全確認改為用戶核定的三項內容：監督與立即停止、毛巾承托側滑與軀幹正中、三次無痛試做與慢穩休息。
- 保留治療師確認勾選及原有即時停止／動作品質警示；刪除重複清單文字。
- 回歸結果：Level 3 **23/23**、iPad／iPhone layout **8/8**、inline script 語法及 diff check 通過。

## 2026-08-16 — Level 4 安全確認三項精簡
- Level 4 開始前畫面改為用戶核定的三項內容：監督與停止準則、滑板離身 10–15 cm 的安全前滑姿勢、三次無痛試做與可隨時休息。
- Level 4 模式隱藏原有重複監督句及詳細動作段落，只顯示三項核定文字；治療師確認勾選、返回及繼續機制保留。
- Level 5–6 的既有共用安全內容不受影響。
- 回歸結果：Level 4–6 技術驗證 **120/120**、iPad／iPhone layout **9/9**、inline script 語法及 diff check 通過。

## 2026-08-16 — Level 5 安全確認五項精簡
- Level 5 開始前畫面改為用戶核定的五項內容：患手伸手／輕合／張手、軀幹正中、三次無痛試做、慢穩及可休息、治療師監督與停止準則。
- Level 5 模式隱藏原有重複監督句及詳細動作段落；治療師確認勾選、返回及繼續機制保留。
- Level 4 與 Level 6–7 的安全內容不受影響。
- 回歸結果：Level 4–6 技術驗證 **120/120**、iPad／iPhone layout **10/10**、inline script 語法及 diff check 通過。

## 2026-08-16 — 所有 Level 跳過獨立安全確認頁
- 一般參加者流程不再顯示「開始前安全確認」中轉頁。
- Level 3 從級別選擇直接開啟雙手外側滑動模組；Level 4–7 從設定直接進入相機校準；重玩亦直接返回校準。
- 安全頁程式保留供研究／QA檢查；遊戲內休息、停止、相機錯誤及動作品質警示全部保留。
- 回歸結果：Level 3 **23/23**、全站流程及版面 **11/11**、Level 4–6 技術驗證 **120/120**；inline script 語法及 diff check 通過。

## 2026-08-16 — Level 6–7 安全確認文字定稿
- Level 6–7 安全內容改為用戶核定的五項：患手伸手／輕捏／張指、軀幹正中、三次無痛試做、慢穩及可休息、治療師監督與停止準則。
- 一般參加者流程仍按最新決定直接跳過安全確認頁；文字保留供研究／QA或日後重新啟用。
- 回歸結果：Level 4–6 技術驗證 **120/120**、全站流程及版面 **12/12**、inline script 語法及 diff check 通過。

## 2026-08-17 — Level 3 患側方向及單一步驟啟動修正
- Level 3 不再預設左患；治療師必須先選「左手患側」或「右手患側」，否則開始按鈕維持停用。
- 每次循環固定為「中央 → 患側肩外展外滑 → 返回中央」，完成後不再錯誤切換至健側方向。
- 首次患側外滑會按實際 landmark 位移自動綁定左右座標，避免前置鏡頭鏡像與實際患側不一致。
- 「開始 Level 3 遊戲」單一按鈕會建立 session、啟動本機相機及進入校準；相機失敗時顯示可重試錯誤，不會停在無反應狀態。
- iPad 推論間隔改為 50 ms，其他裝置 40 ms；移除重複的 canvas 相機重畫，並將訓練錄影降至 12 fps，減少同一裝置上的處理競爭。
- 自動回歸 **51/51 通過**；標準遊戲 runner 確認右患啟動後 `sessionActive=true`、`targetDirection=RIGHT`，互動式 iPad QA 亦確認左右患側選擇及相機錯誤 fallback 無 console error。

## 2026-08-17 — Level 3 共用遊戲庫與 Level 4 複合關節控制修正
- Level 3 不再跳往獨立診斷頁，現可直接進入插花、茶樓飲茶、衣物分類、啤牌及麻雀遊戲。
- Level 3 使用雙腕中點及已鏡像的畫面座標；右患側外滑只會令游標向右，左患側外滑只會令游標向左。
- Level 3 茶樓完整循環已驗證：中央停留拿取、向患側外滑、目標停留放置，正確計分。
- Level 4 不再以手腕絕對高度控制點心。向上移動必須同時出現患手前移及肘伸直；回到約 90° 肘屈曲起點時點心向下。
- 患側聳肩但沒有肘伸直時，點心不會向上，訓練模式會顯示「患側聳肩 · 請治療師即時糾正」。
- MediaPipe 深度 Z 與畫面 Y 均作前伸變化參考，以支援側坐桌旁及不同 iPad 角度；判定仍是技術提示，不代替治療師臨床觀察。
- 全站 Node 回歸 **84 passed、0 failed、3 skipped**；Level 4–6 技術驗證 **121/121**；標準遊戲 runner、iPad 1024×768 及 console error 檢查通過。

## 2026-08-18 — Level 4 實拍抖動與過早放置修正
- 按同一張枱、iPad 約一米前方的實拍片檢查後，確認原本控制器會把細微 landmark 抖動當成肘伸／肘屈，並在未接近完全伸直時過早完成放置。
- 肘角度改用最近 5 幀中位數平滑；相對起點少於 6° 的變化不會驅動點心，並須連續 3 幀確認後才視為真正開始伸手。
- 點心的垂直位置現在由平滑後的患側肘角度直接控制：肘伸直向上、肘屈曲向下；鏡頭方向只作方向紀錄，不再直接推動點心。
- 每節按校準起點推算患者的接近完全伸直角度；未達至少 95% 伸展進度時即使碰到目標亦不會放置，畫面只提示繼續伸直手肘。
- 離線快取版本已更新，避免 iPad 繼續載入舊控制器。
- 驗證結果：Level 4–6 技術驗證 **125/125**（Level 4 **48/48**）；追蹤回歸 **21/21**；inline scripts、service worker 語法及 diff formatting 全部通過。

## 2026-08-18 — 點心尺寸、分層位置及目標保護
- 按實機截圖縮小叉燒包、糯米雞、燒賣及蝦餃的活動物件尺寸，移除蝦餃原有過大的 1.45 倍比例。
- 點心起始位置改為高低錯落排列，增加上方空間利用，避免所有物件集中在同一水平線。
- 所有活動物件均加入目標保護區；普通點心及動物干擾物都不可生成在蒸籠／其他目的地之上。
- 擁擠畫面的 fallback 亦必須保留提示及目標保護，不會再以強行重疊方式生成。
- iPad 直向 820×1180 及橫向 1180×820 視覺檢查確認點心、標籤與蒸籠目標沒有遮擋。
- 驗證結果：Level 4–6 技術驗證 **125/125**、追蹤回歸 **21/21**；inline scripts 及 diff formatting 全部通過。

## 2026-08-18 — 手機相機預覽修正
- 手機直向遊戲時，相機由全螢幕背景改為右下角固定小預覽窗；MediaPipe 仍使用原始相機串流解像度。
- 加入 `webkit-playsinline` 及 runtime inline playback 設定，避免 iPhone 將相機影片切換成原生全螢幕。
- Service Worker 升級至 v8，確保裝置取得新版手機介面。

## 2026-08-18 — Level 3 每回合圖案輪換
- 茶樓飲茶每回合從燒賣、蝦餃、叉燒包及糯米雞抽出下一款；麻雀擴充至一至六筒；啤牌擴充至紅心、階磚、梅花及黑桃。
- 每次完成放置後才更新下一回合，活動物件與目的地會同步更換；中央拿取、向患側外滑及患側放置的動作流程不變。
- 抽選會排除上一回合的款式，避免連續出現同一圖案。
- 互動瀏覽器測試各主題連續運行 10 輪：全部物件與目的地配對正確、沒有連續重複、沒有 console error。
- iPad 1180×820 及手機 390×844 畫面已檢查；遊戲區完整貼合 viewport，沒有水平 overflow。
- Service Worker 升級至 v9，避免裝置沿用舊圖案池。

## 2026-08-19 — Level 6–7 夾仔輕按偵測修正
- 夾仔模式不再沿用 Level 5 的整手握合判定；改為專用拇指至食指／中指 aperture 訊號，容許兩指或三指操作低阻力夾仔。
- 校準以同一位使用者「放鬆打開」與「輕按」的相對差值建立個人門檻；所需差值及進入門檻均降低，毋須握拳或用力壓實。
- 保留 hysteresis 及 60 ms 穩定確認，避免相機抖動造成反覆誤觸；放鬆後會使用較低退出門檻正常放下。
- 手部 landmark 要求縮減至夾仔判定所需的拇指、食指、中指及掌部基準，減少工具遮擋無名指／小指時整體偵測失敗。
- 驗證結果：手勢追蹤回歸 **28/28**、Level 4–7 技術驗證 **126/126**、inline JavaScript 及 diff formatting 通過。
- Service Worker 升級至 v16，避免 iPad 繼續沿用舊夾仔偵測程式。
2026-08-19 — Level 4 release media privacy
- Replaced the three proposed scene GIFs with reproducible PIL-drawn illustrations generated by `tools/generate_level4_safe_gifs.py`.
- The bowling, bus-card and mahjong assets contain no photographs, captured video, identifiable people or QA recordings.
- Renamed the runtime assets from `*_real.gif` to `*_illustrated.gif` so the repository and audit trail describe their origin accurately.

## 2026-08-19 — Level 4 實景示範 GIF 及適應性進度（治療師確認制）
- **實景示範 GIF**：保齡球、巴士拍卡及洗麻雀改用已審視的實景 GIF（`img/advanced/level4_bowling_real_life.gif`、`level4_buspay_real_life.gif`、`level4_mahjongwash_real_life.gif`）。畫面內沒有人臉、沒有可識別人物、沒有商標。
- 常數更名為 `LEVEL4_GUIDE_ASSETS`（保留 `LEVEL4_SCENARIO_GIFS` 別名），活動庫縮圖及設定流程的示範圖同步更新；舊有 `*_illustrated.gif` 已從 `img/advanced` 移除並不再被引用，`tools/generate_level4_safe_gifs.py` 標示為已停用。
- `scripts/build-dist.sh` 加入三個 GIF 的存在性守門；`dist/public/offline-assets.js` 已包含三個 GIF，離線可用。
- **適應性進度**：新增獨立模組 `fthue-adaptive-progression.js`。級別次序為 Level 3 早期 → Level 3 後期 → Level 4 早期 → Level 4 中期 → Level 4 後期 → Level 5 → Level 6 → Level 7。
- 進階與退階同樣需要連續 **15** 次有效試作。有效成功累加成功連續數並清零失敗連續數；有效失敗或治療師確認的代償累加失敗連續數並清零成功連續數。
- 校準失敗、暫時追蹤中斷、遮蔽、相機錯誤、技術故障，或 landmark 信心不足的試作屬**無效**：既不累加亦不清零任何連續數，畫面顯示「追蹤／校準問題，本次不計」。
- 達 15 次時只顯示治療師參考卡（進階／退階），**軟件不會自動評估 FTHUE 級別，亦不會自行更改級別**。治療師須明確按「接受」或「不接受」；接受只更新程式內的訓練階段（供選遊戲用），不接受則維持級別，兩者都會重設連續數。最高／最低級別只顯示維持建議。
- 試玩模式不會出現臨床級別建議，只顯示中性的「試玩連續成功 x/15」練習進度。
- 訓練中顯示「有效連續成功 7/15」／「有效連續失敗 4/15」，沒有使用 emoji，繁體中文為主、研究英文介面有對應文字。
- **試作定義**：一次完成的任務循環（一次放置、一次抹淨玻璃、一次推保齡球、一次洗麻雀弧、一次拍卡、一次啤牌／衣物分類），絕不使用逐幀偵測；每個結果以 trial id 守門，最多只計一次。
- 已接上的完成事件：`transport_place`（茶樓／Level 3–4 前送放置）、`grasp_release`（Level 5–7 握放／捏放）、`level4_wipe`、三個獨立 Level 4 遊戲（經 `__level4GameRuntime.addScore`）、`cards_place`、`laundry_place`。尚未接上：煮食分步（`cookAdvance`，屬步驟非完整試作）、麻雀和牌／退回（`mjWinRound`／`mjUndo`，屬認知選擇）、插花擺放（`flowersUpdate`，無對錯判斷）。
- 原有代償重複兩次的暫停及降難度行為完全保留；所有私隱、離線及相機行為不變。
- **驗證結果**：`bash tools/checkjs.sh` 全部 OK（blocks 0–6）；`node --check service-worker.js` OK；`node --test tests/adaptive-progression.test.mjs` **18/18**；全套 `node --test tests/*.mjs` **125 項／122 通過／0 失敗／3 項為原有 skip**（同時修正兩項原有 cache 版本失敗）；`bash scripts/build-dist.sh` 產生 `dist/public` 120 files；`git diff --check` 通過。
- 無相機瀏覽器煙霧測試（headless，無人物截圖）確認：「有效連續成功 7/15」、無效試作保留連續數、15 次後出現治療師參考卡、接受後階段由 Level 5 更新至 Level 6 並重設連續數，`pageerror`／`console.error` 均為空。
- Service Worker 升級至 `fthue-rehab-v23-20260819-level4-real-life-gifs-adaptive`。


## 2026-08-19 Level 4 bedside preflight repair

- After the therapist marks the supported flexed start and extended end, Level 4 stays locked until three live, ordered 下方起點 → 上方終點 → 下方起點 checks complete. Participant-specific endpoint calibration remains sign-safe: flexed maps to progress 0 and extended to progress 1 even if the raw 2D elbow-angle sign is inverted.
- The calibration strip visibly shows the current raw 2D elbow angle (when tracked), normalised progress, exact recognised state (下方起點 / 伸肘中 / 上方終點) and the 0/3–3/3 verification count. Missing tracking, reversed order and stalled motion keep the game locked and show retry guidance. QA snapshots expose gameReady, preflight, verification and state fields.
- Wipe-window, wash-mahjong and bus-pay require preflight pass plus extension → maintained extension → outward arc; bus-pay additionally requires target dwell. Wipe coverage is wider (16×10 grid, broader active region, 1.80-cell brush) while an updated movement anchor prevents stationary jitter accumulating. Bowling releases on a clear valid flexion reversal after extension.
- Deterministic tests cover manual endpoint capture, three ordered cycles, inverted raw-angle direction, UI readouts, missing/reversed/stalled tracking, preflight gameplay lock, path wording and immediate bowling release. A flexion-return verifier bug was corrected so a genuine partial return can time out as stalled.
- Validation: node --test tests/*.mjs = 130 passed, 0 failed, 3 skipped; bash tools/checkjs.sh; node --check level4-elbow-calibration.js; node --check level4-three-games-module.js; bash scripts/build-dist.sh (120 files, 71M); and git diff --check all passed.
- Bedside caveat: software coverage is synthetic only. Confirm tracking, available elbow excursion and all three preflight cycles on the intended iPad, seating and lighting before clinical use. No real-person media was added or reviewed.


## 2026-08-19 Level 4 real-device repair (anchor lock, live camera, real mahjong)

**Root causes found in the shipped code (from the therapist's on-device numeric traces; no recording was opened):**
1. `evaluateEndpoints()` / `applyCandidate()` accepted a **support-only** calibration (`radial` / `depthZ`) when every elbow-intrinsic primary (`angle`, `spanRatio`, `worldSpan`) failed separation. On the real iPad the captured angle span was only 1–6°, so the two captures unlocked the games on wrist depth alone. Progress then snapped between 0 and 100, a flexed arm could read 1.00 and an extended arm 0.00, and the preflight reported "sequence reversed" repeatedly.
2. `angleRetention()` fell back to the raw, unqualified angle, so the outward arc silently paused (`arcExtensionGate .45`) and 巴士拍卡 could never register a tap.
3. There was no conflict detection between signals, no absolute per-frame angle-jump limit and no dropout hold: one 32° landmark glitch or a single lost frame changed the result.
4. 保齡球 released only after a large return excursion (peak−0.08 plus a per-frame drop), which felt delayed. 保齡球 (`#1b1f2b`) and 巴士拍卡 (`#dfe6e6`) painted an opaque full-canvas background over the live patient view. 洗麻雀 drew white numbered rectangles in a tidy pattern with no sound.

**A. Detection (level4-elbow-calibration.js)**
- Endpoints and sign are captured **once** per signal by the two therapist captures and then frozen (`buildSignLock`, `state.locked`). Preflight and gameplay can never re-invert, re-learn or auto-recapture; only an explicit new 標記 releases the lock.
- Canonical progress is forced by the clinical anchors: the flexed capture is exactly 0 and the extended capture exactly 1 (`anchorPriority ['angle','spanRatio','worldSpan']`, `anchorShare .72`, `anchorBound .22`, `anchorEndpointEpsilon .02`). There is **no dependence on anatomical full extension** — beyond the captured extension stays 1.
- `requirePrimarySignal`: at least one qualified elbow-intrinsic primary is mandatory. A depth-only or support-only capture is refused with stage `retry`, reason `no-primary-signal` and 「未量到手肘動作 · 請調整鏡頭角度」 plus the 45° side-view instruction. `angleRetention()` no longer falls back to an unqualified raw angle; the arc reports `arc-blocked-no-retention-signal` instead.
- World/depth can never overrule the anchor: a non-anchor signal disagreeing by more than `conflictTolerance .35` for `conflictFrames 10` is suppressed (`conflictReason = <key>-conflicts-angle-anchor`).
- Dropout / outlier robustness: `maxAngleStepDeg 30` replaces a whole glitch sample with the last accepted one (reported as `angle-glitch`), `dropoutHoldFrames 8` holds the last valid progress on a short tracking loss (`tracking-dropout-hold`) instead of failing the cycle, and `verificationReverseFrames 3` debounces reversal before "sequence reversed" is shown. Three clinically correct cycles now always pass the preflight.

**B. 點心 (index.html)** — the carry lane stores `bottomY = max(pickupY,targetY)` and `topY = min(...)`; the height is `bottomY + (topY-bottomY) * canonical progress`. X is locked to the lane. Flexion can therefore never move the item upward, even when the plate sits below the pickup slot.

**C. 保齡球** — release now happens on the first stable reversal or return (`peak >= .55` with a per-frame drop, `dropFromPeak >= .035` for 2 frames, or `dropFromPeak >= .06` immediately), so there is no perceptible delay. Pins topple on impact and settle. The live camera is drawn first (dim 0.30) and the alley is composited at `globalAlpha .62` over `rgba(27,31,43,.26)`.

**D. 巴士拍卡** — camera first (dim 0.22), bus interior and windows at `globalAlpha .62` over `rgba(223,230,230,.26)`, reader opaque. Flow is extend → hold extension → outward arc → reader dwell → one WebAudio 嘟. The arc uses the wrist lateral signal, and lateral excursion freezes reach rather than collapsing it to 0.

**E. 洗麻雀** — real Hong Kong tile faces from the existing `img/advanced/mahjong_atlas.png` through `__level4GameRuntime.drawMahjongTile` (procedural engraved-ivory fallback only if the atlas has not loaded); no white numbered cards and no new copyrighted or real-person media. Per-round Fisher–Yates shuffle with stable randomised positions, rotations, scales and pile order (`level4Prng`, `level4MahjongShuffle`), reshuffled every third valid wash step and on each new round. Procedural WebAudio clacks (filtered noise burst) fire only during an active valid wash, with a ≥90 ms rate limit in both the module and `playMahjongShuffleClack()`. The camera is the bottom layer here too (dim 0.26) with a translucent table.

**F. 抹窗** — unchanged and still enlarged: 16×10 grid, broader active region, 1.80-cell brush.

**G. Housekeeping** — service worker cache version bumped to `fthue-rehab-v25-20260819-level4-anchor-camera-mahjong`; nothing was committed, pushed or published.

**Validation**
- `bash tools/checkjs.sh` OK (blocks 0–6); `node --check level4-elbow-calibration.js`; `node --check level4-three-games-module.js`.
- `node --test tests/*.mjs` per file: adaptive-progression 18, cooking-level-guide 2, level4-bedside-preflight 4, level4-games-behavior 10, level4-independent-games 8, **level4-real-device-repair 25 (new)**, level4-stabilization-arc 12, level4-two-pose-calibration 13, level67-interactions 5, research-auth 14, tracking-regression 29, ui-layout 15 — 0 failures.
- New deterministic coverage: clinical anchors 0/1, frozen sign lock, support-only capture refusal, world/depth conflict suppression, single-frame 32° angle outlier, one-frame dropout hold, three-cycle preflight pass, shallow-range rejection, 點心 Y direction and jitter-free linearity, immediate bowling release and pin settling, arc block without a retention signal, no reach collapse from lateral motion, camera-first render order plus opaque fallback for all three scenes, mahjong disorder/shuffle determinism and clack throttling.
- `bash scripts/build-dist.sh` → `dist/public` 120 files; `git diff --check` clean.
- Camera-free browser QA (headless, synthetic canvas capture stream fed into the app's own video element, no real person): `qa_app_scenes_with_synthetic_camera.png` shows the patient layer visible behind 保齡球, 巴士拍卡 and 洗麻雀; `qa_real_mahjong_tiles_from_app.png` shows the real 筒/索/萬/東南中發 faces rendered by the shipped tile renderer.

**Real-device caveat** — all evidence above is synthetic. On the intended iPad, the therapist must still (1) place the camera roughly 45° to the side so the elbow angle separates the two captures, (2) confirm the calibration strip shows a qualified primary signal (no 「未量到手肘動作」), and (3) complete the three preflight cycles before clinical use.

### 2026-08-20 QA artifact relocation (security review remediation)

- The whole `qa/` tree (bedside/device captures, probes and visual-QA screenshots — 34 previously tracked files plus local ignored captures) was **moved out of the repository** to `/home/user/workspace/ych_rehab_qa_artifacts/qa/`, structure intact. Files were moved, never opened or copied, so participant/tester imagery is preserved untouched and was not inspected.
- Generated local review artifacts were moved to `/home/user/workspace/ych_rehab_qa_artifacts/review-notes/` (`interface_text_audit_20260812.md`, `level4_elbow_transport_findings_20260819.md`, `level4_stabilized_arc_findings_20260819.md`, `level4_two_pose_calibration_findings_20260819.md`, `progress_repaired_20260819.md`, `level4_preflight_handoff_20260819.txt`, `qa_level4_transport_debug.mjs`). The camera-free synthetic render harness and its screenshots now live in `/home/user/workspace/ych_rehab_qa_artifacts/synthetic-render-qa/`.
- `git rm -r --cached qa` removed all 34 tracked QA paths from version control (staged only; nothing committed, pushed or published). Only runtime source, tests, tools, docs and assets remain in the repository.
- `.gitignore` now documents the external QA location and keeps `qa/`, `qa_*/` and generated findings/handoff/audit markdown ignored as a safety net.
- `tools/visual_qa_login.mjs` writes to `/home/user/workspace/ych_rehab_qa_artifacts/qa/research-auth` (override with `QA_OUT_DIR`) instead of a repository path.
- `scripts/build-dist.sh` gained two hard guards: the build fails if `qa/` exists inside the repository, and if any `qa` / `user-recordings` / `*-recording-recheck` path appears in `dist/public`. `qa` was also added to the banned-path list.
- No test or build step referenced `qa/`, so the test suite is unaffected. Historical `qa/...` mentions in earlier progress entries now refer to the external artifacts directory.
- Re-validation after the move: `bash tools/checkjs.sh` OK; `node --check` OK for both Level 4 modules, `tools/visual_qa_login.mjs` and `service-worker.js`; `node --test tests/*.mjs` 155 passed / 0 failed across 12 files; `bash scripts/build-dist.sh` → `dist/public` 120 files with no QA path present; `git diff --check` clean.

### 2026-08-20 Level 4 真機失敗修正 v26（五段錄影逐格分析）

治療師在私人預覽用真機測試 v25，**五段錄影全部失敗**。錄影只在倉庫外分析（`/home/user/workspace/ych_rehab_qa_artifacts/new-recordings-20260820/`，抽格 2 fps + debug 面板裁圖），任何病人影像都沒有進入倉庫或 `dist/`。下表只保留 app 自己 debug 面板顯示的數字。

| 錄影 | 遊戲 | Debug 狀態 | 觀察數字 | 失敗關口 | 畫面 |
|---|---|---|---|---|---|
| 1 | 抹窗 | `stage ready · preflight-passed`、`weights angle 0.72 / radial 0.00`、驗證 3/3 | 肘角 80.9→175.5→99.4→145.8°，**進度全程 1.00 / 上方終點** | 標記幅度遠細於實際活動幅度 → 上限飽和，永遠見不到屈肘 | 鏡頭底層正常、清潔 16% |
| 2 | 直線遊戲 | `verification-reversed` / `verification-await-extension`、`weights spanRatio 0.72`、`no separation: angle Δ10.76` | 進度 16/33/49/89/92/100% 與肘角完全脫節，驗證 0/3 | 肘角差 10.76° < 12° → 改由 `spanRatio` 主導 → 非單調 → 永久「次序反轉」 | 鏡頭正常 |
| 3 | 弧線遊戲 | 驗證 1/3→2/3 | **反轉**：87.3°→100%，152.9/155.5/157.7°→0% | 兩次標記次序／透視倒轉，方向被凍結 | 鏡頭正常 |
| 4 | 洗麻雀 | `verification-await-extension`→`verification-reversed`、遊戲鎖定 | 138–172° 都是 0%，114.8° 只有 7% | 下限飽和 + 反轉 | 真麻雀牌面正常 |
| 5 | 點心 | `verification-await-extension` + 次序反轉、`no separation: spanRatio Δ-0.04 / worldSpan Δ-0.08`（負值＝標記倒轉） | 94–144° 全部 0%、下方起點、驗證 0/3 | 反轉 → 永遠拎唔起點心 | 鏡頭＋點心正常 |

**根因（四項，全部有錄影數字支持）**

1. **弧線凍結會鎖死進度。** 伸肘本身會令手腕側移，`arcInstant` 一過 0.07 就把 reach 凍結在當時的數值，之後每一格再凍結一次 → 抹窗停在 1.00、點心／洗麻雀停在 0.00，而肘角其實在 80° 範圍內來回。**修正**：伸肘弧出時不再凍結，而是改為只用肘角錨點計算（`arcAnchorOnly`）——側移只影響 `spanRatio`/`worldSpan`/`radial` 等全臂投影訊號，不影響肘關節角度。原本的凍結只保留給完全沒有肘角錨點的情況。
2. **標記次序／透視倒轉被當成合法方向。** 肘角在解剖上是單調的（屈曲細、伸直大），所以現在對 `angle`/`spanRatio`/`worldSpan`/`radial` 做**解剖定向**（`angleAnatomicalOrientation`）：屈曲永遠是 0，伸直永遠是 1，`depthZ` 保留拍攝時的方向。定向只做一次，之後照樣凍結，不會自動反轉或重新標記。
3. **標記幅度細過實際活動幅度 → 飽和。** `rangeExpansion`：中位數濾波後連續 4 格超出上端才擴闊上端，上限為標記幅度的 4 倍及 180°，**下端（屈曲錨點）永不移動**，所以 flexed = 0 的臨床錨點保持不變；單格 landmark 跳格不會擴闊。
4. **投影訊號取代了肘角。** `requireAngleAnchor`：只要兩次標記都量到肘角，肘角就必須是錨點；肘角差 ≥5°（`angleCaptureFloorDeg`）可先作暫定錨點，但要靠真實活動幅度（`minLiveExcursionDeg` 12°）才計驗證週期（`verification-await-range`，不算失敗）；若肘角量到但完全分不開而其他訊號分得開，直接拒絕校正（`angle-no-separation`，指示把 iPad 移到患側約 45° 再重新標記），不會靜靜地解鎖一個與手肘無關的遊戲。

**改動檔案**
- `level4-elbow-calibration.js` — 解剖定向 + 範圍擴闊 + 肘角優先錨點 + 弧線改為錨點主導；新增 snapshot 欄位 `oriented`/`provisional`/`expansion`/`anchorRange`/`anchorRangeReady`/`arc.anchorOnly`；新增指引 `angle-no-separation`、`verification-await-range`。
- `index.html` — 床邊 debug 行加上 `oriented`、`range`（未夠會標示）、`widened`、`arc anchor-only`。
- `service-worker.js` — cache version → `fthue-rehab-v26-20260820-level4-anatomic-anchor-arc`（`tests/adaptive-progression.test.mjs`、`tests/tracking-regression.test.mjs` 同步更新）。
- `tests/level4-recording-replay.test.mjs`（新，13 個測試）— 只用錄影中肉眼可見的數字重播五段軌跡，沒有任何影像或病人資料。
- `tests/level4-two-pose-calibration.test.mjs`、`tests/level4-real-device-repair.test.mjs`、`tests/level4-bedside-preflight.test.mjs`、`tests/level4-stabilization-arc.test.mjs` — 四個舊測試原本斷言「凍結倒轉方向」及「投影訊號可以做錨點」，已按新的臨床規則改寫。

**驗證**
- `bash tools/checkjs.sh` OK；`node --check` OK（兩個 Level 4 模組、`service-worker.js`）。
- 逐檔 `node --test`：adaptive-progression 18、cooking-level-guide 2、level4-bedside-preflight 4、level4-games-behavior 10、level4-independent-games 8、level4-real-device-repair 25、**level4-recording-replay 13（新）**、level4-stabilization-arc 12、level4-two-pose-calibration 13、level67-interactions 5、research-auth 14、tracking-regression 29、ui-layout 15 = **168 pass / 0 fail**。
- 無鏡頭瀏覽器煙霧測試：頁面載入 0 個 console／page error。
- `bash scripts/build-dist.sh` → `dist/public` 120 files / 76M；`git diff --check` clean。沒有 commit、push 或 publish。
- Final verification: full Node suite 175 total / 172 pass / 0 fail / 3 skip; combined iPad+new iPhone recording replay 17/17; `tools/checkjs.sh`, `git diff --check`, and `scripts/build-dist.sh` passed. Built public package was checked for absent QA/recording media.

## 2026-08-21 Level 4 v31 hands-free automatic calibration and tabletop cycles

- **v31 hands-free capture:** 新增「自動標記起點及終點 / Auto mark start & end」。按下後先有 3 秒治療師撤離倒數；倒數期間不接受姿勢或 endpoint sample。其後鎖定患側肩／肘／腕的肩位置、上／前臂比例與畫面 aspect；姿勢遺失、stale frame、重覆 decoded-frame generation、其他人／手進入造成的 identity jump 都會 fail-closed，清除未完成的穩定 credit，不會悄悄換人。
- **抗抖動而非窄角度門檻：** auto hold 使用 15-generation rolling window，至少 8 個 distinct fresh inlier generations；以 rolling median、MAD（≤3°）、10–90% trimmed span（≤9°）、sustained-drift slope（≤0.35°/frame）判定。孤立離群值（離 median 超過 `max(6°, 3×MAD)`）只拒收該 sample，不會清空整個 hold；空間／subject lock 仍是獨立嚴格要求。每 phase timeout 約 20 秒；起點後必須離開至少 8°，終點以遠端 peak ±3° 的穩定 hold 完成，並需 endpoint separation ≥8°。candidate pair 在 controller 外完成後才以原子 `capturePair` 寫入，因此自動失敗永不覆寫既有 manual/controller endpoints。
- **固定臨床意義：** 只以 2D elbow angle 直接 signed mapping：屈肘 supported start = 0（畫面下／起點），伸肘 forward = 1（畫面上／前方）。不重新定向 endpoints、不融合其他 movement signals、不重設 preflight cycles；fresh decoded generation 是唯一可前進 state 的來源。
- **最終五款 Level 4 循環：** 點心、保齡球只接受「屈肘開始 → 伸肘向上／向前 → 真正屈肘返回」才可重新開始；抹窗為肘伸到上緣後以**肩水平外展**由左至右清掃；洗麻雀為肘伸向前後以肩水平外展進入順時針洗牌；巴士為肘伸向上拍卡、肩水平外展把卡由左至右帶回起點、再屈肘返回才可下一輪。三個 path game 的 lateral phase 不會凍結、覆寫或反轉 elbow vertical coordinate。點心與保齡球完全不讀取、顯示或 gate shoulder horizontal-abduction。肩屈曲／肩高度／elevation 已完全排除於 Level 4 calculation、UI、gate、calibration 及 scoring。
- **老人家可讀 UI：** patient-facing calibration strip 只保留大字的已記錄屈肘起點角度、已記錄伸肘終點角度，以及（只限 path games）肩水平外展 range/state；倒數／hold 顯示單一簡單指令。raw/filtered angle、generation、identity lock、MAD/span、rejections、candidate separation 等轉入預設關閉的「治療師詳細資料 / Therapist details」。`render_game_to_text` 和 QA bridge 保留完整 diagnostics。
- **版本與離線：** `LEVEL_APP_BUILD` 及 service-worker cache 升級為 `v31-20260821-hands-free-auto-calibration`；`dist/public` 已重建（121 files，76M）。
- **驗證：** `tools/checkjs.sh`、相關 `node --check`、`git diff --check` 均通過；完整 `NODE_PATH=/home/user/node_modules node --test tests/*.mjs` 為 **151 total / 148 pass / 0 fail / 3 skip**。新增 deterministic auto calibration（noisy stationary inliers + isolated outliers、sustained drift、identity jump、stale/pose loss、increasing/decreasing endpoint order、atomic pair/manual fallback）、vertical-axis、及全部五款 ordered-cycle coverage。Level 4–6 technical runner source 和 rebuilt dist 均為 **185/185**（L4 107、L5 40、L6 31）。
- **Browser QA artifacts（repo 外）：** `/home/user/workspace/ych_rehab_qa_artifacts/level4-auto-calibration-v31/` 保存 source 及 dist 的 iPhone 390×844 countdown/completed calibration、iPad portrait calibration、及 iPad landscape 點心／保齡／抹窗／洗麻雀／巴士各 phase screenshot 和 JSON/log；所有畫面 `detailsOpen:false`、無 horizontal overflow、browser errors 空白。
- **真實裝置限制：** 附送的 8.87 秒 1920×1080/29.97 fps 影片只作為 UI／場景及「靜止讀數會波動」問題的視覺檢查；沒有可安全分離並儲存的逐幀 MediaPipe landmark/raw-angle trace，故不把其當成精確 jitter measurement，也沒有把影片或 extracted media 放進 source、dist 或 cache。上述 robust thresholds 由合成的 noisy/outlier numeric regressions 保護，仍必須以目標 iPhone/iPad、患側 45° 枱面擺位、光線、衣物遮擋和個別可動範圍完成床邊確認；姿勢模型不能保證區分所有治療師／病人遮擋情況，identity lock 會寧願 retry 而不換人。

## 2026-08-21 Level 4 v32 patient-anchor and ordered-sweep release blockers resolved
- **Pre-button identity anchor:** automatic calibration now keeps a private rolling buffer of six distinct fresh affected-side shoulder/elbow/wrist signatures before the auto button can begin. The robust signature contains shoulder position, arm scale/geometry, selected side, and image aspect. Pressing auto freezes that pre-withdrawal signature; post-countdown frames must match it. A first post-countdown therapist/other arm can never create or rebase a lock. No anchor gives the clear retry message to keep the patient alone/in frame and wait briefly; no controller endpoint changes occur.
- **Robust hold settings retained:** 15-frame window, at least 8 accepted inliers, MAD <= 3 degrees, 10–90% trimmed span <= 9 degrees, drift <= 0.35 degrees/generation, isolated outliers excluded rather than resetting a hold. Auto requires an 8-degree deliberate/stable separation and commits both endpoints atomically.
- **Ordered wipe direction:** the wipe game admits fog clearing only for a fresh, increasing screen-X sweep after the elbow-forward milestone. Fresh reverse or stationary X frames only refresh the non-credit anchor; they cannot clear fog. Dim sum and bowling remain elbow-only; wipe, mahjong, and bus retain their path-only horizontal row and ordered guidance.
- **Patient/UI and diagnostics:** generic/linear screens hide the shoulder-horizontal-abduction row and any lateral wording; path games show the readable row only. Bedside diagnostics and `render_game_to_text` now include auto phase, stable count, countdown, rejection, candidate separation, and pre-anchor availability/frame count/frozen state. Therapist details remain collapsed.
- **Version/offline:** `LEVEL_APP_BUILD` and service-worker cache are `v32-20260821-patient-anchor-ordered-cycles` / `fthue-rehab-v32-20260821-patient-anchor-ordered-cycles`; `dist/public` rebuilt with current offline manifest.
- **Validation:** deterministic auto tests cover countdown, duplicate generations, noisy hold/outlier tolerance, both endpoint directions, sustained drift, pre-anchor absence, first post-countdown therapist mismatch, later identity jump, stale/pose-loss reset, timeout, atomic pair and manual fallback. Ordered-cycle tests cover reverse wipe non-credit plus increasing-X credit. Final source and dist technical validation each reported 185/185 pass; browser QA artifacts are outside the repo in `/home/user/workspace/ych_rehab_qa_artifacts/level4-auto-calibration-v31/` (v32-source/v32-dist), covering iPhone portrait and iPad portrait/landscape states.
- **Physical-device limitation:** synthetic QA validates deterministic 2-D landmark contracts and responsive Chrome rendering only. A therapist must still verify supported tabletop positioning, affected-arm selection, real camera/mirror placement (including ~45-degree hemiplegic-side iPad placement), landmark stability, and the conservative identity thresholds on the intended iPhone/iPad Safari/Chrome before clinical use. No patient recording, upload, network service, storage, or new permission was added.
- **Final v32 sign-off rerun:** `tools/checkjs.sh`, relevant `node --check`, `git diff --check`, and the full Node suite completed cleanly: 155 tests, 152 pass, 0 fail, 3 intentional skips. Final source and `dist/public` technical runner reruns each passed 185/185. Final source and dist browser matrix reruns each passed 17/17 checks with no browser errors.

## 2026-08-24 Level 4 v33 hands-free torso continuity and horizontal-range calibration

- **Selected arm is fixed anatomically:** the selected-left path always reads Pose indices 11/13/15 and selected-right always reads 12/14/16. Mirror mode changes only the drawn/display X coordinate, never the anatomical indices. A missing selected shoulder–elbow–wrist triplet now reports `selected-arm-lost`; it neither reads nor substitutes the opposite arm.
- **Continuity lock repaired:** automatic calibration no longer treats selected-arm shoulder/elbow/wrist geometry as identity. The frozen pre-start anchor and every auto-capture sample use both shoulders’ midpoint plus hip midpoint/torso scale when visible (shoulder span is the fallback scale only when hips are table-occluded). Normal forearm foreshortening or extension therefore stays eligible. Missing torso or a materially moved/replaced torso fails closed as `torso-moved/person-changed`; a bare therapist hand cannot establish an anchor. Selected-arm loss, stale frames and duplicate generations clear uncommitted hold credit.
- **Hands-free phases:** one Auto Start action still starts the withdrawal countdown. Dim sum and bowling now atomically commit after stable supported flexion followed by stable extension. Wipe, mahjong and bus add one hands-free `keep-elbow-extended-and-move-outward` phase: after the stable extension endpoint, a fresh, stable deliberate shoulder-horizontal-abduction range is collected while the elbow remains within its extension tolerance, then flexed/extended/horizontal baseline/end are committed together. Timeout, cancel and three explicit manual fallback markers remain available; no therapist confirmation is needed between automatic phases.
- **Signal separation and display:** the horizontal range is normalized only for path-game X after extension and cannot alter the elbow progress/Y map. Linear games do not enable, show or consume it. The camera/canvas now visibly draws only the selected shoulder–elbow–wrist chain and labels `Tracking patient’s LEFT/RIGHT arm`; patient-facing values say “Captured” rather than live joint numbers, while numeric diagnostics remain in collapsed therapist details.
- **Reasons and test coverage:** guidance includes `selected-arm-lost`, `torso-moved/person-changed`, `frame-stale`, `hold-flexed`, `extend-and-hold`, and `keep-elbow-extended-and-move-outward`. New deterministic coverage in `tests/level4-handsfree-v33.test.mjs` covers mirror/anatomical indices, opposite-arm exclusion, arm-geometry continuity, torso replacement, hand-only rejection, selected-arm loss, linear versus path phase completion, duplicate/stale protections, and horizontal/elbow signal independence. Existing ordered-cycle, generation and axis tests were updated for the explicit horizontal fallback endpoint.
- **Cache/build:** app build is `v33-20260824-handsfree-torso-continuity-r2`; service-worker cache is `fthue-rehab-v33-20260824-handsfree-torso-continuity-r2`. `dist/public` was rebuilt after validation (121 files, 76M).
- **Validation:** focused Level 4 controller/cycle tests passed 41/41. `bash tools/checkjs.sh`, `node --check level4-elbow-calibration.js`, `node --check level4-three-games-module.js`, `node --check sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs`, `git diff --check`, and the full `node --test tests/*.mjs` suite all passed (162 total, 159 passed, 0 failed, 3 intentional skips). The source and rebuilt-dist Level 4–6 technical runner each passed **185/185** (L4 107, L5 40, L6 31); final reports/results are outside the repo at `/home/user/workspace/ych_rehab_qa_artifacts/v33-source-final9/` and `/home/user/workspace/ych_rehab_qa_artifacts/v33-dist-final/`.
- **Browser QA:** synthetic left-arm path-game calibration at iPad landscape (1180×820) and portrait (820×1180) completed with no page errors; the selected-arm label, selected-chain overlay, path horizontal endpoint and calibration panel were all visible and panel bounds remained inside the game stage. Artifacts are outside the repo at `/home/user/workspace/ych_rehab_qa_artifacts/v33-browser/`.
- **Physical-device limitation:** all new identity/range evidence is synthetic landmark/browser QA. Before clinical use, a therapist must confirm target iPad Safari/Chrome camera framing, both shoulders and (where possible) hips, selected shoulder–elbow–wrist visibility throughout the supported tabletop movement, patient-specific extension and outward range, clothing/occlusion tolerance, and the conservative torso continuity thresholds. No patient media, deployment, publish, push or commit was performed.
## 2026-08-24 — v34 Level 4 calibration recovery and current-frame capture
- Real-device recording showed a live selected-arm overlay while Bowling and Mahjong remained `NOT READY`; no endpoints had committed, so game objects correctly stayed locked at progress 0.
- Patient continuity now uses the non-selected shoulder as its admission anchor. The moving affected shoulder, intermittent hip visibility and apparent arm/torso scale are diagnostic only, preventing ordinary supported reach from being labelled as a person change.
- A `torso-moved/person-changed` automatic-calibration retry now invalidates the stale frozen torso lock and requires six new ordinary fresh patient frames before another automatic attempt. Previously committed manual endpoints remain untouched.
- Manual fallback now closes the decoded-frame/inference race by inferring and admitting the exact visible generation before marking. If current-frame inference fails, it shows a waiting message and does not inject an arm-less controller packet or mutate endpoints.
- Added deterministic regressions for replacement-anchor recovery, exact-current-frame manual capture, and non-mutating inference failure.
- Build/cache identifiers moved to `v34-20260824-calibration-recovery-current-frame`.

## 2026-08-24 — v35 Level 4 automatic launch and simplified fallback
- Level 4 calibration now begins without a therapist button press. Six distinct fresh frames first establish the selected patient's stable torso and affected-arm context; only then does the existing three-second withdrawal countdown start.
- Dim sum and bowling collect flexed then extended holds automatically. Wipe, mahjong and bus automatically add the horizontal-abduction hold before atomically committing all endpoints.
- Normal hands-free setup hides the retry and manual controls. After cancellation or a retry state, concise fallback controls appear: `屈肘 / Flexed`, `伸肘 / Extended`, and, when applicable, `外展 / Outward`, plus `重試自動偵測 / Retry auto`.
- Selected anatomical side, mirror handling, torso continuity, stale-frame protection, duplicate-generation idempotence and opposite-arm exclusion are unchanged.
- Build/cache identifiers moved to `v35-20260824-handsfree-auto-start`; the source manifest and rebuilt public package are aligned.
- Validation passed: focused Level 4/UI suite 49/49; full Node suite with no failures; source and rebuilt-dist technical runner 185/185 each; syntax, deterministic build and `git diff --check`. iPad landscape browser QA completed a three-endpoint path calibration with no setup click and verified the simplified cancelled-state fallback, with no page errors or horizontal overflow.
- Physical-device bedside validation is still required for actual iPad/Samsung Tablet Chrome camera tracking, occlusion, lighting and patient-specific movement range.

## 2026-08-25 — v38 Level 2–4 clinical remap, exact shoulder targets, and Tsuen Wan photo cards

- **Final clinical mapping:** all tabletop-supported activity is now visible only under FTHUE Level 2. This includes the inherited bilateral towel/affected-side slide and the former supported elbow-extension / horizontal-abduction games (dim sum, wipe-window, bowling, mahjong wash and bus pay). Level 3 is active shoulder flexion to therapist-selected 30°/40°/50° targets. Level 4 is active shoulder flexion to therapist-selected 60°–180° targets in 10° steps. Level 4 contains no supported/tabletop mode.
- **OT selection only:** the landing page and target setup state that an occupational therapist must select the FTHUE level. The software does not diagnose or automatically assign FTHUE levels. The target selector starts before camera tracking and is explicitly labelled as a camera-estimated training setting, not goniometry or FTHUE classification.
- **Hands-free shoulder controller:** added `shoulder-flexion-controller.js`. It locks the selected anatomical arm (left 11/13/15 or right 12/14/16), uses world landmarks when available and an aspect-corrected trunk-to-upper-arm estimate otherwise, never swaps indices for mirror display, and fails closed on stale frames, duplicate generations, selected-arm loss, torso discontinuity, visible shoulder hike or trunk lean. No therapist capture/confirm button is used for Level 3/4.
- **Exact per-object state machine:** every Level 3/4 object uses a deterministic-random start from `{0°,10°,20°}` with no immediate repeat when alternatives exist. The controller waits for a stable estimate near that start, then admits motion to the selected target. A stable target hold arms completion; a stable return to the required start range is required before the next repetition and selects the next start. Diagnostics/results record selected start/target, baseline estimate, current/peak camera estimate, target state and repetitions.
- **Practical single-tablet setup:** Level 2 guidance uses a stable upright tablet at the affected-side front-oblique view around 45°, far enough to include selected shoulder/elbow/wrist and tabletop path. Level 3/4 guidance uses landscape/upright on a stable stand at affected-side anterior-oblique 30–45°, screen tilted toward the patient, lens near shoulder height, full trunk and moving arm visible, non-affected arm outside the tracking zone and therapist stepping away. Exact sagittal ROM requires a separate lateral camera/device or therapist goniometry.
- **Selected-side-only Level 2 bilateral control:** the physical activity remains bilateral (the unaffected hand may guide), but camera control reads only the selected affected wrist. The opposite arm cannot substitute after selected-side loss.
- **Tsuen Wan photo-card activity:** added six optimized local JPEG objects/targets (Chuen Lung Street, Tsuen Wan Market Street, downtown street scene, skyline, Tsuen Wan Plaza and Tak Wah Park) to Levels 2–4. All are offline-ready Wikimedia Commons images (17–99 KB after optimization). `image-sources.json` records title, author, license, license URL and Commons source URL; the landing-page Credits/Image sources panel links to it. The original requested Market Street URL could not be fetched, so the verified CC BY-SA 4.0 `Tsuen Wan Market Street in February 2024` Commons image by 姒姓賢寧 was used instead.
- **Versions/build:** app/service-worker/manifest identifiers are `v38-20260825-tsuenwan-photo-targets`; `scripts/build-dist.sh` now copies `shoulder-flexion-controller.js` and `image-sources.json`. Final `dist/public` contains 129 files / 76 MB. No QA or user recording path is present in the build.
- **Deterministic coverage:** added `tests/shoulder-flexion-levels.test.mjs` and `tests/tsuenwan-photo-assets.test.mjs`; updated Level 2 mapping, cache, layout, safety and selected-side expectations. Coverage includes exact target/start sets, seeded non-repeat starts, wrong-start waiting, hands-free auto admission, stable target/return, camera angle geometry, selected-side/mirror correctness, opposite-arm exclusion, stale/duplicate/pose-loss fail-closed behavior, compensation guards, photo paths/size/credits and offline packaging.
- **Final verification:** `tools/checkjs.sh`; `node --check` for the shoulder controller, both preserved supported-tabletop modules, service worker and technical runner; full `node --test tests/*.mjs` = **178 total / 175 pass / 0 fail / 3 intentional skips**; `scripts/build-dist.sh`; and `git diff --check` all passed. Updated source and final rebuilt-dist technical validation each passed **211/211** (Level 2: 106, Level 3: 20, Level 4: 20, Level 5: 40, Level 6: 25), with no runtime errors.
- **Browser QA:** iPad portrait 820×1180 and landscape 1180×820 covered the Level 4 exact target selector, Level 3 hands-free random-start readiness, selected-arm/trunk overlay, photo-card objects/targets, calibration panel bounds and horizontal overflow. No page/console errors or horizontal overflow. Artifacts are outside the repo at `/home/user/workspace/ych_rehab_qa_artifacts/v38-browser-final/`; technical reports are at `/home/user/workspace/ych_rehab_qa_artifacts/v38-source-final2/` and `/home/user/workspace/ych_rehab_qa_artifacts/v38-dist-postbuild/`.
- **Limitations:** all motion validation remains synthetic. The 30–45° anterior-oblique view supports practical game feedback but not medical-grade sagittal ROM. Bedside OT validation is still required for target iPad/Samsung hardware, clothing/occlusion, framing, world-landmark availability, tolerance of start/target holds, and safety thresholds. No commit, push, publish or deploy was performed.

## 2026-08-25 — v45 Level 3/4 continuous shoulder-flexion feedback

- **Shoulder-only interaction:** Level 3 and Level 4 now bypass the legacy virtual pickup, grasp/release, cursor-contact, stillness and dwell gates. The patient may keep holding the chosen object or the 1 lb stick while shoulder elevation alone drives the on-screen object.
- **Continuous movement feedback:** the active object moves vertically with fresh selected-arm shoulder progress and the patient display shows the current camera-estimated lift in degrees. A target is scored once after reaching the prescribed height; return toward the current randomized start re-arms the next repetition.
- **Larger targets:** Level 3/4 game objects and target zones were enlarged for clearer tablet viewing while preserving the existing Tsuen Wan photo-card theme.
- **Safety boundary:** tracking remains restricted to the selected anatomical affected arm and retains stale-frame, replay, selected-arm-loss, torso-continuity and compensation safeguards. The degree display is movement biofeedback, not clinical goniometry or automatic FTHUE classification.
- **Version/build:** app, manifest and service-worker identifiers are aligned at `v45-20260825-live-shoulder-angle`.
- **Validation:** full Node suite passed **191 total / 188 passed / 0 failed / 3 intentional skips**. `tools/checkjs.sh`, relevant `node --check`, and `git diff --check` passed. Source Level 3 portrait and Level 4 landscape browser QA plus rebuilt-dist Level 4 landscape QA showed live degree feedback, full target progress, no page errors and no horizontal overflow.
- **Clinical limitation:** physical bedside testing remains required to judge camera-angle bias, real affected-arm occlusion, safe object/stick grasp, compensatory trunk or shoulder movement, and whether the displayed estimate is understandable and motivating for each patient.
## 2026-08-25 — v46 Level 3/4 shoulder-detection repair completion

- Level 3/4 calibration now requires Pose readiness; Hand Landmarker success cannot admit a shoulder game when Pose failed.
- The selected anatomical affected arm is locked, older/duplicate generations are rejected, and no opposite-arm fallback is allowed.
- A stable participant-specific camera baseline maps resting posture to 0°; the overhead span remains reachable through 180° despite a non-zero image-plane offset.
- Movement is explicitly ordered as `await-start → outward → await-return`. Invalid frames clear partial dwell, and a repetition/score is committed only after return.
- Level 3/4 objects are larger and move directly from the same normalized shoulder progress used by endpoint detection. Legacy virtual pickup, grasp, hand-cursor, stillness and release gates are bypassed.
- The patient view shows approximate live lift in degrees. Ordinary redraws between Pose inferences retain the last valid fresh reading; stale camera, selected-arm loss, side mismatch and safety failures still show paused and remain fail-closed for scoring.
- Validation: `tools/checkjs.sh`, relevant `node --check` commands and `git diff --check` passed. The full Node suite passed **195 total / 192 passed / 0 failed / 3 intentional skips**. Source and rebuilt-dist Level 2–6 technical validation each passed **211/211** (Level 2: 106, Level 3: 20, Level 4: 20, Level 5: 40, Level 6: 25). The rebuilt public package contains 135 files / 84 MB with aligned v46 app, manifest and service-worker markers; no MOV/MP4 or private inspection path is present.
- Browser QA: synthetic iPad portrait Level 3 and iPad landscape Level 4 flows confirmed patient-specific baseline capture, start acquisition, continuous object motion, visible live degrees, target feedback, and scoring only after return. In the exact Level 4 90° case, the object moved from canvas Y 640 to Y 279, displayed approximately 90°, kept the score at 0 at the target, then recorded one repetition and score 10 after return. Source and rebuilt dist had no console errors or horizontal overflow.
- Remaining limitation: the camera value is an approximate tablet-view movement estimate, not goniometry. Final bedside testing must confirm camera angle, full shoulder/elbow visibility, occlusion tolerance, and the participant's safe range.
# v49 production hardening

- Public and offline builds now remove all embedded browser QA automation hooks, including synthetic pose input, virtual time control and `window.__qa`.
- The source build retains these hooks for automated regression testing, while release guards fail if any QA-only entry appears in `dist/public`.

## 2026-08-26 — v51 fixed 0° shoulder start and Level 5 affected-hand grasp/release

- Level 3 and Level 4 repetitions now always begin and return to the participant-specific camera baseline labelled 0°. The former 10°/20° randomized starts and related instructions were removed; therapist-selected target and hold options are unchanged.
- Level 5 Hand Landmarker now requests up to two hands and admits only the configured anatomical affected side. An opposite, assisting, or therapist hand cannot silently replace the affected hand; uncertain handedness fails closed.
- Level 5 grasp/release accepts two visibly curled fingers for grasp and two visibly reopened fingers for release even when reach-related foreshortening shifts the personalized aggregate score.
- Short tracking gaps may preserve the held object visually, but stale landmarks cannot accumulate pickup or release dwell.
- App, manifest, and service-worker identifiers are aligned at `v51-20260826-zero-start-level5-grasp`.
- Validation passed: full Node suite 208 total / 205 passed / 0 failed / 3 intentional skips; source technical validation 211/211; JavaScript syntax and `git diff --check` passed.
- Physical iPad/Samsung bedside testing remains necessary for partial hemiparetic hand visibility, crossed hands, therapist hand entry, camera handedness classification, two-hand inference performance, lighting, and occlusion during reach.

## 2026-08-26 — v52 Level 5 right-hand label correction

- Corrected a regression that inverted MediaPipe Hand Landmarker labels for the raw, unmirrored camera frames used by inference. CSS mirroring now affects display coordinates only.
- Right and left affected-hand selections both retain strict selected-side admission; missing handedness and opposite-hand-only detections still fail closed without falling back to a therapist or unaffected hand.
- Added deterministic tests for raw-camera right/left labels, explicitly mirrored inference pixels, and fail-closed opposite-hand rejection.
- App, manifest, and service-worker identifiers are aligned at `v52-20260826-right-hand-label-fix`.
## 2026-08-26 Level 2 outward shoulder-horizontal-abduction game v55

- The easier Level 2 activity now matches the supplied reference: supported affected forearm starts at midline and slides outward toward the affected side.
- The selected anatomical affected wrist directly drives one large game object. The old contact, dwell, virtual pickup, grasp and release gates are bypassed.
- Reaching the outward target gives immediate positive feedback and scores once. Returning to midline only rearms the next repetition and is not labelled as a separate training movement.
- The harder Level 2 forward-reach-then-circle activity remains available, with no duplicate games added.
- Build markers aligned to `v55-20260826-level2-outward-abduction`.
## 2026-08-26 — v59 Level 2 real supported-slide tracking

- The bedside recording showed one valid outward repetition, followed by repeated full supported slides that stayed visually at the midline because the controller's fixed elbow-to-wrist displacement ratio rejected real camera perspective and forearm geometry.
- Level 2 now drives progress from the selected affected wrist relative to the torso and affected-side outward axis, matching the original simple tabletop wipe interaction. The selected elbow must remain visible but no longer blocks progress or controls the object.
- Selected anatomical side, torso-relative normalization, mirror invariance, missing-landmark fail-closed behavior, generation replay protection, one-score-per-outward endpoint, and return-to-midline re-arming remain intact. Elbow-only movement still produces zero progress.
- Added a deterministic recording-like regression in which the wrist moves outward while elbow image displacement remains small.
- Release identifiers advanced to `v59-20260826-level2-real-slide-tracking`.

## v60 Level 2 midline and natural-sway repair
- Level 2 baseline now accumulates only while the selected affected wrist is at the body midline; an outward starting pose clears pending samples and prompts the patient to return to centre.
- Natural small trunk sway near the outward endpoint is admitted with `maxTorsoLean: .24`; genuine larger sustained lean and torso translation remain fail-closed.
- Added deterministic regressions for wrong-start recovery, recording-like natural sway, preserved large-lean rejection, and the complete wrong-start → midline calibration → outward score flow.
- Release identifiers advanced to `v60-20260826-level2-midline-sway-fix`.
- Focused Level 2/tracking/layout/camera tests passed 63/63; the complete Node suite, embedded JavaScript checks, controller syntax and `git diff --check` passed.

## 2026-08-26 — v61 Level 6 functional-task redesign (chopstick dim sum / cloth-peg laundry)

- Level 6 (internal id `67`) is redesigned around the approved FTHUE-HK design: setup now offers exactly two therapist-supervised functional tasks — `筷子點心` / Chopstick Dim Sum and `衣夾晾衫` / Cloth-Peg Laundry — replacing the former bare three-finger pinch mode and the unrelated flowers/cards/mahjong/cooking themes. Cooking remains unavailable at every level, unchanged from v59.
- Both tasks are controlled solely by the existing selected-anatomical-arm shoulder-flexion controller: fixed participant-specific 0° start, discrete OT-goniometer-measured target choices of 60–70–80–90–100–110–120°, target/hold/return phases, and fail-closed behaviour on stale, duplicate, or lost pose — with no opposite-arm fallback. Reaching target once scores and requires an explicit return to 0° before the next repetition can score again.
- The website does not identify real chopsticks or pegs, does not measure pinch or grasp force, and does not detect actual grasp/release for normal-flow Level 6; Pose shoulder/elbow/wrist angle is the sole admission and scoring signal (`isGrossTabletop()`/`readGrossPoseHand()` always report `isGrasping:false`). On reaching target, task-specific visuals play: virtual chopsticks pick up dim sum (har gao, siu mai, beef ball) into a rice bowl, or a virtual peg clips a garment/sock/towel onto a Hong Kong drying line.
- The prior bare/peg/chopsticks pinch- and grasp-detection code (aperture thresholds, hysteresis, `readHandGesture`) is preserved unchanged and still exercised by its own tests, but is reachable only from the separate pilot-study research track — never from the normal patient-facing Level 6 setup screen.
- Updated safety checklist (5 items, goniometer/no-tool-detection wording), safety-gate title and concise note, calibration brief (`CALIB_LEVEL_BRIEF['67']`), Level 6 level-select card copy, and the full Traditional Chinese/English localization pairs for both tasks, both themes, and the new setup/rules/prompt strings.
- Added `window.__qa.selectLevel6Task(taskId)` and `window.__qa.availableActivityThemes(level)` QA hooks (both stripped from the public build like all other `window.__qa` methods) to support deterministic setup/theme-sync testing.
- Rewrote `tests/level67-interactions.test.mjs` for the two-task model (theme/task sync, shoulder-target validation, task-specific rendering, hand/tool-detection-cannot-gate, iPad portrait/landscape/compact-viewport layout) and updated the affected assertions in `tests/ui-layout.test.mjs`, `tests/shoulder-flexion-levels.test.mjs`, `tests/assisted-stick-mode.test.mjs`, and `tests/tracking-regression.test.mjs` to match the new copy and the added third `state.level==='67'` branch in the shoulder-target-options renderer.
- Extended `sandbox/level4-6-technical-validation/run-level4-6-technical-validation.mjs`: the Level 6 launch-matrix now expects `gameType:'dwell'` for both `chopstick_dimsum` and `peg_laundry` (was `'pinch'`), the safety-copy check matches the new goniometer-target wording, and the report's scope/limitation text now accurately describes Pose-only shoulder-flexion control instead of thumb-index aperture detection.
- Release identifiers advanced to `v62-20260827-level6-games-restored` (`manifest.webmanifest`, `service-worker.js`, and the in-page service-worker registration marker in `index.html`).
- Validation passed: full Node suite 239 passed / 0 failed / 3 pre-existing unrelated skips; source technical validation 138/138 (21/21 for Level 6); embedded JavaScript syntax checks (`tools/checkjs.sh`) and `git diff --check` passed; `dist/public` rebuilt cleanly with all `window.__qa`/research-mode hooks stripped and the v61 marker present in all three build files.
- Levels 2–5 and the pilot-study research track are unchanged by this session; `/home/user/workspace/ych_rehab_games_gh_pages_publish` was not touched, and no commit, push, publish, or deploy was performed.

## 2026-08-27 v62 Level 6 games restored
- Corrected the v61 Level 6 catalog without reintroducing legacy duplicates. The final six choices are: 插花 / Flower Arranging; 筷子點心 / Chopstick Dim Sum; 衣夾晾衫 / Cloth-Peg Laundry; 啤牌 / Playing Cards; 麻雀 / Mahjong; 煮蛋炒飯 / Cook Egg Fried Rice. Legacy `dimsum` and `laundry` Level 6 entries remain removed.
- Restored the four non-tool v60 activities as shoulder-flexion dwell tasks. Kept the two v61 replacements as additional choices and synchronized activity cards, task IDs, themes, setup controls, titles, instructions, rendering and launch behavior.
- Chopstick Dim Sum now requires the selected affected hand: index + middle slightly extended opens/releases, slightly flexed closes/picks up, and selected-arm shoulder flexion transports. Cloth-Peg Laundry reuses the selected affected-hand tripod aperture/open-release interaction, with shoulder flexion for transport. Neither normal-flow tool task uses pose-only dwell pickup/release.
- Both tool tasks accept one fresh decoded generation only, preserve anatomical selected-side identity, reject the opposite/therapist hand, fail closed on missing required landmarks, and cannot arm from a static closed grasp. Deterministic tests cover open→close pickup, shoulder transport, open release, stale-frame idempotence, wrong-hand rejection, partial landmarks and static-grasp rejection for both tasks.
- Removed per-game/activity difficulty metadata under every activity title across Levels 2–6 in both Traditional Chinese and English while preserving the main FTHUE level labels. Standardized the restored English Level 6 titles.
- Aligned app, manifest and service-worker markers to `v62-20260827-level6-games-restored`; rebuilt `dist/public` with **134 files (83M)**. The public build excludes authoring, research and QA hooks as required.
- Validation: Level 6 focused suite **23/23**; tracking regression **29/29**; final full Node suite **250 total / 247 passed / 0 failed / 3 intentional skips**; technical validator **148/148** (Level 6 **31/31**); all `tools/checkjs.sh` blocks and module syntax checks passed; `git diff --check` passed.
- Playwright iPad QA passed **22/22** at **820×1180 portrait** and **1180×820 landscape**. Normal clicks verified the exact six-card catalog, all six setup-title synchronizations, bilingual switching, no activity difficulty labels across every level/language, essential tool instructions, no horizontal overflow and no console/page errors. Screenshots, inventory, runner and JSON results are in `/home/user/workspace/ych_rehab_qa_artifacts/v62-level6-games-restored/` and were visually inspected.
- Limitation: deterministic/browser testing cannot replace bedside verification of real affected-hand landmark quality, tool occlusion, lighting, physical chopstick/peg handling, shoulder movement tolerance or iPad camera performance. No commit, push, publish or deployment was performed.

## 2026-08-27 v63 Level 6 angle selector removed
- Removed the complete shared shoulder-target card from normal FTHUE Level 6 setup only. Level 3 still renders 30°/40°/50°/60° and Level 4 still renders 60°–180° in 10° steps, including their existing therapist details.
- Level 6 now always initializes the existing conservative internal shoulder-transport endpoint at 60° and ignores target-angle injection; no therapist selection is required or exposed. The six-task catalog and interaction engines are unchanged, including selected index/middle open-close for Chopstick Dim Sum and selected-hand tripod open-close for Cloth-Peg Laundry.
- Updated Traditional Chinese/English landing, setup, calibration and safety copy to describe functional shoulder transport without a goniometer or 60–120° choice. App/manifest/cache markers are aligned to `v63-20260827-level6-no-angle-selector`.
- Added regression and technical-validator coverage proving the Level 6 target card is hidden while Levels 3/4 retain their exact selectors, and proving Level 6 keeps the fixed internal endpoint. Focused shoulder/Level 6/layout/language tests passed 72/72; module/inline syntax and `git diff --check` passed.
- Rebuilt `dist/public` with 134 files (83M); source and public markers align and the public bundle contains no Level 6 goniometer note or 60–120° setup wording.
- Final validation complete: full Node suite **251 total / 248 passed / 0 failed / 3 intentional skips**; source technical validator **151/151** (Level 2 **37**, Level 3 **21**, Level 4 **21**, Level 5 **40**, Level 6 **32**); all module and inline JavaScript syntax checks plus `git diff --check` passed. The production bundle intentionally strips `window.__qa`, so the interactive technical validator is source-only; separate `dist/public` marker, selector-guard, forbidden-copy, asset-exclusion and JavaScript syntax audits passed.
- Playwright iPad QA passed at **820×1180 portrait** and **1180×820 landscape** using normal clicks. Level 3 retained exactly **30°/40°/50°/60°**, Level 4 retained exactly **60°–180° in 10° steps**, and Level 6 showed no shoulder-target card in Traditional Chinese or English. All six Level 6 task buttons synchronized their titles/previews, no horizontal overflow or console/page errors occurred, and all eight screenshots were visually inspected with no clipping, overlap or selector leakage found. Evidence is in `/home/user/workspace/ych_rehab_qa_artifacts/v63-level6-no-angle-selector/`.
- Limitation: automated and simulated-landmark QA does not replace bedside testing with the affected hand, real chopsticks/cloth pegs, tool occlusion, ward lighting, shoulder tolerance, or the target iPad/Safari camera. No commit, push, publish or deployment was performed.

## 2026-08-27 v64 Level 6 duplicate task picker removed
- Removed the duplicated Level 6 task picker from setup; the six-task catalog is selected once from the game-select screen only. Full results in `v64-level6-no-duplicate-task-picker-results-20260827.md`.

## 2026-08-28 v65 Level 6 tripod pinch across all games
- Unified all six Level 6 activities on the selected-affected-hand tripod pinch (thumb–index–middle) interaction with per-patient calibration; shoulder flexion still transports. Full results in `v65-level6-tripod-pinch-all-games-results-20260828.md`.

## 2026-08-28 v66 Level 6 calibration fresh-frame fix
- Fixed the bedside failure where Level 6 calibration never detected the hand: the calibration loop consumed only fresh decoded frames and the stale-frame admission path starved it. Calibration now admits the same fresh-generation frames as gameplay while keeping all fail-closed identity/staleness gates. Suite 273 total / 270 passed / 3 skips; validator 165/165; published as `v66-20260828-level6-calibration-fresh-frame` and verified live.

## 2026-08-28 v67 bedside usability fixes (four ward recordings)
- Addressed four distinct failures observed in five bedside screen recordings from 26–28 Aug 2026.
- **Level 2 permanent torso pause**: torso gates widened (maxTorsoTranslation .14→.20, maxTorsoLean .24→.32); slow postural drift is absorbed by an EMA baseline adaptation (alpha .06) applied only while the hand rests near midline below the return threshold; a sustained torso reject (≥75 consecutive frames) with the wrist at midline now clears the baseline and re-runs the 5-frame midline capture (reason `hold-at-midline`, prompt 「患手保持中線／重新對位」) instead of pausing forever. Genuine large single-frame trunk lean still fails closed.
- **Level 3/4 unreachable return window**: each phase now also accepts an adaptive floor path — the estimated angle must be at or below 45% of the selected excursion (relativeReturnCap 0.45) AND within 6° of the rolling per-phase minimum (returnFloorToleranceDeg 6). Oblique bedside cameras that never read below ~30–44° can now complete repetitions; hovering above the relative cap never counts. The near-zero absolute window and target attainment are unchanged; this remains a game gate, not a goniometric claim.
- **Level 6 calibration never completing**: per-stage progress survives momentary hand-landmark dropouts up to `CALIB_DROPOUT_GRACE_MS` 1500ms (previously any dropout reset everything); the light-close stage accumulates evidence (`closedHoldMs` with per-tick delta capped at 120ms, done at ≥450ms cumulative or 10 closed samples) and resets only on a clear reopen; checklist items now flip ○→✓ via `renderCalibCheck` in addition to turning green.
- **Level 6 release nearly impossible**: personal pinch thresholds recalibrated to enter = closedMean+gap×0.56, exit = +0.70, open = min(openMean−gap×0.02, closedMean+gap×0.80); `computePinchState` adds an asymmetric reopen path (far digit fully open AND near digit past mid-reopen) and an OR-path separation check, so a hemiplegic hand that reopens unevenly can release without near-full symmetric extension. Hysteresis ordering closedMean<enter<exit<open, both-digit requirements, MAX_HOLD_MS 5000 and RELEASE_DIFFICULTY_LIMIT 3 safety nets are preserved. Level 5 grasp thresholds untouched.
- Markers aligned to `v67-20260828-bedside-usability-fixes`; new `tests/v67-bedside-usability.test.mjs` (10 regression tests over all four fixes); pinned assertions updated in tracking-regression and level2 tests.
- Validation: full Node suite **283 total / 280 passed / 0 failed / 3 intentional skips**; source technical validator **165/165**; `tools/checkjs.sh`, module `node --check` and `git diff --check` passed; `dist/public` rebuilt (134 files, 83M) with aligned v67 markers and all QA hooks stripped; Playwright iPad QA at 820×1180 portrait and 1180×820 landscape visually inspected (home, Level 2 flow, Level 6 catalog and calibration checklist ○ items) with no clipping, overflow or console errors — evidence in `/home/user/workspace/ych_rehab_qa_artifacts/v67-bedside-usability/`.
- Limitation: simulated-landmark and fake-camera QA cannot replace bedside verification of real affected-hand reopen asymmetry, dropout patterns, ward lighting or iPad camera performance.

## 2026-08-30 v68 Level 5 calibration open-baseline quality gate (ships with v69)
- Fixed the bedside failure where Level 5 grasp/release detection was unusable: the calibration open stage was a blind 750ms timer, so a patient resting in a fist poisoned `openMean` and produced inverted/collapsed thresholds.
- Open-stage samples now require finite aperture AND `calibLooksOpen` (both digits clearly extended); progress accrues as cumulative `openHoldMs` ≥750ms with per-tick delta capped at 120ms, so momentary drops no longer reset progress but a closed hand never accrues.
- Close stage re-baselines automatically: if sustained apertures ≥600ms are clearly more open than the captured open baseline, the open baseline is discarded and recollected (baseline pollution recovery).
- `tests/v68-calib-open-baseline.test.mjs` adds 9 regression tests. No release performed for v68 alone; shipped together with v69.

## 2026-08-30 v69 dim sum order mode (Level 6 chopsticks revamp)
- Rebuilt the Level 67 chopstick dim sum game as a task-oriented ordering activity per bedside feedback video: no chopsticks are drawn on screen (the patient holds real chopsticks), dim sum use real photos (`img/beefball_real.png` 牛肉球, plus existing 蝦餃/燒賣 art), and the two identical steamers are replaced by one large central empty plate (`img/rooster_plate.png`, 雞公碟 real photo).
- Order flow: `newDimsumOrder()` announces and displays 「落單：我想食X個…，Y個…。」 (2 distinct dim sum types, 2–4 each, spoken in Cantonese); each correctly placed dim sum appears ON the plate (up to 10 slots) with a live progress line (e.g. 牛肉球 1/2　蝦餃 1/3); completing the order triggers a WebAudio applause + spoken praise + green celebration banner, then a new different order begins after 2.6s, looping until the session timer ends. Wrong/excess items score −3 by design (cognitive counting demand). Research/pilot modes are fully unaffected (`isDimsumOrderGame()` requires non-research).
- Spawn/layout hardening from visual QA: the canvas-drawn order banner positions itself below any DOM HUD islands sharing its horizontal span and registers itself as a spawn-exclusion island; `ensureFoodsClearOfInstructions()` now re-runs whenever the banner rect first appears or resizes (initial spawn happens before first render). Landscape-specific fixes: central plate narrowed to 30% width, dim sum radius capped by canvas height, order-mode spawn slots moved to sides + centre-top, and the banner shrinks its fonts to fit a 38% width cap so side items never hide behind it.
- `tests/v69-dimsum-order.test.mjs` (15 tests) covers menu integrity, order generation distinctness, placement/acceptance/completion, celebration timing, reset, and no-chopsticks-drawing invariants; `tests/level67-interactions.test.mjs` extended for the single-plate flow via the `dimsumOrder` QA layout field.
- Validation: full Node suite **307 total / 304 passed / 0 failed / 3 intentional skips**; source technical validator **165/165**; `tools/checkjs.sh` + module `node --check` + `git diff --check` passed; `dist/public` rebuilt (136 files, 84M) with aligned `v69-20260830-dimsum-order` markers, 0 QA-hook hits, and both new photos present + included in `offline-assets.js`; Playwright iPad QA at 820×1180 portrait and 1180×820 landscape — start, mid-order placement and celebration screenshots all visually inspected (evidence `/home/user/workspace/ych_rehab_qa_artifacts/v69g_*` and `v69c_*`).
- Limitation: simulated-landmark QA cannot replace bedside verification of real chopstick handling, applause audibility in ward noise, order comprehension by aphasic patients, or iPad camera performance.

## 2026-08-30 v70 tool-in-hand pinch detection (real chopsticks / clothes peg)
- Fixed the bedside failure (three 30 Aug recordings) where Level 6 real-tool tasks were unusable with an actual tool in hand: the bare-hand open gate (aperture ratio ≥0.72) is unreachable while gripping chopsticks, and the middle finger rides the lower chopstick so it moves far less than the index — symmetric thresholds never confirmed release.
- New `computeToolPinchState` path (chopsticks + clothes-peg tasks only): per-digit ratios against each digit's own calibrated range, weighted near 0.68 / far 0.32; grasp enters at ratio ≤ enter; release requires BOTH nearRatio ≥ nearExit AND farRatio ≥ farExit — a single drifting landmark can never release (verified in the live pipeline: index-only and middle-only drift both kept the item held).
- Tool calibration: the patient opens/closes the actual tool several times; per-digit open/near-closed samples (p08/p92, min range 0.030, ≥12 samples) derive personal enter/exit/open thresholds (enter = closed + gap×0.56, exits ×0.62, opens ×0.74, score-open ×0.80). Calibration copy, HUD prompts and task cards switch to tool wording (筷子：揸開／合埋；衣夾：鬆開／揸實); v68 open-baseline quality gate and rebaseline/dropout clearing preserved.
- Safety unchanged: affected-hand-only identity gates, fail-closed staleness/generation checks, MAX_HOLD_MS 5000 (confirmed firing in QA when a hold exceeded 5s), release dwell 650ms, no opposite-arm fallback. No tool identification is performed — the camera only analyses visible hand motion.
- `tests/v70-tool-pinch.test.mjs` (16 tests) covers threshold derivation, per-digit asymmetry, single-digit drift safety, calibration gating and wording; `tests/level67-interactions.test.mjs` re-verified 44/44.
- Validation: full Node suite **323 total / 320 passed / 0 failed / 3 intentional skips**; source technical validator **165/165**; `tools/checkjs.sh` + module `node --check` + `git diff --check` passed; `dist/public` rebuilt with aligned `v70-20260830-tool-pinch` markers ×3 and 0 QA-hook hits; Playwright iPad QA 820×1180 + 1180×820: calibration copy screens, full dim sum order completion end-to-end in both orientations (order done, celebration banner, plate accumulation), in-game prompt wording (揸開筷子→合埋筷子拿起→保持夾住→揸開筷子放下), dist boot — all screenshots visually inspected (evidence `/home/user/workspace/ych_rehab_qa_artifacts/v70_*`).
- Limitation: simulated-landmark QA cannot replace bedside verification with real chopsticks/pegs, real hemiplegic grip asymmetry, ward lighting or iPad camera performance.

## 2026-08-30 v71 laundry order mode (Level 6 clothes-peg revamp)
- Rebuilt the Level 67 peg laundry game per bedside feedback (7 clothes photos + drying-rack photo supplied 30 Aug): the two 曬衫竹笆 boxes are gone, replaced by ONE large white drying rack (real photo `img/laundry_rack.png`) at the bottom centre; items are real clothes photos (恤衫×2 designs、孖煙通、牛仔褲、半截裙、底衫、襪) with no virtual peg drawn — the patient operates a real clothes peg.
- Order flow mirrors v69: `newLaundryOrder()` announces e.g. 「請將3件恤衫放上晾衫架。」 (first order 1 type ×3; later orders 2–3 distinct types, 1–3 pieces each, ≤10 rack slots, Cantonese measure words 件/條/對); hung clothes accumulate visually ON the rack rail; completing an order triggers applause + 「好叻呀！晾好晒喇！」 + green banner, then a new order after 2.6s until the timer ends. Research/pilot untouched (`isLaundryOrderGame()` requires non-research).
- Spawn hardening (validator catch): the landscape default spawn slots (y 0.54) sat inside the big rack's protected zone, so all slots were rejected and spawns fell into the reduced-spacing fallback, causing intermittent item overlap — laundry order mode now uses dedicated landscape slots (y 0.36, x 0.24/0.50/0.76). The Level 4–6 validator runner also learned the order-driven target mapping (`layout.laundryOrder` → rack), matching its v69 dimsum handling.
- `tests/v71-laundry-order.test.mjs` (16 tests): assets, defs/measure words, single-rack contract, both drop paths, deadlock guard, lifecycle, gating, order generation bounds, placement/completion/reset behaviour.

## 2026-08-30 v72 fridge grocery put-away game (new Level 5 theme 雪櫃收納)
- New Level 5 grasp-and-release theme per 30 Aug request (13 photos supplied): after grocery shopping, the patient moves 12 foods (叉燒飯、排骨、豆腐、蝦、肉丸、菠菜、菜心、黃芽白、南瓜、牛奶、魚、荷蘭豆 — real photos, background-removed) one at a time from a grocery bag at the bottom of the screen into a large open-fridge photo (`img/fridge_open.png`) at the top.
- Free placement WITH planning demand: food may be released anywhere inside the fridge interior, but landing on an already-placed food "crashes" — rejected with a red dashed ring, an orange banner + spoken hint naming the blocking food (「嗰個位放咗牛奶喇，試下第二度啦。」). Crashes/out-of-bounds deduct NO score and never feed `wrongStreak` (spatial planning is part of the task; avoids recovery-pause loops); the food simply returns for another attempt. Successful placement uses the standard +10 path and the food appears in the fridge where it was released (placed radius sized so all 12 fit with planning).
- Round flow: shuffled 12-food queue, spoken intro 「買完餸返嚟喇！…」, canvas banner shows progress (已放入 X／12 樣　而家請放：…) and the paper grocery bag shows 「仲有 N 樣」; completing all 12 triggers applause + 「好叻呀！全部餸菜都放入雪櫃喇！」 then a new shuffled round after 2.6s. Gated to public Level 5 only (`isFridgeGame()` requires level '5' + non-research); PILOT_TRAINING_SCENARIOS untouched.
- Wiring: theme `fridge` in THEME_ORDER (Level 5 catalog only), single top fridge target (style `fridge`), bag-spot spawn in `makeFoodAt`, single-current-food defs via `getActivityDefs`, `dimSumTargetCount` 1/0, deadlock guard in `ensureFoodCount`, both drop paths route through `fridgeTryPlace`, banner registered as spawn-exclusion island, reset/start hooks, QA layout field `fridgeGame`.
- `tests/v72-fridge.test.mjs` (18 tests): assets, theme gating, 12 defs, top/bottom layout, drop-path routing, no-penalty crash branches, deadlock guard, pilot isolation, behavioural module tests (shuffle, place/advance, wrong-type/distractor rejection, bounds crash, collision crash naming the blocker, full-round celebration + auto next round, reset, 12-fit geometry).
- iPad QA-driven fixes: `ensureFoodsClearOfInstructions` now skips held/removed foods (held-item relocation was cloning an orphan duplicate in the bag) and bails on missing defs (post-round crash during celebration); `fridgeTryPlace` rejects releases overlapping the instruction banner with a no-penalty crash-style hint 「呢個位俾指示牌遮住，放低啲第二度啦。」; crash distance factor 0.92→0.85 and landscape-aware `fridgePlacedRadius` (rh×0.105／rw×0.058 vs portrait 0.135／0.075) so all 12 foods fit in landscape where the banner blocks much of the interior; QA-only `banner`/`interior` geometry added to the `level67Layout().fridgeGame` payload.
- Landscape banner overlap fix for ALL order banners (dimsum v69, laundry v71, fridge v72): banners started at y=10 and the narrow centred dimsum/laundry banners were hidden behind the top DOM button row (返回／暫停…). All three now floor at y=76 in landscape (`isPortrait() ? 10 : 76`); portrait unchanged. Verified by screenshots in all three themes.
- Test upkeep: build marker re-pinned to `v72-20260830-laundry-fridge` in adaptive-progression／language-switch／shoulder-flexion-levels／tracking-regression tests; v72 fridge test harness now injects `gameCanvas` (used by landscape-aware radius).
- iPad Playwright QA (820×1180 + 1180×820): fridge full rounds 12/12 both orientations (16/13 planned spots, crash + banner-blocked rejection exercised, score 120, auto next round via real 2.6s timer); laundry order completed 3/3 both orientations (0 pick fails, praise banner + rack accumulation verified); dimsum landscape banner reposition verified; 0 page errors everywhere. Dist boot check: marker v72, `window.__qa` undefined, 0 console errors.
- Validation (v71+v72 together): full Node suite **357 total / 354 passed / 0 failed / 3 intentional skips**; source technical validator **166/166** (fridge launch added); `tools/checkjs.sh` + `git diff --check` passed. Dist rebuild, iPad QA and security review recorded below before release.

## 2026-08-30 v73 bowling alley scene (Levels 3/4 shoulder flexion)
- New shoulder-flexion visual scene 「荃灣保齡球場」 for Levels 3 AND 4, offered first in the theme list, per 30 Aug request (retro alley mockup IMG_1542 + bowling animation video supplied). Assets: `img/bowling_alley_bg.png` (alley cleaned of pins/ball, 荃灣保齡球場 sign kept), `img/bowling_pin.png`, `img/bowling_ball.png` (all AI-edited from the user's mockup, pngquant-optimised), `audio/haobo_cheer.mp3` (0.97 s, 4 mixed male+female voices shouting 「好波」, Gemini TTS, bundled offline).
- Mechanic: the lane scene replaces the generic guide/target panel (`drawShoulderFlexionGuide` branches to `drawBowlingAlleyScene`; `setupTargets` returns no generic target). The bowling ball (item layer) shrinks with lift progress; when the patient reaches the OT-selected target angle (existing `targetReady` award point — judgement unchanged), `startBowlingStrike()` rolls a ball up the lane (620 ms), then ALL 10 pins fall completely with per-pin randomised rotation/offsets (680 ms) and stay lying until the repetition completes (arm returns → `resetBowlingStrike()` re-racks). Impact plays synthesized pin-crash (WebAudio noise bursts) + existing applause + the bundled multi-voice 好波 cheer (decoded once via `getAudioCtx()`, same-origin fetch, fail-safe).
- SAFETY: pure visual/audio reward layer reading only `shoulderFlexionState.progress`/`targetReady` — adds no hand-contact, pickup-dwell, grip or release signal to the L3/L4 branch (contract test enforces banned identifiers in the scene block).
- Wiring: theme `bowlinglane` (legacy Level-4 tabletop id `bowling` untouched), THEME_ORDER + tracking-regression assertion updated, gated `level==='3'||'4'`, `LEVEL3_THEME_VARIANTS.bowlinglane` single variant, EN localization entries added, `build-dist.sh` now copies `audio/` (service worker inventories it automatically).
- QA-driven fixes: item label suppressed during roll/fall (floating 保齡球 text mid-lane); top 目標 X° caption skipped when the panel top is within 34 px of the canvas edge (landscape clipping) — side panel already shows the target.
- `tests/v73-bowling.test.mjs` (8 tests): assets + dist audio copy, theme registration/order, functional level gating, variant/scene/no-generic-target contracts, safety banned-identifier scan, strike trigger + repetition re-rack anchors, functional strike state machine (roll→impact sounds-once→down→reset, 10 pin seeds, re-trigger no-op), lane geometry on-canvas in both iPad orientations.
- Validation: full Node suite **365 total / 362 passed / 0 failed / 3 intentional skips**; technical validator **168/168** (×3 runs); `tools/checkjs.sh` + `git diff --check` passed; dist rebuilt with aligned `v73-20260830-bowling` markers ×3 and 0 QA-hook hits; audio shipped in dist + offline-assets. iPad Playwright QA (820×1180 L3 target 40° + 1180×820 L4 target 60°): calibration→lift→targetReady→ball rolls→all pins down→green tick→arm lowered→rep counted (score 10, streak 1/15)→pins re-racked, screenshots visually inspected (`ych_rehab_qa_artifacts/v73/`); 0 page errors; dist boot check passed.
- Limitation: 好波 cheer generated with Gemini TTS — Cantonese pronunciation needs bedside verification on iPad speakers; simulated-landmark QA cannot replace real ward camera/lighting verification.

## v74-20260831-teahouse（2026-08-31）
- 點心主題（Level 3/4）新增「模擬茶樓」顯示模式（預設），活動選單點心卡下面有選擇框：「模擬茶樓」｜「看到自己」（原有鏡頭版本，完全保留）。
- 模擬茶樓：全畫面茶樓背景（唔顯示病人自己嘅鏡頭影像），點心隨抬肩由下方細碟升起；達標後飛入竹蒸籠，冒蒸氣＋「醒目！繼續！」橫額＋廣東話讚賞語音（好叻呀！點心蒸好喇！）。
- 安全不變量：場景屬純視覺／音效獎勵層，只讀 shoulderFlexionState，唔加任何手部接觸／揸握／放開訊號；research track（!research.active）唔受影響；L5 雪櫃、L67 筷子點心完全不變。
- 新資產：img/teahouse_bg.png、img/steamer_empty.png（AI 生成後壓縮）。
- 測試：tests/v74-teahouse.test.mjs 12 項新測試；全套 374 pass / 0 fail / 3 skip；validator 168/168；iPad QA 820×1180＋1180×820 截圖已目視檢查（ych_rehab_qa_artifacts/v74/）。

## v75-20260831-design（2026-08-31）
- 依照用戶 30–31 Aug 設計圖（IMG_1549 箭咀、IMG_1550 茶樓、IMG_1554 保齡球、IMG_1555 雪櫃、插花設計圖）全面重整場景；所有新視覺資產一律由用戶設計圖裁剪（flower_01–08、leaf_01–08、flower_vase、th_plate 852×413、th_tray 977×447、bball_court、bball_ball；例外：fridge_wide.png 1597×935 為 AI 闊雪櫃）。
- L3/4 保齡球場放大：pwFit 修正 landscape 溢出，球道貼滿場景框，球樽/球更大更清楚。
- L3/4 新主題「籃球」（荃灣屋邨球場背景，規則同保齡球邏輯完全一樣）：籃球隨抬肩縮細升向籃框，達標後 startBasketballShot() 入樽動畫＋歡呼；純視覺獎勵層，只讀 shoulderFlexionState，contract test 掃描禁止任何手部接觸／揸握／放開識別字（v73/v74/v75 場景區塊同一標準）。
- L3/4 模擬茶樓依設計圖重排：中間大碟（th_plate）＋碟上蒸籠，下方托盤（th_tray，貼畫面底）載細碟點心，右側大型綠色向上箭咀（drawTeahouseUpArrow）提示抬肩方向；幾何測試改為 v75 設計（laneX=cw*0.5、碟上蒸籠、托盤貼底、正向移行距離）。
- L5 插花按設計重做：16 款花葉材（用戶相片裁剪）、新花瓶、底部調色盤一行揀花，功能鍵（花⇄葉／旋轉／放大縮小／復原／清除／完成作品）保留；鏡頭畫面保留喺場景後面，病人見到自己隻手先可以安全對準抓握。
- L5 雪櫃改用闊身雪櫃相，landscape 橫向佔滿全屏（tw=min(cw*0.97,1160)、maxH ch*0.64），食物加大（fridgeBoost landscape 1.35／portrait 1.25）。食物喺 landscape 會視覺上疊喺雪櫃相底部裝飾邊之前（刻意「企喺雪櫃前面」層次）；validator itemsDoNotCoverTargets 為 fridge 主題改用「生成點中心必須完全喺雪櫃矩形以下」不變量（保留向上搬運距離；其他主題維持圓對矩形零重疊檢查）。
- L6 工具開合自適應偵測（曬衫夾＋筷子夾唔到嘅修復）：TOOL_ADAPT_MIN_SAMPLES=90、MIN_SPAN=0.030、TOO_CLOSE_SCALE=0.55；病人實際開合幅度自動學習個人化 enter/nearExit/farExit/open/scoreOpen 閾值（lo+span×0.42/0.58/0.72/0.85），幅度不足即 fail-closed（thresholds=null 回退預設）；雙指同時重開先算放開（單指漂移永不觸發釋放）；HUD 實時顯示開合%＋「手太貼近鏡頭」提示；resetToolPinchAdapt 喺 session reset＋每 rep 兩處清空。
- HUD 修正：iPad portrait 頂部按鈕换行至第二行（~y90–145），.adv-panel top 72→152px，指示卡唔再被 休息/停止 按鈕遮住（插花／麻雀直向截圖驗證）。
- 測試：tests/v75-adaptive-tool.test.mjs 9 項新測試（源碼合約＋行為：靜止唔學習、真開合有序學習、單指漂移安全、reset 清空）；v70/v72/v73/v74/tracking-regression 測試全部更新對應 v75 幾何／主題清單；全套 386 total / 383 pass / 0 fail / 3 intentional skips；validator 168/168；checkjs + git diff --check 乾淨。
- dist 重建：185 檔案，v75-20260831-design 標記 ×3 對齊，QA hooks 0 命中；iPad Playwright QA 820×1180＋1180×820 七個場景截圖全部目視檢查（ych_rehab_qa_artifacts/v75/）。
- 限制：模擬 landmark QA 不能取代病房實機（真衣夾／筷子、偏癱手形、病房光線、iPad 鏡頭）驗證；茶樓碟/托盤相內有畫上點心屬設計圖原有內容。

## v77 local responsiveness pass（2026-09-01；未部署）
- 同一個新鮮 decoded-frame generation 只做一次 affected-hand inference／interpretation；stale、nonfinite、倒退 generation、換 video/session 一律 fail-closed，init／camera reset 會清 cache。Affected-hand-only、finite landmarks、無 opposite-hand fallback 保持不變。
- Public loop 約 30 fps、privacy recording canvas 20 fps，duplicate RAF／decoded frame 不重做昂貴工作；research loop 保持原有逐 RAF 行為。Public tracking 改 3-frame median + EMA 0.20／0.32／0.45；research 保持 5-frame 及舊 alpha。
- Action prompt 用 mode／language／content render key 避免相同 DOM writes，patient／research 顯示內容保持原樣。
- Public shoulder hold 可容許連續 2 個新鮮 below-target frame，第 3 個才 reset；grace 期間 hold clock 暫停，stale／invalid 即時 reset。Public target feedback 150 ms；research/default 不變。
- Public grasp 及 advanced timing 對齊 100／120／220 ms；research 分別保持 220／360／650 及 420／480／1000 ms。60 ms gesture confirmation、先真 open 才可 prep、最多 100 ms fresh-only release continuity、Level 6 雙指同時重開及 tool gate 全部保留。
- Level 5 cards／Mahjong viewport layout 防止選項重疊／出界；steamer／laundry overlap 加 safeguard；cards 指示更新為上方收牌區。雪櫃 layout 完全未改。
- 驗證：focused responsiveness + shoulder 35/35；tracking + accessible preview 46/46；Playwright UI/layout 20/20（含 390×844、1180×820 Level 5 bounds／non-overlap）；全 Node suite 423 total／420 pass／0 fail／3 intentional skips；syntax checks passed。詳情見 `v77_responsiveness_local_report_20260901.md`。

## v78 Level 6 pinch games + patient voice（2026-09-01；只限本機，未部署）
- Public Level 6 關手／夾住游標及動作提示已按患側使用用戶上載的右手、左手圖片；白底以透明 PNG 處理，原 JPEG 未改。Level 5 及 research 顯示分支維持原樣。
- Standard 與 advanced 搬運顯示把物件移到拇指／食指接觸點，並以 0.74–0.96 透明度保留物件可見；碰撞、計分及真實控制座標仍使用原 cursor／held-item 座標。
- Level 6 插花改用 Level 5 public advanced 插花版面與相同 vase/palette 幾何，但 `gameType` 仍是 Level 6 affected-hand tripod pinch。
- Public Level 6 筷子加入 wrist-relative index/middle extension cue，讓拇指／筷子重疊時仍可觀察兩指屈伸；固定及自適應進入／重開均要求兩指同意，靜止或只一指漂移不會產生自適應門檻或釋放。Research 分支不使用此 cue。
- Level 5 點心 source 初始 Y 限制於畫面下半（portrait ≥0.62、landscape ≥0.64），蒸籠保持上半；真初始 preview 無 held item。
- 新增 audio-only public voice observer：接觸未拿起物件時 Level 5「揸拳頭」、Level 6「夾住」；在真正下到上版面持續持物但 1.6 秒後仍無有效上移時「舉高手」一次；到達目標但仍夾住時 Level 5／一般 L6「打開隻手」、筷子「打開筷子」、衣夾曬衫「放手」。每 cycle 去重、2.8 秒 cooldown、drop/round reset；cards/mahjong 或目標不在上方不會講「舉高手」；paused/research 不會記錄或播放。沒有新增畫面文字。
- 安全：affected-hand-only、fresh/stale generation、finite landmarks、handedness confidence、無 opposite-hand fallback、open-before-close、movement/adaptive gate、60 ms stabilizer、release dwell 及 Level 6 true dual-digit reopen 均保留；voice 只觀察已判定 contact/phase，不改 scoring/tracking。
- 驗證：`tools/checkjs.sh` 11 blocks 全過；v78 新要求 11/11；focused Level 5/6 tracking/tool/layout/voice 161/161；全 Node suite 435 total／432 pass／0 fail／3 intentional skips；`git diff --check` 通過。實際 Level 6 筷子流程攔截到「夾住」及「打開筷子」，物件仍 held、score 0，確認語音沒有代替放手或計分。
- 預覽：`preview_level5_dimsum_initial_390x844.png`、`preview_level6_flowers_right_pinch_820x1180.png`、`preview_level6_chopsticks_left_pinch_1180x820.png`，均以 source `index.html` 的 fresh browser context、本機 HTTP、service worker blocked 產生並目視檢查；沒有改 `dist/public`、沒有部署／commit／push。
- 限制：synthetic landmark／browser QA 不能取代真 iPad、長者偏癱手、真筷子／衣夾遮擋、病房光線及裝置廣東話 voice 的 bedside 測試。 supplied hand image anchor 及物件接觸點在極端 canvas 邊緣仍可能被裁切。
## 2026-09-02 v91 Level 6 chopstick open-arm repair
- Root cause: public chopsticks allowed the fixed 1.48/1.68 index/middle extension ratios to override the calibrated tripod aperture. A naturally flexed static affected hand could therefore become `closed`, while a genuinely small participant-specific stroke could remain unreachable. Runtime adaptive history was also cleared at `initGame`, and no calibrated flex range existed to survive that reset.
- Replaced absolute flex classification with participant-specific two-finger thresholds. Calibration now records valid affected index and middle open/closed samples separately and stores `state.personalChopstickFlex`; both digits must move in the same direction and thresholds stay inside the measured range without a large artificial floor.
- Gameplay threshold order is now calibration → runtime-adaptive fallback → defaults. `initGame` still clears transient histories but preserves `personalToolPinch` and `personalChopstickFlex`.
- Real-tool `isOpenPrep` now requires a positively separated posture, not merely any valid frame that is not currently closed. Every basic, picker, and carrier cycle remains unarmed until stable open; tracking loss, stale/duplicate generations, missing working fingers, or the wrong anatomical hand disarm the cycle.
- While unarmed, public chopsticks visibly show `先張開筷子｜穩定張開後再合埋夾起`; the otherwise audio-only Level 6 status card remains unchanged. Research-mode branches and the other five Level 6 activities are not rerouted.
- Added `tests/v91-chopstick-open-arm.test.mjs` for static closed entry, open→close pickup, close-without-open rejection, calibrated small-range motion surviving game init, and tracking loss/duplicate/invalid/wrong-hand re-arm.
- Focused result: 84/84 pass across v68 calibration, v70 tool pinch, v75 adaptation, v78 Level 6 interactions, v91 regression, and tracking regression. Inline/service-worker/sanitizer syntax checks and `git diff --check` pass before rebuild.
- Final validation: complete Node suite **473 total / 470 passed / 0 failed / 3 intentional skips**; the four updated patient-safety/UI contracts pass **44/44**; source and rebuilt-public inline JavaScript, service workers, sanitizer and build script syntax all pass; build markers align at `v91-20260902-chopstick-open-arm-calibration`; public research isolation and final `git diff --check` pass.

## 2026-09-02 v92 bottom-right hand-tracking stabilization
- Diagnosed the visible edge jitter as a combination of source-video/canvas aspect-ratio mismatch, short no-hand detector gaps resetting Level 5/6 gesture state, and redundant Safari resize events clearing the canvas. Normal pickup/release hysteresis was not rapidly toggling valid state.
- Added `object-fit:cover`-equivalent camera crop mapping using the decoded video dimensions, bounded the cursor/carried sprite by its radius, bounded the Level 6 visual hand/item offset, and made identical canvas resizes a no-op.
- Extended the existing 750 ms edge grace to Level 6 grasp/pinch play only for a genuine fresh `no-hand-detected` result. Wrong-hand, low-confidence/unknown-hand, missing required landmarks, duplicate frames, and stale frames still fail closed and clear the open arm.
- During an admitted edge miss, gesture/open/release clocks are paused rather than reset or advanced. This preserves a previously proven open-before-close arm without allowing missing frames to earn pickup or release dwell.
- Added `tests/v92-edge-hand-stability.test.mjs`: portrait iPad-like cover mapping, Level 5 right/left edge misses, Level 6 peg right/left and chopstick edge misses, held garment/dim-sum bounds, and two virtual-minute Level 5 and laundry pickup/drop endurance loops.
- Rebuilt `dist/public` with aligned marker `v92-20260902-edge-hand-stability`; sanitized public isolation remains intact.
- Final validation: all 48 test files passed in four bounded groups, **481 total / 478 passed / 0 failed / 3 intentional skips**. Focused v92 tests pass **8/8**; Level 6 plus v91 safety pass **51/51**; public isolation passes **5/5**. Source/public inline scripts, source/public service workers, sanitizer and v92 test syntax pass; `git diff --check` passes.
- `dist/public` was rebuilt locally with **189 files (88M)**. No deployment, commit, GitHub push or other remote change was performed.

## 2026-09-03 v96 Level 5/6 detection robustness (from five therapist screen recordings)
- **Chopsticks "尚未偵測" (confirmed bug, present since v67):** `interpretHandResults()` fell through to the gross-tabletop pose fallback for the normal-flow chopsticks task (`isGrossTabletop() && !isLevel6ToolGestureTask()` is true for level `67` + chopsticks) and referenced `videoEl`, which is not in scope there. The first hand-less camera frame threw `ReferenceError` inside `startCalibLoop().loop`, the `requestAnimationFrame` chain ended, and calibration could never detect the index finger. Reproduced in headless Chromium with the real Hand Landmarker on frames recovered from the recording. Fix: `interpretHandResults(results, inputMirrored, videoEl)` receives the element from `detectWrist`; the pose fallback is now `isGrossTabletop() && !isLevel6()` so every normal Level 6 task fails closed as the comment always intended; `detectWrist` wraps interpretation in try/catch (`interpret-error`); `startCalibLoop` and `gameLoop` keep their RAF chain alive on a per-frame fault (`calib-frame-error`; QA mode still rethrows).
- **Level 5 cursor loss mid-grasp:** MediaPipe handedness label/score dips when the whole hand closes into a fist; the strict `>= 0.55` label gate then returned `affected-hand-not-detected`, which was not grace-eligible, so cursor and grasp state were cleared immediately. Added a short continuity rescue in `selectedAffectedHandIndex` (public Level 5 only): an ambiguous label within 0.16 normalised units of the last accepted wrist inside 600 ms is kept; a confidently labelled opposite hand (`>= 0.80`) is still rejected, a hand elsewhere is rejected, and cold-start ambiguous labels still fail closed. `affected-hand-not-detected` now qualifies for the existing 750 ms hold in public Level 5 only. Level 6 tasks keep the strict fail-closed rule (level67-interactions tests unchanged).
- **Level 6 flowers on landscape iPad:** with the full-width planter, `flowerSnapToVase` could place a released bloom half outside the canvas at the screen corner. Placement is now clamped to keep the bloom visible; the v77 central-reach amplification is unchanged.
- QA hooks: `__qa.interpretHand`, `__qa.graspGraceEligible`, `__qa.resetHandTrack`, `__qa.flowerSnapProbe`. New `tests/v96-level5-6-detection-robustness.test.mjs` (6 tests). Full suite: 51 files, 485 tests / 482 passed / 0 failed / 3 intentional skips.
- Build marker `v96-20260903-level5-6-detection-robustness`; `dist/public` rebuilt (189 files).

## 2026-09-03 v97 Level 5/6 low-latency pass
- Analysed therapist recording `IMG_6290.mov`: 25.765 seconds, 773 frames, stable approximately 30 fps, maximum recorded frame interval 35 ms and no interval above 50 ms. The visible delay therefore came from application inference/render work rather than dropped frames in the recording.
- Removed the duplicate Level 6 inference path: normal Level 6 sessions now initialise and run Hand Landmarker only. Pose Landmarker remains limited to Levels 2–4 gross-tabletop tasks. Chopsticks, flowers and the other Level 6 activities no longer synchronously run Pose plus Hand on every decoded camera frame.
- Preserved the actual public chopsticks mechanic: affected-side index-fingertip dwell (`gameType: dwell`) controls the cursor and pickup/release. Finger flexion/tool-opening measurements remain calibration or prompt support only and are not required to move the cursor or complete a dwell.
- Public Level 5/6 cursor display now uses the newest accepted hand point directly, bypassing the previous 3-frame median plus EMA delay. Research mode and Levels 2–4 retain their previous smoothing.
- Added a public-only large-display backing-store limit (maximum edge 1600 px, maximum 1.44 million pixels). CSS presentation remains full-screen; iPad 1180×820 remains native size; research mode remains uncapped. This reduces full-canvas image/shadow/text repaint cost on 1080p and 4K external displays without changing task geometry.
- Extended the Level 6 QA frame hook to all Level 6 tasks and added `tests/v97-level56-performance.test.mjs` plus `tests/v97-level56-latency-e2e.test.mjs`.
- Validation: full Node suite **490 total / 487 passed / 0 failed / 3 intentional skips** in four bounded groups; `tools/checkjs.sh`, service-worker/shell syntax and `git diff --check` passed. Persistent Playwright QA covered Level 6 flowers at 1920×1080 (1600×900 backing store), Level 6 chopsticks at 1180×820, and Level 5 flowers at 820×1180; latest-frame cursor coordinates matched exactly, pause/resume worked by real click, and there were zero page errors.
- Limitation: browser and synthetic-landmark QA cannot replace bedside testing with a real affected hand, real chopsticks, ward lighting, iPad thermal load or the final external display/cable combination.

## 2026-09-04 v98 Level 5/6 hand admission, render cache, 30 s safety pause (from therapist recording `IMG_6325.mov` and bedside report)
- Bedside report: on a Windows laptop webcam mirrored to a ward TV, Level 5/6 detection was slow, the cursor disappeared for around 20 s while the participant was clearly performing the task, reappeared inconsistently, and the open/closed hand icon flickered. The red full-screen pause overlay appeared after only 5 s.
- Safety pause: `MAX_HOLD_MS` 5000 → 30000 (overlay copy derives from the constant). The pause still fires on a stationary hand; it now no longer interrupts a slow but ongoing reach.
- **Clinical policy change (public Level 5 and Level 6 only; research mode unchanged and still strict):** the affected-hand gate previously rejected every frame whose MediaPipe handedness label was not the affected side at ≥0.55 confidence. With a low table-height webcam the hand is seen edge-on or from the dorsum and the label is wrong or uncertain for long stretches, so the cursor vanished although the hand was visible. v98 keeps the strict confident-label pass first, then: (a) continuity rescue (ambiguous label near the last accepted wrist) extended from 600 ms to 1500 ms and applied to Level 6 as well as Level 5; (b) lone-hand admission — when exactly one hand is in view, an affected/unknown/uncertain label is admitted at once, and a confidently opposite-labelled lone hand is admitted only after being continuously alone and opposite-labelled for 1000 ms (`LONE_HAND_ADMIT_MS`); (c) with two or more hands in view the strict rule still decides, so an assisting hand never displaces a visible affected hand; (d) the 750 ms handedness-dropout grace (v96, Level 5) now also applies to Level 6. Level 6 fresh-frame, finite-landmark, open-before-close, tool-gate and release-dwell rules are unchanged.
- Grasp icon flicker: the public Level 5 grasp stabiliser confirmation window was 30 ms, i.e. a flip was confirmed on the very next frame, so a hand at the open/closed threshold toggled every frame. Raised to 60 ms (two consecutive frames at 30 fps). Level 6 pinch timing unchanged.
- Render cost: megapixel photo assets (dim sum, steamer, big plate, laundry, fridge, flower pot, Level 5 food items) were resampled from full resolution every frame. Added a down-sampled bitmap cache (`scaledBitmapFor`/`drawImageScaled`, 64 px buckets, ≤6 variants per image, sources ≥400 px only); atlas/source-rect draws and Level 4 are untouched. Headless benchmark at 1180×820: Level 5 dim sum source pixels per frame 2.58 MP → 0.45 MP, Level 6 flowers 0.64 → 0.37 MP.
- Hand model delegate: previously fixed GPU on non-Apple devices. `preferredHandDelegate()` honours `?handDelegate=cpu|gpu`, keeps CPU on Apple touch devices, otherwise uses a per-device record in `localStorage` (`fthue.handDelegate.v98`). After a public Level 5/6 game with ≥90 samples, a GPU mean tracking time >70 ms triggers one CPU trial game, then the faster delegate is settled. QA and research sessions never write the record.
- Diagnostics: `?perf=1` shows a small on-screen HUD (tracking ms, render ms, frame ms, fps, long frames, camera/canvas size, hand delegate, hands in view, label/score, admission path and per-path counters). Same data via `__qa.perf()` in the source build only.
- Tests: new `tests/v98-level56-hand-admission.test.mjs` (10 tests). Updated `tests/level67-interactions.test.mjs` (fail-closed cases now include a second hand and let the continuity/grace windows lapse), `tests/v96-level5-6-detection-robustness.test.mjs` (v98 policy), `tests/v77-accessible-grab-preview.test.mjs` (cached draw), `tests/v67-bedside-usability.test.mjs` (30 s) and the seven build-marker tests. `setLevel6ToolFrame` gained `secondHand` for QA.
- Validation: full Node suite **500 total / 497 passed / 0 failed / 3 intentional skips** in four bounded groups, `tools/checkjs.sh`, service-worker syntax and `git diff --check` passed; `dist/public` rebuilt with aligned `v98-20260904-level56-hand-admission-render-cache-hold30s` markers; public-isolation test and clean static-server boot (`window.__qa` undefined); iPad Playwright QA at 820×1180 and 1180×820 with visually inspected screenshots.
- Limitation: the therapist's laptop model, browser and display mode are unknown; synthetic landmarks cannot reproduce its webcam geometry or GPU. The `?perf=1` HUD exists so the next bedside session can report the real tracking/render cost and admission path.

## 2026-09-04 v99 Handedness-check switch, calibration hand lock, calibration privacy blur (therapist requests C and D-1)
- Therapist request: (C) a therapist-controlled ON/OFF for the left/right hand check, and once calibrated the game should stay on the participant's hand and not be captured by other objects, passers-by or people in the background; (D-1) blur the calibration camera view like a video-call background so other patients in the ward are not shown.
- **Handedness check switch (public Level 5 and Level 6 only; research mode unchanged and still strict):** new `state.handednessCheck` (default `true` on every page load), UI block `#handCheckBlock` inside the 患側方向 card (`button-handcheck-on` / `button-handcheck-off`, note text explains that OFF is only for alert participants under direct supervision). The block is hidden for Level 3/4. OFF ignores the MediaPipe left/right label entirely; the affected-side choice is still required because Level 5/6 placement geometry (cards, mahjong, targets) depends on it. `startGame(opts.handednessCheck)` and `__qa.setHandednessCheck()` in the source build only.
- **Calibration hand lock (public Level 5/6, both switch states):** `handLock` stores the last admitted wrist position and an EMA of the wrist→middle-MCP span. (a) Size gate: a hand whose span is <0.55× or >1.90× the locked size is not eligible (a smaller background hand or a passer-by further from the camera is dropped); if every visible hand fails the gate for 3 s the size is forgotten so a participant who moved much closer/further is not locked out. (b) Lock override: while the tracked hand is still within 0.16 of its last position and fresh (≤1500 ms), a confidently labelled hand more than 0.30 away does not take over even if its label score is higher. (c) Re-acquisition: after the track is stale, a hand appearing more than 0.30 from the lock must persist 400 ms before admission; near the lock it is immediate. The lock survives a new round and is cleared on camera start/stop. v98 admission order (strict → continuity → lone hand) is otherwise unchanged. `?perf=1` HUD shows `perf v99`, `check on/off`, `lockSize`, and `size`/`far` rejection paths.
- **Calibration privacy blur:** default ON (`state.privacyBlur`), toggle button `#btnPrivacyBlur` next to 左右反轉. Implemented on the existing `calibOverlay` canvas with no extra model: the `<video>` is hidden (opacity 0) while the class `privacy-blur` is set, the frame is drawn through a two-stage down-scale (40 px → 160 px wide → full size, `imageSmoothingEnabled`) with a 22 % dark overlay, and once a hand (Level 5/6) or the affected shoulder/elbow/wrist (Level 3/4 pose) is detected a rounded sharp window (bounding box + 28 % padding, min 18 % of the frame) shows the participant's hand at full clarity. Mirror mode is honoured. The game screen (selfie preview under the game) is unchanged in this release.
- Assets prepared for v100: `img/fridge_apple.png`, `img/fridge_durian.png` (transparent PNGs from the therapist's photos; not yet referenced).
- Tests: new `tests/v99-hand-check-lock-privacy.test.mjs` (10 tests: constants and scope, settings UI visibility/default, OFF admits opposite label and keeps the locked hand, ON lock override, size gate + 3 s forget, 400 ms far re-acquisition, lock survives a round / cleared by reset / Level 4 strict, privacy toggle). Seven build-marker tests updated.
- Validation: full Node suite **510 total / 507 passed / 0 failed / 3 intentional skips** in four bounded groups, `tools/checkjs.sh`, service-worker syntax and `git diff --check` passed; `dist/public` rebuilt with aligned `v99-20260904-hand-check-switch-lock-privacy-blur` markers; public-isolation test and clean static-server boot (`window.__qa` undefined, no page errors); iPad Playwright QA at 820×1180 and 1180×820 with a fake camera device (settings ON/OFF, Level 4 block hidden, calibration blur ON / sharp window / OFF) with visually inspected screenshots.
- Limitation: the blur strength is fixed (40 px source width); a face very close to the camera and very large in frame remains recognisable in outline only. The sharp window follows the detected hand bounding box, so a face directly behind the hand would be shown inside that window.

## 2026-09-04 v100 Calibration privacy: participant-only person segmentation (therapist clarification of request D-1)
- Therapist clarification after v99: the participant should be fully visible, and everything else in the background — including other patients — should be blurred like a video-call background. v99 only revealed the detected hand.
- Implementation: MediaPipe `ImageSegmenter` with the local `vendor/mediapipe/models/selfie_segmenter.tflite` (250 KB, shipped in `vendor`, copied to `dist/public`, listed in `offline-assets.js`). Same `vision_bundle.mjs`/wasm as the hand and pose models; delegate follows `preferredHandDelegate()` with CPU fallback. The segmenter receives a 192 px-wide down-scaled copy of the frame (`privacySegInput`), never the full camera frame, and each `ImageSegmenterResult` is closed after use.
- Participant-only selection: the confidence mask is thresholded at 0.5 and split into 4-connected components (`privacyPersonComponent`). The component connected to the tracked wrist (hand landmark 0, or the affected wrist for Level 3/4 pose) is revealed; the search snaps to the nearest person pixel within 8 % of the frame width; the seed is remembered for 2.5 s after detection drops. Without a seed the largest component is used. A second person elsewhere in the frame therefore stays blurred even when the model classifies them as a person.
- Rendering order in `startCalibLoop`: blurred frame (v99) → participant layer (`drawPrivacyPersonLayer`: video drawn through the mask with `destination-in`, 3 px edge feather, mirror-aware) → hand window (v99, kept so the tracked hand is always sharp even if the segmenter misses it). Segmentation is throttled to one run per 100 ms (250 ms when the EMA cost exceeds 50 ms); the layer redraws every frame from the latest mask. Model load failure sets `privacySegmenterFailed` and the screen falls back to v99 behaviour. `stopCamera` and calibration entry reset the mask/seed.
- Game screen selfie preview unchanged (calibration screen only, as requested).
- Tests: new `tests/v100-privacy-person-mask.test.mjs` (5 tests: model/constant contracts, draw order and resets, component picker with seed/no-seed/snap/far-seed cases, empty masks, toggle + QA layer). `tests/v99-hand-check-lock-privacy.test.mjs` updated (window points variable rename; "no extra model" contract removed). Seven build-marker tests updated. QA hooks `privacyPersonComponent`, `privacySegState`, `setPrivacyPersonMask` (source build only).
- Validation: full Node suite in four bounded groups — 515 tests, 512 passed, 3 intentional skips, 0 failed (four load-induced failures in group 4 — the isolation test racing the concurrent dist rebuild and one timing-based v98 continuity test — passed on an isolated rerun), `tools/checkjs.sh`, service-worker syntax, `git diff --check`; `dist/public` rebuilt with aligned `v100-20260904-privacy-person-segmentation` markers (192 files incl. the model); public-isolation test and clean static-server boot (`window.__qa` undefined, no page errors); iPad Playwright QA at 820×1180 and 1180×820 with a fake camera device — the real segmenter loaded in ~9 s under software GL and produced masks (no person in the synthetic feed → nothing revealed), and an injected person-shaped mask confirmed the composite (blur → sharp participant → hand window) with visually inspected screenshots.
- Limitation: headless software-GL timings (~760 ms per loop) are not representative; bedside check on the HP laptop with `?perf=1` is needed (`__qa.privacySegState().costMs` in the source build). The selfie segmenter is trained for near-camera subjects; a participant far from the camera (Level 3/4 at 1.4 m) may be partially masked, in which case the v99 hand/arm window still shows the affected limb.
