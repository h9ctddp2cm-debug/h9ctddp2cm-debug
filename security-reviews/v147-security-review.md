# v147 Security / Safety Review — detection box, subject lock, 640×360 camera, speed display

Date: 2026-11-27 · Marker `v147-20261127-detect-box`

## Change
Therapist feedback: the games lag on the tablet and on the large TV, and people walking past the
doorway take over the tracking. On site the TV is driven by an HP Windows laptop that uses its own
camera; Levels 3–6 are all played there.

1. Detection box (calibration page). A green box shows the part of the camera picture that is
   tracked. Two sliders move its left and right edges; the default is the middle 76%. Each frame
   the box area is drawn to an in-memory canvas, the hand / pose model reads only that canvas, and
   the returned points are converted back to whole-frame coordinates. The box is not drawn during
   a game. It applies to landscape camera frames only.
2. Subject lock (Levels 3 / 4). Calibration records the shoulder width and the body centre. In the
   game a pose whose shoulders are under 60% of that width, or whose centre jumps more than one
   shoulder width in a single frame, is not passed to the game.
3. Performance. The camera request is 640×360 at an ideal 30 frames a second (was 960×540). A blur
   filter on a camera picture that is not visible in white-background games is removed. The
   instruction panel uses a solid white background instead of a blurred translucent one.
4. Speed display. A switch in the advanced part of the settings page (off by default) shows frames
   per second, tracking time and camera resolution in the corner of the game.
5. On-site test switches in the address: `?cam=hd` (previous 960×540 request) and
   `?poseDelegate=cpu|gpu`. Defaults are unchanged.

## Safety / privacy
- Nothing is stricter for the patient's movement: no detection threshold, confidence, timing,
  score rule or game step was edited. `numHands:2`, confidences 0.20 / 0.18 / 0.18,
  `runningMode:'VIDEO'`, the work interval and the canvas limit are untouched. Levels 5 / 6 still
  have no smoothing, and their existing hand lock was not tightened. Level 6 chopsticks stays
  `gameType:'dwell'`.
- The subject lock fails safe. A refused frame is handled like "no new camera frame": the game
  holds its current state, no point is taken away and the arm is not treated as lowered. A position
  jump is let go after 2.5 s and a size change after 6 s, so a patient who really moved is followed
  again without staff action. Recalibrating clears the record. Unreadable shoulders pass through
  unchanged.
- The pose model still returns one person per frame. If it settles on a passer-by inside the box,
  the lock stops that person from scoring, but the patient is not tracked until the model returns
  to them. Narrowing the box is the main protection; staff should set it during calibration.
- The box can only narrow what the models see. With the box at full width the page uses the
  earlier uncropped path. The hand model keeps a 6% margin on each side so a hand at the edge of
  the box is not cut. The reachable range on screen is the overlap of the earlier safe range and
  the box, so the default box behaves as before and a narrower box still reaches both screen edges.
- Privacy: cropping happens in memory in the page. No frame, crop or landmark is stored, uploaded
  or logged. The visible camera picture keeps its blur and face cover; only a filter on a picture
  that could not be seen was removed. The calibration picture now shows the whole camera frame with
  the area outside the box darkened, so staff can see who is in view.
- Storage: two new `localStorage` entries on the device — `fthue.detectBox.v147` (two numbers, the
  box edges) and `fthue.speedDisplay.v147` (on / off). No personal data.
- No new network destination, dependency or permission. The camera permission request is the same
  one as before with a smaller size.
- The speed display shows numbers about the device only (frames per second, milliseconds,
  resolution, build). It is off unless staff turn it on.
- Public bundle: built with `./scripts/build-dist.sh` (built-in guards pass); QA hooks absent from
  `dist/public/index.html`.

## Verification
- `tests/v147-detect-box-subject-lock.test.mjs` (19): markers; thresholds and pacing untouched;
  both models read the crop and points are converted back; effects removed while the visible
  camera stays blurred; English entries; subject lock (baseline from calibration, small body
  refused, jump refused then let go, size learned again, learning without calibration); detection
  box defaults, limits, saving, reload, crop and mapping; Level 5 / 6 cursor range; calibration
  card only with a landscape camera; a passer-by pose is ignored in a Level 3 game and nothing is
  scored or penalised; behaviour without the lock; speed display.
- Updated for this change: `level4-camera-startup`, `v77-responsiveness`, `v143-simple-setup`,
  `tracking-regression`.
- Browser check with a test camera file and the real models (not an automated test): a hand in the
  middle of the frame is found with the full, default and narrow box at the same position; a hand
  near the edge is found with the full and default box and not with the narrow box; a person in
  the middle is found with every box; a person near the edge is not found with the narrow box and
  cannot complete calibration with the default box; calibration completes for the person in the
  middle and the lock accepts every frame in the game.
- Node tests in two groups: see `progress.md` for the counts of this build.
- `tools/checkjs.sh` 11 OK; `node --check service-worker.js`; `git diff --check` clean;
  `./scripts/build-dist.sh` → 338 files; dist has no `__qa`.

## Not verified
- Not tried on the HP laptop, the TV or a tablet, and not with a patient or real passers-by. The
  browser check used a still picture as the camera; speed numbers from the test machine do not
  describe the laptop.
- Whether 640×360 and the crop make the games feel faster on site is unknown until the speed
  display is read there. Fine finger detection at a distance with the smaller frame should be
  compared with `?cam=hd`.
- With the default box a far-away person just inside the box edge produced occasional very small
  false poses in the browser check. The size rule of the subject lock is meant to refuse these in
  a game; this was not tried with real people.
