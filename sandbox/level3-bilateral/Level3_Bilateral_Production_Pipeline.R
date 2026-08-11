#!/usr/bin/env Rscript

# Level 3 bilateral sandbox: block-level ingestion and exploratory analysis.
# Requires only jsonlite. The browser remains the raw-data source of truth;
# all summaries and directional DTC calculations are performed offline here.

if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Package 'jsonlite' is required. Install it with install.packages('jsonlite').")
}

args <- commandArgs(trailingOnly = TRUE)
export_dir <- if (length(args) > 0 && !startsWith(args[[1]], "--")) {
  args[[1]]
} else {
  "sandbox_block_exports"
}
generate_synthetic <- "--generate-synthetic" %in% args
force_synthetic <- "--force-synthetic" %in% args
run_edge_case_tests <- "--run-edge-case-tests" %in% args

seed_from_commit <- strtoi("8f028f3", base = 16L)
set.seed(seed_from_commit)

condition_for <- function(sequence_code, block_position) {
  schedule <- list(
    AB = c("SINGLE_TASK_BASELINE", "DUAL_TASK_INTERFERENCE"),
    BA = c("DUAL_TASK_INTERFERENCE", "SINGLE_TASK_BASELINE")
  )
  if (!sequence_code %in% names(schedule) || !block_position %in% c(1, 2)) {
    return(NA_character_)
  }
  schedule[[sequence_code]][[block_position]]
}

finite_number <- function(value, fallback = NA_real_) {
  candidate <- suppressWarnings(as.numeric(value))
  if (length(candidate) == 1 && is.finite(candidate)) candidate else fallback
}

nullable_number <- function(value) {
  candidate <- finite_number(value)
  if (is.finite(candidate)) candidate else NULL
}

make_frame_stream <- function(rep_index, movement_ms, baseline_y, drift) {
  fractions <- c(0, 0.25, 0.5, 0.75, 1)
  lapply(seq_along(fractions), function(i) {
    fraction <- fractions[[i]]
    list(
      timestamp_ms = round((rep_index - 1) * 5000 + fraction * movement_ms),
      vcp_x_normalized = round(0.5142 - 0.21 * fraction, 4),
      vcp_y_normalized = round(baseline_y + drift * sin(pi * fraction), 4),
      wrist_separation_m = round(0.041 + 0.001 * sin(rep_index + fraction), 4),
      shoulder_midpoint_x_normalized = round(0.500 + 0.004 * sin(rep_index), 4)
    )
  })
}

make_synthetic_block <- function(patient_index, sequence_code, block_position) {
  condition <- condition_for(sequence_code, block_position)
  is_dual <- identical(condition, "DUAL_TASK_INTERFERENCE")
  patient_id <- sprintf("PT_%02d", patient_index)
  base_mt <- 1300 + patient_index * 55
  dual_cost <- if (patient_index == 10) 0 else 280 + (patient_index %% 4) * 45
  planned_minutes <- if (is_dual) 8 else 5
  n_reps <- 8

  repetitions <- lapply(seq_len(n_reps), function(rep_index) {
    late_increment <- if (is_dual && rep_index > 5) 110 + 10 * patient_index else 0
    movement_ms <- base_mt + (if (is_dual) dual_cost else 0) + late_increment
    # Deliberate tied values and one zero paired difference exercise safe statistics.
    movement_ms <- movement_ms + c(0, 40, 40, 80, 120, 120, 160, 200)[[rep_index]]
    drift <- 0.018 + patient_index * 0.0008 + if (is_dual) 0.018 else 0
    success <- !(rep_index == 7 && patient_index %% 4 == 0)
    warning_count <- if (is_dual && rep_index %in% c(4, 7)) 1 else 0
    cognitive_correct <- if (is_dual) (rep_index %% 5 != 0) else NULL

    list(
      repetition_index_block_relative = rep_index,
      target_direction_physical = if (rep_index %% 2 == 1) "LEFT" else "RIGHT",
      movement_time_duration_ms = if (success) movement_ms else NULL,
      return_time_duration_ms = if (success) round(movement_ms * 0.78) else 900,
      l3_max_vertical_y_deviation_normalized = if (success) round(drift + rep_index * 0.0006, 4) else NULL,
      was_cycle_completed_successfully = success,
      was_manually_invalidated = FALSE,
      failure_reason = if (success) NULL else "WRIST_RELEASE",
      compensation_warnings_count = warning_count,
      cognitive_metrics = list(
        stimulus_id = if (is_dual) sprintf("tally_update_%02d", rep_index) else sprintf("none_control_rep%d", rep_index),
        patient_response_status = if (is_dual) "SUBMITTED" else "NOT_APPLICABLE",
        is_response_accurate = cognitive_correct
      ),
      frame_telemetry_stream = make_frame_stream(rep_index, movement_ms, 0.6841, drift)
    )
  })

  list(
    sandbox_metadata = list(
      protocol_version = "LEVEL3_BILATERAL_SANDBOX_V3.2",
      software_version = "BUILD_2026_8F028F3",
      patient_anonymous_id = patient_id,
      clinical_fthue_level = if (patient_index %% 2 == 0) 4 else 3,
      exploratory_motor_strata = "GROSS_MOTOR_3_4",
      affected_side_physical = if (patient_index %% 2 == 0) "LEFT" else "RIGHT",
      participant_sequence = sequence_code,
      block_order_position = block_position,
      experimental_condition_block = condition,
      planned_block_duration_minutes = planned_minutes,
      assigned_cognitive_load_tier = if (is_dual) "HIGH_RUNNING_TOTAL" else "NONE_CONTROL",
      trial_block_number = block_position,
      subjective_enjoyment_vams_score = if (block_position == 2) 6 + patient_index %% 5 else NULL,
      fatigue_measurements = list(
        vas_f_t0_mm = 18 + patient_index,
        rpe_t0_borg_6_20 = 8,
        vas_f_t1_pre_rest_mm = if (block_position == 1) 30 + patient_index else NULL,
        rpe_t1_pre_rest_borg_6_20 = if (block_position == 1) 11 else NULL,
        vas_f_t1_post_rest_mm = if (block_position == 2) 22 + patient_index else NULL,
        rpe_t1_post_rest_borg_6_20 = if (block_position == 2) 9 else NULL,
        vas_f_t2_post_session_mm = if (block_position == 2) 42 + patient_index else NULL,
        rpe_t2_post_session_borg_6_20 = if (block_position == 2) 13 else NULL
      ),
      therapist_notes = "Synthetic pipeline validation only."
    ),
    calibration_constants = list(
      calibration_vcp_x_median_normalized = 0.5142,
      calibration_vcp_y_median_normalized = 0.6841,
      calculated_mad_normalized = 0.0145,
      dynamic_vcp_tolerance_clamped_normalized = 0.0508,
      baseline_shoulder_width_normalized = 0.2641,
      baseline_wrist_separation_m = 0.0412
    ),
    raw_experimental_repetition_logs = repetitions
  )
}

write_json_block <- function(payload, path) {
  jsonlite::write_json(
    payload,
    path,
    auto_unbox = TRUE,
    pretty = TRUE,
    null = "null",
    na = "null",
    digits = NA
  )
}

generate_synthetic_exports <- function(directory, force = FALSE) {
  dir.create(directory, recursive = TRUE, showWarnings = FALSE)
  existing <- list.files(directory, pattern = "\\.json$", full.names = TRUE)
  if (length(existing) > 0 && !force) {
    stop("Synthetic generation refused: target directory already contains JSON files. Use --force-synthetic only for disposable test data.")
  }
  if (force && length(existing) > 0) unlink(existing)

  for (patient_index in seq_len(10)) {
    sequence_code <- if (patient_index %% 2 == 1) "AB" else "BA"
    for (block_position in c(1, 2)) {
      payload <- make_synthetic_block(patient_index, sequence_code, block_position)
      condition_code <- if (payload$sandbox_metadata$experimental_condition_block == "SINGLE_TASK_BASELINE") "ST" else "DT"
      filename <- sprintf("PT_%02d_B%d_%s.json", patient_index, block_position, condition_code)
      write_json_block(payload, file.path(directory, filename))
    }
  }

  orphan <- make_synthetic_block(99, "AB", 1)
  orphan$sandbox_metadata$patient_anonymous_id <- "PT_ORPHAN"
  write_json_block(orphan, file.path(directory, "PT_ORPHAN_B1_ST.json"))
  message("Generated 20 paired block files plus one deliberate orphan file in: ", directory)
}

read_block_file <- function(path) {
  tryCatch(
    jsonlite::fromJSON(path, simplifyVector = FALSE),
    error = function(error) {
      warning(sprintf("Skipping malformed JSON '%s': %s", basename(path), error$message), call. = FALSE)
      NULL
    }
  )
}

repetitions_to_data_frame <- function(block) {
  reps <- block$raw_experimental_repetition_logs
  if (is.null(reps) || !is.list(reps) || length(reps) == 0) return(data.frame())
  rows <- lapply(reps, function(rep) {
    cognitive_value <- rep$cognitive_metrics$is_response_accurate
    data.frame(
      repetition_index_block_relative = finite_number(rep$repetition_index_block_relative),
      movement_time_duration_ms = finite_number(rep$movement_time_duration_ms),
      return_time_duration_ms = finite_number(rep$return_time_duration_ms),
      l3_max_vertical_y_deviation_normalized = finite_number(rep$l3_max_vertical_y_deviation_normalized),
      was_cycle_completed_successfully = isTRUE(rep$was_cycle_completed_successfully),
      compensation_warnings_count = max(0, finite_number(rep$compensation_warnings_count, 0)),
      cognitive_accuracy = if (is.null(cognitive_value)) NA else isTRUE(cognitive_value),
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, rows)
}

validate_block_identity <- function(block, path) {
  metadata <- block$sandbox_metadata
  if (is.null(metadata)) {
    warning(sprintf("Skipping '%s': sandbox_metadata is absent.", basename(path)), call. = FALSE)
    return(FALSE)
  }
  patient_id <- metadata$patient_anonymous_id
  condition <- metadata$experimental_condition_block
  sequence_code <- metadata$participant_sequence
  block_position <- finite_number(metadata$block_order_position)
  expected <- condition_for(sequence_code, block_position)
  valid <- is.character(patient_id) && nzchar(patient_id) &&
    condition %in% c("SINGLE_TASK_BASELINE", "DUAL_TASK_INTERFERENCE") &&
    identical(condition, expected)
  if (!valid) {
    warning(sprintf("Skipping '%s': patient, sequence, position, or condition is inconsistent.", basename(path)), call. = FALSE)
  }
  valid
}

safe_ratio_percent <- function(numerator, denominator) {
  if (!is.finite(numerator) || !is.finite(denominator) || denominator == 0) return(NA_real_)
  numerator / denominator * 100
}

parse_and_link_blocks <- function(directory) {
  files <- sort(list.files(directory, pattern = "\\.json$", full.names = TRUE))
  if (length(files) == 0) stop("No JSON block exports found in: ", directory)

  blocks <- list()
  for (path in files) {
    block <- read_block_file(path)
    if (!is.null(block) && validate_block_identity(block, path)) {
      blocks[[length(blocks) + 1]] <- list(path = path, payload = block)
    }
  }
  if (length(blocks) == 0) return(data.frame())

  patient_ids <- unique(vapply(blocks, function(item) item$payload$sandbox_metadata$patient_anonymous_id, character(1)))
  patient_rows <- list()

  for (patient_id in sort(patient_ids)) {
    patient_blocks <- Filter(
      function(item) identical(item$payload$sandbox_metadata$patient_anonymous_id, patient_id),
      blocks
    )
    st_items <- Filter(
      function(item) identical(item$payload$sandbox_metadata$experimental_condition_block, "SINGLE_TASK_BASELINE"),
      patient_blocks
    )
    dt_items <- Filter(
      function(item) identical(item$payload$sandbox_metadata$experimental_condition_block, "DUAL_TASK_INTERFERENCE"),
      patient_blocks
    )
    if (length(st_items) != 1 || length(dt_items) != 1) {
      warning(sprintf("Skipping patient %s: expected exactly one ST and one DT block.", patient_id), call. = FALSE)
      next
    }

    st_block <- st_items[[1]]$payload
    dt_block <- dt_items[[1]]$payload
    st_meta <- st_block$sandbox_metadata
    dt_meta <- dt_block$sandbox_metadata
    if (!identical(st_meta$participant_sequence, dt_meta$participant_sequence)) {
      warning(sprintf("Skipping patient %s: sequence differs across blocks.", patient_id), call. = FALSE)
      next
    }

    st_reps <- repetitions_to_data_frame(st_block)
    dt_reps <- repetitions_to_data_frame(dt_block)
    if (nrow(st_reps) == 0 || nrow(dt_reps) == 0) {
      warning(sprintf("Skipping patient %s: a block has no repetition records.", patient_id), call. = FALSE)
      next
    }

    st_valid <- st_reps[
      st_reps$was_cycle_completed_successfully &
        is.finite(st_reps$repetition_index_block_relative) &
        is.finite(st_reps$movement_time_duration_ms) &
        is.finite(st_reps$l3_max_vertical_y_deviation_normalized),
      ,
      drop = FALSE
    ]
    dt_valid <- dt_reps[
      dt_reps$was_cycle_completed_successfully &
        is.finite(dt_reps$repetition_index_block_relative) &
        is.finite(dt_reps$movement_time_duration_ms) &
        is.finite(dt_reps$l3_max_vertical_y_deviation_normalized),
      ,
      drop = FALSE
    ]
    st_valid <- st_valid[order(st_valid$repetition_index_block_relative), , drop = FALSE]
    dt_valid <- dt_valid[order(dt_valid$repetition_index_block_relative), , drop = FALSE]
    if (nrow(st_valid) < 5 || nrow(dt_valid) < 5) {
      warning(sprintf("Skipping patient %s: fewer than 5 valid successful repetitions in ST or DT.", patient_id), call. = FALSE)
      next
    }

    st_early <- head(st_valid, 5)
    dt_early <- head(dt_valid, 5)
    dt_late <- tail(dt_valid, 5)
    st_planned_minutes <- finite_number(st_meta$planned_block_duration_minutes)
    dt_planned_minutes <- finite_number(dt_meta$planned_block_duration_minutes)
    if (!is.finite(st_planned_minutes) || st_planned_minutes <= 0 ||
        !is.finite(dt_planned_minutes) || dt_planned_minutes <= 0) {
      warning(sprintf("Skipping patient %s: planned block duration is invalid.", patient_id), call. = FALSE)
      next
    }

    st_warnings <- sum(st_reps$compensation_warnings_count, na.rm = TRUE)
    dt_warnings <- sum(dt_reps$compensation_warnings_count, na.rm = TRUE)
    st_observed_minutes <- sum(
      st_reps$movement_time_duration_ms + st_reps$return_time_duration_ms,
      na.rm = TRUE
    ) / 60000
    dt_observed_minutes <- sum(
      dt_reps$movement_time_duration_ms + dt_reps$return_time_duration_ms,
      na.rm = TRUE
    ) / 60000
    dt_cognitive <- dt_reps$cognitive_accuracy[!is.na(dt_reps$cognitive_accuracy)]
    dt_accuracy <- if (length(dt_cognitive) > 0) mean(dt_cognitive) * 100 else NA_real_
    st_fatigue <- st_meta$fatigue_measurements
    dt_fatigue <- dt_meta$fatigue_measurements

    patient_rows[[length(patient_rows) + 1]] <- data.frame(
      patient_id = patient_id,
      fthue_level = finite_number(st_meta$clinical_fthue_level),
      motor_strata = as.character(st_meta$exploratory_motor_strata),
      random_sequence = as.character(st_meta$participant_sequence),
      mt_st_early = median(st_early$movement_time_duration_ms),
      mt_dt_early = median(dt_early$movement_time_duration_ms),
      mt_dt_late = median(dt_late$movement_time_duration_ms),
      drift_y_st_early = median(st_early$l3_max_vertical_y_deviation_normalized),
      drift_y_dt_early = median(dt_early$l3_max_vertical_y_deviation_normalized),
      warning_density_st_per_planned_minute = st_warnings / st_planned_minutes,
      warning_density_dt_per_planned_minute = dt_warnings / dt_planned_minutes,
      warning_density_st_per_observed_active_minute = if (st_observed_minutes > 0) st_warnings / st_observed_minutes else NA_real_,
      warning_density_dt_per_observed_active_minute = if (dt_observed_minutes > 0) dt_warnings / dt_observed_minutes else NA_real_,
      failure_rate_st_pct = mean(!st_reps$was_cycle_completed_successfully) * 100,
      failure_rate_dt_pct = mean(!dt_reps$was_cycle_completed_successfully) * 100,
      cognitive_accuracy_dt_pct = dt_accuracy,
      subjective_enjoyment_vams_score = finite_number(
        dt_meta$subjective_enjoyment_vams_score,
        finite_number(st_meta$subjective_enjoyment_vams_score)
      ),
      vas_f_t0_mm = finite_number(st_fatigue$vas_f_t0_mm, finite_number(dt_fatigue$vas_f_t0_mm)),
      vas_f_t1_pre_rest_mm = finite_number(st_fatigue$vas_f_t1_pre_rest_mm, finite_number(dt_fatigue$vas_f_t1_pre_rest_mm)),
      vas_f_t1_post_rest_mm = finite_number(st_fatigue$vas_f_t1_post_rest_mm, finite_number(dt_fatigue$vas_f_t1_post_rest_mm)),
      vas_f_t2_post_session_mm = finite_number(dt_fatigue$vas_f_t2_post_session_mm, finite_number(st_fatigue$vas_f_t2_post_session_mm)),
      stringsAsFactors = FALSE
    )
  }

  if (length(patient_rows) == 0) return(data.frame())
  analysis <- do.call(rbind, patient_rows)
  analysis$movement_time_dtc_pct <- mapply(
    function(st, dt) safe_ratio_percent(dt - st, st),
    analysis$mt_st_early,
    analysis$mt_dt_early
  )
  analysis$path_kinematics_dtc_pct <- mapply(
    function(st, dt) safe_ratio_percent(dt - st, st),
    analysis$drift_y_st_early,
    analysis$drift_y_dt_early
  )
  analysis$dt_late_vs_early_mt_change_pct <- mapply(
    function(early, late) safe_ratio_percent(late - early, early),
    analysis$mt_dt_early,
    analysis$mt_dt_late
  )
  analysis
}

complete_pair <- function(x, y) {
  keep <- is.finite(x) & is.finite(y)
  list(x = as.numeric(x[keep]), y = as.numeric(y[keep]))
}

safe_paired_wilcoxon <- function(x, y) {
  pair <- complete_pair(x, y)
  if (length(pair$x) < 2) {
    return(list(n = length(pair$x), statistic = NA_real_, p.value = NA_real_, note = "fewer than 2 complete pairs"))
  }
  differences <- pair$y - pair$x
  if (all(differences == 0)) {
    return(list(n = length(pair$x), statistic = 0, p.value = 1, note = "all paired differences are zero"))
  }
  result <- suppressWarnings(wilcox.test(
    pair$x,
    pair$y,
    paired = TRUE,
    exact = FALSE,
    correct = TRUE,
    conf.int = FALSE
  ))
  list(
    n = length(pair$x),
    statistic = unname(result$statistic),
    p.value = result$p.value,
    note = "asymptotic normal approximation with continuity correction"
  )
}

matched_pairs_rank_biserial <- function(x, y) {
  pair <- complete_pair(x, y)
  differences <- pair$y - pair$x
  differences <- differences[differences != 0]
  if (length(differences) == 0) return(0)
  ranks <- rank(abs(differences), ties.method = "average")
  w_positive <- sum(ranks[differences > 0])
  w_negative <- sum(ranks[differences < 0])
  (w_positive - w_negative) / (w_positive + w_negative)
}

bootstrap_statistic_ci <- function(x, y, statistic, replicates = 2000, seed = seed_from_commit) {
  pair <- complete_pair(x, y)
  n <- length(pair$x)
  if (n < 2) return(c(lower = NA_real_, upper = NA_real_))
  set.seed(seed)
  estimates <- replicate(replicates, {
    indices <- sample.int(n, n, replace = TRUE)
    statistic(pair$x[indices], pair$y[indices])
  })
  estimates <- estimates[is.finite(estimates)]
  if (length(estimates) == 0) return(c(lower = NA_real_, upper = NA_real_))
  setNames(
    as.numeric(quantile(estimates, c(0.025, 0.975), names = FALSE)),
    c("lower", "upper")
  )
}

median_paired_difference <- function(x, y) {
  pair <- complete_pair(x, y)
  if (length(pair$x) == 0) return(NA_real_)
  median(pair$y - pair$x)
}

median_iqr <- function(value) {
  value <- value[is.finite(value)]
  if (length(value) == 0) return("NA")
  sprintf("%.3f [IQR %.3f–%.3f]", median(value), quantile(value, 0.25), quantile(value, 0.75))
}

run_internal_edge_case_checks <- function() {
  zero_test <- safe_paired_wilcoxon(c(100, 100, 100), c(100, 100, 100))
  stopifnot(identical(zero_test$p.value, 1))
  stopifnot(identical(matched_pairs_rank_biserial(c(1, 2, 3), c(1, 2, 3)), 0))

  tied_rrb <- matched_pairs_rank_biserial(
    c(100, 100, 100, 100),
    c(110, 110, 90, 100)
  )
  stopifnot(is.finite(tied_rrb), tied_rrb >= -1, tied_rrb <= 1)
  stopifnot(is.na(safe_ratio_percent(1, 0)))

  edge_directory <- tempfile("level3-edge-cases-")
  dir.create(edge_directory, recursive = TRUE)
  on.exit(unlink(edge_directory, recursive = TRUE), add = TRUE)

  short_st <- make_synthetic_block(51, "AB", 1)
  short_dt <- make_synthetic_block(51, "AB", 2)
  short_dt$raw_experimental_repetition_logs <- head(
    short_dt$raw_experimental_repetition_logs,
    4
  )
  write_json_block(short_st, file.path(edge_directory, "PT_51_B1_ST.json"))
  write_json_block(short_dt, file.path(edge_directory, "PT_51_B2_DT.json"))

  orphan <- make_synthetic_block(52, "AB", 1)
  write_json_block(orphan, file.path(edge_directory, "PT_52_B1_ST.json"))

  linked <- suppressWarnings(parse_and_link_blocks(edge_directory))
  stopifnot(nrow(linked) == 0)
  message("Internal edge-case checks passed: zero differences, ties, zero denominator, missing block, and fewer than 5 valid repetitions.")
}

if (run_edge_case_tests) run_internal_edge_case_checks()
if (generate_synthetic) generate_synthetic_exports(export_dir, force = force_synthetic)
dir.create(export_dir, recursive = TRUE, showWarnings = FALSE)
analysis_db <- parse_and_link_blocks(export_dir)

analysis_csv <- file.path(export_dir, "analysis_linked_participants.csv")
summary_path <- file.path(export_dir, "analysis_summary.txt")
write.csv(analysis_db, analysis_csv, row.names = FALSE, na = "")

report_lines <- character()
emit <- function(format_string = "", ...) {
  line <- sprintf(format_string, ...)
  cat(line, "\n", sep = "")
  report_lines <<- c(report_lines, line)
}

emit("==========================================================================")
emit(" Level 3 Bilateral Sandbox: Block-Linkage Statistical HUD")
emit("==========================================================================")
emit("Valid linked participant pairs: %d", nrow(analysis_db))

if (nrow(analysis_db) >= 2) {
  mt_test <- safe_paired_wilcoxon(analysis_db$mt_st_early, analysis_db$mt_dt_early)
  mt_rrb <- matched_pairs_rank_biserial(analysis_db$mt_st_early, analysis_db$mt_dt_early)
  mt_rrb_ci <- bootstrap_statistic_ci(
    analysis_db$mt_st_early,
    analysis_db$mt_dt_early,
    matched_pairs_rank_biserial
  )
  mt_difference_ci <- bootstrap_statistic_ci(
    analysis_db$mt_st_early,
    analysis_db$mt_dt_early,
    median_paired_difference
  )

  emit("")
  emit("[Primary paired contrast: ST early vs DT early]")
  emit("ST early MT: %s ms", median_iqr(analysis_db$mt_st_early))
  emit("DT early MT: %s ms", median_iqr(analysis_db$mt_dt_early))
  emit("Median paired MT difference: %.3f ms (bootstrap 95%% CI %.3f to %.3f)",
       median_paired_difference(analysis_db$mt_st_early, analysis_db$mt_dt_early),
       mt_difference_ci[["lower"]], mt_difference_ci[["upper"]])
  emit("Asymptotic paired Wilcoxon: W=%.3f, p=%.5f, N=%d",
       mt_test$statistic, mt_test$p.value, mt_test$n)
  emit("Matched-pairs rank-biserial r_rb: %.4f (bootstrap 95%% CI %.4f to %.4f)",
       mt_rrb, mt_rrb_ci[["lower"]], mt_rrb_ci[["upper"]])
  emit("Method note: %s.", mt_test$note)

  fatigue_test <- safe_paired_wilcoxon(analysis_db$mt_dt_early, analysis_db$mt_dt_late)
  safety_test <- safe_paired_wilcoxon(
    analysis_db$warning_density_st_per_planned_minute,
    analysis_db$warning_density_dt_per_planned_minute
  )
  emit("")
  emit("[Exploratory within-DT fatigue slice: DT early vs DT late]")
  emit("DT late MT: %s ms", median_iqr(analysis_db$mt_dt_late))
  emit("Asymptotic paired Wilcoxon p=%.5f; median late-vs-early change=%s%%",
       fatigue_test$p.value, median_iqr(analysis_db$dt_late_vs_early_mt_change_pct))
  emit("")
  emit("[Exploratory safety contrast]")
  emit("ST warnings per planned minute: %s", median_iqr(analysis_db$warning_density_st_per_planned_minute))
  emit("DT warnings per planned minute: %s", median_iqr(analysis_db$warning_density_dt_per_planned_minute))
  emit("Asymptotic paired Wilcoxon p=%.5f", safety_test$p.value)
  emit("Observed-active-minute densities are exported separately and are not labelled as planned exposure.")

  emit("")
  emit("[Descriptive exploratory strata only]")
  for (stratum in unique(analysis_db$motor_strata)) {
    subset_db <- analysis_db[analysis_db$motor_strata == stratum, , drop = FALSE]
    emit("%s: N=%d; MT DTC=%s%%; Path DTC=%s%%; DT cognitive accuracy=%s%%",
         stratum,
         nrow(subset_db),
         median_iqr(subset_db$movement_time_dtc_pct),
         median_iqr(subset_db$path_kinematics_dtc_pct),
         median_iqr(subset_db$cognitive_accuracy_dt_pct))
  }
  emit("Subjective enjoyment score: %s / 10", median_iqr(analysis_db$subjective_enjoyment_vams_score))
} else {
  emit("Inferential dashboard skipped safely: at least 2 linked complete participant pairs are required.")
}

emit("==========================================================================")
emit("Participant table: %s", analysis_csv)
emit("Summary: %s", summary_path)
writeLines(report_lines, summary_path, useBytes = TRUE)
