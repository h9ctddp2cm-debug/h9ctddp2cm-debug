/* FTHUE adaptive progression — therapist-confirmed level recommendations.

   What this module IS
   -------------------
   A deterministic bookkeeper for CONSECUTIVE VALID TRIAL OUTCOMES. It counts
   completed task cycles (a whole game attempt), never frame-level detections,
   and it recommends — never performs — a change of clinical FTHUE level.

   What this module is NOT
   ----------------------
   It is NOT an automatic FTHUE assessment. It does not measure impairment, it
   does not detect compensation, tone or spasticity, and it never silently
   changes the participant's clinical level. Every recommendation must be
   explicitly accepted or declined by the supervising therapist.

   Clinical rules implemented (per therapist decision)
   ---------------------------------------------------
   * Ordered progression stages:
       Early Level 3 -> Late Level 3 -> Early Level 4 -> Mid Level 4 ->
       Late Level 4 -> Level 5 -> Level 6 -> Level 7
   * 15 consecutive VALID successes  -> recommend moving to the next stage.
   * 15 consecutive VALID failures   -> recommend returning to the prior stage.
     (Both directions use the same 15-trial requirement.)
   * A valid success increments the success streak and resets the failure streak.
   * A valid failure, or a therapist-confirmed compensation on an otherwise
     successful trial, increments the failure streak and resets the success
     streak.
   * INVALID trials never increment and never reset either streak:
       calibration failure, temporary tracking loss, occlusion, camera error,
       technical failure, or a trial without adequate landmark confidence.
   * Each trial outcome is counted at most once (trial-id guard).
   * At the first/last stage a completed streak produces a MAINTAIN message
     instead of an out-of-range recommendation.
   * Trial (試玩) mode never produces clinical-looking upgrade/downgrade
     recommendations. It only reports neutral practice streak progress.

   The module has no DOM, timer, network or camera dependency, so the same code
   runs in the browser and in the deterministic Node tests. */

(function (global) {
  'use strict';

  /* Ordered clinical progression stages. `appLevel` maps a stage onto the
     existing in-app level ids ('3', '4', '5', '67') used for game selection;
     `fthueLevel` stays the clinical label and is never changed by this module
     on its own. */
  const STAGES = [
    { id: 'early_level3', appLevel: '3',  fthueLevel: '3', zh: 'Level 3 早期', en: 'Early Level 3' },
    { id: 'late_level3',  appLevel: '3',  fthueLevel: '3', zh: 'Level 3 後期', en: 'Late Level 3' },
    { id: 'early_level4', appLevel: '4',  fthueLevel: '4', zh: 'Level 4 早期', en: 'Early Level 4' },
    { id: 'mid_level4',   appLevel: '4',  fthueLevel: '4', zh: 'Level 4 中期', en: 'Mid Level 4' },
    { id: 'late_level4',  appLevel: '4',  fthueLevel: '4', zh: 'Level 4 後期', en: 'Late Level 4' },
    { id: 'level5',       appLevel: '5',  fthueLevel: '5', zh: 'Level 5',      en: 'Level 5' },
    { id: 'level6',       appLevel: '67', fthueLevel: '6', zh: 'Level 6',      en: 'Level 6' },
    { id: 'level7',       appLevel: '67', fthueLevel: '7', zh: 'Level 7',      en: 'Level 7' },
  ].map((stage, order) => Object.freeze(Object.assign({ order }, stage)));

  const REQUIRED_VALID_STREAK = 15;
  /* Below this landmark confidence the trial cannot be scored clinically, so it
     is discarded rather than counted as a failure. */
  const MIN_LANDMARK_CONFIDENCE = 0.5;

  /* Every reason here makes a trial INVALID: the movement was not observed
     well enough to be scored either way. */
  const INVALID_REASONS = Object.freeze([
    'calibration_failure',
    'tracking_loss',
    'tracking_lost',
    'occlusion',
    'camera_error',
    'technical_failure',
    'insufficient_landmark_confidence',
  ]);

  const CLASSIFICATION = Object.freeze({
    SUCCESS: 'success',
    FAILURE: 'failure',
    INVALID: 'invalid',
  });

  const TEXT = {
    zh: {
      validSuccess: '有效連續成功',
      validFailure: '有效連續失敗',
      practiceSuccess: '試玩連續成功',
      practiceFailure: '試玩連續失敗',
      invalidTrial: '追蹤／校準問題，本次不計',
      ready: '準備開始，尚未有有效試作',
      upgradeTitle: '治療師參考：可考慮進階',
      downgradeTitle: '治療師參考：可考慮退回上一級',
      maintainTopTitle: '治療師參考：建議維持現有級別',
      maintainBottomTitle: '治療師參考：建議維持現有級別',
      note: '本程式不會自動評估 FTHUE 級別，亦不會自行更改級別。以下只是連續有效試作的統計參考，'
        + '是否調整級別須由治療師臨床判斷後確認。',
      accept: '接受建議並更新訓練級別',
      decline: '不接受，維持現有級別',
      practiceTitle: '試玩練習進度',
      practiceNote: '試玩模式只顯示練習次數，不提供級別建議。',
    },
    en: {
      validSuccess: 'Valid consecutive successes',
      validFailure: 'Valid consecutive failures',
      practiceSuccess: 'Practice consecutive successes',
      practiceFailure: 'Practice consecutive failures',
      invalidTrial: 'Tracking / calibration problem — this trial is not counted',
      ready: 'Ready to start. No valid trial yet.',
      upgradeTitle: 'For therapist review: progression may be considered',
      downgradeTitle: 'For therapist review: returning to the previous stage may be considered',
      maintainTopTitle: 'For therapist review: maintaining the current stage is suggested',
      maintainBottomTitle: 'For therapist review: maintaining the current stage is suggested',
      note: 'This app does not assess the FTHUE level automatically and never changes the level by '
        + 'itself. The counts below are a reference only; any change must be confirmed by the '
        + 'supervising therapist.',
      accept: 'Accept and update the training stage',
      decline: 'Decline and keep the current stage',
      practiceTitle: 'Practice progress',
      practiceNote: 'Trial mode shows practice counts only and gives no stage recommendation.',
    },
  };

  function textFor(lang) { return lang === 'en' ? TEXT.en : TEXT.zh; }

  function stageById(id) {
    for (const stage of STAGES) if (stage.id === id) return stage;
    return null;
  }

  function stageLabel(stage, lang) {
    if (!stage) return '';
    return lang === 'en' ? stage.en : stage.zh;
  }

  function isInvalidReason(reason) {
    return !!reason && INVALID_REASONS.indexOf(String(reason)) >= 0;
  }

  /* Classify a raw trial report without touching any state. Exported so tests
     and callers can reason about the rules independently. */
  function classifyTrial(trial, options) {
    const opts = options || {};
    const minConfidence = Number.isFinite(opts.minLandmarkConfidence)
      ? opts.minLandmarkConfidence : MIN_LANDMARK_CONFIDENCE;
    const report = trial || {};

    if (report.valid === false) {
      return { classification: CLASSIFICATION.INVALID, reason: report.reason || 'technical_failure' };
    }
    if (report.outcome === CLASSIFICATION.INVALID) {
      return { classification: CLASSIFICATION.INVALID, reason: report.reason || 'technical_failure' };
    }
    if (isInvalidReason(report.reason)) {
      return { classification: CLASSIFICATION.INVALID, reason: String(report.reason) };
    }
    if (report.adequateLandmarkConfidence === false) {
      return { classification: CLASSIFICATION.INVALID, reason: 'insufficient_landmark_confidence' };
    }
    if (Number.isFinite(report.landmarkConfidence) && report.landmarkConfidence < minConfidence) {
      return { classification: CLASSIFICATION.INVALID, reason: 'insufficient_landmark_confidence' };
    }
    if (report.outcome === CLASSIFICATION.SUCCESS && report.compensationConfirmed !== true) {
      return { classification: CLASSIFICATION.SUCCESS, reason: '' };
    }
    if (report.outcome === CLASSIFICATION.SUCCESS && report.compensationConfirmed === true) {
      return { classification: CLASSIFICATION.FAILURE, reason: 'therapist_confirmed_compensation' };
    }
    return { classification: CLASSIFICATION.FAILURE, reason: report.reason || '' };
  }

  function createController(options) {
    const opts = options || {};
    const requiredStreak = Number.isFinite(opts.requiredStreak) && opts.requiredStreak > 0
      ? Math.floor(opts.requiredStreak) : REQUIRED_VALID_STREAK;
    const minLandmarkConfidence = Number.isFinite(opts.minLandmarkConfidence)
      ? opts.minLandmarkConfidence : MIN_LANDMARK_CONFIDENCE;
    const log = typeof opts.log === 'function' ? opts.log : function () {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    let stageIndex = 0;
    const initial = stageById(opts.stageId);
    if (initial) stageIndex = initial.order;

    let mode = opts.mode === 'trial' ? 'trial' : 'training';
    let successStreak = 0;
    let failureStreak = 0;
    let validTrials = 0;
    let invalidTrials = 0;
    let duplicateTrials = 0;
    let lastTrial = null;
    let pending = null;
    /* Trial-id guard: an outcome is counted at most once even if the caller's
       game loop fires the same completion twice. */
    const countedTrialIds = new Set();
    /* Undo record used when the therapist confirms a compensation right after
       an otherwise successful trial. */
    let lastCounted = null;
    let autoTrialSeq = 0;

    function stage() { return STAGES[stageIndex]; }
    function atTop() { return stageIndex >= STAGES.length - 1; }
    function atBottom() { return stageIndex <= 0; }

    function snapshot() {
      return {
        stageId: stage().id,
        stageOrder: stage().order,
        appLevel: stage().appLevel,
        fthueLevel: stage().fthueLevel,
        mode,
        requiredStreak,
        successStreak,
        failureStreak,
        validTrials,
        invalidTrials,
        duplicateTrials,
        countedTrials: countedTrialIds.size,
        atTop: atTop(),
        atBottom: atBottom(),
        pending: pending ? Object.assign({}, pending) : null,
        lastTrial: lastTrial ? Object.assign({}, lastTrial) : null,
      };
    }

    function progressText(lang) {
      const t = textFor(lang);
      const trialMode = mode === 'trial';
      if (failureStreak > 0) {
        return (trialMode ? t.practiceFailure : t.validFailure) + ' ' + failureStreak + '/' + requiredStreak;
      }
      if (successStreak > 0) {
        return (trialMode ? t.practiceSuccess : t.validSuccess) + ' ' + successStreak + '/' + requiredStreak;
      }
      if (lastTrial && lastTrial.classification === CLASSIFICATION.INVALID) return t.invalidTrial;
      return (trialMode ? t.practiceSuccess : t.validSuccess) + ' 0/' + requiredStreak;
    }

    function lastTrialText(lang) {
      const t = textFor(lang);
      if (!lastTrial) return t.ready;
      if (lastTrial.classification === CLASSIFICATION.INVALID) return t.invalidTrial;
      return progressText(lang);
    }

    function buildRecommendation(direction) {
      const t = { zh: textFor('zh'), en: textFor('en') };
      const from = stage();

      if (mode === 'trial') {
        return {
          type: 'practice',
          clinical: false,
          direction: direction,
          fromStageId: from.id,
          toStageId: from.id,
          title: { zh: t.zh.practiceTitle, en: t.en.practiceTitle },
          body: { zh: t.zh.practiceNote, en: t.en.practiceNote },
          actionable: false,
        };
      }

      const targetOrder = stageIndex + (direction === 'upgrade' ? 1 : -1);
      const target = STAGES[targetOrder] || null;

      if (!target) {
        const top = direction === 'upgrade';
        return {
          type: 'maintain',
          clinical: true,
          direction: direction,
          fromStageId: from.id,
          toStageId: from.id,
          title: {
            zh: top ? t.zh.maintainTopTitle : t.zh.maintainBottomTitle,
            en: top ? t.en.maintainTopTitle : t.en.maintainBottomTitle,
          },
          body: {
            zh: top
              ? '已連續 ' + requiredStreak + ' 次有效成功，但現時已是最高級別（' + stageLabel(from, 'zh')
                + '）。建議維持現有級別，繼續鞏固動作質素。'
              : '已連續 ' + requiredStreak + ' 次有效失敗，但現時已是最初級別（' + stageLabel(from, 'zh')
                + '）。建議維持現有級別，並由治療師檢視擺位、距離及難度設定。',
            en: top
              ? requiredStreak + ' consecutive valid successes were recorded, but this is already the '
                + 'highest stage (' + stageLabel(from, 'en') + '). Maintaining the current stage is suggested.'
              : requiredStreak + ' consecutive valid failures were recorded, but this is already the '
                + 'first stage (' + stageLabel(from, 'en') + '). Maintaining the current stage is suggested; '
                + 'please review seating, distance and difficulty.',
          },
          actionable: false,
        };
      }

      const up = direction === 'upgrade';
      return {
        type: up ? 'upgrade' : 'downgrade',
        clinical: true,
        direction: direction,
        fromStageId: from.id,
        toStageId: target.id,
        title: { zh: up ? t.zh.upgradeTitle : t.zh.downgradeTitle, en: up ? t.en.upgradeTitle : t.en.downgradeTitle },
        body: {
          zh: '已連續 ' + requiredStreak + ' 次有效' + (up ? '成功' : '失敗') + '（'
            + stageLabel(from, 'zh') + '）。可考慮' + (up ? '進階至 ' : '退回 ')
            + stageLabel(target, 'zh') + '。' + t.zh.note,
          en: requiredStreak + ' consecutive valid ' + (up ? 'successes' : 'failures') + ' at '
            + stageLabel(from, 'en') + '. Moving to ' + stageLabel(target, 'en')
            + ' may be considered. ' + t.en.note,
        },
        actionable: true,
      };
    }

    function maybeRecommend() {
      if (pending) return null;
      let direction = '';
      if (successStreak >= requiredStreak) direction = 'upgrade';
      else if (failureStreak >= requiredStreak) direction = 'downgrade';
      if (!direction) return null;

      const recommendation = buildRecommendation(direction);
      if (recommendation.actionable) pending = recommendation;
      log('adaptive_progression_recommendation', {
        type: recommendation.type,
        direction: direction,
        from_stage: recommendation.fromStageId,
        to_stage: recommendation.toStageId,
        mode: mode,
        success_streak: successStreak,
        failure_streak: failureStreak,
      });
      return recommendation;
    }

    function clearPendingIfContradicted(classification) {
      if (!pending) return;
      if (pending.direction === 'upgrade' && classification === CLASSIFICATION.FAILURE) pending = null;
      if (pending.direction === 'downgrade' && classification === CLASSIFICATION.SUCCESS) pending = null;
    }

    function applyClassification(classification) {
      if (classification === CLASSIFICATION.SUCCESS) {
        successStreak += 1;
        failureStreak = 0;
        validTrials += 1;
      } else if (classification === CLASSIFICATION.FAILURE) {
        failureStreak += 1;
        successStreak = 0;
        validTrials += 1;
      } else {
        invalidTrials += 1;
      }
    }

    function recordTrial(trial) {
      const report = trial || {};
      const trialId = report.trialId === undefined || report.trialId === null || report.trialId === ''
        ? 'auto-' + (++autoTrialSeq)
        : String(report.trialId);

      if (countedTrialIds.has(trialId)) {
        duplicateTrials += 1;
        return Object.assign(snapshot(), {
          trialId,
          counted: false,
          duplicate: true,
          classification: lastTrial ? lastTrial.classification : '',
          recommendation: null,
          progressText: progressText(report.lang),
        });
      }
      countedTrialIds.add(trialId);

      const beforeSuccess = successStreak;
      const beforeFailure = failureStreak;
      const decision = classifyTrial(report, { minLandmarkConfidence });
      clearPendingIfContradicted(decision.classification);
      applyClassification(decision.classification);

      lastTrial = {
        trialId,
        classification: decision.classification,
        reason: decision.reason,
        source: report.source || '',
      };
      lastCounted = {
        trialId,
        classification: decision.classification,
        beforeSuccess,
        beforeFailure,
        compensationApplied: false,
      };

      log('adaptive_progression_trial', {
        trial_id: trialId,
        classification: decision.classification,
        reason: decision.reason,
        source: lastTrial.source,
        success_streak: successStreak,
        failure_streak: failureStreak,
        mode: mode,
        stage: stage().id,
      });

      const recommendation = maybeRecommend();
      const result = Object.assign(snapshot(), {
        trialId,
        counted: true,
        duplicate: false,
        classification: decision.classification,
        invalidReason: decision.classification === CLASSIFICATION.INVALID ? decision.reason : '',
        recommendation,
        progressText: progressText(report.lang),
      });
      onChange(snapshot(), recommendation);
      return result;
    }

    /* A therapist-confirmed compensation turns the most recent otherwise
       successful VALID trial into a failure. It is applied at most once per
       trial and never touches an invalid trial. */
    function noteCompensation(details) {
      const info = details || {};
      if (!lastCounted) return { converted: false, reason: 'no_trial' };
      if (info.trialId !== undefined && info.trialId !== null && info.trialId !== ''
        && String(info.trialId) !== lastCounted.trialId) {
        return { converted: false, reason: 'trial_id_mismatch' };
      }
      if (lastCounted.compensationApplied) return { converted: false, reason: 'already_applied' };
      if (lastCounted.classification !== CLASSIFICATION.SUCCESS) {
        return { converted: false, reason: 'last_trial_not_success' };
      }

      successStreak = lastCounted.beforeSuccess;
      failureStreak = lastCounted.beforeFailure;
      validTrials -= 1;
      clearPendingIfContradicted(CLASSIFICATION.FAILURE);
      applyClassification(CLASSIFICATION.FAILURE);
      lastCounted.classification = CLASSIFICATION.FAILURE;
      lastCounted.compensationApplied = true;
      lastTrial = {
        trialId: lastCounted.trialId,
        classification: CLASSIFICATION.FAILURE,
        reason: 'therapist_confirmed_compensation',
        source: lastTrial ? lastTrial.source : '',
      };

      log('adaptive_progression_compensation', {
        trial_id: lastCounted.trialId,
        success_streak: successStreak,
        failure_streak: failureStreak,
        stage: stage().id,
        mode: mode,
      });

      const recommendation = maybeRecommend();
      onChange(snapshot(), recommendation);
      return Object.assign(snapshot(), {
        converted: true,
        recommendation,
        progressText: progressText(info.lang),
      });
    }

    /* Therapist explicitly accepts the recommendation. Only then does the app's
       training stage change; both streaks restart from zero. */
    function accept() {
      if (!pending || !pending.actionable) return null;
      const from = stage();
      const target = stageById(pending.toStageId);
      if (!target) { pending = null; return null; }
      stageIndex = target.order;
      successStreak = 0;
      failureStreak = 0;
      const accepted = pending;
      pending = null;
      lastCounted = null;
      log('adaptive_progression_accepted', {
        from_stage: from.id,
        to_stage: target.id,
        direction: accepted.direction,
        app_level: target.appLevel,
        mode: mode,
      });
      onChange(snapshot(), null);
      return { accepted: true, direction: accepted.direction, from: from, to: target, state: snapshot() };
    }

    /* Therapist declines. The stage is unchanged and both streaks restart. */
    function decline() {
      if (!pending) return null;
      const declined = pending;
      pending = null;
      successStreak = 0;
      failureStreak = 0;
      lastCounted = null;
      log('adaptive_progression_declined', {
        stage: stage().id,
        direction: declined.direction,
        mode: mode,
      });
      onChange(snapshot(), null);
      return { accepted: false, direction: declined.direction, state: snapshot() };
    }

    function setMode(nextMode) {
      mode = nextMode === 'trial' ? 'trial' : 'training';
      if (mode === 'trial') pending = null;
      onChange(snapshot(), null);
      return mode;
    }

    function setStage(stageId) {
      const target = stageById(stageId);
      if (!target) return null;
      stageIndex = target.order;
      successStreak = 0;
      failureStreak = 0;
      pending = null;
      lastCounted = null;
      onChange(snapshot(), null);
      return snapshot();
    }

    function resetStreaks() {
      successStreak = 0;
      failureStreak = 0;
      pending = null;
      lastTrial = null;
      lastCounted = null;
      countedTrialIds.clear();
      onChange(snapshot(), null);
      return snapshot();
    }

    return {
      STAGES,
      stage,
      snapshot,
      recordTrial,
      noteCompensation,
      accept,
      decline,
      setMode,
      setStage,
      resetStreaks,
      progressText,
      lastTrialText,
      pendingRecommendation() { return pending ? Object.assign({}, pending) : null; },
      atTop,
      atBottom,
    };
  }

  const api = {
    STAGES,
    REQUIRED_VALID_STREAK,
    MIN_LANDMARK_CONFIDENCE,
    INVALID_REASONS,
    CLASSIFICATION,
    TEXT,
    stageById,
    stageLabel,
    classifyTrial,
    createController,
  };

  global.FthueAdaptiveProgression = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
