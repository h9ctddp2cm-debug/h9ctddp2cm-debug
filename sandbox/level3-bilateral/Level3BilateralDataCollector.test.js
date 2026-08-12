import test from "node:test";
import assert from "node:assert/strict";
import { Level3BilateralDataCollector } from "./Level3BilateralDataCollector.js";

function metadata(condition = "SINGLE_TASK_BASELINE", sequence = "AB", blockPosition = 1) {
  return {
    patientId: "SUBACUTE_PT_001",
    fthueLevel: "3",
    affectedSide: "RIGHT",
    experimentalCondition: condition,
    cognitiveTier: condition === "SINGLE_TASK_BASELINE" ? "NONE_CONTROL" : "HIGH_RUNNING_TOTAL",
    participantSequence: sequence,
    blockOrderPosition: String(blockPosition),
    trialBlockNumber: String(blockPosition),
    therapistNotes: "No identifiers.",
    targetElevationDeg: "45",
    reachRangeProfile: "STANDARD",
    toleranceMode: "STANDARD",
    patientLeftXSign: "1",
    vasFT0Mm: "20",
    rpeT0Borg620: "8",
    vasFT1PreRestMm: "",
    rpeT1PreRestBorg620: "",
    vasFT1PostRestMm: "",
    rpeT1PostRestBorg620: "",
    vasFT2PostSessionMm: "",
    rpeT2PostSessionBorg620: "",
    subjectiveEnjoymentVamsScore: "",
  };
}

function engine() {
  return {
    calibrationVcpXMedian: 0.5,
    calibrationVcpYMedian: 0.7,
    calibrationVcpMad: 0.01,
    dynamicVcpTolerance: 0.03,
    baselineShoulderWidth: 0.25,
    baselineWristSeparation: 0.04,
  };
}

function output(action, nowMs, vcpX = 0.5, vcpY = 0.7) {
  return {
    action,
    timestampMs: nowMs,
    state: action === "CENTER_READY" ? "STATE_WIPING_LATERAL" : "STATE_RETURN_CENTER",
    targetDirection: "LEFT",
    metrics: {
      vcpX,
      vcpY,
      wristSeparation: 0.04,
      shoulderCenterX: 0.5,
    },
  };
}

test("successful repetition keeps movement and return time separate with dense VCP telemetry", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.observe(output("WIPING_LATERAL", 1300, 0.42, 0.73), core, 1300);
  collector.observe(output("TARGET_REACHED", 2000, 0.3, 0.75), core, 2000);
  collector.observe(output("RETURNING_CENTER", 2400, 0.4, 0.72), core, 2400);
  collector.observe(output("SUCCESS_SCORE", 3000), core, 3000);

  const rep = collector.repetitions[0];
  assert.equal(rep.movement_time_duration_ms, 1000);
  assert.equal(rep.return_time_duration_ms, 1000);
  assert.equal(rep.was_cycle_completed_successfully, true);
  assert.equal(rep.repetition_index_block_relative, 1);
  assert.ok(Math.abs(rep.l3_max_vertical_y_deviation_normalized - 0.05) < 1e-9);
  assert.equal("max_vertical_y_deviation_normalized" in rep, false);
  assert.equal(rep.frame_telemetry_stream.length, 5);
  assert.equal(rep.cognitive_metrics.is_response_accurate, null);
});

test("therapist pause and tracking interruption are excluded from phase duration", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.pause(1200);
  collector.resume(1500);
  collector.observe(output("TRACKING_LOST", 1600), core, 1600);
  collector.observe(output("WIPING_LATERAL", 1900), core, 1900);
  collector.observe(output("TARGET_REACHED", 2300), core, 2300);
  collector.observe(output("SUCCESS_SCORE", 3300), core, 3300);

  const rep = collector.repetitions[0];
  assert.equal(rep.movement_time_duration_ms, 700);
  assert.equal(rep.return_time_duration_ms, 1000);
});

test("wrist release closes an unsuccessful repetition without fabricating movement time", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata("DUAL_TASK_INTERFERENCE", "AB", 2), 0);
  collector.setCognitiveResponse({
    stimulusId: "tally_update_04",
    responseStatus: "SUBMITTED",
    isAccurate: false,
  });
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.observe(output("OBJECT_FADE_OUT", 1600), core, 1600);
  collector.observe(output("RETURN_AFTER_RELEASE", 2400), core, 2400);

  const rep = collector.repetitions[0];
  assert.equal(rep.movement_time_duration_ms, null);
  assert.equal(rep.return_time_duration_ms, 800);
  assert.equal(rep.was_cycle_completed_successfully, false);
  assert.equal(rep.failure_reason, "WRIST_RELEASE");
  assert.equal(rep.cognitive_metrics.is_response_accurate, false);
});

test("warning clips are counted once until the signal returns to a non-warning action", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.observe(output("TRUNK_TRANSLATION_WARNING", 1100), core, 1100);
  collector.observe(output("TRUNK_TRANSLATION_WARNING", 1500), core, 1500);
  collector.observe(output("WIPING_LATERAL", 1600), core, 1600);
  collector.observe(output("TRUNK_TRANSLATION_WARNING", 1700), core, 1700);
  collector.invalidateCurrentRepetition("TEST_END", 1800);
  assert.equal(collector.repetitions[0].compensation_warnings_count, 2);
});

test("manual invalidation is retained and export contains raw constants without DTC fields", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.invalidateCurrentRepetition("THERAPIST_INVALIDATED", 1500);
  const payload = collector.endSession(core, 2000);

  assert.equal(payload.raw_experimental_repetition_logs[0].was_manually_invalidated, true);
  assert.equal(payload.raw_experimental_repetition_logs[0].failure_reason, "THERAPIST_INVALIDATED");
  assert.equal(payload.calibration_constants.baseline_wrist_separation_m, 0.04);
  assert.equal("derived_calculations" in payload, false);
  assert.equal(payload.sandbox_metadata.planned_adjunct_duration_minutes, 15);
  assert.equal(payload.sandbox_metadata.participant_sequence, "AB");
  assert.equal(payload.sandbox_metadata.block_order_position, 1);
  assert.equal(payload.sandbox_metadata.planned_block_duration_minutes, 5);
  assert.equal(payload.sandbox_metadata.fatigue_measurements.vas_f_t0_mm, 20);
});

test("overlapping therapist pause and tracking loss are excluded only once", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.observe(output("CENTER_READY", 1000), core, 1000);
  collector.pause(1200);
  collector.observe(output("TRACKING_LOST", 1300), core, 1300);
  collector.resume(1500);
  collector.observe(output("WIPING_LATERAL", 1700), core, 1700);
  collector.observe(output("TARGET_REACHED", 2000), core, 2000);
  collector.observe(output("SUCCESS_SCORE", 3000), core, 3000);
  assert.equal(collector.repetitions[0].movement_time_duration_ms, 500);
});

test("sequence and block position reject a mismatched condition", () => {
  const collector = new Level3BilateralDataCollector();
  assert.throws(
    () => collector.startSession(metadata("DUAL_TASK_INTERFERENCE", "AB", 1), 0),
    /Condition mismatch/,
  );
});

test("fatigue metadata can be completed at session end without frontend aggregation", () => {
  const collector = new Level3BilateralDataCollector();
  const core = engine();
  collector.startSession(metadata(), 0);
  collector.updateBlockMetadata({
    therapistNotes: "First block completed.",
    vasFT0Mm: "20",
    rpeT0Borg620: "8",
    vasFT1PreRestMm: "38",
    rpeT1PreRestBorg620: "11",
    vasFT1PostRestMm: "",
    rpeT1PostRestBorg620: "",
    vasFT2PostSessionMm: "",
    rpeT2PostSessionBorg620: "",
    subjectiveEnjoymentVamsScore: 8,
  });
  const payload = collector.endSession(core, 5000);
  assert.equal(payload.sandbox_metadata.fatigue_measurements.vas_f_t1_pre_rest_mm, 38);
  assert.equal(payload.sandbox_metadata.fatigue_measurements.rpe_t1_pre_rest_borg_6_20, 11);
  assert.equal(payload.sandbox_metadata.fatigue_measurements.vas_f_t1_post_rest_mm, null);
  assert.equal(payload.sandbox_metadata.subjective_enjoyment_vams_score, 8);
  assert.equal("metrics_summary" in payload, false);
});

test("fatigue values outside the instrument range fail safely", () => {
  const collector = new Level3BilateralDataCollector();
  assert.throws(
    () => collector.startSession({ ...metadata(), vasFT0Mm: "101" }, 0),
    /VAS-F T0/,
  );
});

test("subjective enjoyment score must be an integer-like value within 1 to 10", () => {
  const collector = new Level3BilateralDataCollector();
  assert.throws(
    () => collector.startSession({ ...metadata(), subjectiveEnjoymentVamsScore: 11 }, 0),
    /Subjective enjoyment score/,
  );
});


/* P0 clinical safety review: neutral protocol label with backward-compatible
   legacy metadata for the deprecated "target elevation" field. */
test("protocol variant is exported alongside the backward-compatible legacy field", () => {
  const collector = new Level3BilateralDataCollector();
  collector.startSession({ ...metadata(), protocolVariant: "B" }, 0);
  const payload = collector.exportPayload(engine());
  assert.equal(payload.sandbox_metadata.therapist_selected_protocol_variant, "B");
  assert.equal(payload.sandbox_metadata.therapist_selected_target_elevation_deg, 45);
});

test("sessions without a protocol variant still export legacy metadata", () => {
  const collector = new Level3BilateralDataCollector();
  collector.startSession(metadata(), 0);
  const payload = collector.exportPayload(engine());
  assert.equal(payload.sandbox_metadata.therapist_selected_protocol_variant, null);
  assert.equal(payload.sandbox_metadata.therapist_selected_target_elevation_deg, 45);
});
