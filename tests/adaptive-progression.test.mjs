/* Deterministic tests for the therapist-confirmed FTHUE adaptive progression.

   These run the real controller (fthue-adaptive-progression.js) with no DOM, no
   camera, no timers and no randomness, then assert the index.html wiring by
   source inspection. Clinical rules under test:

     * 15 consecutive VALID successes -> upgrade recommendation
     * 15 consecutive VALID failures  -> downgrade recommendation
     * a valid success resets the failure streak and vice versa
     * invalid trials never increment and never reset either streak
     * each trial outcome is counted at most once (trial-id guard)
     * endpoints show a maintain message instead of an out-of-range move
     * trial (試玩) mode never produces a clinical recommendation
     * therapist-confirmed compensation turns a success into a failure
     * accepting moves the stage, declining keeps it; both reset the streaks */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const progression = require(path.join(root, 'fthue-adaptive-progression.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-dist.sh'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

const REQUIRED = progression.REQUIRED_VALID_STREAK;

function controller(options){
  return progression.createController(Object.assign({ stageId: 'early_level4' }, options || {}));
}

function feed(ctrl, outcome, count, prefix){
  let last = null;
  for(let i = 0; i < count; i++){
    last = ctrl.recordTrial({ trialId: (prefix || outcome) + '-' + i, outcome });
  }
  return last;
}

/* ---------------- ordered stages ---------------- */

test('the progression order is the eight agreed clinical stages', () => {
  assert.deepEqual(progression.STAGES.map(s => s.id), [
    'early_level3', 'late_level3', 'early_level4', 'mid_level4', 'late_level4',
    'level5', 'level6', 'level7',
  ]);
  assert.equal(REQUIRED, 15);
  // Both directions require the same number of consecutive valid trials.
  assert.equal(progression.STAGES[0].appLevel, '3');
  assert.equal(progression.STAGES[7].appLevel, '67');
});

/* ---------------- upgrade ---------------- */

test('15 consecutive valid successes recommend the next stage and nothing sooner', () => {
  const ctrl = controller();
  for(let i = 1; i < REQUIRED; i++){
    const step = ctrl.recordTrial({ trialId: 's' + i, outcome: 'success' });
    assert.equal(step.successStreak, i);
    assert.equal(step.recommendation, null, `no recommendation at ${i}/${REQUIRED}`);
  }
  const final = ctrl.recordTrial({ trialId: 's' + REQUIRED, outcome: 'success' });
  assert.equal(final.successStreak, REQUIRED);
  assert.equal(final.recommendation.type, 'upgrade');
  assert.equal(final.recommendation.clinical, true);
  assert.equal(final.recommendation.actionable, true);
  assert.equal(final.recommendation.fromStageId, 'early_level4');
  assert.equal(final.recommendation.toStageId, 'mid_level4');
  // The stage does NOT change on its own.
  assert.equal(ctrl.snapshot().stageId, 'early_level4');
  // The recommendation is raised once, not on every following trial.
  const after = ctrl.recordTrial({ trialId: 's-extra', outcome: 'success' });
  assert.equal(after.recommendation, null);
});

test('15 consecutive valid failures recommend the prior stage', () => {
  const ctrl = controller({ stageId: 'mid_level4' });
  const final = feed(ctrl, 'failure', REQUIRED);
  assert.equal(final.failureStreak, REQUIRED);
  assert.equal(final.recommendation.type, 'downgrade');
  assert.equal(final.recommendation.toStageId, 'early_level4');
  assert.equal(ctrl.snapshot().stageId, 'mid_level4');
});

/* ---------------- streak resets ---------------- */

test('a valid failure resets the success streak and a valid success resets the failure streak', () => {
  const ctrl = controller();
  feed(ctrl, 'success', 14, 'a');
  assert.equal(ctrl.snapshot().successStreak, 14);
  const broken = ctrl.recordTrial({ trialId: 'break', outcome: 'failure' });
  assert.equal(broken.successStreak, 0);
  assert.equal(broken.failureStreak, 1);
  assert.equal(broken.recommendation, null);

  feed(ctrl, 'failure', 13, 'b');
  assert.equal(ctrl.snapshot().failureStreak, 14);
  const recovered = ctrl.recordTrial({ trialId: 'recover', outcome: 'success' });
  assert.equal(recovered.failureStreak, 0);
  assert.equal(recovered.successStreak, 1);
});

/* ---------------- invalid trials ---------------- */

test('invalid trials never increment and never reset either streak', () => {
  const ctrl = controller();
  feed(ctrl, 'success', 7, 'c');
  const before = ctrl.snapshot();
  assert.equal(before.successStreak, 7);

  const invalidReasons = ['calibration_failure', 'tracking_loss', 'occlusion',
    'camera_error', 'technical_failure'];
  invalidReasons.forEach((reason, i) => {
    const step = ctrl.recordTrial({ trialId: 'inv-' + i, outcome: 'success', reason });
    assert.equal(step.classification, 'invalid');
    assert.equal(step.invalidReason, reason);
    assert.equal(step.successStreak, 7, `${reason} must not change the success streak`);
    assert.equal(step.failureStreak, 0, `${reason} must not change the failure streak`);
  });

  // A trial without adequate landmark confidence is invalid too.
  const lowConfidence = ctrl.recordTrial({ trialId: 'lowconf', outcome: 'success', landmarkConfidence: 0.2 });
  assert.equal(lowConfidence.classification, 'invalid');
  assert.equal(lowConfidence.invalidReason, 'insufficient_landmark_confidence');
  assert.equal(lowConfidence.successStreak, 7);

  const flagged = ctrl.recordTrial({ trialId: 'flagged', outcome: 'failure', adequateLandmarkConfidence: false });
  assert.equal(flagged.classification, 'invalid');
  assert.equal(flagged.successStreak, 7);
  assert.equal(flagged.failureStreak, 0);

  // Invalid trials are counted separately and reported to the therapist.
  assert.equal(ctrl.snapshot().invalidTrials, 7);
  assert.equal(ctrl.snapshot().validTrials, 7);
  assert.equal(ctrl.progressText('zh'), '有效連續成功 7/15');

  // Eight more valid successes still reach the threshold: invalid trials in the
  // middle neither helped nor hurt.
  const final = feed(ctrl, 'success', 8, 'd');
  assert.equal(final.successStreak, REQUIRED);
  assert.equal(final.recommendation.type, 'upgrade');
});

test('the invalid-trial wording is explicit and separate from the streak line', () => {
  const ctrl = controller();
  ctrl.recordTrial({ trialId: 'only', outcome: 'success', reason: 'tracking_loss' });
  assert.equal(ctrl.lastTrialText('zh'), '追蹤／校準問題，本次不計');
  assert.equal(progression.TEXT.zh.invalidTrial, '追蹤／校準問題，本次不計');
  assert.equal(progression.TEXT.zh.validSuccess, '有效連續成功');
  assert.equal(progression.TEXT.zh.validFailure, '有效連續失敗');
  assert.ok(progression.TEXT.en.invalidTrial.length > 0, 'English fallback wording exists');
  // No emoji in any therapist-facing string.
  const strings = JSON.stringify(progression.TEXT);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(strings), 'no emoji in progression copy');
});

/* ---------------- one count per trial ---------------- */

test('the same trial id is counted at most once', () => {
  const ctrl = controller();
  const first = ctrl.recordTrial({ trialId: 'trial-1', outcome: 'success' });
  assert.equal(first.counted, true);
  assert.equal(first.successStreak, 1);
  for(let i = 0; i < 5; i++){
    const repeat = ctrl.recordTrial({ trialId: 'trial-1', outcome: 'success' });
    assert.equal(repeat.counted, false);
    assert.equal(repeat.duplicate, true);
    assert.equal(repeat.successStreak, 1);
  }
  assert.equal(ctrl.snapshot().validTrials, 1);
  assert.equal(ctrl.snapshot().duplicateTrials, 5);
  // A duplicated failure cannot double-count either.
  ctrl.recordTrial({ trialId: 'trial-2', outcome: 'failure' });
  ctrl.recordTrial({ trialId: 'trial-2', outcome: 'failure' });
  assert.equal(ctrl.snapshot().failureStreak, 1);
});

/* ---------------- therapist-confirmed compensation ---------------- */

test('a therapist-confirmed compensation turns a successful valid trial into a failure', () => {
  const ctrl = controller();
  feed(ctrl, 'success', 3, 'e');
  assert.equal(ctrl.snapshot().successStreak, 3);
  const converted = ctrl.noteCompensation({ trialId: 'e-2' });
  assert.equal(converted.converted, true);
  assert.equal(converted.successStreak, 0);
  assert.equal(converted.failureStreak, 1);
  // Applied at most once for the same trial.
  const again = ctrl.noteCompensation({ trialId: 'e-2' });
  assert.equal(again.converted, false);
  assert.equal(again.reason, 'already_applied');
  assert.equal(ctrl.snapshot().failureStreak, 1);
  // Compensation reported directly at record time behaves identically.
  const direct = ctrl.recordTrial({ trialId: 'comp-inline', outcome: 'success', compensationConfirmed: true });
  assert.equal(direct.classification, 'failure');
  assert.equal(direct.failureStreak, 2);
});

test('compensation cannot convert an invalid trial', () => {
  const ctrl = controller();
  feed(ctrl, 'success', 4, 'f');
  ctrl.recordTrial({ trialId: 'inv', outcome: 'success', reason: 'occlusion' });
  const result = ctrl.noteCompensation({ trialId: 'inv' });
  assert.equal(result.converted, false);
  assert.equal(result.reason, 'last_trial_not_success');
  assert.equal(ctrl.snapshot().successStreak, 4);
  assert.equal(ctrl.snapshot().failureStreak, 0);
});

/* ---------------- accept / decline ---------------- */

test('accepting moves the training stage and resets both streaks', () => {
  const ctrl = controller();
  feed(ctrl, 'success', REQUIRED, 'g');
  const accepted = ctrl.accept();
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.to.id, 'mid_level4');
  assert.equal(accepted.to.appLevel, '4');
  const snap = ctrl.snapshot();
  assert.equal(snap.stageId, 'mid_level4');
  assert.equal(snap.successStreak, 0);
  assert.equal(snap.failureStreak, 0);
  assert.equal(snap.pending, null);
});

test('declining keeps the current stage and resets both streaks', () => {
  const ctrl = controller({ stageId: 'late_level4' });
  feed(ctrl, 'failure', REQUIRED, 'h');
  assert.equal(ctrl.pendingRecommendation().type, 'downgrade');
  const declined = ctrl.decline();
  assert.equal(declined.accepted, false);
  const snap = ctrl.snapshot();
  assert.equal(snap.stageId, 'late_level4');
  assert.equal(snap.successStreak, 0);
  assert.equal(snap.failureStreak, 0);
  assert.equal(snap.pending, null);
});

/* ---------------- endpoints ---------------- */

test('the top stage shows a maintain message instead of an upgrade', () => {
  const ctrl = controller({ stageId: 'level7' });
  const final = feed(ctrl, 'success', REQUIRED, 'i');
  assert.equal(final.recommendation.type, 'maintain');
  assert.equal(final.recommendation.actionable, false);
  assert.equal(final.recommendation.toStageId, 'level7');
  assert.equal(ctrl.pendingRecommendation(), null);
  assert.equal(ctrl.accept(), null);
  assert.equal(ctrl.snapshot().stageId, 'level7');
  assert.match(final.recommendation.body.zh, /維持現有級別/);
});

test('the first stage shows a maintain message instead of a downgrade', () => {
  const ctrl = controller({ stageId: 'early_level3' });
  const final = feed(ctrl, 'failure', REQUIRED, 'j');
  assert.equal(final.recommendation.type, 'maintain');
  assert.equal(final.recommendation.actionable, false);
  assert.equal(final.recommendation.toStageId, 'early_level3');
  assert.equal(ctrl.snapshot().stageId, 'early_level3');
  assert.match(final.recommendation.body.zh, /維持現有級別/);
});

/* ---------------- trial mode ---------------- */

test('trial mode never produces a clinical upgrade or downgrade recommendation', () => {
  const up = controller({ mode: 'trial' });
  const upFinal = feed(up, 'success', REQUIRED, 'k');
  assert.equal(upFinal.recommendation.type, 'practice');
  assert.equal(upFinal.recommendation.clinical, false);
  assert.equal(upFinal.recommendation.actionable, false);
  assert.equal(up.pendingRecommendation(), null);
  assert.equal(up.accept(), null);
  assert.equal(up.snapshot().stageId, 'early_level4');
  // Neutral practice wording only.
  assert.equal(up.progressText('zh'), '試玩連續成功 15/15');

  const down = controller({ mode: 'trial', stageId: 'mid_level4' });
  const downFinal = feed(down, 'failure', REQUIRED, 'l');
  assert.equal(downFinal.recommendation.clinical, false);
  assert.equal(down.snapshot().stageId, 'mid_level4');
});

test('switching from training to trial mode drops any pending clinical recommendation', () => {
  const ctrl = controller();
  feed(ctrl, 'success', REQUIRED, 'm');
  assert.equal(ctrl.pendingRecommendation().type, 'upgrade');
  ctrl.setMode('trial');
  assert.equal(ctrl.pendingRecommendation(), null);
});

/* ---------------- app wiring ---------------- */

test('the app wires real completion events, not frame-level detections', () => {
  assert.match(html, /<script src="fthue-adaptive-progression\.js"><\/script>/);
  assert.match(html, /function adaptiveNoteTrial\(source, outcome, meta\)/);
  // Transport / grasp placements, the wipe pane, the three standalone Level 4
  // games and the two advanced sorting games all report completed cycles.
  assert.match(html, /adaptiveNoteTrial\('transport_place', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\('transport_place', 'failure'/);
  assert.match(html, /adaptiveNoteTrial\('grasp_release', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\('grasp_release', 'failure'/);
  assert.match(html, /adaptiveNoteTrial\('level4_wipe', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\(eventName \|\| 'level4_game', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\('cards_place', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\('cards_place', 'failure'/);
  assert.match(html, /adaptiveNoteTrial\('laundry_place', 'success'\)/);
  assert.match(html, /adaptiveNoteTrial\('laundry_place', 'failure'/);
  // Tracking loss, camera error and missing calibration invalidate a trial.
  assert.match(html, /adaptiveInvalidateNextTrial\('tracking_loss'\)/);
  assert.match(html, /adaptiveInvalidateNextTrial\('camera_error'\)/);
  assert.match(html, /adaptiveInvalidReason = 'calibration_failure'/);
  // Compensation is wired to the existing therapist observation panel and the
  // existing repeated-compensation safety behaviour is untouched.
  assert.match(html, /adaptiveNoteCompensation\(btn\.dataset\.comp\)/);
  assert.match(html, /showSafetyPause\('請先暫停'/);
  assert.match(html, /COMPENSATION_REPEAT_LIMIT = 2/);
});

test('the therapist card is explicit that no automatic assessment happens', () => {
  assert.match(html, /data-testid="panel-adaptive-recommendation"/);
  assert.match(html, /data-testid="button-adaptive-accept"/);
  assert.match(html, /data-testid="button-adaptive-decline"/);
  assert.match(html, /data-testid="text-adaptive-streak"/);
  assert.match(html, /本程式不會自動評估 FTHUE 級別/);
  assert.match(html, /if\(!recommendation\.clinical\) return;/);
});

test('the adaptive module ships offline with a bumped cache version', () => {
  assert.match(build, /cp "\$ROOT\/fthue-adaptive-progression\.js" "\$DIST\/fthue-adaptive-progression\.js"/);
  assert.match(serviceWorker, /fthue-rehab-v84-20260902-grasp-calib-front-shoulder/);
  assert.match(serviceWorker, /importScripts\("\.\/offline-assets\.js"\)/);
});
