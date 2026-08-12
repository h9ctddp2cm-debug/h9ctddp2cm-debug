export const LEVEL3_PROTOCOL_VERSION = "LEVEL3_BILATERAL_SANDBOX_V3.2";
export const LEVEL3_SOFTWARE_VERSION = "BUILD_2026_8F028F3";

const INTERRUPTION_ACTIONS = new Set(["TRACKING_LOST", "UNKNOWN", "STABILIZING"]);
const WARNING_ACTIONS = new Set([
  "TRUNK_TRANSLATION_WARNING",
  "BILATERAL_ASYMMETRY_WARNING",
]);

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function optionalNumber(value, min, max, fieldName) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new RangeError(`${fieldName} must be between ${min} and ${max}, or blank`);
  }
  return number;
}

function optionalInteger(value, min, max, fieldName) {
  const number = optionalNumber(value, min, max, fieldName);
  if (number !== null && !Number.isInteger(number)) {
    throw new RangeError(`${fieldName} must be a whole number between ${min} and ${max}, or blank`);
  }
  return number;
}

function expectedCondition(sequence, blockPosition) {
  const schedule = {
    AB: ["SINGLE_TASK_BASELINE", "DUAL_TASK_INTERFERENCE"],
    BA: ["DUAL_TASK_INTERFERENCE", "SINGLE_TASK_BASELINE"],
  };
  return schedule[sequence]?.[blockPosition - 1] || null;
}

function normalizeFatigueMeasurements(values = {}) {
  return {
    vas_f_t0_mm: optionalNumber(values.vasFT0Mm, 0, 100, "VAS-F T0"),
    rpe_t0_borg_6_20: optionalNumber(values.rpeT0Borg620, 6, 20, "RPE T0"),
    vas_f_t1_pre_rest_mm: optionalNumber(values.vasFT1PreRestMm, 0, 100, "VAS-F T1 pre-rest"),
    rpe_t1_pre_rest_borg_6_20: optionalNumber(values.rpeT1PreRestBorg620, 6, 20, "RPE T1 pre-rest"),
    vas_f_t1_post_rest_mm: optionalNumber(values.vasFT1PostRestMm, 0, 100, "VAS-F T1 post-rest"),
    rpe_t1_post_rest_borg_6_20: optionalNumber(values.rpeT1PostRestBorg620, 6, 20, "RPE T1 post-rest"),
    vas_f_t2_post_session_mm: optionalNumber(values.vasFT2PostSessionMm, 0, 100, "VAS-F T2 post-session"),
    rpe_t2_post_session_borg_6_20: optionalNumber(
      values.rpeT2PostSessionBorg620,
      6,
      20,
      "RPE T2 post-session",
    ),
  };
}

function defaultCognitiveMetrics(condition) {
  if (condition === "SINGLE_TASK_BASELINE") {
    return {
      stimulus_id: "none_control",
      patient_response_status: "NOT_APPLICABLE",
      is_response_accurate: null,
    };
  }
  return {
    stimulus_id: null,
    patient_response_status: "PENDING",
    is_response_accurate: null,
  };
}

export class Level3BilateralDataCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.sessionActive = false;
    this.sessionStartedAtMs = null;
    this.metadata = null;
    this.repetitions = [];
    this.activeRepetition = null;
    this.pausedAtMs = null;
    this.interruptedAtMs = null;
    this.holdReasons = new Set();
    this.holdStartedAtMs = null;
    this.lastWarningSignature = null;
    this.latestCognitiveMetrics = null;
  }

  startSession(metadata, nowMs = performance.now()) {
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    const participantSequence = String(metadata.participantSequence || "").toUpperCase();
    const blockOrderPosition = Number(metadata.blockOrderPosition);
    const condition = expectedCondition(participantSequence, blockOrderPosition);
    if (!condition) {
      throw new RangeError("participantSequence must be AB or BA and blockOrderPosition must be 1 or 2");
    }
    if (metadata.experimentalCondition !== condition) {
      throw new Error(
        `Condition mismatch: ${participantSequence} block ${blockOrderPosition} must be ${condition}`,
      );
    }
    const cognitiveTier = condition === "SINGLE_TASK_BASELINE"
      ? "NONE_CONTROL"
      : metadata.cognitiveTier;
    if (condition === "DUAL_TASK_INTERFERENCE" && cognitiveTier === "NONE_CONTROL") {
      throw new Error("Dual-task block requires an active cognitive load tier");
    }
    this.reset();
    this.sessionActive = true;
    this.sessionStartedAtMs = nowMs;
    this.metadata = {
      protocol_version: LEVEL3_PROTOCOL_VERSION,
      software_version: LEVEL3_SOFTWARE_VERSION,
      patient_anonymous_id: metadata.patientId,
      clinical_fthue_level: Number(metadata.fthueLevel),
      exploratory_motor_strata: "GROSS_MOTOR_3_4",
      affected_side_physical: metadata.affectedSide,
      participant_sequence: participantSequence,
      block_order_position: blockOrderPosition,
      experimental_condition_block: condition,
      planned_block_duration_minutes: condition === "SINGLE_TASK_BASELINE" ? 5 : 8,
      assigned_cognitive_load_tier: cognitiveTier,
      trial_block_number: blockOrderPosition,
      fatigue_measurements: normalizeFatigueMeasurements(metadata),
      subjective_enjoyment_vams_score: optionalInteger(
        metadata.subjectiveEnjoymentVamsScore,
        1,
        10,
        "Subjective enjoyment score",
      ),
      // Deprecated field name kept for backward compatibility with existing
      // exports/pipeline; the Level 3 task is horizontal sliding, not elevation.
      therapist_selected_target_elevation_deg: Number(metadata.targetElevationDeg),
      therapist_selected_protocol_variant: metadata.protocolVariant ?? null,
      therapist_selected_range_profile: metadata.reachRangeProfile,
      therapist_selected_tolerance_mode: metadata.toleranceMode,
      camera_preprocess_direction_mapping: Number(metadata.patientLeftXSign),
      therapist_notes: metadata.therapistNotes || "",
      planned_adjunct_duration_minutes: 15,
      planned_setup_calibration_minutes: 2,
      session_started_at_iso: new Date().toISOString(),
    };
    this.latestCognitiveMetrics = defaultCognitiveMetrics(condition);
  }

  updateBlockMetadata(metadata = {}) {
    if (!this.metadata) throw new Error("No session metadata is available");
    this.metadata.fatigue_measurements = normalizeFatigueMeasurements(metadata);
    this.metadata.subjective_enjoyment_vams_score = optionalInteger(
      metadata.subjectiveEnjoymentVamsScore,
      1,
      10,
      "Subjective enjoyment score",
    );
    if (typeof metadata.therapistNotes === "string") {
      this.metadata.therapist_notes = metadata.therapistNotes.trim();
    }
    return clone(this.metadata);
  }

  setCognitiveResponse({ stimulusId, responseStatus, isAccurate }) {
    if (!this.metadata || this.metadata.experimental_condition_block === "SINGLE_TASK_BASELINE") {
      this.latestCognitiveMetrics = defaultCognitiveMetrics("SINGLE_TASK_BASELINE");
      return;
    }
    this.latestCognitiveMetrics = {
      stimulus_id: stimulusId || null,
      patient_response_status: responseStatus || "PENDING",
      is_response_accurate: typeof isAccurate === "boolean" ? isAccurate : null,
    };
    if (this.activeRepetition) {
      this.activeRepetition.cognitive_metrics = clone(this.latestCognitiveMetrics);
    }
  }

  beginHold(kind, nowMs) {
    if (!this.sessionActive || !this.activeRepetition) return;
    const key = kind === "pause" ? "pausedAtMs" : "interruptedAtMs";
    if (this[key] !== null) return;
    this[key] = nowMs;
    if (this.holdReasons.size === 0) this.holdStartedAtMs = nowMs;
    this.holdReasons.add(kind);
  }

  endHold(kind, nowMs) {
    if (!this.activeRepetition) return;
    const key = kind === "pause" ? "pausedAtMs" : "interruptedAtMs";
    if (this[key] === null) return;
    this[key] = null;
    this.holdReasons.delete(kind);
    if (this.holdReasons.size === 0 && this.holdStartedAtMs !== null) {
      this.activeRepetition.excluded_duration_ms += Math.max(0, nowMs - this.holdStartedAtMs);
      this.holdStartedAtMs = null;
    }
  }

  pause(nowMs = performance.now()) {
    this.beginHold("pause", nowMs);
  }

  resume(nowMs = performance.now()) {
    this.endHold("pause", nowMs);
  }

  startRepetition(output, nowMs) {
    if (this.activeRepetition) this.invalidateCurrentRepetition("NEW_REPETITION_STARTED", nowMs);
    this.activeRepetition = {
      repetition_index_block_relative: this.repetitions.length + 1,
      target_direction_physical: output.targetDirection,
      movement_time_duration_ms: null,
      return_time_duration_ms: null,
      l3_max_vertical_y_deviation_normalized: 0,
      was_cycle_completed_successfully: false,
      was_manually_invalidated: false,
      failure_reason: null,
      compensation_warnings_count: 0,
      cognitive_metrics: clone(this.latestCognitiveMetrics),
      frame_telemetry_stream: [],
      movement_started_at_ms: nowMs,
      return_started_at_ms: null,
      excluded_duration_ms: 0,
      phase_excluded_checkpoint_ms: 0,
    };
    this.lastWarningSignature = null;
  }

  trackFrameKinematics(output, nowMs, engine) {
    if (!this.activeRepetition || this.pausedAtMs !== null || this.interruptedAtMs !== null) return;
    const metrics = output.metrics;
    if (!metrics || !Number.isFinite(metrics.vcpX) || !Number.isFinite(metrics.vcpY)) return;
    const baselineY = engine.calibrationVcpYMedian;
    const verticalDeviation = Number.isFinite(baselineY) ? Math.abs(metrics.vcpY - baselineY) : 0;
    this.activeRepetition.l3_max_vertical_y_deviation_normalized = Math.max(
      this.activeRepetition.l3_max_vertical_y_deviation_normalized,
      verticalDeviation,
    );
    this.activeRepetition.frame_telemetry_stream.push({
      timestamp_ms: Math.max(0, nowMs - this.sessionStartedAtMs),
      vcp_x_normalized: metrics.vcpX,
      vcp_y_normalized: metrics.vcpY,
      wrist_separation_m: finiteOrNull(metrics.wristSeparation),
      shoulder_midpoint_x_normalized: finiteOrNull(metrics.shoulderCenterX),
    });
  }

  phaseElapsed(startMs, nowMs) {
    if (!this.activeRepetition || !Number.isFinite(startMs)) return null;
    const excluded = this.activeRepetition.excluded_duration_ms
      - this.activeRepetition.phase_excluded_checkpoint_ms;
    return Math.max(0, nowMs - startMs - excluded);
  }

  closeRepetition(nowMs, { successful, failureReason = null } = {}) {
    const rep = this.activeRepetition;
    if (!rep) return null;
    this.endHold("pause", nowMs);
    this.endHold("interruption", nowMs);
    if (rep.return_started_at_ms !== null && rep.return_time_duration_ms === null) {
      rep.return_time_duration_ms = this.phaseElapsed(rep.return_started_at_ms, nowMs);
    }
    rep.was_cycle_completed_successfully = Boolean(successful);
    rep.failure_reason = failureReason;
    delete rep.movement_started_at_ms;
    delete rep.return_started_at_ms;
    delete rep.excluded_duration_ms;
    delete rep.phase_excluded_checkpoint_ms;
    this.repetitions.push(rep);
    this.activeRepetition = null;
    this.lastWarningSignature = null;
    this.holdReasons.clear();
    this.holdStartedAtMs = null;
    this.pausedAtMs = null;
    this.interruptedAtMs = null;
    return rep;
  }

  invalidateCurrentRepetition(reason = "THERAPIST_INVALIDATED", nowMs = performance.now()) {
    if (!this.activeRepetition) return null;
    this.activeRepetition.was_manually_invalidated = true;
    return this.closeRepetition(nowMs, { successful: false, failureReason: reason });
  }

  observe(output, engine, nowMs = output?.timestampMs ?? performance.now()) {
    if (!this.sessionActive || !output || !Number.isFinite(nowMs)) return;
    if (INTERRUPTION_ACTIONS.has(output.action)) {
      this.beginHold("interruption", nowMs);
      return;
    }
    this.endHold("interruption", nowMs);

    if (output.action === "CENTER_READY") this.startRepetition(output, nowMs);
    this.trackFrameKinematics(output, nowMs, engine);

    if (WARNING_ACTIONS.has(output.action) && this.activeRepetition) {
      const signature = output.action;
      if (signature !== this.lastWarningSignature) {
        this.activeRepetition.compensation_warnings_count += 1;
        this.lastWarningSignature = signature;
      }
    } else if (!WARNING_ACTIONS.has(output.action)) {
      this.lastWarningSignature = null;
    }

    if (output.action === "TARGET_REACHED" && this.activeRepetition) {
      this.activeRepetition.movement_time_duration_ms = this.phaseElapsed(
        this.activeRepetition.movement_started_at_ms,
        nowMs,
      );
      this.activeRepetition.return_started_at_ms = nowMs;
      this.activeRepetition.phase_excluded_checkpoint_ms = this.activeRepetition.excluded_duration_ms;
    } else if (output.action === "OBJECT_FADE_OUT" && this.activeRepetition) {
      this.activeRepetition.failure_reason = "WRIST_RELEASE";
      this.activeRepetition.return_started_at_ms = nowMs;
      this.activeRepetition.phase_excluded_checkpoint_ms = this.activeRepetition.excluded_duration_ms;
    } else if (output.action === "SUCCESS_SCORE") {
      this.closeRepetition(nowMs, { successful: true });
    } else if (output.action === "RETURN_AFTER_RELEASE") {
      this.closeRepetition(nowMs, { successful: false, failureReason: "WRIST_RELEASE" });
    }
  }

  calibrationConstants(engine) {
    return {
      calibration_vcp_x_median_normalized: finiteOrNull(engine.calibrationVcpXMedian),
      calibration_vcp_y_median_normalized: finiteOrNull(engine.calibrationVcpYMedian),
      calculated_mad_normalized: finiteOrNull(engine.calibrationVcpMad),
      dynamic_vcp_tolerance_clamped_normalized: finiteOrNull(engine.dynamicVcpTolerance),
      baseline_shoulder_width_normalized: finiteOrNull(engine.baselineShoulderWidth),
      baseline_wrist_separation_m: finiteOrNull(engine.baselineWristSeparation),
    };
  }

  endSession(engine, nowMs = performance.now()) {
    if (this.activeRepetition) this.invalidateCurrentRepetition("SESSION_ENDED_MID_REPETITION", nowMs);
    this.sessionActive = false;
    return this.exportPayload(engine);
  }

  exportPayload(engine) {
    return {
      sandbox_metadata: clone(this.metadata || {}),
      calibration_constants: this.calibrationConstants(engine),
      raw_experimental_repetition_logs: clone(this.repetitions),
    };
  }
}
