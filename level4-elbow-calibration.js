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
  const AUTO_CONFIG = {
    withdrawalMs: 3000,
    phaseTimeoutMs: 20000,
    windowFrames: 15,
    minInlierFrames: 8,
    // Pre-button patient identity anchor: six distinct ordinary camera frames
    // are required before the therapist may start the withdrawal countdown.
    preAnchorWindowFrames: 12,
    preAnchorMinFrames: 6,
    minAutoExcursionDeg: 8,
    minAutoSeparationDeg: 8,
    maxMadDeg: 3,
    maxTrimmedSpanDeg: 9,
    maxDriftDegPerFrame: 0.35,
    angleOutlierFloorDeg: 6,
    endpointPeakBandDeg: 4,
    endpointMedianPeakDeg: 3.5,
    torsoMidpointJumpScale: 0.55,
    torsoScaleMin: 0.62,
    torsoScaleMax: 1.45,
    identityAspectDelta: 0.035,
    spatialTorsoJitterScale: 0.25,
    spatialTorsoScaleMin: 0.82,
    spatialTorsoScaleMax: 1.22,
    minHorizontalOutward: 0.08,
    horizontalElbowToleranceDeg: 10,
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
  // Shared display contract for every Level 4 game. The horizontal argument is
  // admitted only by a game's ordered horizontal-abduction phase; it is never a
  // permanent elbow companion. Increasing admitted horizontal-abduction range is
  // deliberately screen-left to screen-right for either arm and either mirror
  // setting. The anatomical 2-D estimate remains a separate approximate input.
  function pathCoordinates(progress, abductionProgress, side, mirrorX) {
    return {
      x: 0.10 + 0.80 * clamp01(abductionProgress),
      // 0 is the lower supported-flexion position; 1 is the upper extension position.
      y: 0.84 + (0.32 - 0.84) * clamp01(progress),
    };
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
  // Torso geometry remains available for diagnostics. Identity continuity
  // below is anchored on the non-selected shoulder so normal movement of the
  // affected shoulder, elbow and wrist cannot masquerade as a person change.
  function torsoFromLandmarks(lm) {
    if (!Array.isArray(lm)) return null;
    const leftShoulder = lm[11], rightShoulder = lm[12];
    if (!pointUsable(leftShoulder) || !pointUsable(rightShoulder)) return null;
    const shoulderMid = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };
    const shoulderSpan = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
    if (!Number.isFinite(shoulderSpan) || shoulderSpan < 1e-4) return null;
    const leftHip = lm[23], rightHip = lm[24];
    const hipsUsable = pointUsable(leftHip) && pointUsable(rightHip);
    const hipMid = hipsUsable ? {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    } : null;
    const torsoScale = hipMid ? Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y) : shoulderSpan;
    if (!Number.isFinite(torsoScale) || torsoScale < 1e-4) return null;
    return { shoulderMid, hipMid, torsoScale, shoulderSpan, hipsUsable };
  }
  // Approximate horizontal-abduction observation only: the angle between the affected upper arm
  // and the shoulder-to-hip trunk axis (or image vertical if the hip is hidden
  // by the table). It is aspect-aware and is never part of the elbow progress
  // map or a readiness gate.
  function shoulderAbduction2D(arm, lm, side, imageAspect) {
    if (!arm || !pointUsable(arm.shoulder) || !pointUsable(arm.elbow)) return null;
    const aspect = usableImageAspect(imageAspect);
    const hip = Array.isArray(lm) ? lm[side === 'left' ? 23 : 24] : null;
    const trunk = pointUsable(hip)
      ? { x: (hip.x - arm.shoulder.x) * aspect, y: hip.y - arm.shoulder.y }
      : { x: 0, y: 1 };
    const upper = { x: (arm.elbow.x - arm.shoulder.x) * aspect, y: arm.elbow.y - arm.shoulder.y };
    const tn = Math.hypot(trunk.x, trunk.y), un = Math.hypot(upper.x, upper.y);
    if (tn < 1e-4 || un < 1e-4) return null;
    const cos = (trunk.x * upper.x + trunk.y * upper.y) / (tn * un);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }
  // Signed screen-outward upper-arm displacement.  This is deliberately
  // independent from the elbow angle: it compares the upper arm with the
  // patient's trunk/other shoulder and normalises by upper-arm scale. Positive
  // always means "away from the trunk toward the affected side on screen",
  // including under mirrored video.  It is used only as the horizontal path
  // axis in the three table-top path games.
  function shoulderOutward2D(arm, options) {
    if (!arm || !pointUsable(arm.shoulder) || !pointUsable(arm.elbow)) return null;
    const aspect = usableImageAspect(options && options.imageAspect);
    const displayX = options && options.mirrorX === false ? value => value : value => 1 - value;
    const upper = dist2D(arm.shoulder, arm.elbow, aspect);
    if (upper < 1e-4) return null;
    const other = arm.otherShoulder;
    let outwardSign = pointUsable(other)
      ? Math.sign(displayX(arm.shoulder.x) - displayX(other.x))
      : 0;
    if (!outwardSign) {
      const nativeSign = options && options.side === 'left' ? -1 : 1;
      outwardSign = options && options.mirrorX === false ? nativeSign : -nativeSign;
    }
    return outwardSign * aspect * (displayX(arm.elbow.x) - displayX(arm.shoulder.x)) / upper;
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
    // The horizontal estimate is deliberately opt-in from the three path
    // games. Linear Level 4 games neither read nor surface it.
    const horizontalEnabled = !options || options.enableHorizontalAbduction !== false;
    return {
      angle,
      lateral: lateralOffset(arm, options),
      shoulderAbduction: horizontalEnabled
        ? shoulderAbduction2D(arm, options && options.lm, options && options.side, imageAspect) : null,
      shoulderOutward: horizontalEnabled ? shoulderOutward2D(arm, options) : null,
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
        framingReady: false, gameReady: false, manual: { flexed: false, extended: false, horizontal: false }, auto: { flexed: false, extended: false, horizontal: false },
        endpoints: { flexed: null, extended: null, horizontal: null }, separation: {}, weights: { angle: 1 },
        qualified: [], lacking: [], signals: null, rawAngle: null, filteredAngle: null,
        filteredProgress: null, instantProgress: 0, progress: 0, signalProgress: { angle: 0 },
        engaged: false, reachGate: false, returnReady: true, completionReady: false,
        warning: '', retryCount: 0, captureCount: { flexed: 0, extended: 0, horizontal: 0 },
        frameFresh: false, frameGeneration: null, frameAgeMs: null,
        frameReason: 'awaiting-decoded-frame', frameSource: 'none', lastPoseGeneration: null,
        lastConsumedGeneration: null, newFrame: false, angleWindow: [], shoulderAbductionWindow: [],
        shoulderAbduction: null, filteredShoulderAbduction: null, shoulderOutward: null,
        side: 'right', imageAspect: 1, requiresHorizontal: false,
        lateral: null, arcProgress: 0, arcInstant: 0, arcActive: false,
        arcCalibrated: false, arcBaseline: null, abductionProgress: 0, abductionInstant: 0,
        abductionBaseline: null, abductionRange: null, abductionCalibrated: false, arcReason: 'awaiting-extension',
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
      if (!state.calibrated || !state.arcCalibrated || !Number.isFinite(state.shoulderOutward)) {
        state.arcActive = false;
        return;
      }
      const range = state.abductionRange || config.arcScale;
      state.arcInstant = clamp01(Math.max(0, state.shoulderOutward - state.arcBaseline) / range);
      state.arcProgress += config.smoothAlpha * (state.arcInstant - state.arcProgress);
      const lateralReady = state.arcProgress >= config.arcEnter
        ? true : (state.arcProgress <= config.arcExit ? false : state.arcActive);
      state.arcActive = state.progress >= config.arcExtensionGate && lateralReady;
      state.arcReason = state.arcActive ? 'extension-then-outward' :
        (state.progress < config.arcExtensionGate ? 'awaiting-extension' : 'awaiting-outward-lateral');
    }
    function updateAbductionAxis() {
      if (!state.calibrated || !state.abductionCalibrated || !Number.isFinite(state.shoulderOutward)) {
        state.abductionInstant = 0; state.abductionProgress = 0;
        return;
      }
      // The extended endpoint is the person's neutral X baseline.  We only
      // expose outward (not inward) movement and clamp to the safe display
      // range; this never feeds back into the elbow Y calculation or gates.
      state.abductionInstant = clamp01(Math.max(0,
        state.shoulderOutward - state.abductionBaseline) / (state.abductionRange || config.arcScale));
      state.abductionProgress += config.smoothAlpha * (state.abductionInstant - state.abductionProgress);
    }
    function update(input) {
      const packet = input || {};
      setFrame(packet);
      state.side = packet.side === 'left' ? 'left' : 'right';
      state.imageAspect = usableImageAspect(packet.imageAspect);
      state.requiresHorizontal = packet.requireHorizontal === true;
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
        state.reason = 'selected-arm-lost'; state.stage = state.calibrated ? 'not-ready' : 'framing';
        state.stabilizer.reason = 'hold-selected-arm-lost';
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
        state.shoulderAbduction = signals.shoulderAbduction;
        state.shoulderOutward = signals.shoulderOutward;
        state.lastPoseGeneration = state.frameGeneration;
        state.angleWindow.push(signals.angle);
        while (state.angleWindow.length > config.medianWindow) state.angleWindow.shift();
        state.lastConsumedGeneration = state.frameGeneration;
        state.filteredAngle = median(state.angleWindow) ?? signals.angle;
        if (Number.isFinite(signals.shoulderAbduction)) {
          state.shoulderAbductionWindow.push(signals.shoulderAbduction);
          while (state.shoulderAbductionWindow.length > config.medianWindow) state.shoulderAbductionWindow.shift();
          const shoulderMedian = median(state.shoulderAbductionWindow);
          state.filteredShoulderAbduction = !Number.isFinite(state.filteredShoulderAbduction)
            ? shoulderMedian : state.filteredShoulderAbduction + config.smoothAlpha * (shoulderMedian - state.filteredShoulderAbduction);
        }
        if (state.calibrated) { mapAngle(); updateArc(); updateAbductionAxis(); }
      }
      if (state.calibrated) {
        state.gameReady = true; state.stage = 'ready'; state.reason = 'ready';
      } else if (state.manual.extended && state.requiresHorizontal) {
        state.stage = 'capture-horizontal';
        state.reason = state.reason === 'horizontal-range-not-ready' ? state.reason : 'awaiting-horizontal-range';
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
        lateral: state.lateral, shoulderOutward: state.shoulderOutward, imageAspect: state.imageAspect };
      if (which === 'flexed') {
        state.endpoints.flexed = endpoint; state.manual.flexed = true; state.auto = { flexed: false, extended: false, horizontal: false };
        state.manual.extended = false; state.manual.horizontal = false; state.endpoints.horizontal = null;
        state.calibrated = false; state.gameReady = false;
        // Start the very small live filter at the visible captured endpoint so
        // the readout remains literal at mark time, rather than inheriting a
        // previous pose's median.
        state.angleWindow = [endpoint.angle]; state.filteredAngle = endpoint.angle;
        state.filteredProgress = null; state.progress = 0; state.instantProgress = 0;
        state.captureCount.flexed += 1; state.stage = 'capture-extended'; state.reason = 'awaiting-extended-capture';
        return true;
      }
      if (!state.endpoints.flexed) { state.reason = 'capture-flexed-first'; state.stage = 'capture-flexed'; return false; }
      if (which === 'horizontal') {
        if (!state.endpoints.extended) { state.reason = 'capture-extended-first'; state.stage = 'capture-extended'; return false; }
        const baseline = state.endpoints.extended.shoulderOutward;
        const range = Number.isFinite(state.shoulderOutward) && Number.isFinite(baseline)
          ? state.shoulderOutward - baseline : NaN;
        const elbowDifference = Math.abs(state.rawAngle - state.endpoints.extended.angle);
        if (!Number.isFinite(range) || range < config.arcScale * 0.45 || elbowDifference > AUTO_CONFIG.horizontalElbowToleranceDeg) {
          state.reason = 'horizontal-range-not-ready'; state.stage = 'capture-horizontal';
          return false;
        }
        state.endpoints.horizontal = { shoulderOutward: state.shoulderOutward, generation: state.frameGeneration,
          angle: state.rawAngle, range, imageAspect: state.imageAspect };
        state.manual.horizontal = true; state.captureCount.horizontal = (state.captureCount.horizontal || 0) + 1;
        state.abductionBaseline = baseline; state.abductionRange = range; state.abductionCalibrated = true;
        state.arcBaseline = baseline; state.arcCalibrated = true;
        state.calibrated = true; state.gameReady = state.framingReady; state.filteredProgress = null;
        mapAngle(); updateArc(); updateAbductionAxis(); state.stage = 'ready'; state.reason = 'ready';
        return true;
      }
      const separation = endpoint.angle - state.endpoints.flexed.angle;
      state.separation = { angle: separation };
      if (Math.abs(separation) < config.minAngleSeparationDeg) {
        state.endpoints.extended = null; state.manual.extended = false; state.calibrated = false;
        state.retryCount += 1; state.lacking = [{ signal: 'angle', reason: 'too-similar', separation }];
        state.stage = 'capture-extended'; state.reason = 'angle-separation-too-small';
        return false;
      }
      state.endpoints.extended = endpoint; state.manual.extended = true;
      state.captureCount.extended += 1; state.calibrated = !state.requiresHorizontal; state.gameReady = state.calibrated && state.framingReady;
      // Make the second labelled mark visibly equal 1 at the moment of capture.
      // Subsequent fresh frames again use the fixed median/EMA path.
      state.angleWindow = [endpoint.angle]; state.filteredAngle = endpoint.angle;
      state.qualified = ['angle']; state.lacking = []; state.filteredProgress = null;
      state.arcBaseline = endpoint.shoulderOutward; state.arcCalibrated = false;
      state.abductionBaseline = endpoint.shoulderOutward; state.abductionRange = null;
      state.abductionCalibrated = false;
      if (state.requiresHorizontal) {
        state.stage = 'capture-horizontal'; state.reason = 'awaiting-horizontal-range';
        return true;
      }
      mapAngle(); updateArc(); updateAbductionAxis(); state.stage = 'ready'; state.reason = 'ready';
      return true;
    }
    // Commit a complete automatically collected pair in one mutation. This is
    // deliberately separate from the therapist buttons: a cancelled, stale or
    // rejected auto run cannot alter an existing manual pair one endpoint at a
    // time.
    function capturePair(pair) {
      const flexed = pair && pair.flexed;
      const extended = pair && pair.extended;
      const requiresHorizontal = pair && pair.requiresHorizontal === true;
      const horizontal = pair && pair.horizontal;
      if (!flexed || !extended || !Number.isFinite(flexed.angle) || !Number.isFinite(extended.angle)
        || !Number.isFinite(flexed.generation) || !Number.isFinite(extended.generation)
        || flexed.generation === extended.generation) return false;
      const separation = extended.angle - flexed.angle;
      if (Math.abs(separation) < config.minAngleSeparationDeg) return false;
      const make = source => ({ angle: source.angle, generation: source.generation,
        lateral: source.lateral, shoulderOutward: source.shoulderOutward,
        imageAspect: usableImageAspect(source.imageAspect) });
      const nextFlexed = make(flexed);
      const nextExtended = make(extended);
      const horizontalRange = horizontal && Number.isFinite(horizontal.shoulderOutward) && Number.isFinite(nextExtended.shoulderOutward)
        ? horizontal.shoulderOutward - nextExtended.shoulderOutward : NaN;
      if (requiresHorizontal && (!Number.isFinite(horizontalRange) || horizontalRange < config.minHorizontalOutward
        || Math.abs(horizontal.angle - nextExtended.angle) > config.horizontalElbowToleranceDeg)) return false;
      state.endpoints.flexed = nextFlexed;
      state.endpoints.extended = nextExtended;
      state.endpoints.horizontal = requiresHorizontal ? {
        shoulderOutward: horizontal.shoulderOutward, generation: horizontal.generation,
        angle: horizontal.angle, range: horizontalRange, imageAspect: usableImageAspect(horizontal.imageAspect),
      } : null;
      state.manual.flexed = false; state.manual.extended = false; state.manual.horizontal = false;
      state.auto = { flexed: true, extended: true, horizontal: requiresHorizontal };
      state.separation = { angle: separation };
      state.captureCount.flexed += 1; state.captureCount.extended += 1;
      state.calibrated = true; state.gameReady = state.framingReady;
      state.angleWindow = [nextExtended.angle]; state.filteredAngle = nextExtended.angle;
      state.qualified = ['angle']; state.lacking = []; state.filteredProgress = null;
      state.arcBaseline = nextExtended.shoulderOutward; state.arcCalibrated = requiresHorizontal;
      state.abductionBaseline = nextExtended.shoulderOutward;
      state.abductionRange = requiresHorizontal ? horizontalRange : null;
      state.abductionCalibrated = requiresHorizontal;
      mapAngle(); updateArc(); updateAbductionAxis(); state.stage = 'ready'; state.reason = 'ready';
      return true;
    }
    function markFlexed() { return capture('flexed'); }
    function markExtended() { return capture('extended'); }
    function markHorizontal() { return capture('horizontal'); }
    function recalibrate() { reset(); }
    function guidance() {
      if (!state.frameFresh) return { main: '等候新相機畫面', detail: '目前畫面已過時，未會使用舊姿勢', en: 'Waiting for a fresh camera frame — old poses are blocked' };
      if (!state.framingReady) return { main: '未偵測到指定患側手臂', detail: '讓已選患側肩、肘、手腕回到畫面', en: 'Selected arm lost — show the selected shoulder, elbow and wrist' };
      if (state.reason === 'angle-separation-too-small') return RETRY_TEXT;
      if (!state.manual.flexed) return { main: '按「屈肘起點」', detail: '以目前新鮮畫面記錄 0', en: 'Capture flexed start from this fresh frame (0)' };
      if (!state.manual.extended) return { main: '按「伸肘終點」', detail: '以目前新鮮畫面記錄 1', en: 'Capture extended end from this fresh frame (1)' };
      if (state.requiresHorizontal && !state.manual.horizontal) return { main: '保持伸肘，肩水平外展向外移動後按「外展終點」', detail: '先保持伸肘，再記錄肩水平外展範圍', en: 'Keep elbow extended; shoulder horizontal abduction outward, then capture range' };
      return { main: '已就緒', detail: '屈肘開始、伸肘向上／向前、屈肘返回', en: 'Ready — flexed start, extend up/forward, then flexed return' };
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
        completionReady: state.completionReady, warning: state.warning,
        weights: { angle: 1 }, separation: Object.assign({}, state.separation), qualified: state.qualified.slice(),
        lacking: state.lacking.map(item => Object.assign({}, item)), signals: state.signals && Object.assign({}, state.signals),
        signalProgress: Object.assign({}, state.signalProgress),
        endpoints: { flexed: state.endpoints.flexed && Object.assign({}, state.endpoints.flexed),
          extended: state.endpoints.extended && Object.assign({}, state.endpoints.extended),
          horizontal: state.endpoints.horizontal && Object.assign({}, state.endpoints.horizontal) },
        manual: Object.assign({}, state.manual), auto: Object.assign({}, state.auto), retryCount: state.retryCount,
        captureCount: Object.assign({}, state.captureCount), frame, newFrame: state.newFrame,
        imageAspect: state.imageAspect, side: state.side,
        filtered: { angle: state.filteredAngle, progress: state.filteredProgress }, stabilizer: Object.assign({}, state.stabilizer),
        lateral: state.lateral, shoulderAbduction: state.shoulderAbduction,
        shoulderOutward: state.shoulderOutward,
        filteredShoulderAbduction: state.filteredShoulderAbduction,
        arcProgress: state.arcProgress, arcInstant: state.arcInstant,
        arcActive: state.arcActive, arcCalibrated: state.arcCalibrated,
        abductionProgress: state.abductionProgress, abductionInstant: state.abductionInstant,
        abductionCalibrated: state.abductionCalibrated, abductionBaseline: state.abductionBaseline,
        abductionRange: state.abductionRange, requiresHorizontal: state.requiresHorizontal,
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
        'shoulderAbduction:' + (Number.isFinite(snap.filteredShoulderAbduction) ? snap.filteredShoulderAbduction.toFixed(1) : 'na')
          + ' lateral:' + (Number.isFinite(snap.lateral) ? snap.lateral.toFixed(3) : 'na')
          + ' shoulderOutward:' + (Number.isFinite(snap.shoulderOutward) ? snap.shoulderOutward.toFixed(3) : 'na')
          + ' abductionProgress:' + snap.abductionProgress.toFixed(3)
          + ' arcProgress:' + snap.arcProgress.toFixed(3) + ' arcActive:' + snap.arcActive
          + ' arcReason:' + snap.arc.reason,
        'controller:signed-angle-capture-order median' + config.medianWindow + ' ema' + config.smoothAlpha
          + ' hysteresis' + config.endpointHysteresis,
      ].join(' ');
    }
    return { config, state, reset, update, markFlexed, markExtended, markHorizontal, capturePair, recalibrate, guidance, toText, snapshot };
  }

  function percentile(sorted, fraction) {
    if (!sorted.length) return null;
    const at = (sorted.length - 1) * fraction;
    const lower = Math.floor(at), upper = Math.ceil(at);
    return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (at - lower);
  }
  function torsoSignature(lm, imageAspect, selectedSide) {
    const torso = torsoFromLandmarks(lm);
    if (!torso) return null;
    const side = selectedSide === 'left' ? 'left' : 'right';
    const anchorShoulder = lm[side === 'left' ? 12 : 11];
    if (!pointUsable(anchorShoulder)) return null;
    return {
      anchorShoulder:{x:anchorShoulder.x,y:anchorShoulder.y},
      shoulderMid: torso.shoulderMid,
      hipMid: torso.hipMid,
      scale: torso.torsoScale,
      shoulderSpan: torso.shoulderSpan,
      hipsUsable: torso.hipsUsable,
      aspect: usableImageAspect(imageAspect),
    };
  }
  function signatureRelation(lock, current) {
    if (!lock || !current) return null;
    const stableScale = Math.max(0.08, Number(lock.shoulderSpan) || Number(lock.scale) || 0.08);
    const anchorShoulder = lock.anchorShoulder && current.anchorShoulder
      ? dist2D(lock.anchorShoulder, current.anchorShoulder, lock.aspect) / stableScale : null;
    const shoulderMid = dist2D(lock.shoulderMid, current.shoulderMid, lock.aspect) / stableScale;
    const hipMid = lock.hipMid && current.hipMid
      ? dist2D(lock.hipMid, current.hipMid, lock.aspect) / stableScale : null;
    return {
      anchorShoulder,
      shoulderMid,
      hipMid,
      // Only the non-selected shoulder is an admission gate. Shoulder midpoint,
      // hip visibility and apparent scale change under expected tabletop reach
      // and remain diagnostic rather than identity claims.
      midpoint: anchorShoulder == null ? shoulderMid : anchorShoulder,
      scale: current.scale / lock.scale,
      aspect: Math.abs(current.aspect - lock.aspect),
    };
  }
  function leastSquaresSlope(samples, key) {
    if (samples.length < 2) return 0;
    const first = samples[0].generation;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    samples.forEach(sample => { const x = sample.generation - first; const value = sample[key || 'angle']; n++; sx += x; sy += value; sxx += x*x; sxy += x*value; });
    const denom = n * sxx - sx * sx;
    return Math.abs(denom) < 1e-9 ? 0 : (n * sxy - sx * sy) / denom;
  }
  function robustWindow(samples, config, key) {
    const signal = key || 'angle';
    const values = samples.map(sample => sample[signal]).filter(Number.isFinite);
    const sorted = values.slice().sort((a,b) => a-b);
    const centre = median(sorted);
    if (!Number.isFinite(centre)) return { median:null, mad:null, trimmedSpan:null, slope:null, inliers:[], stable:false };
    const deviations = values.map(value => Math.abs(value - centre));
    const mad = median(deviations) || 0;
    // A one-frame landmark spike is excluded from credit rather than turning a
    // normal still hold into a restart. The subsequent MAD/trimmed tests remain
    // the actual stability gate.
    const band = Math.max(config.angleOutlierFloorDeg, 3 * mad);
    const inliers = samples.filter(sample => Math.abs(sample[signal] - centre) <= band);
    const inlierSorted = inliers.map(sample => sample[signal]).sort((a,b) => a-b);
    const trimmedSpan = inlierSorted.length >= 2 ? percentile(inlierSorted, .90) - percentile(inlierSorted, .10) : Infinity;
    const slope = leastSquaresSlope(inliers, signal);
    return { median: median(inlierSorted), mad, trimmedSpan, slope, inliers,
      stable: inliers.length >= config.minInlierFrames && mad <= config.maxMadDeg
        && trimmedSpan <= config.maxTrimmedSpanDeg && Math.abs(slope) <= config.maxDriftDegPerFrame };
  }
  function createAutoCalibration(options) {
    const config = Object.assign({}, AUTO_CONFIG, options || {});
    // This buffer is deliberately populated only by ordinary fresh Level 4
    // packets before the bedside auto button is pressed.  It is a torso
    // continuity anchor, not an arm endpoint sampler and has no public seed/bypass.
    const preAnchor = { samples:[], lastGeneration:null, signature:null, side:null, stableFrames:0 };
    const state = { phase:'idle', reason:'idle', countdownRemainingMs:0, stableFrames:0,
      samples:[], lock:null, anchorFrozen:false, lastGeneration:null, phaseStartedAt:null, deadlineAt:null,
      candidate:{flexed:null, extended:null, horizontal:null, separation:null}, farthest:{angle:null, signed:0, absolute:0}, stablePeak:{angle:null, signed:0, absolute:0},
      summary:{median:null,mad:null,trimmedSpan:null,slope:null,inliers:0}, attempts:0, requiresHorizontal:false };
    function clearCredit(reason) {
      state.samples = []; state.stableFrames = 0;
      state.summary = {median:null,mad:null,trimmedSpan:null,slope:null,inliers:0};
      state.reason = reason;
    }
    function clearPreAnchor() {
      preAnchor.samples=[]; preAnchor.lastGeneration=null; preAnchor.signature=null;
      preAnchor.side=null; preAnchor.stableFrames=0;
    }
    function anchorFromSamples() {
      if (!preAnchor.samples.length) return null;
      const recent = preAnchor.samples.slice(-config.preAnchorWindowFrames);
      const latest = recent[recent.length - 1];
      // Selection changes and aspect changes never blend into a signature.
      const sameContext = recent.filter(item => item.side === latest.side
        && Math.abs(item.signature.aspect - latest.signature.aspect) <= config.identityAspectDelta);
      if (sameContext.length < config.preAnchorMinFrames) return null;
      const midpoint = key => ({
        x:median(sameContext.map(item=>item.signature[key]?.x).filter(Number.isFinite)),
        y:median(sameContext.map(item=>item.signature[key]?.y).filter(Number.isFinite)),
      });
      const base = {
        anchorShoulder:midpoint('anchorShoulder'),
        shoulderMid: midpoint('shoulderMid'),
        hipMid:sameContext.some(item=>item.signature.hipMid) ? midpoint('hipMid') : null,
        scale:median(sameContext.map(item=>item.signature.scale)),
        shoulderSpan:median(sameContext.map(item=>item.signature.shoulderSpan)),
        aspect:median(sameContext.map(item=>item.signature.aspect)),
      };
      const inliers = sameContext.filter(item => {
        const rel=signatureRelation(base,item.signature);
        return rel && rel.midpoint <= config.spatialTorsoJitterScale
          && rel.aspect <= config.identityAspectDelta;
      });
      preAnchor.stableFrames=inliers.length;
      if (inliers.length < config.preAnchorMinFrames) return null;
      const inlierMidpoint = key => ({
        x:median(inliers.map(item=>item.signature[key]?.x).filter(Number.isFinite)),
        y:median(inliers.map(item=>item.signature[key]?.y).filter(Number.isFinite)),
      });
      return {
        anchorShoulder:inlierMidpoint('anchorShoulder'),
        shoulderMid:inlierMidpoint('shoulderMid'),
        hipMid:inliers.some(item=>item.signature.hipMid) ? inlierMidpoint('hipMid') : null,
        scale:median(inliers.map(item=>item.signature.scale)),
        shoulderSpan:median(inliers.map(item=>item.signature.shoulderSpan)),
        aspect:median(inliers.map(item=>item.signature.aspect)),
        side:latest.side, frames:inliers.length,
      };
    }
    function observePreAnchor(packet) {
      // A running endpoint session must never learn a new identity.  The only
      // lock accepted after countdown is the frozen pre-button patient anchor.
      if (state.anchorFrozen || !['idle','retry','cancelled'].includes(state.phase)) return;
      const input=packet || {};
      const fresh=input.frameFresh === true || input.frame?.fresh === true;
      const generation=input.frameGeneration ?? input.frame?.generation;
      if (!fresh || !Number.isFinite(generation) || generation === preAnchor.lastGeneration) return;
      preAnchor.lastGeneration=generation;
      const side=input.side === 'left' ? 'left' : 'right';
      const signature=torsoSignature(input.lm,input.imageAspect,side);
      if (!signature) { preAnchor.stableFrames=0; return; }
      preAnchor.samples.push({generation,side,signature});
      while(preAnchor.samples.length > config.preAnchorWindowFrames) preAnchor.samples.shift();
      preAnchor.signature=anchorFromSamples();
      preAnchor.side=preAnchor.signature?.side || null;
    }
    function resetRun(reason, phase) {
      Object.assign(state, { phase:phase || 'idle', reason:reason || 'idle', countdownRemainingMs:0, stableFrames:0,
        samples:[], lock:null, anchorFrozen:false, lastGeneration:null, phaseStartedAt:null, deadlineAt:null,
        candidate:{flexed:null,extended:null,horizontal:null,separation:null}, farthest:{angle:null,signed:0,absolute:0}, stablePeak:{angle:null,signed:0,absolute:0},
        summary:{median:null,mad:null,trimmedSpan:null,slope:null,inliers:0}, requiresHorizontal:false });
      return snapshot();
    }
    function reset(reason) { resetRun(reason); clearPreAnchor(); return snapshot(); }
    function start(nowMs, options) {
      const now=Number.isFinite(nowMs) ? nowMs : Date.now();
      resetRun('therapist-withdrawal');
      state.requiresHorizontal=options && options.requireHorizontal === true;
      const frozen=preAnchor.signature || anchorFromSamples();
      if (!frozen) {
        state.phase='retry'; state.reason='pre-anchor-required';
        return snapshot();
      }
      state.lock={ anchorShoulder:{...frozen.anchorShoulder}, shoulderMid:{...frozen.shoulderMid},
        hipMid:frozen.hipMid && {...frozen.hipMid}, scale:frozen.scale,
        shoulderSpan:frozen.shoulderSpan, aspect:frozen.aspect, side:frozen.side };
      state.anchorFrozen=true; state.phase='countdown'; state.deadlineAt=now+config.withdrawalMs;
      state.attempts += 1;
      return snapshot();
    }
    function cancel() { return resetRun('cancelled','cancelled'); }
    function retry(reason) {
      state.phase='retry'; state.reason=reason || 'retry'; state.countdownRemainingMs=0;
      clearCredit(state.reason);
      // A confirmed torso discontinuity invalidates the frozen pre-button
      // patient anchor.  Do not trap subsequent attempts against that stale
      // lock: preserve any previously committed endpoints, but require six new
      // ordinary fresh frames before Auto can be started again.
      if (state.reason === 'torso-moved/person-changed') {
        state.lock=null;
        state.anchorFrozen=false;
        clearPreAnchor();
      }
      return snapshot();
    }
    function acceptSample(packet) {
      const side=packet.side === 'left' ? 'left' : 'right';
      const arm = packet.arm || armFromLandmarks(packet.lm,side);
      const signals = computeSignals(arm, null, packet);
      if (!signals) { clearCredit('selected-arm-lost'); return null; }
      const signature = torsoSignature(packet.lm, packet.imageAspect, side);
      // Fail closed: this is never assigned from the first post-countdown torso.
      if (!signature || !state.lock || !state.anchorFrozen || side !== state.lock.side) {
        retry('torso-moved/person-changed'); return null;
      }
      const relation = signatureRelation(state.lock, signature);
      if (!relation || relation.midpoint > config.torsoMidpointJumpScale || relation.aspect > config.identityAspectDelta) {
        retry('torso-moved/person-changed'); return null;
      }
      if (relation.midpoint > config.spatialTorsoJitterScale) {
        clearCredit('torso-unstable'); return null;
      }
      const sample = { angle:signals.angle, generation:packet.frameGeneration, lateral:signals.lateral,
        shoulderOutward:signals.shoulderOutward, imageAspect:usableImageAspect(packet.imageAspect), signature };
      state.samples.push(sample);
      while (state.samples.length > config.windowFrames) state.samples.shift();
      const summary = robustWindow(state.samples, config);
      state.summary = { median:summary.median, mad:summary.mad, trimmedSpan:summary.trimmedSpan,
        slope:summary.slope, inliers:summary.inliers.length };
      state.stableFrames = summary.inliers.length;
      // One normal landmark spike does not restart a still hold; it is excluded
      // by robustWindow's median/MAD inlier rule and remains diagnostic only.
      if (Math.abs(sample.angle - (summary.median ?? sample.angle)) > Math.max(config.angleOutlierFloorDeg, 3 * (summary.mad || 0))) state.reason='angle-outlier-ignored';
      return { sample, summary };
    }
    function update(packet, controller) {
      const input=packet || {}, now=Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
      observePreAnchor(input);
      if (state.phase === 'idle' || state.phase === 'retry' || state.phase === 'cancelled' || state.phase === 'complete') return snapshot();
      if (state.phase === 'countdown') {
        state.countdownRemainingMs=Math.max(0,state.deadlineAt-now);
        if (now < state.deadlineAt) return snapshot();
        state.phase='capture-flexed'; state.reason='hold-supported-flexion'; state.phaseStartedAt=now; state.deadlineAt=now+config.phaseTimeoutMs;
        // The image that ends withdrawal is never an endpoint sample.
        return snapshot();
      }
      if (now >= state.deadlineAt) return retry(state.phase === 'capture-flexed' ? 'timeout-flexed'
        : (state.phase === 'capture-horizontal' ? 'timeout-horizontal' : 'timeout-extension'));
      const fresh=input.frameFresh === true || input.frame?.fresh === true;
      const generation=input.frameGeneration ?? input.frame?.generation;
      if (!fresh) { clearCredit('frame-stale'); return snapshot(); }
      if (!Number.isFinite(generation) || generation === state.lastGeneration) return snapshot();
      state.lastGeneration=generation;
      const accepted=acceptSample(input);
      if (!accepted || state.phase === 'retry') return snapshot();
      const {sample,summary}=accepted;
      if (state.phase === 'capture-flexed') {
        if (summary.stable) {
          const flexed=summary.inliers[Math.floor(summary.inliers.length/2)];
          state.candidate.flexed=Object.assign({},flexed,{angle:summary.median});
          state.phase='capture-extended'; state.reason='slowly-extend'; state.phaseStartedAt=now; state.deadlineAt=now+config.phaseTimeoutMs;
          state.samples=[]; state.stableFrames=0;
        }
        return snapshot();
      }
      if (state.phase === 'capture-horizontal') {
        const start=state.candidate.extended;
        if (!start || Math.abs(sample.angle - start.angle) > config.horizontalElbowToleranceDeg) {
          clearCredit('keep-elbow-extended-and-move-outward');
          return snapshot();
        }
        const horizontalSummary=robustWindow(state.samples, Object.assign({}, config, {
          maxMadDeg:0.035, maxTrimmedSpanDeg:0.09, maxDriftDegPerFrame:0.012, angleOutlierFloorDeg:0.08,
        }), 'shoulderOutward');
        if (!Number.isFinite(sample.shoulderOutward) || !horizontalSummary.stable) {
          state.reason='keep-elbow-extended-and-move-outward';
          return snapshot();
        }
        const range=horizontalSummary.median-start.shoulderOutward;
        if (range < config.minHorizontalOutward) {
          state.reason='keep-elbow-extended-and-move-outward';
          return snapshot();
        }
        const horizontal=horizontalSummary.inliers[Math.floor(horizontalSummary.inliers.length/2)];
        state.candidate.horizontal=Object.assign({},horizontal,{shoulderOutward:horizontalSummary.median,angle:sample.angle});
        const committed=controller && typeof controller.capturePair === 'function' && controller.capturePair({
          flexed:state.candidate.flexed, extended:start, horizontal:state.candidate.horizontal, requiresHorizontal:true,
        });
        if (!committed) return retry('pair-commit-rejected');
        state.phase='complete'; state.reason='auto-pair-ready'; state.stableFrames=horizontalSummary.inliers.length;
        return snapshot();
      }
      const start=state.candidate.flexed;
      const signed=sample.angle-start.angle, absolute=Math.abs(signed);
      if (absolute > state.farthest.absolute) state.farthest={angle:sample.angle,signed,absolute};
      if (summary.stable) {
        const separation=Math.abs(summary.median-start.angle);
        if (separation > state.stablePeak.absolute) state.stablePeak={angle:summary.median,signed:summary.median-start.angle,absolute:separation};
        const nearPeak=state.stablePeak.angle == null ? 0 : summary.inliers.filter(item=>Math.abs(item.angle-state.stablePeak.angle)<=config.endpointPeakBandDeg).length;
        if (state.stablePeak.absolute >= config.minAutoExcursionDeg && nearPeak >= config.minInlierFrames
          && Math.abs(summary.median-state.stablePeak.angle) <= config.endpointMedianPeakDeg
          && separation >= config.minAutoSeparationDeg) {
          const extended=summary.inliers[Math.floor(summary.inliers.length/2)];
          state.candidate.extended=Object.assign({},extended,{angle:summary.median});
          state.candidate.separation=state.candidate.extended.angle-start.angle;
          if (state.requiresHorizontal) {
            state.phase='capture-horizontal'; state.reason='keep-elbow-extended-and-move-outward';
            state.phaseStartedAt=now; state.deadlineAt=now+config.phaseTimeoutMs; state.samples=[]; state.stableFrames=0;
            return snapshot();
          }
          const committed=controller && typeof controller.capturePair === 'function'
            && controller.capturePair({flexed:start,extended:state.candidate.extended,requiresHorizontal:false});
          if (!committed) return retry('pair-commit-rejected');
          state.phase='complete'; state.reason='auto-pair-ready'; state.stableFrames=nearPeak;
        } else if (state.farthest.absolute < config.minAutoExcursionDeg) state.reason='move-at-least-8deg';
      }
      return snapshot();
    }
    function snapshot() {
      const anchor=preAnchor.signature;
      return { phase:state.phase, reason:state.reason, countdownRemainingMs:state.countdownRemainingMs,
        stableFrames:state.stableFrames, requiredStableFrames:config.minInlierFrames, attempts:state.attempts,
        candidate:{flexed:state.candidate.flexed && Object.assign({},state.candidate.flexed), extended:state.candidate.extended && Object.assign({},state.candidate.extended), horizontal:state.candidate.horizontal && Object.assign({},state.candidate.horizontal), separation:state.candidate.separation},
        farthest:Object.assign({},state.farthest), stablePeak:Object.assign({},state.stablePeak), summary:Object.assign({},state.summary),
        lock:state.lock && {scale:state.lock.scale,aspect:state.lock.aspect,side:state.lock.side},
        requiresHorizontal:state.requiresHorizontal,
        preAnchor:{available:!!anchor, stableFrames:preAnchor.stableFrames, requiredFrames:config.preAnchorMinFrames,
          side:anchor?.side || null, frozen:state.anchorFrozen} };
    }
    return { config, state, start, cancel, retry, reset, update, snapshot };
  }

  const api = { CONFIG, AUTO_CONFIG, SIGNAL_KEYS, PRIMARY_KEYS, SIGNAL_LABELS, RETRY_TEXT, createController, createAutoCalibration,
    computeSignals, armFromLandmarks, torsoFromLandmarks, torsoSignature, jointAngle2D, shoulderAbduction2D, shoulderOutward2D, pathCoordinates,
    usableImageAspect, pointUsable, median, clamp01 };
  global.Level4ElbowCalibration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
