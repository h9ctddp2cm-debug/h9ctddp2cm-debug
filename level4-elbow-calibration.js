/* FTHUE Level 4 — participant-specific TWO-POSE elbow calibration.

   Clinical problem this file solves
   --------------------------------
   The iPad stands upright on the same table, roughly one metre in front of the
   participant (or slightly on the affected-side front angle). From that
   viewpoint a single 2D elbow angle is NOT a reliable description of elbow
   flexion/extension: forearm motion largely happens along the camera axis, so
   the projected angle can stay flat, or even move backwards, while the elbow
   genuinely extends.

   Therefore Level 4 no longer guesses a threshold. The therapist captures the
   participant's own two endpoints:

     1. supported flexed / start pose  (elbow about 90 degrees, but ANY
        available range is accepted),
     2. extended / end pose.

   Several independent signals are measured at both endpoints:

     angle      normalised 2D elbow angle (degrees)
     spanRatio  arm-span ratio dist(shoulder,wrist)/(upperArm+forearm) in 2D
     worldSpan  the same span ratio computed from MediaPipe world landmarks
                (true 3D, perspective free) when they are available
     radial     wrist-to-shoulder radial distance / shoulder span
     depthZ     (wrist.z - shoulder.z) / shoulder span, from image-space z

   Each signal is kept only if the two captured endpoints separate it by more
   than its own minimum separation, and its DIRECTION (sign) is learned from
   the capture, so a signal that decreases with extension is handled exactly
   like one that increases. Remaining signals are weighted by how strongly
   they separated, multiplied by a fixed reliability prior.

   `angle`, `spanRatio` and `worldSpan` are elbow-intrinsic: they are invariant
   to trunk lean and shoulder elevation. `radial` and `depthZ` also respond to
   shoulder/trunk movement, so while any elbow-intrinsic signal is usable they
   are limited to a small supporting share. If the front-facing view collapses
   every elbow-intrinsic signal, the supporting signals carry the whole
   estimate instead of failing.

   Output is one normalised progress value: flexed endpoint = 0, extended
   endpoint = 1, whatever the underlying signs. Every Level 4 game consumes
   that same value, plus its hysteresis flags, for reach/return gating.

   This module never infers tone, strength, spasticity or movement quality. It
   is a screen-control signal, not a measurement instrument. */

(function (global) {
  'use strict';

  const CONFIG = {
    stabilityWindow: 5,
    stabilityTolerance: { angle: 9, spanRatio: 0.06 },
    minStableSamples: 3,
    maxStableSamples: 12,
    // Minimum endpoint separation required before a signal may be trusted.
    minSeparation: { angle: 12, spanRatio: 0.08, worldSpan: 0.08, radial: 0.10, depthZ: 0.06 },
    reliability: { angle: 1.0, spanRatio: 1.15, worldSpan: 1.25, radial: 0.9, depthZ: 0.5 },
    strengthCap: 3,
    // Share of the fused estimate left to shoulder-sensitive signals while at
    // least one elbow-intrinsic signal is usable.
    supportShare: 0.15,
    deadZone: 0.12,
    smoothAlpha: 0.55,
    snapEpsilon: 0.02,
    // ---- anti-jitter stabilisation ------------------------------------
    // Real iPad landmarks jump frame to frame. Raw signals are first passed
    // through a short rolling median with per-signal outlier rejection, then
    // the fused value is stabilised with a calibration-span-relative deadband,
    // an adaptive EMA and a bounded per-frame step. None of these steps is a
    // blanket increase in smoothing: a consistent, real movement raises the
    // gain immediately so the game stays responsive.
    medianWindow: 5,
    medianMinSamples: 3,
    // Reject a sample when it deviates from the rolling median by more than
    // this multiple of the calibrated endpoint separation for that signal.
    outlierSpanFactor: 0.55,
    maxConsecutiveRejects: 3,
    // Fraction of the calibrated 0..1 span treated as jitter and ignored.
    jitterBand: 0.045,
    directionFrames: 2,
    minAlpha: 0.28,
    maxAlpha: 0.85,
    alphaSpan: 0.22,
    maxStep: 0.16,
    reversalAlpha: 0.7,
    snapLow: 0.05,
    snapHigh: 0.95,
    snapFrames: 2,
    engageEnter: 0.20,
    engageExit: 0.06,
    engageFrames: 2,
    reachEnter: 0.62,
    reachExit: 0.28,
    returnAt: 0.18,
    completeAt: 0.94,
    // ---- bedside proof after the two manual endpoint captures -------------
    // Calibration establishes the participant-specific mapping. It does not
    // unlock a game until the live device has proved that mapping three times
    // in the intended flexed -> extended -> flexed order.
    verificationCycles: 3,
    verificationMotionDelta: 0.06,
    verificationReverseDelta: 0.10,
    verificationStallFrames: 150,
    attemptsBeforeRetry: 2,
    hikeTolerance: 0.035,
    // ---- signal B: shoulder-abduction / lateral arc --------------------
    // Baseline is captured with the extended endpoint; the scale is the larger
    // of a clinical floor and the excursion the participant actually produces.
    // A 45-degree bedside camera compresses the visible lateral excursion.
    // Keep the floor small enough to recognise a deliberate supported sweep,
    // while the separate jitter band still rejects landmark shimmer.
    arcMinScale: 0.18,
    arcEnter: 0.28,
    arcExit: 0.12,
    // Lateral excursion above this fraction freezes reach progress so the arc
    // cannot make a carried item slide or shake.
    arcHold: 0.07,
    arcHoldStep: 0.03,
    // Safety release: the reach freeze can never latch forever.
    arcHoldMaxFrames: 240,
    // Category 2 requires the calibrated elbow extension to be MAINTAINED
    // through the lateral arc. Retention is measured on the elbow joint angle
    // alone, because a joint angle survives shoulder abduction while whole-arm
    // projection signals do not.
    arcExtensionGate: 0.45,
    arcExtensionResume: 0.60,
    arcJitterBand: 0.05,
    arcAlphaMin: 0.30,
    arcAlphaMax: 0.80,
    arcMaxStep: 0.20,
  };

  const SIGNAL_KEYS = ['angle', 'spanRatio', 'worldSpan', 'radial', 'depthZ'];
  const PRIMARY_KEYS = ['angle', 'spanRatio', 'worldSpan'];
  const SIGNAL_LABELS = {
    angle: '肘角 angle',
    spanRatio: '手臂比例 span',
    worldSpan: '立體比例 world',
    radial: '肩腕距離 radial',
    depthZ: '深度 depth',
  };

  const RETRY_TEXT = {
    main: '兩個姿勢分別不足 · 請重做',
    detail: '屈肘起點與伸直終點要明顯不同',
    en: 'Start and end poses too similar — capture again',
  };

  function isPrimary(key) {
    return PRIMARY_KEYS.indexOf(key) >= 0;
  }

  function median(values) {
    const sorted = values.filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function pointUsable(point) {
    // A forearm resting on a table (or on a skateboard) is often given low
    // visibility even when its coordinates are stable enough for control.
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && (point.visibility == null || point.visibility >= 0.05);
  }

  function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function dist3D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  function jointAngle2D(a, b, c) {
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
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
      shoulder: lm[left ? 11 : 12],
      elbow: lm[left ? 13 : 14],
      wrist: lm[left ? 15 : 16],
      otherShoulder: lm[left ? 12 : 11],
    };
    return [arm.shoulder, arm.elbow, arm.wrist].every(pointUsable) ? arm : null;
  }

  function worldSpanRatio(worldArm) {
    if (!worldArm) return null;
    const { shoulder, elbow, wrist } = worldArm;
    if (![shoulder, elbow, wrist].every(point => point
      && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))) {
      return null;
    }
    const upper = dist3D(shoulder, elbow);
    const fore = dist3D(elbow, wrist);
    if (upper + fore < 1e-4) return null;
    // A degenerate all-zero world frame carries no information.
    if (upper < 1e-3 || fore < 1e-3) return null;
    return dist3D(shoulder, wrist) / (upper + fore);
  }

  /* Raw signal set for one camera frame. Every value is scale free, so the
     participant's distance from the iPad does not change the numbers. */
  /* The lateral/abduction signal (B) is deliberately NOT part of SIGNAL_KEYS:
     it never enters the reach fusion (A), so drawing the outward circle cannot
     move a carried dim-sum item. `mirrorX` matches the on-screen mirrored
     preview and `side` selects the outward direction, so the participant's own
     outward direction is always positive. */
  function lateralOffset(arm, options) {
    if (!arm) return null;
    const side = (options && options.side) === 'left' ? 'left' : 'right';
    const mirrorX = !(options && options.mirrorX === false);
    const displayX = value => (mirrorX ? 1 - value : value);
    const outwardSign = side === 'right' ? 1 : -1;
    const upper = dist2D(arm.shoulder, arm.elbow);
    const fore = dist2D(arm.elbow, arm.wrist);
    const armLength = upper + fore;
    if (!(armLength > 1e-4)) return null;
    return outwardSign * (displayX(arm.wrist.x) - displayX(arm.shoulder.x)) / armLength;
  }

  function computeSignals(arm, worldArm, options) {
    if (!arm) return null;
    const angle = jointAngle2D(arm.shoulder, arm.elbow, arm.wrist);
    const upper = dist2D(arm.shoulder, arm.elbow);
    const fore = dist2D(arm.elbow, arm.wrist);
    const chord = dist2D(arm.shoulder, arm.wrist);
    if (!Number.isFinite(angle) || upper + fore < 1e-4) return null;
    const otherShoulderVisible = pointUsable(arm.otherShoulder);
    const shoulderSpan = Math.max(0.05, otherShoulderVisible
      ? dist2D(arm.shoulder, arm.otherShoulder)
      : upper * 1.35);
    const hasImageZ = Number.isFinite(arm.wrist.z) && Number.isFinite(arm.shoulder.z);
    return {
      angle,
      spanRatio: chord / (upper + fore),
      worldSpan: worldSpanRatio(worldArm),
      radial: chord / shoulderSpan,
      depthZ: hasImageZ ? ((arm.wrist.z || 0) - (arm.shoulder.z || 0)) / shoulderSpan : null,
      shoulderBalance: otherShoulderVisible ? arm.shoulder.y - arm.otherShoulder.y : null,
      shoulderSpan,
      worldAvailable: Number.isFinite(worldSpanRatio(worldArm)),
      // Signal B: outward (abduction) excursion in arm-length units.
      lateral: lateralOffset(arm, options),
    };
  }

  function medianSample(samples) {
    const out = {};
    SIGNAL_KEYS.forEach(key => {
      out[key] = median(samples.map(sample => sample[key]));
    });
    // Signal B is stored with the endpoint but never fused into reach progress.
    out.lateral = median(samples.map(sample => sample.lateral));
    out.shoulderBalance = median(samples.map(sample => sample.shoulderBalance));
    return out;
  }

  function createController(options) {
    const config = Object.assign({}, CONFIG, options || {});

    const state = {
      stage: 'framing',
      reason: 'framing',
      calibrated: false,
      framingReady: false,
      manual: { flexed: false, extended: false },
      endpoints: { flexed: null, extended: null },
      separation: {},
      weights: {},
      qualified: [],
      lacking: [],
      signals: null,
      signalProgress: {},
      instantProgress: 0,
      progress: 0,
      engaged: false,
      engageFrames: 0,
      reachGate: false,
      returnReady: true,
      completionReady: false,
      shoulderHike: false,
      warning: '',
      attempts: 0,
      retryCount: 0,
      captureCount: { flexed: 0, extended: 0 },
      depthSource: 'none',
      movementSeen: false,
      // A calibrated mapping is deliberately distinct from a gameplay unlock.
      // These values are exposed in snapshots for deterministic bedside QA.
      preflightPassed: false,
      verificationCount: 0,
      verificationPhase: 'await-flexed',
      verificationFailure: '',
      verificationMoved: false,
      verificationPeak: 0,
      verificationTrough: 1,
      verificationActiveFrames: 0,
      history: [],
      samples: [],
      // anti-jitter bookkeeping
      rawWindow: [],
      filtered: null,
      rejectRun: 0,
      rejectedSignals: [],
      rejectedFrames: 0,
      direction: 0,
      directionRun: 0,
      holdFrames: 0,
      snapRun: 0,
      lastAlpha: 0,
      lastStep: 0,
      stabilizerReason: 'idle',
      // signal B: lateral arc + ordered cycle
      side: 'right',
      mirrorX: true,
      lateral: null,
      arcBaseline: null,
      arcScale: null,
      arcObservedMax: 0,
      arcProgress: 0,
      arcInstant: 0,
      arcActive: false,
      arcHold: false,
      arcHoldFrames: 0,
      arcPaused: false,
      arcReason: 'arc-idle',
      extensionRetention: null,
      arcCalibrated: false,
      cyclePhase: 'start',
      cycleOutSeen: false,
      cycleReturnSeen: false,
      cycleReachSeen: false,
      cycleOrdered: false,
      cycleComplete: false,
      cycleCount: 0,
    };

    function reset() {
      state.stage = 'framing';
      state.reason = 'framing';
      state.calibrated = false;
      state.framingReady = false;
      state.manual = { flexed: false, extended: false };
      state.endpoints = { flexed: null, extended: null };
      state.separation = {};
      state.weights = {};
      state.qualified = [];
      state.lacking = [];
      state.signals = null;
      state.signalProgress = {};
      state.instantProgress = 0;
      state.progress = 0;
      state.engaged = false;
      state.engageFrames = 0;
      state.reachGate = false;
      state.returnReady = true;
      state.completionReady = false;
      state.shoulderHike = false;
      state.warning = '';
      state.attempts = 0;
      state.retryCount = 0;
      state.captureCount = { flexed: 0, extended: 0 };
      state.depthSource = 'none';
      state.movementSeen = false;
      state.preflightPassed = false;
      state.verificationCount = 0;
      state.verificationPhase = 'await-flexed';
      state.verificationFailure = '';
      state.verificationMoved = false;
      state.verificationPeak = 0;
      state.verificationTrough = 1;
      state.verificationActiveFrames = 0;
      state.history = [];
      state.samples = [];
      state.rawWindow = [];
      state.filtered = null;
      state.rejectRun = 0;
      state.rejectedSignals = [];
      state.rejectedFrames = 0;
      state.direction = 0;
      state.directionRun = 0;
      state.holdFrames = 0;
      state.snapRun = 0;
      state.lastAlpha = 0;
      state.lastStep = 0;
      state.stabilizerReason = 'idle';
      state.lateral = null;
      state.arcBaseline = null;
      state.arcScale = null;
      state.arcObservedMax = 0;
      state.arcProgress = 0;
      state.arcInstant = 0;
      state.arcActive = false;
      state.arcHold = false;
      state.arcHoldFrames = 0;
      state.arcPaused = false;
      state.arcReason = 'arc-idle';
      state.extensionRetention = null;
      state.arcCalibrated = false;
      state.cyclePhase = 'start';
      state.cycleOutSeen = false;
      state.cycleReturnSeen = false;
      state.cycleReachSeen = false;
      state.cycleOrdered = false;
      state.cycleComplete = false;
      state.cycleCount = 0;
      return state;
    }

    function spread(values) {
      const usable = values.filter(v => Number.isFinite(v));
      if (usable.length < 2) return Infinity;
      return Math.max.apply(null, usable) - Math.min.apply(null, usable);
    }

    function isStable() {
      if (state.history.length < config.stabilityWindow) return false;
      const window = state.history.slice(-config.stabilityWindow);
      return spread(window.map(s => s.angle)) <= config.stabilityTolerance.angle
        && spread(window.map(s => s.spanRatio)) <= config.stabilityTolerance.spanRatio;
    }

    /* Endpoint separation decides which signals may be used at all, and in
       which direction. Nothing is calibrated silently: a candidate endpoint
       pair with no usable separation is rejected and reported. */
    function evaluateEndpoints(flexed, extended) {
      const separation = {};
      const weights = {};
      const qualified = [];
      const lacking = [];
      SIGNAL_KEYS.forEach(key => {
        const from = flexed ? flexed[key] : null;
        const to = extended ? extended[key] : null;
        if (!Number.isFinite(from) || !Number.isFinite(to)) {
          separation[key] = null;
          lacking.push({ signal: key, reason: 'unavailable', separation: null, required: config.minSeparation[key] });
          return;
        }
        const delta = to - from;
        separation[key] = delta;
        if (Math.abs(delta) < config.minSeparation[key]) {
          lacking.push({ signal: key, reason: 'too-similar', separation: delta, required: config.minSeparation[key] });
          return;
        }
        const strength = Math.min(config.strengthCap, Math.abs(delta) / config.minSeparation[key]);
        weights[key] = strength * config.reliability[key];
        qualified.push(key);
      });

      const primary = qualified.filter(isPrimary);
      const support = qualified.filter(key => !isPrimary(key));
      const primaryTotal = primary.reduce((sum, key) => sum + weights[key], 0);
      const supportTotal = support.reduce((sum, key) => sum + weights[key], 0);
      const normalised = {};
      if (primaryTotal > 0 && supportTotal > 0) {
        primary.forEach(key => {
          normalised[key] = (1 - config.supportShare) * weights[key] / primaryTotal;
        });
        support.forEach(key => {
          normalised[key] = config.supportShare * weights[key] / supportTotal;
        });
      } else if (primaryTotal > 0) {
        primary.forEach(key => { normalised[key] = weights[key] / primaryTotal; });
      } else if (supportTotal > 0) {
        // Front-facing collapse of every elbow-intrinsic signal: the
        // shoulder-sensitive signals become the whole estimate.
        support.forEach(key => { normalised[key] = weights[key] / supportTotal; });
      }
      return { separation, weights: normalised, qualified, lacking };
    }

    /* ---- stage 1: rolling median with outlier rejection -----------------
       Each raw signal is pushed into a short window. The value used downstream
       is the window median, and a sample that deviates from that median by more
       than `outlierSpanFactor` of the calibrated endpoint separation is dropped
       (a single-frame landmark jump therefore never reaches the games). A run of
       rejections is accepted after `maxConsecutiveRejects` frames so a genuine
       fast movement is not blocked. */
    function filterSignals(signals) {
      const rejected = [];
      state.rawWindow.push(signals);
      if (state.rawWindow.length > config.medianWindow) state.rawWindow.shift();
      const out = { shoulderBalance: signals.shoulderBalance, worldAvailable: signals.worldAvailable };
      const window = state.rawWindow;
      SIGNAL_KEYS.forEach(key => {
        const values = window.map(sample => sample[key]).filter(Number.isFinite);
        const value = signals[key];
        if (!values.length) { out[key] = Number.isFinite(value) ? value : null; return; }
        const mid = median(values);
        if (values.length < config.medianMinSamples || !Number.isFinite(value)) {
          out[key] = Number.isFinite(value) ? value : mid;
          return;
        }
        const sep = state.separation ? Math.abs(state.separation[key]) : null;
        const tolerance = Number.isFinite(sep) && sep > 0
          ? sep * config.outlierSpanFactor
          : config.minSeparation[key] * config.outlierSpanFactor * 2;
        if (Math.abs(value - mid) > tolerance && state.rejectRun < config.maxConsecutiveRejects) {
          rejected.push(key);
          out[key] = mid;
          return;
        }
        // Median of the window, not the raw frame: stationary noise cancels
        // while a sustained change passes through within two frames.
        out[key] = mid;
      });
      // Signal B gets the same rolling median treatment, with its own scale.
      const lateralValues = window.map(sample => sample.lateral).filter(Number.isFinite);
      if (lateralValues.length) {
        const lateralMid = median(lateralValues);
        const value = signals.lateral;
        const scale = Number.isFinite(state.arcScale) ? state.arcScale : config.arcMinScale;
        if (Number.isFinite(value)
          && lateralValues.length >= config.medianMinSamples
          && Math.abs(value - lateralMid) > scale * config.outlierSpanFactor
          && state.rejectRun < config.maxConsecutiveRejects) {
          rejected.push('lateral');
          out.lateral = lateralMid;
        } else {
          out.lateral = lateralMid;
        }
      } else {
        out.lateral = Number.isFinite(signals.lateral) ? signals.lateral : null;
      }
      if (rejected.length) {
        state.rejectRun += 1;
        state.rejectedFrames += 1;
      } else {
        state.rejectRun = 0;
      }
      state.rejectedSignals = rejected;
      state.filtered = out;
      return out;
    }

    /* ---- stage 2: stabilise the fused 0..1 progress ----------------------
       Deadband, direction confirmation, adaptive EMA, bounded step and
       endpoint snapping, all expressed relative to the calibrated span so the
       behaviour is participant-specific rather than pixel-based. */
    function stabilizeProgress(instant) {
      const previous = state.progress;
      const diff = instant - previous;
      const magnitude = Math.abs(diff);
      const sign = diff > 0 ? 1 : (diff < 0 ? -1 : 0);

      // Lateral abduction distorts the projected arm, so while the outward arc
      // is out the reach value is frozen at its last stable level. This is
      // checked before endpoint snapping: a projection collapse during the arc
      // must never be mistaken for a return to the flexed endpoint.
      if (state.arcHold) {
        state.holdFrames += 1;
        state.snapRun = 0;
        state.lastAlpha = 0;
        state.lastStep = 0;
        state.stabilizerReason = 'arc-hold';
        return previous;
      }

      // Endpoint snap: sitting at either calibrated endpoint for a couple of
      // frames pins progress exactly to 0 or 1 (no residual shimmer there).
      if (instant <= config.snapLow || instant >= config.snapHigh) {
        state.snapRun += 1;
        if (state.snapRun >= config.snapFrames) {
          state.holdFrames = 0;
          state.direction = 0;
          state.directionRun = 0;
          state.lastAlpha = 1;
          const snapped = instant <= config.snapLow ? 0 : 1;
          state.lastStep = snapped - previous;
          state.stabilizerReason = instant <= config.snapLow ? 'snap-flexed' : 'snap-extended';
          return snapped;
        }
      } else {
        state.snapRun = 0;
      }

      if (sign !== 0 && sign === state.direction) {
        state.directionRun += 1;
      } else if (sign !== 0) {
        // Direction reversal: reset the run, and remember the new direction so
        // a real return movement is followed immediately.
        state.direction = sign;
        state.directionRun = 1;
      }

      // Deadband: movement smaller than a fixed fraction of the calibrated span
      // is treated as landmark noise and the object is held still, unless the
      // same direction has been observed for several frames (slow real drift).
      if (magnitude < config.jitterBand && state.directionRun < config.directionFrames * 2) {
        state.holdFrames += 1;
        state.lastAlpha = 0;
        state.lastStep = 0;
        state.stabilizerReason = 'deadband-hold';
        return previous;
      }
      state.holdFrames = 0;

      // Adaptive EMA: gain grows with the size of the confirmed movement, so
      // smooth extension/flexion tracks closely while noise stays damped.
      let alpha = config.minAlpha
        + (config.maxAlpha - config.minAlpha)
        * clamp01((magnitude - config.jitterBand) / config.alphaSpan);
      if (state.directionRun >= config.directionFrames) {
        alpha = Math.max(alpha, config.reversalAlpha);
        state.stabilizerReason = 'tracking';
      } else {
        state.stabilizerReason = 'confirming';
      }
      let next = previous + alpha * diff;
      // Bounded per-frame movement: an accepted but large jump still cannot
      // teleport the on-screen item across the lane in a single frame.
      const step = next - previous;
      if (Math.abs(step) > config.maxStep) {
        next = previous + Math.sign(step) * config.maxStep;
        state.stabilizerReason = 'step-limited';
      }
      state.lastAlpha = alpha;
      state.lastStep = next - previous;
      return clamp01(next);
    }

    function fuse(signals) {
      const flexed = state.endpoints.flexed;
      const extended = state.endpoints.extended;
      const perSignal = {};
      if (!signals || !flexed || !extended) return { progress: 0, perSignal };
      let weighted = 0;
      let available = 0;
      Object.keys(state.weights).forEach(key => {
        const weight = state.weights[key];
        const value = signals[key];
        const from = flexed[key];
        const to = extended[key];
        if (!Number.isFinite(value) || !Number.isFinite(from) || !Number.isFinite(to)) return;
        const range = to - from;
        if (Math.abs(range) < 1e-6) return;
        // Sign agnostic: dividing by the signed range maps the flexed endpoint
        // to 0 and the extended endpoint to 1 in either direction.
        const p = clamp01((value - from) / range);
        perSignal[key] = p;
        weighted += weight * p;
        available += weight;
      });
      if (available <= 0) return { progress: 0, perSignal };
      const fused = weighted / available;
      // Dead zone around the flexed endpoint absorbs landmark jitter without
      // pushing the extended endpoint below 1.
      const dz = config.deadZone;
      const shaped = fused <= dz ? 0 : (fused - dz) / (1 - dz);
      return { progress: clamp01(shaped), perSignal };
    }

    function applyCandidate(candidate, source) {
      const result = evaluateEndpoints(state.endpoints.flexed, candidate);
      state.separation = result.separation;
      state.lacking = result.lacking;
      if (!result.qualified.length) {
        state.samples = [];
        state.weights = {};
        state.qualified = [];
        state.calibrated = false;
        // Simply resting in the start pose is not a failed attempt: only count
        // one once the participant has actually tried to move away from it.
        if (state.movementSeen || source === 'manual') state.attempts += 1;
        if ((state.movementSeen && state.attempts >= config.attemptsBeforeRetry)
            || source === 'manual') {
          state.stage = 'retry';
          state.retryCount += 1;
          state.reason = source === 'manual'
            ? 'manual-insufficient-separation'
            : 'insufficient-separation';
        } else {
          state.stage = 'capture-extended';
          state.reason = 'awaiting-extension';
        }
        return false;
      }
      state.endpoints.extended = candidate;
      // Signal B baseline: the lateral position of the calibrated extended
      // reach, i.e. where the outward arc starts for mahjong-wash and bus-pay.
      state.arcBaseline = Number.isFinite(candidate.lateral) ? candidate.lateral : null;
      state.arcObservedMax = 0;
      state.arcScale = config.arcMinScale;
      state.arcProgress = 0;
      state.arcInstant = 0;
      state.arcActive = false;
      state.arcHold = false;
      state.arcCalibrated = Number.isFinite(state.arcBaseline);
      state.weights = result.weights;
      state.qualified = result.qualified;
      state.calibrated = true;
      state.stage = 'ready';
      state.reason = source === 'manual' ? 'calibrated-manual' : 'calibrated';
      // The capture itself ends at the extended pose. Never credit that pose as
      // a verification repetition: require a live return to flexed first.
      resetVerification('');
      state.samples = [];
      state.attempts = 0;
      state.captureCount.extended += 1;
      return true;
    }

    /* ---- signal B: lateral arc phase -------------------------------------
       Independent of the reach fusion. The baseline is the lateral position at
       the calibrated extended endpoint; the scale adapts to the excursion the
       participant actually produces, with a clinical floor. The arc only counts
       while extension is adequate (the shared reach gate is open). */
    /* Elbow retention during the lateral arc.
       Joint angle is the primary signal because it remains anatomically local
       when the shoulder abducts. Whole-arm image/world projections can shorten
       sharply at a 45-degree camera even though the elbow is still extended, so
       they are fallbacks only when angle did not separate at calibration. */
    const RETENTION_FALLBACK_KEYS = ['worldSpan', 'spanRatio'];
    function normalizedRetention(key, signals) {
      const flexed = state.endpoints.flexed;
      const extended = state.endpoints.extended;
      const from = flexed && flexed[key];
      const to = extended && extended[key];
      const now = signals && signals[key];
      if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(now)) return null;
      const span = to - from;
      if (Math.abs(span) < 1e-6) return null;
      return clamp01((now - from) / span);
    }
    function angleRetention(signals) {
      const flexed = state.endpoints.flexed;
      const extended = state.endpoints.extended;
      if (!flexed || !extended || !signals) return null;
      if (state.qualified.indexOf('angle') >= 0) {
        return normalizedRetention('angle', signals);
      }
      for (const key of RETENTION_FALLBACK_KEYS) {
        if (state.qualified.indexOf(key) < 0) continue;
        const value = normalizedRetention(key, signals);
        if (Number.isFinite(value)) return value;
      }
      return normalizedRetention('angle', signals);
    }

    function updateArc(signals) {
      const lateral = signals ? signals.lateral : null;
      state.lateral = Number.isFinite(lateral) ? lateral : null;
      if (!Number.isFinite(lateral) || !Number.isFinite(state.arcBaseline)) {
        state.arcInstant = 0;
        state.arcActive = false;
        state.arcHold = false;
        state.arcHoldFrames = 0;
        return;
      }
      // Elbow retention: is the participant still near their own calibrated
      // extended endpoint? Never anatomical full extension.
      state.extensionRetention = angleRetention(signals);
      if (Number.isFinite(state.extensionRetention)) {
        if (state.extensionRetention < config.arcExtensionGate) {
          // Flexor synergy crept back in: pause and reset lateral scoring
          // instead of crediting the arc, and let reach follow the flexion.
          state.arcPaused = true;
          state.arcProgress = 0;
          state.arcActive = false;
          state.arcHold = false;
          state.arcHoldFrames = 0;
          state.arcInstant = 0;
          state.arcReason = 'arc-paused-elbow-flexed';
          return;
        }
        if (state.arcPaused && state.extensionRetention >= config.arcExtensionResume) {
          state.arcPaused = false;
          state.arcReason = 'arc-resumed';
        }
        if (state.arcPaused) {
          state.arcInstant = 0;
          state.arcActive = false;
          state.arcHold = false;
          state.arcReason = 'arc-paused-elbow-flexed';
          return;
        }
      }
      const excursion = lateral - state.arcBaseline;
      state.arcObservedMax = Math.max(state.arcObservedMax, excursion);
      state.arcScale = Math.max(config.arcMinScale, state.arcObservedMax * 0.9);
      state.arcCalibrated = true;
      const instant = clamp01(excursion / state.arcScale);
      state.arcInstant = instant;

      // The arc has its own deadband, adaptive gain and bounded step, so a
      // shaky wrist does not make a circular game jump.
      const diff = instant - state.arcProgress;
      if (Math.abs(diff) < config.arcJitterBand) {
        // hold
      } else {
        const alpha = config.arcAlphaMin
          + (config.arcAlphaMax - config.arcAlphaMin)
          * clamp01((Math.abs(diff) - config.arcJitterBand) / config.alphaSpan);
        let next = state.arcProgress + alpha * diff;
        const step = next - state.arcProgress;
        if (Math.abs(step) > config.arcMaxStep) {
          next = state.arcProgress + Math.sign(step) * config.arcMaxStep;
        }
        state.arcProgress = clamp01(next);
      }
      // Adequate extension gates the arc: the outward path only counts once
      // this cycle has already reached the calibrated extended endpoint, so an
      // outward swing from a flexed elbow never advances a path game.
      const extensionSeen = state.cycleReachSeen || state.reachGate;
      state.arcActive = extensionSeen && state.arcProgress >= config.arcEnter;
      // The reach freeze uses the instantaneous excursion and does not wait for
      // the reach gate: abduction distorts the projected arm immediately, and
      // that distortion must never reach the carried item.
      state.arcReason = state.arcActive ? 'arc-active' : 'arc-idle';
      const holding = state.arcInstant >= config.arcHold;
      if (holding && state.arcHoldFrames < config.arcHoldMaxFrames) {
        state.arcHoldFrames += 1;
        state.arcHold = true;
      } else {
        if (!holding) state.arcHoldFrames = 0;
        state.arcHold = false;
      }
    }

    /* ---- ordered cycle: flex -> extend -> outward arc -> back -> flex ---- */
    function updateCycle() {
      state.cycleComplete = false;
      if (state.progress <= config.returnAt && state.cyclePhase !== 'start') {
        const ordered = state.cycleReachSeen && state.cycleOutSeen && state.cycleReturnSeen;
        if (ordered) {
          state.cycleComplete = true;
          state.cycleCount += 1;
        }
        state.cycleOrdered = ordered;
        state.cyclePhase = 'start';
        state.cycleReachSeen = false;
        state.cycleOutSeen = false;
        state.cycleReturnSeen = false;
        state.arcProgress = 0;
        state.arcInstant = 0;
        state.arcActive = false;
        state.arcHold = false;
        state.arcHoldFrames = 0;
        return;
      }
      if (state.progress <= config.returnAt) {
        state.cyclePhase = 'start';
        return;
      }
      if (state.reachGate) state.cycleReachSeen = true;
      if (state.cycleReachSeen && state.arcProgress >= config.arcEnter) state.cycleOutSeen = true;
      if (state.cycleOutSeen && state.arcProgress <= config.arcExit) state.cycleReturnSeen = true;

      if (!state.cycleReachSeen) state.cyclePhase = 'extending';
      else if (!state.cycleOutSeen) state.cyclePhase = state.reachGate ? 'reached' : 'flexing';
      else if (!state.cycleReturnSeen) state.cyclePhase = 'arc-out';
      else state.cyclePhase = state.progress < config.reachExit ? 'flexing' : 'arc-return';
    }

    function resetVerification(reason) {
      state.preflightPassed = false;
      state.verificationCount = 0;
      state.verificationPhase = 'await-flexed';
      state.verificationFailure = reason || '';
      state.verificationMoved = false;
      state.verificationPeak = state.progress;
      state.verificationTrough = state.progress;
      state.verificationActiveFrames = 0;
    }

    function failVerification(reason) {
      resetVerification(reason);
      state.reason = 'verification-' + reason;
    }

    /* The proof sequence deliberately uses the already calibrated, sign-safe
       0..1 progress. Therefore "extension" is always increasing regardless of
       whether the raw 2D elbow angle rises or falls on this participant's
       camera view. A player must first return from the captured extended pose
       to the captured flexed pose, then complete three full cycles. */
    function updateVerification() {
      if (state.preflightPassed) return;
      const progress = state.progress;
      if (state.verificationPhase === 'await-flexed') {
        // At auto-calibration the stabiliser may still hold its previous zero
        // for one frame while the captured endpoint is already extended. Check
        // the fused instantaneous mapping as well, so that calibration itself
        // can never arm or count a verification cycle.
        if (progress <= config.returnAt && state.instantProgress <= config.returnAt) {
          state.verificationPhase = 'await-extended';
          state.verificationMoved = false;
          state.verificationPeak = progress;
          state.verificationActiveFrames = 0;
          state.reason = 'verification-await-extension';
        }
        return;
      }

      if (state.verificationPhase === 'await-extended') {
        state.verificationPeak = Math.max(state.verificationPeak, progress);
        if (progress >= config.returnAt + config.verificationMotionDelta) {
          state.verificationMoved = true;
          // The therapist has followed the retry instruction and begun a new
          // correctly directed extension; clear the prior retry banner now.
          state.verificationFailure = '';
        }
        if (state.verificationMoved) state.verificationActiveFrames += 1;
        if (state.verificationMoved
          && progress < state.verificationPeak - config.verificationReverseDelta) {
          failVerification('reversed');
          return;
        }
        if (state.verificationMoved
          && state.verificationActiveFrames > config.verificationStallFrames) {
          failVerification('stalled');
          return;
        }
        if (state.reachGate && progress >= config.reachEnter) {
          state.verificationPhase = 'await-flexed-return';
          state.verificationMoved = false;
          state.verificationTrough = progress;
          state.verificationActiveFrames = 0;
          state.reason = 'verification-await-flexion';
        }
        return;
      }

      if (state.verificationPhase === 'await-flexed-return') {
        // Compare against the previous trough before accepting the new sample.
        // Updating the trough first makes `progress <= trough - delta`
        // impossible and would hide a stalled/reversed flexion return.
        const previousTrough = state.verificationTrough;
        if (progress <= previousTrough - config.verificationMotionDelta) {
          state.verificationMoved = true;
        }
        state.verificationTrough = Math.min(previousTrough, progress);
        if (state.verificationMoved) state.verificationActiveFrames += 1;
        if (state.verificationMoved
          && progress > state.verificationTrough + config.verificationReverseDelta) {
          failVerification('reversed');
          return;
        }
        if (state.verificationMoved
          && state.verificationActiveFrames > config.verificationStallFrames) {
          failVerification('stalled');
          return;
        }
        if (state.returnReady && progress <= config.returnAt) {
          state.verificationCount += 1;
          state.verificationMoved = false;
          state.verificationActiveFrames = 0;
          if (state.verificationCount >= config.verificationCycles) {
            state.preflightPassed = true;
            state.verificationPhase = 'complete';
            state.verificationFailure = '';
            state.reason = 'preflight-passed';
          } else {
            state.verificationPhase = 'await-extended';
            state.verificationPeak = progress;
            state.reason = 'verification-await-extension';
          }
        }
      }
    }

    function recognisedState() {
      if (!state.framingReady || !Number.isFinite(state.progress)) return null;
      if (state.progress <= config.returnAt) return '下方起點';
      if (state.progress >= config.completeAt) return '上方終點';
      return '伸肘中';
    }

    function updateGates(signals) {
      const fused = fuse(signals);
      state.signalProgress = fused.perSignal;
      state.instantProgress = fused.progress;

      const hikeBaseline = state.endpoints.flexed ? state.endpoints.flexed.shoulderBalance : null;
      state.shoulderHike = Number.isFinite(hikeBaseline)
        && Number.isFinite(signals.shoulderBalance)
        && (hikeBaseline - signals.shoulderBalance) > config.hikeTolerance;

      // Signal B is evaluated first: it decides whether reach progress must be
      // frozen for this frame.
      updateArc(signals);

      if (state.shoulderHike) {
        state.warning = '患側聳肩 · 請治療師即時糾正';
        state.stabilizerReason = 'shoulder-hike';
      } else {
        state.warning = '';
        state.progress = stabilizeProgress(state.instantProgress);
        if (state.instantProgress === 0 && state.progress <= config.engageExit) {
          state.progress = 0;
        }
        if (state.instantProgress === 1 && state.progress >= config.completeAt) {
          state.progress = 1;
        }
      }

      if (state.progress >= config.engageEnter) {
        state.engageFrames = Math.min(config.engageFrames, state.engageFrames + 1);
      } else if (state.progress <= config.engageExit) {
        state.engageFrames = 0;
      }
      if (!state.engaged && state.engageFrames >= config.engageFrames) state.engaged = true;
      if (state.progress <= config.engageExit) state.engaged = false;

      // Hysteresis: one noisy frame can neither open nor close the reach gate.
      if (state.progress >= config.reachEnter) state.reachGate = true;
      else if (state.progress <= config.reachExit) state.reachGate = false;
      state.returnReady = state.progress <= config.returnAt;
      state.completionReady = state.engaged
        && state.instantProgress >= config.completeAt
        && state.progress >= config.completeAt;
      updateCycle();
      updateVerification();
    }

    function update(input) {
      const side = (input && input.side) === 'left' ? 'left' : 'right';
      const arm = (input && input.arm) || armFromLandmarks(input && input.lm, side);
      const worldArm = (input && input.worldArm)
        || armFromLandmarks(input && input.worldLm, side);
      if (!arm) {
        state.framingReady = false;
        state.shoulderHike = false;
        state.warning = '';
        state.history = [];
        if (!state.calibrated) {
          state.stage = state.endpoints.flexed
            ? (state.stage === 'retry' ? 'retry' : 'capture-extended')
            : 'framing';
          state.reason = 'framing';
        } else {
          // A missing limb must never leave a game interactable. The completed
          // proof remains recorded, but gameReady (snapshot) drops until live
          // tracking is restored; an unfinished proof reports an explicit retry.
          if (!state.preflightPassed) state.verificationFailure = 'tracking-missing';
          state.reason = state.preflightPassed ? 'tracking-missing' : 'verification-tracking-missing';
        }
        return state;
      }
      state.side = side;
      if (input && typeof input.mirrorX === 'boolean') state.mirrorX = input.mirrorX;
      const signals = computeSignals(arm, worldArm, {
        side,
        mirrorX: state.mirrorX !== false,
      });
      if (!signals) {
        state.framingReady = false;
        if (!state.preflightPassed) state.verificationFailure = 'tracking-missing';
        state.reason = state.calibrated ? 'verification-tracking-missing' : 'unstable-landmarks';
        return state;
      }
      state.framingReady = true;
      state.signals = signals;
      state.depthSource = signals.worldAvailable
        ? 'world'
        : (Number.isFinite(signals.depthZ) ? 'image-z' : 'none');
      state.history.push(signals);
      if (state.history.length > config.stabilityWindow) state.history.shift();
      if (!state.calibrated && state.endpoints.flexed && !state.movementSeen) {
        state.movementSeen = SIGNAL_KEYS.some(key => {
          const from = state.endpoints.flexed[key];
          const value = signals[key];
          return Number.isFinite(from) && Number.isFinite(value)
            && Math.abs(value - from) >= config.minSeparation[key] * 0.6;
        });
      }

      if (state.calibrated) {
        // Gates run on the median-filtered signals so a single-frame landmark
        // jump cannot move the on-screen item. Endpoint capture keeps the raw
        // samples, which are already median-reduced across a stable hold.
        updateGates(filterSignals(signals));
        return state;
      }
      // Keep the rolling window warm during capture so the first calibrated
      // frame is already filtered.
      filterSignals(signals);

      // ---- staged capture -------------------------------------------------
      if (!state.endpoints.flexed) {
        state.stage = 'capture-flexed';
        state.reason = isStable() ? 'capturing-flexed' : 'hold-still-flexed';
        if (isStable()) {
          state.samples.push(signals);
          if (state.samples.length > config.maxStableSamples) state.samples.shift();
          if (state.samples.length >= config.minStableSamples) {
            state.endpoints.flexed = medianSample(state.samples);
            state.captureCount.flexed += 1;
            state.samples = [];
            state.stage = 'capture-extended';
            state.reason = 'awaiting-extension';
          }
        }
        state.progress = 0;
        state.instantProgress = 0;
        state.engaged = false;
        state.reachGate = false;
        state.completionReady = false;
        return state;
      }

      if (state.stage !== 'retry') state.stage = 'capture-extended';
      if (isStable()) {
        state.samples.push(signals);
        if (state.samples.length > config.maxStableSamples) state.samples.shift();
        if (state.samples.length >= config.minStableSamples) {
          const candidate = medianSample(state.samples);
          if (applyCandidate(candidate, 'auto')) {
            // The current pose IS the extended endpoint, so progress is known
            // exactly; no smoothing lag at the moment of calibration.
            updateGates(signals);
            state.progress = state.instantProgress;
          }
        }
      }
      if (!state.calibrated) {
        state.progress = 0;
        state.instantProgress = 0;
        state.engaged = false;
        state.reachGate = false;
        state.completionReady = false;
      }
      return state;
    }

    /* ---- compact manual therapist fallback --------------------------------
       Two buttons: mark the current pose as the flexed start, then as the
       extended end. Used when automatic stability detection struggles. */
    function currentCapture() {
      if (state.samples.length) return medianSample(state.samples);
      if (state.history.length) return medianSample(state.history);
      return null;
    }

    function markFlexed() {
      const candidate = currentCapture();
      if (!candidate) {
        state.reason = 'manual-no-pose';
        return state;
      }
      state.endpoints.flexed = candidate;
      state.endpoints.extended = null;
      state.calibrated = false;
      resetVerification('');
      state.weights = {};
      state.qualified = [];
      state.samples = [];
      state.attempts = 0;
      state.manual.flexed = true;
      state.captureCount.flexed += 1;
      state.movementSeen = false;
      state.stage = 'capture-extended';
      state.reason = 'manual-flexed-captured';
      state.progress = 0;
      state.instantProgress = 0;
      state.engaged = false;
      state.reachGate = false;
      state.completionReady = false;
      return state;
    }

    function markExtended() {
      const candidate = currentCapture();
      if (!candidate) {
        state.reason = 'manual-no-pose';
        return state;
      }
      if (!state.endpoints.flexed) {
        state.reason = 'manual-flexed-missing';
        state.stage = 'capture-flexed';
        return state;
      }
      state.manual.extended = true;
      if (applyCandidate(candidate, 'manual') && state.signals) {
        updateGates(state.signals);
        state.progress = state.instantProgress;
      }
      return state;
    }

    function recalibrate() {
      return reset();
    }

    function guidance() {
      if (!state.framingReady) {
        return {
          main: 'iPad 同枱直放 · 約 1 米',
          detail: '患側肩・手肘・手腕全部入鏡',
          en: 'Show shoulder, elbow and wrist',
        };
      }
      if (state.stage === 'retry') {
        const names = state.lacking
          .filter(entry => entry.reason === 'too-similar')
          .map(entry => SIGNAL_LABELS[entry.signal]);
        return {
          main: RETRY_TEXT.main,
          detail: names.length ? RETRY_TEXT.detail + ' · ' + names.join('、') : RETRY_TEXT.detail,
          en: RETRY_TEXT.en,
        };
      }
      if (state.stage === 'capture-flexed' || !state.endpoints.flexed) {
        return {
          main: '保持屈肘起點',
          detail: '手臂放穩不動 · 正在記錄起點',
          en: 'Hold the supported start pose',
        };
      }
      if (!state.calibrated) {
        return {
          main: '慢慢伸直手肘到最遠',
          detail: '到最遠位置停住 · 正在記錄終點',
          en: 'Extend the elbow, then hold',
        };
      }
      if (!state.preflightPassed) {
        if (state.verificationFailure === 'tracking-missing') {
          return {
            main: '追蹤中斷 · 遊戲已鎖定',
            detail: '請讓患側肩、肘、腕重回鏡頭，再由下方起點重試',
            en: 'Tracking missing — game locked; reframe and retry from the lower start',
          };
        }
        if (state.verificationFailure === 'reversed') {
          return {
            main: '次序反轉 · 遊戲已鎖定',
            detail: '請回到下方起點，按「伸肘到上方 → 屈肘回下方」重試',
            en: 'Sequence reversed — return to lower start and retry in order',
          };
        }
        if (state.verificationFailure === 'stalled') {
          return {
            main: '動作停滯 · 遊戲已鎖定',
            detail: '請回到下方起點，以連續伸肘及屈肘重試',
            en: 'Movement stalled — return to lower start and retry continuously',
          };
        }
        if (state.verificationPhase === 'await-flexed') {
          return {
            main: '預檢 0/' + config.verificationCycles + ' · 回到下方起點',
            detail: '準備開始三次「下方 → 上方 → 下方」驗證',
            en: 'Preflight 0/' + config.verificationCycles + ' — return to lower start',
          };
        }
        if (state.verificationPhase === 'await-extended') {
          return {
            main: '預檢 ' + state.verificationCount + '/' + config.verificationCycles + ' · 伸肘到上方終點',
            detail: '保持支撐，進度必須由下方起點向上增加',
            en: 'Extend to upper end — progress must increase from lower start',
          };
        }
        return {
          main: '預檢 ' + state.verificationCount + '/' + config.verificationCycles + ' · 屈肘回下方起點',
          detail: '完成本次後，重複同一順序直至 3/3',
          en: 'Flex back to lower start — repeat the same order until 3/3',
        };
      }
      return {
        main: '預檢完成 · 可開始遊戲',
        detail: '伸肘向上／屈肘向下',
        en: 'Preflight complete — extend up, flex down',
      };
    }

    function separationText() {
      return SIGNAL_KEYS.map(key => {
        const value = state.separation[key];
        const weight = state.weights[key];
        return key + ':' + (Number.isFinite(value) ? value.toFixed(3) : 'na')
          + '/w' + (Number.isFinite(weight) ? weight.toFixed(2) : '0');
      }).join(' ');
    }

    function toText() {
      const signals = state.signals || {};
      const flexed = state.endpoints.flexed || {};
      const extended = state.endpoints.extended || {};
      const raw = SIGNAL_KEYS.map(key => key + ':'
        + (Number.isFinite(signals[key]) ? signals[key].toFixed(3) : 'na')).join(' ');
      const ends = SIGNAL_KEYS.map(key => key + ':'
        + (Number.isFinite(flexed[key]) ? flexed[key].toFixed(3) : 'na') + '>'
        + (Number.isFinite(extended[key]) ? extended[key].toFixed(3) : 'na')).join(' ');
      return [
        'stage:' + state.stage,
        'calibrated:' + state.calibrated,
        'framingReady:' + state.framingReady,
        'gameReady:' + (state.preflightPassed && state.framingReady),
        'preflightPassed:' + state.preflightPassed,
        'verification:' + state.verificationCount + '/' + config.verificationCycles,
        'verificationPhase:' + state.verificationPhase,
        'verificationFailure:' + (state.verificationFailure || 'none'),
        'recognisedState:' + (recognisedState() || 'tracking-missing'),
        'progress:' + state.progress.toFixed(3),
        'instant:' + state.instantProgress.toFixed(3),
        'engaged:' + state.engaged,
        'reachGate:' + state.reachGate,
        'returnReady:' + state.returnReady,
        'completionReady:' + state.completionReady,
        'depthSource:' + state.depthSource,
        'movementSeen:' + state.movementSeen,
        'shoulderHike:' + state.shoulderHike,
        'reason:' + state.reason,
        'retries:' + state.retryCount,
        'manual:' + (state.manual.flexed ? 'F' : '-') + (state.manual.extended ? 'E' : '-'),
        'raw=' + raw,
        'endpoints=' + ends,
        'side:' + state.side,
        'arc:' + state.arcProgress.toFixed(3),
        'arcInstant:' + state.arcInstant.toFixed(3),
        'arcActive:' + state.arcActive,
        'arcHold:' + state.arcHold,
        'arcPaused:' + state.arcPaused,
        'arcReason:' + state.arcReason,
        'retention:' + (Number.isFinite(state.extensionRetention)
          ? state.extensionRetention.toFixed(3) : 'na'),
        'arcBaseline:' + (Number.isFinite(state.arcBaseline) ? state.arcBaseline.toFixed(3) : 'na'),
        'arcScale:' + (Number.isFinite(state.arcScale) ? state.arcScale.toFixed(3) : 'na'),
        'lateral:' + (Number.isFinite(state.lateral) ? state.lateral.toFixed(3) : 'na'),
        'cycle:' + state.cyclePhase,
        'cycleOrdered:' + state.cycleOrdered,
        'cycleCount:' + state.cycleCount,
        'stabilizer:' + state.stabilizerReason,
        'alpha:' + state.lastAlpha.toFixed(2),
        'step:' + state.lastStep.toFixed(3),
        'hold:' + state.holdFrames,
        'dirRun:' + (state.direction > 0 ? '+' : state.direction < 0 ? '-' : '0') + state.directionRun,
        'rejected:' + (state.rejectedSignals.length ? state.rejectedSignals.join('/') : 'none'),
        'rejectedFrames:' + state.rejectedFrames,
        'filtered=' + SIGNAL_KEYS.map(key => key + ':'
          + (state.filtered && Number.isFinite(state.filtered[key])
            ? state.filtered[key].toFixed(3) : 'na')).join(' '),
        'separation=' + separationText(),
        'signalProgress=' + SIGNAL_KEYS.map(key => key + ':'
          + (Number.isFinite(state.signalProgress[key])
            ? state.signalProgress[key].toFixed(3) : 'na')).join(' '),
      ].join(' ');
    }

    return {
      config,
      state,
      reset,
      update,
      markFlexed,
      markExtended,
      recalibrate,
      guidance,
      toText,
      separationText,
      snapshot() {
        return {
          stage: state.stage,
          reason: state.reason,
          calibrated: state.calibrated,
          framingReady: state.framingReady,
          gameReady: state.preflightPassed && state.framingReady,
          preflightPassed: state.preflightPassed,
          verification: {
            required: config.verificationCycles,
            count: state.verificationCount,
            phase: state.verificationPhase,
            failure: state.verificationFailure,
            locked: !(state.preflightPassed && state.framingReady),
          },
          recognisedState: recognisedState(),
          recognizedState: recognisedState(),
          progress: state.progress,
          instantProgress: state.instantProgress,
          engaged: state.engaged,
          reachGate: state.reachGate,
          returnReady: state.returnReady,
          completionReady: state.completionReady,
          shoulderHike: state.shoulderHike,
          warning: state.warning,
          weights: Object.assign({}, state.weights),
          separation: Object.assign({}, state.separation),
          qualified: state.qualified.slice(),
          lacking: state.lacking.map(entry => Object.assign({}, entry)),
          signals: state.signals ? Object.assign({}, state.signals) : null,
          signalProgress: Object.assign({}, state.signalProgress),
          endpoints: {
            flexed: state.endpoints.flexed ? Object.assign({}, state.endpoints.flexed) : null,
            extended: state.endpoints.extended ? Object.assign({}, state.endpoints.extended) : null,
          },
          depthSource: state.depthSource,
          movementSeen: state.movementSeen,
          manual: Object.assign({}, state.manual),
          retryCount: state.retryCount,
          captureCount: Object.assign({}, state.captureCount),
          filtered: state.filtered ? Object.assign({}, state.filtered) : null,
          side: state.side,
          lateral: state.lateral,
          arc: {
            calibrated: state.arcCalibrated,
            baseline: state.arcBaseline,
            scale: state.arcScale,
            instant: state.arcInstant,
            progress: state.arcProgress,
            active: state.arcActive,
            hold: state.arcHold,
            observedMax: state.arcObservedMax,
            paused: state.arcPaused,
            reason: state.arcReason,
            extensionRetention: state.extensionRetention,
          },
          arcProgress: state.arcProgress,
          arcActive: state.arcActive,
          cycle: {
            phase: state.cyclePhase,
            reachSeen: state.cycleReachSeen,
            outSeen: state.cycleOutSeen,
            returnSeen: state.cycleReturnSeen,
            ordered: state.cycleOrdered,
            complete: state.cycleComplete,
            count: state.cycleCount,
          },
          stabilizer: {
            reason: state.stabilizerReason,
            alpha: state.lastAlpha,
            step: state.lastStep,
            holdFrames: state.holdFrames,
            direction: state.direction,
            directionRun: state.directionRun,
            rejected: state.rejectedSignals.slice(),
            rejectedFrames: state.rejectedFrames,
            snapRun: state.snapRun,
          },
        };
      },
    };
  }

  const api = {
    CONFIG,
    SIGNAL_KEYS,
    PRIMARY_KEYS,
    SIGNAL_LABELS,
    RETRY_TEXT,
    createController,
    computeSignals,
    armFromLandmarks,
    jointAngle2D,
    pointUsable,
    median,
    clamp01,
  };

  global.Level4ElbowCalibration = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
