/* FTHUE Level 4 — observable two-point elbow controller.

   The therapist captures the displayed flexed start (0) and extended end (1)
   from fresh decoded frames. Runtime control is the signed, direct elbow-angle
   map between those two captures. Lateral motion is reported separately for
   arc games and never modifies elbow progress. */
(function (global) {
  'use strict';

  const CONFIG = {
    minAngleSeparationDeg: 5,
    medianWindow: 3,
    smoothAlpha: 0.45,
    endpointHysteresis: 0.035,
    engageEnter: 0.20,
    engageExit: 0.10,
    reachEnter: 0.70,
    reachExit: 0.58,
    returnAt: 0.18,
    completeAt: 0.96,
    arcExtensionGate: 0.70,
    arcEnter: 0.12,
    arcExit: 0.07,
    arcScale: 0.18,
  };
  const SIGNAL_KEYS = ['angle'];
  const PRIMARY_KEYS = ['angle'];
  const SIGNAL_LABELS = { angle: '肘角 angle' };
  const RETRY_TEXT = {
    main: '兩個姿勢太接近 · 請重拍伸肘終點',
    detail: '屈肘起點與伸肘終點的肘角至少相差 5°',
    en: 'Start and end angles are too similar — recapture the extended end',
  };

  function median(values) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }
  function pointUsable(point) {
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && (point.visibility == null || point.visibility >= 0.05);
  }
  function usableImageAspect(value) {
    const aspect = Number(value);
    return Number.isFinite(aspect) && aspect >= 0.25 && aspect <= 4 ? aspect : 1;
  }
  function dist2D(a, b, imageAspect) {
    return Math.hypot((a.x - b.x) * usableImageAspect(imageAspect), a.y - b.y);
  }
  function jointAngle2D(a, b, c, imageAspect) {
    const aspect = usableImageAspect(imageAspect);
    const ab = { x: (a.x - b.x) * aspect, y: a.y - b.y };
    const cb = { x: (c.x - b.x) * aspect, y: c.y - b.y };
    const abn = Math.hypot(ab.x, ab.y);
    const cbn = Math.hypot(cb.x, cb.y);
    if (abn < 1e-4 || cbn < 1e-4) return null;
    const cos = (ab.x * cb.x + ab.y * cb.y) / (abn * cbn);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }
  function armFromLandmarks(lm, side) {
    if (!Array.isArray(lm)) return null;
    const left = side === 'left';
    const arm = {
      shoulder: lm[left ? 11 : 12], elbow: lm[left ? 13 : 14], wrist: lm[left ? 15 : 16],
      otherShoulder: lm[left ? 12 : 11],
    };
    return [arm.shoulder, arm.elbow, arm.wrist].every(pointUsable) ? arm : null;
  }
  function lateralOffset(arm, options) {
    if (!arm) return null;
    const aspect = usableImageAspect(options && options.imageAspect);
    const displayX = options && options.mirrorX === false ? value => value : value => 1 - value;
    const outwardSign = options && options.side === 'left' ? -1 : 1;
    const upper = dist2D(arm.shoulder, arm.elbow, aspect);
    const forearm = dist2D(arm.elbow, arm.wrist, aspect);
    if (upper + forearm < 1e-4) return null;
    return outwardSign * aspect * (displayX(arm.wrist.x) - displayX(arm.shoulder.x)) / (upper + forearm);
  }
  function computeSignals(arm, _worldArm, options) {
    if (!arm) return null;
    const imageAspect = usableImageAspect(options && options.imageAspect);
    const angle = jointAngle2D(arm.shoulder, arm.elbow, arm.wrist, imageAspect);
    if (!Number.isFinite(angle)) return null;
    return {
      angle,
      lateral: lateralOffset(arm, options),
      imageAspect,
      // Deliberately observable only: these values are never used for progress.
      spanRatio: null, worldSpan: null, radial: null, depthZ: null,
    };
  }

  function createController(options) {
    const config = Object.assign({}, CONFIG, options || {});
    const state = {};
    function reset() {
      Object.assign(state, {
        stage: 'framing', reason: 'awaiting-fresh-pose', calibrated: false,
        framingReady: false, gameReady: false, manual: { flexed: false, extended: false },
        endpoints: { flexed: null, extended: null }, separation: {}, weights: { angle: 1 },
        qualified: [], lacking: [], signals: null, rawAngle: null, filteredAngle: null,
        filteredProgress: null, instantProgress: 0, progress: 0, signalProgress: { angle: 0 },
        engaged: false, reachGate: false, returnReady: true, completionReady: false,
        warning: '', shoulderHike: false, retryCount: 0, captureCount: { flexed: 0, extended: 0 },
        frameFresh: false, frameGeneration: null, frameAgeMs: null,
        frameReason: 'awaiting-decoded-frame', frameSource: 'none', lastPoseGeneration: null,
        lastConsumedGeneration: null, newFrame: false, angleWindow: [], side: 'right', imageAspect: 1,
        lateral: null, arcProgress: 0, arcInstant: 0, arcActive: false,
        arcCalibrated: false, arcBaseline: null, arcReason: 'awaiting-extension',
        stabilizer: { reason: 'idle', alpha: config.smoothAlpha, medianWindow: config.medianWindow,
          hysteresis: config.endpointHysteresis },
      });
    }
    reset();

    function setFrame(input) {
      const frame = input.frame || {};
      state.frameFresh = typeof input.frameFresh === 'boolean' ? input.frameFresh
        : (typeof frame.fresh === 'boolean' ? frame.fresh : true);
      state.frameGeneration = input.frameGeneration != null ? input.frameGeneration : (frame.generation ?? null);
      state.frameAgeMs = Number.isFinite(frame.ageMs) ? frame.ageMs : null;
      state.frameReason = frame.reason || (state.frameFresh ? 'fresh-decoded-frame' : 'stale-decoded-frame');
      state.frameSource = frame.source || 'not-provided';
    }
    function hasSameGenerationPose() {
      return state.frameFresh && state.lastPoseGeneration === state.frameGeneration
        && Number.isFinite(state.filteredAngle);
    }
    function applyHysteresis(value) {
      if (value <= config.endpointHysteresis) return 0;
      if (value >= 1 - config.endpointHysteresis) return 1;
      return clamp01(value);
    }
    function updateGates() {
      state.engaged = state.progress >= config.engageEnter
        ? true : (state.progress <= config.engageExit ? false : state.engaged);
      state.reachGate = state.progress >= config.reachEnter
        ? true : (state.progress <= config.reachExit ? false : state.reachGate);
      state.returnReady = state.progress <= config.returnAt;
      state.completionReady = state.progress >= config.completeAt;
    }
    function mapAngle() {
      if (!state.calibrated || !Number.isFinite(state.filteredAngle)) return;
      const start = state.endpoints.flexed.angle;
      const end = state.endpoints.extended.angle;
      // signed-angle-capture-order: capture order is the sign; never reorient it.
      const direct = clamp01((state.filteredAngle - start) / (end - start));
      state.instantProgress = direct;
      if (Math.abs(state.filteredAngle - start) < 1e-9) state.filteredProgress = 0;
      else if (Math.abs(state.filteredAngle - end) < 1e-9) state.filteredProgress = 1;
      else if (!Number.isFinite(state.filteredProgress)) state.filteredProgress = direct;
      else state.filteredProgress += config.smoothAlpha * (direct - state.filteredProgress);
      state.progress = applyHysteresis(state.filteredProgress);
      state.signalProgress.angle = state.progress;
      state.stabilizer.reason = 'median3-ema';
      updateGates();
    }
    function updateArc() {
      if (!state.calibrated || !state.arcCalibrated || !Number.isFinite(state.lateral)) {
        state.arcActive = false;
        return;
      }
      state.arcInstant = clamp01(Math.max(0, state.lateral - state.arcBaseline) / config.arcScale);
      state.arcProgress += config.smoothAlpha * (state.arcInstant - state.arcProgress);
      const lateralReady = state.arcProgress >= config.arcEnter
        ? true : (state.arcProgress <= config.arcExit ? false : state.arcActive);
      state.arcActive = state.progress >= config.arcExtensionGate && lateralReady;
      state.arcReason = state.arcActive ? 'extension-then-outward' :
        (state.progress < config.arcExtensionGate ? 'awaiting-extension' : 'awaiting-outward-lateral');
    }
    function update(input) {
      const packet = input || {};
      setFrame(packet);
      state.side = packet.side === 'left' ? 'left' : 'right';
      state.imageAspect = usableImageAspect(packet.imageAspect);
      const arm = packet.arm || armFromLandmarks(packet.lm, state.side);
      const signals = computeSignals(arm, null, packet);
      if (!state.frameFresh) {
        state.newFrame = false;
        state.framingReady = false; state.gameReady = false;
        state.reason = 'frame-stale'; state.stage = state.calibrated ? 'not-ready' : 'framing';
        state.stabilizer.reason = 'hold-stale-frame';
        return state;
      }
      if (!signals) {
        state.newFrame = false;
        state.framingReady = false; state.gameReady = false;
        state.reason = 'pose-lost'; state.stage = state.calibrated ? 'not-ready' : 'framing';
        state.stabilizer.reason = 'hold-pose-lost';
        return state;
      }
      // A decoded camera image may be rendered by several RAF ticks.  Admit the
      // pose exactly once by generation: the median, EMA, progress gates and
      // outward arc must never advance merely because the display repainted.
      const hasGeneration = Number.isFinite(state.frameGeneration);
      const isNewGeneration = hasGeneration
        ? state.frameGeneration !== state.lastConsumedGeneration
        : packet.newFrame === true;
      state.newFrame = isNewGeneration;
      state.framingReady = true;
      if (isNewGeneration) {
        state.signals = signals; state.rawAngle = signals.angle; state.lateral = signals.lateral;
        state.lastPoseGeneration = state.frameGeneration;
        state.angleWindow.push(signals.angle);
        while (state.angleWindow.length > config.medianWindow) state.angleWindow.shift();
        state.lastConsumedGeneration = state.frameGeneration;
        state.filteredAngle = median(state.angleWindow) ?? signals.angle;
        if (state.calibrated) { mapAngle(); updateArc(); }
      }
      if (state.calibrated) {
        state.gameReady = true; state.stage = 'ready'; state.reason = 'ready';
      } else if (state.manual.flexed) {
        state.stage = 'capture-extended';
        state.reason = state.reason === 'angle-separation-too-small' ? state.reason : 'awaiting-extended-capture';
      } else {
        state.stage = 'capture-flexed'; state.reason = 'awaiting-flexed-capture';
      }
      return state;
    }
    function capture(which) {
      if (!hasSameGenerationPose()) {
        state.reason = 'capture-needs-fresh-current-pose';
        state.stage = state.manual.flexed ? 'capture-extended' : 'capture-flexed';
        return false;
      }
      // The mark records the fresh frame that the therapist can see. Filtering
      // remains a live-control concern, not a hidden endpoint substitution.
      const endpoint = { angle: state.rawAngle, generation: state.frameGeneration,
        lateral: state.lateral, imageAspect: state.imageAspect };
      if (which === 'flexed') {
        state.endpoints.flexed = endpoint; state.manual.flexed = true;
        state.manual.extended = false; state.calibrated = false; state.gameReady = false;
        // Start the very small live filter at the visible captured endpoint so
        // the readout remains literal at mark time, rather than inheriting a
        // previous pose's median.
        state.angleWindow = [endpoint.angle]; state.filteredAngle = endpoint.angle;
        state.filteredProgress = null; state.progress = 0; state.instantProgress = 0;
        state.captureCount.flexed += 1; state.stage = 'capture-extended'; state.reason = 'awaiting-extended-capture';
        return true;
      }
      if (!state.endpoints.flexed) { state.reason = 'capture-flexed-first'; state.stage = 'capture-flexed'; return false; }
      const separation = endpoint.angle - state.endpoints.flexed.angle;
      state.separation = { angle: separation };
      if (Math.abs(separation) < config.minAngleSeparationDeg) {
        state.endpoints.extended = null; state.manual.extended = false; state.calibrated = false;
        state.retryCount += 1; state.lacking = [{ signal: 'angle', reason: 'too-similar', separation }];
        state.stage = 'capture-extended'; state.reason = 'angle-separation-too-small';
        return false;
      }
      state.endpoints.extended = endpoint; state.manual.extended = true;
      state.captureCount.extended += 1; state.calibrated = true; state.gameReady = state.framingReady;
      // Make the second labelled mark visibly equal 1 at the moment of capture.
      // Subsequent fresh frames again use the fixed median/EMA path.
      state.angleWindow = [endpoint.angle]; state.filteredAngle = endpoint.angle;
      state.qualified = ['angle']; state.lacking = []; state.filteredProgress = null;
      state.arcBaseline = endpoint.lateral; state.arcCalibrated = Number.isFinite(endpoint.lateral);
      mapAngle(); updateArc(); state.stage = 'ready'; state.reason = 'ready';
      return true;
    }
    function markFlexed() { return capture('flexed'); }
    function markExtended() { return capture('extended'); }
    function recalibrate() { reset(); }
    function guidance() {
      if (!state.frameFresh) return { main: '等候新相機畫面', detail: '目前畫面已過時，未會使用舊姿勢', en: 'Waiting for a fresh camera frame — old poses are blocked' };
      if (!state.framingReady) return { main: '未偵測到手臂', detail: '讓肩、肘、手腕回到畫面', en: 'Pose lost — show shoulder, elbow and wrist' };
      if (state.reason === 'angle-separation-too-small') return RETRY_TEXT;
      if (!state.manual.flexed) return { main: '按「屈肘起點」', detail: '以目前新鮮畫面記錄 0', en: 'Capture flexed start from this fresh frame (0)' };
      if (!state.manual.extended) return { main: '按「伸肘終點」', detail: '以目前新鮮畫面記錄 1', en: 'Capture extended end from this fresh frame (1)' };
      return { main: '已就緒', detail: '肘角直接控制進度；外展只用於弧線遊戲', en: 'Ready — elbow angle controls progress; lateral motion is arc-only' };
    }
    function snapshot() {
      const frame = { fresh: state.frameFresh, generation: state.frameGeneration, ageMs: state.frameAgeMs,
        reason: state.frameReason, source: state.frameSource, newFrame: state.newFrame };
      return {
        stage: state.stage, reason: state.reason, calibrated: state.calibrated,
        framingReady: state.framingReady, gameReady: state.gameReady,
        progress: state.progress, instantProgress: state.instantProgress, rawAngle: state.rawAngle,
        filteredAngle: state.filteredAngle, filteredProgress: state.filteredProgress,
        engaged: state.engaged, reachGate: state.reachGate, returnReady: state.returnReady,
        completionReady: state.completionReady, shoulderHike: false, warning: state.warning,
        weights: { angle: 1 }, separation: Object.assign({}, state.separation), qualified: state.qualified.slice(),
        lacking: state.lacking.map(item => Object.assign({}, item)), signals: state.signals && Object.assign({}, state.signals),
        signalProgress: Object.assign({}, state.signalProgress),
        endpoints: { flexed: state.endpoints.flexed && Object.assign({}, state.endpoints.flexed),
          extended: state.endpoints.extended && Object.assign({}, state.endpoints.extended) },
        manual: Object.assign({}, state.manual), retryCount: state.retryCount,
        captureCount: Object.assign({}, state.captureCount), frame, newFrame: state.newFrame,
        imageAspect: state.imageAspect, side: state.side,
        filtered: { angle: state.filteredAngle, progress: state.filteredProgress }, stabilizer: Object.assign({}, state.stabilizer),
        lateral: state.lateral, arcProgress: state.arcProgress, arcInstant: state.arcInstant,
        arcActive: state.arcActive, arcCalibrated: state.arcCalibrated,
        arc: { calibrated: state.arcCalibrated, baseline: state.arcBaseline,
          progress: state.arcProgress, instant: state.arcInstant, active: state.arcActive,
          reason: state.arcReason },
      };
    }
    function toText() {
      const snap = snapshot();
      const f = snap.frame;
      const point = which => Number.isFinite(snap.endpoints[which] && snap.endpoints[which].angle)
        ? snap.endpoints[which].angle.toFixed(1) + '°' : '—';
      return [
        'stage:' + snap.stage, 'reason:' + snap.reason, 'calibrated:' + snap.calibrated
          + ' framingReady:' + snap.framingReady + ' ready:' + snap.gameReady,
        'frame:' + (f.fresh ? 'fresh' : 'stale') + ' generation:' + (f.generation ?? 'na')
          + ' newFrame:' + f.newFrame + ' age:' + (Number.isFinite(f.ageMs) ? Math.round(f.ageMs) + 'ms' : 'na')
          + ' source:' + f.source + ' frameReason:' + f.reason,
        'rawAngle:' + (Number.isFinite(snap.rawAngle) ? snap.rawAngle.toFixed(1) : 'na'),
        'filteredAngle:' + (Number.isFinite(snap.filteredAngle) ? snap.filteredAngle.toFixed(1) : 'na'),
        'progress:' + snap.progress.toFixed(3) + ' instant:' + snap.instantProgress.toFixed(3),
        'captured:flexed=' + point('flexed') + ' extended=' + point('extended')
          + ' separation=' + (Number.isFinite(snap.separation.angle) ? snap.separation.angle.toFixed(1) + '°' : 'na'),
        'lateral:' + (Number.isFinite(snap.lateral) ? snap.lateral.toFixed(3) : 'na')
          + ' arcProgress:' + snap.arcProgress.toFixed(3) + ' arcActive:' + snap.arcActive
          + ' arcReason:' + snap.arc.reason,
        'controller:signed-angle-capture-order median' + config.medianWindow + ' ema' + config.smoothAlpha
          + ' hysteresis' + config.endpointHysteresis,
      ].join(' ');
    }
    return { config, state, reset, update, markFlexed, markExtended, recalibrate, guidance, toText, snapshot };
  }

  const api = { CONFIG, SIGNAL_KEYS, PRIMARY_KEYS, SIGNAL_LABELS, RETRY_TEXT, createController,
    computeSignals, armFromLandmarks, jointAngle2D, usableImageAspect, pointUsable, median, clamp01 };
  global.Level4ElbowCalibration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
