/* ============================================================
   Researcher / data-management bundle.
   Holds randomization + allocation. NEVER referenced by the
   blinded assessor bundle. Memory-only.
   ============================================================ */
(function () {
  'use strict';
  var $ = RC.$, $$ = RC.$$;

  /* SHA-256 of the temporary researcher passcode.
     Operational blinding barrier only — not production authentication.
     Must be changed before formal use. */
  var PASSCODE_HASH = '2c358df2c25f9bb565cdb7d4f8f50336250ba7280b30b1f93919bf3d4154490a';

  var GROUPS = { A: '遊戲介入組 Game intervention', B: '傳統治療對照組 Conventional control' };

  var slots = [];            // {slot, block, group, participantId, date, revealed}
  var assessments = [];      // imported assessment rows (no allocation inside)
  var sessionsRows = [];     // imported intervention rows
  var settingsFiles = [];    // imported T0 settings
  var deviations = [];       // manual + imported deviation/breach entries

  /* ---------- deterministic PRNG (mulberry32 with string seed) ---------- */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateSequence() {
    var seed = $('#inpSeed').value || 'SEED';
    var n = Math.max(2, Math.min(200, Number($('#inpNSlots').value) || 12));
    var bsMode = $('#selBlockSize').value;
    var rnd = mulberry32(hashSeed(seed));
    var out = [], blockIdx = 0;
    while (out.length < n) {
      var bs = bsMode === 'mixed' ? (rnd() < 0.5 ? 2 : 4) : Number(bsMode);
      blockIdx++;
      var block = [];
      for (var i = 0; i < bs / 2; i++) { block.push('A'); block.push('B'); }
      for (var j = block.length - 1; j > 0; j--) {   // Fisher-Yates with seeded rnd
        var k = Math.floor(rnd() * (j + 1));
        var tmp = block[j]; block[j] = block[k]; block[k] = tmp;
      }
      for (var b = 0; b < block.length && out.length < n; b++) {
        out.push({ slot: out.length + 1, block: blockIdx, group: block[b], participantId: '', date: '', revealed: false });
      }
    }
    slots = out;
    renderAllocation();
    feedback('已產生 ' + slots.length + ' 個名額（seed：' + RC.esc(seed) + '，block size：' + RC.esc(bsMode) + '）。分配標籤在揭示前保持隱藏。');
  }

  function renderAllocation() {
    $('#allocBody').innerHTML = slots.length ? slots.map(function (s) {
      var label = s.revealed
        ? '<b data-testid="text-allocation-' + s.slot + '">' + RC.esc(GROUPS[s.group]) + '</b>'
        : '<span data-testid="text-allocation-' + s.slot + '">🔒 已隱藏 Concealed</span>';
      var btn = s.participantId
        ? '<button type="button" class="rs-btn rs-btn-small rs-btn-secondary" data-testid="button-reveal-' + s.slot + '" data-reveal="' + s.slot + '">' +
        (s.revealed ? '隱藏 Hide' : '揭示 Reveal') + '</button>'
        : '<span class="rs-hint">未指派</span>';
      return '<tr data-testid="row-slot-' + s.slot + '"><td>' + s.slot + '</td><td>' + s.block + '</td><td class="rs-mono">' +
        RC.esc(s.participantId) + '</td><td>' + RC.esc(s.date) + '</td><td>' + label + '</td><td>' + btn + '</td></tr>';
    }).join('') : '<tr><td colspan="6">未產生序列 No sequence generated</td></tr>';
    $$('[data-reveal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = slots[Number(b.getAttribute('data-reveal')) - 1];
        s.revealed = !s.revealed;
        renderAllocation(); renderProgress();
      });
    });
    renderProgress();
  }

  function assignNext() {
    var id = $('#inpAssignId').value.toUpperCase();
    $('#inpAssignId').value = id;
    var r = RC.validateId(id);
    var errEl = $('#assignError');
    if (!r.ok) { errEl.textContent = '✖ ' + r.msg; errEl.style.color = '#A32217'; return; }
    if (!slots.length) { errEl.textContent = '✖ 請先產生分配序列。'; return; }
    if (slots.some(function (s) { return s.participantId === id; })) {
      errEl.textContent = '✖ 此 Participant ID 已分配。'; return;
    }
    var next = slots.filter(function (s) { return !s.participantId; })[0];
    if (!next) { errEl.textContent = '✖ 沒有剩餘名額，請重新產生更長的序列。'; return; }
    next.participantId = id;
    next.date = $('#inpAssignDate').value || RC.nowISO().slice(0, 10);
    errEl.textContent = '✔ 已指派至 slot ' + next.slot + '（分配結果保持隱藏，按「揭示」才顯示）。';
    errEl.style.color = '#12482E';
    RC.applyTestChrome(slots.some(function (s) { return RC.isTestId(s.participantId); }));
    renderAllocation();
  }

  /* ---------- progress ---------- */
  function participantIndex() {
    var map = {};
    function ensure(id) {
      if (!map[id]) map[id] = { id: id, group: '', T0: false, T1: false, sessions: {}, missing: [], breach: false, deviations: 0, test: RC.isTestId(id) };
      return map[id];
    }
    slots.forEach(function (s) { if (s.participantId) { var p = ensure(s.participantId); p.group = s.revealed ? GROUPS[s.group] : '🔒'; } });
    assessments.forEach(function (a) {
      var p = ensure(a.participant_id);
      if (a.timepoint === 'T0') p.T0 = true;
      if (a.timepoint === 'T1') p.T1 = true;
      if (String(a.possible_unblinding).toLowerCase() === 'yes') p.breach = true;
      ['fthue_level', 'grip_mean_kg', 'pinch_mean_kg', 'pain_post', 'fatigue_post'].forEach(function (k) {
        if (a[k] === '' || a[k] === undefined) p.missing.push(a.timepoint + ':' + k);
      });
    });
    sessionsRows.forEach(function (s) {
      var p = ensure(s.participant_id);
      p.sessions[s.session] = s.session_completion || 'recorded';
      if (String(s.protocol_deviation).toLowerCase() === 'yes') p.deviations++;
    });
    deviations.forEach(function (d) {
      var p = ensure(d.participant_id);
      if (d.type === 'blinding_breach') p.breach = true;
      else p.deviations++;
    });
    return map;
  }
  function renderProgress() {
    var map = participantIndex();
    var ids = Object.keys(map).sort();
    $('#progressBody').innerHTML = ids.length ? ids.map(function (id) {
      var p = map[id];
      var cells = ['1', '2', '3', '4', '5'].map(function (n) {
        return '<td data-testid="cell-' + id + '-s' + n + '">' + (p.sessions[n] ? '✔ ' + RC.esc(p.sessions[n]) : '—') + '</td>';
      }).join('');
      return '<tr data-testid="row-progress-' + RC.esc(id) + '"><td class="rs-mono">' + RC.esc(id) + '</td><td>' + RC.esc(p.group) +
        '</td><td>' + (p.T0 ? '✔' : '—') + '</td><td>' + (p.T1 ? '✔' : '—') + '</td>' + cells +
        '<td>' + (p.missing.length ? '⚠ ' + p.missing.length : '—') + '</td><td>' + (p.breach ? '⚠ yes' : 'no') +
        '</td><td>' + p.deviations + '</td><td>' + (p.test ? 'TEST' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="13">未有資料 No data</td></tr>';
  }

  /* ---------- import ---------- */
  function logImport(msg, kind) {
    var box = $('#importLog');
    var div = document.createElement('div');
    div.className = 'rs-note rs-note-' + (kind || 'ok');
    div.innerHTML = '<span class="rs-note-icon">' + (kind === 'danger' ? '✖' : '✔') + '</span><span>' + msg + '</span>';
    box.appendChild(div);
  }
  function importFiles(fileList, kind) {
    Array.prototype.forEach.call(fileList, function (file) {
      RC.readFileText(file).then(function (txt) {
        if (kind === 'settings') {
          var obj = RC.parseJSONFile(txt);
          if (obj.schema !== 'ych-ot-pilot-assessment-settings') throw new Error('不是設定檔 not a settings file');
          settingsFiles.push(obj);
          logImport('已匯入 settings：<b>' + RC.esc(file.name) + '</b>（' + RC.esc(obj.participant_id) + '）');
        } else {
          var rows = RC.csvToObjects(txt);
          if (!rows.length) throw new Error('沒有資料列 no data rows');
          if (!rows[0].participant_id) throw new Error('缺少 participant_id 欄 missing participant_id column');
          if (kind === 'assessment') {
            rows.forEach(function (r) { assessments.push(r); });
            logImport('已匯入評估資料：<b>' + RC.esc(file.name) + '</b>（' + rows.length + ' 列）');
          } else {
            rows.forEach(function (r) {
              sessionsRows.push(r);
              if (String(r.protocol_deviation).toLowerCase() === 'yes') {
                deviations.push({
                  index: deviations.length + 1, participant_id: r.participant_id, type: 'protocol_deviation',
                  detail: r.deviation_detail || '', source: file.name, datetime: RC.nowISO(), by: r.therapist_code || ''
                });
              }
            });
            logImport('已匯入節次資料：<b>' + RC.esc(file.name) + '</b>（' + rows.length + ' 列）');
          }
        }
        RC.applyTestChrome(assessments.concat(sessionsRows).some(function (r) { return RC.isTestId(r.participant_id); }));
        renderProgress(); renderDeviations();
      }).catch(function (e) {
        logImport('匯入失敗 <b>' + RC.esc(file.name) + '</b>：' + RC.esc(e.message), 'danger');
      });
    });
  }

  /* ---------- exports ---------- */
  function feedback(html, kind) {
    $('#exportFeedback').innerHTML = '<div class="rs-note rs-note-' + (kind || 'ok') + '"><span class="rs-note-icon">' +
      (kind === 'danger' ? '✖' : '✔') + '</span><span>' + html + '</span></div>';
  }
  function exportAllocation() {
    if (!slots.length) { feedback('未有分配序列可匯出。', 'danger'); return; }
    var rows = [['slot', 'block', 'participant_id', 'allocation_date', 'allocation_group', 'allocation_label', 'seed', 'generated_at']];
    var seed = $('#inpSeed').value;
    slots.forEach(function (s) {
      rows.push([s.slot, s.block, s.participantId, s.date, s.group, GROUPS[s.group], seed, RC.nowISO()]);
    });
    RC.downloadCSV('allocation.csv', rows);
    feedback('已下載 <b>allocation.csv</b>。此檔案只可由研究員保管，不可交予盲法評估員。');
  }
  function exportDataset() {
    var keys = {};
    assessments.forEach(function (r) { Object.keys(r).forEach(function (k) { keys[k] = 1; }); });
    var aKeys = Object.keys(keys);
    var sKeysMap = {};
    sessionsRows.forEach(function (r) { Object.keys(r).forEach(function (k) { sKeysMap[k] = 1; }); });
    var sKeys = Object.keys(sKeysMap);
    if (!aKeys.length && !sKeys.length) { feedback('未有可匯出的資料，請先匯入 CSV。', 'danger'); return; }

    var head = ['participant_id', 'source', 'timepoint_or_session'].concat(
      aKeys.filter(function (k) { return k !== 'participant_id'; }),
      sKeys.filter(function (k) { return k !== 'participant_id' && aKeys.indexOf(k) === -1; })
    );
    var rows = [head];
    assessments.forEach(function (r) {
      rows.push(head.map(function (k) {
        if (k === 'source') return 'assessment';
        if (k === 'timepoint_or_session') return r.timepoint || '';
        return r[k] === undefined ? '' : r[k];
      }));
    });
    sessionsRows.forEach(function (r) {
      rows.push(head.map(function (k) {
        if (k === 'source') return 'intervention_session';
        if (k === 'timepoint_or_session') return 'S' + (r.session || '');
        return r[k] === undefined ? '' : r[k];
      }));
    });
    RC.downloadCSV('merged_dataset_anonymized.csv', rows);
    feedback('已下載 <b>merged_dataset_anonymized.csv</b>（' + (rows.length - 1) + ' 列）。合併只以匿名 Participant ID 進行；allocation 需另行匯出，兩者分開保存。');
  }
  function exportChange() {
    var outcomes = [
      'fthue_level', 'grip_mean_kg', 'pinch_mean_kg',
      'adl_feeding_score', 'adl_grooming_score', 'adl_dressing_score',
      'motor_correct_per_min', 'cognitive_accuracy_pct',
      'dual_correct_per_min', 'dual_accuracy_pct',
      'motor_dtc_pct', 'cognitive_dtc_pct'
    ];
    var byId = {};
    assessments.forEach(function (r) {
      if (!r.participant_id || (r.timepoint !== 'T0' && r.timepoint !== 'T1')) return;
      if (!byId[r.participant_id]) byId[r.participant_id] = {};
      byId[r.participant_id][r.timepoint] = r;
    });
    var session5 = {};
    sessionsRows.forEach(function (r) {
      if (String(r.session) === '5' && r.participant_id) session5[r.participant_id] = r;
    });
    var ids = Object.keys(byId).sort();
    if (!ids.length) { feedback('請先匯入 T0／T1 評估 CSV。', 'danger'); return; }
    var head = [
      'participant_id', 'allocation_group', 't0_available', 't1_available',
      'baseline_fthue_stratum', 'fthue_ordinal_transition',
      'setup_tool_t0', 'setup_tool_t1', 'same_tool_t0_t1',
      'pinch_type_t0', 'pinch_type_t1', 'same_pinch_type_t0_t1',
      'condition_order_t0', 'condition_order_t1', 'same_condition_order_t0_t1',
      'hours_session5_to_t1', 't1_within_24_48_hours',
      'assessor_code_t0', 'assessor_code_t1', 'same_assessor_t0_t1',
      'affected_side_t0', 'affected_side_t1', 'same_affected_side_t0_t1',
      'dynamometer_t0', 'dynamometer_t1', 'same_dynamometer_t0_t1',
      'grip_handle_t0', 'grip_handle_t1', 'same_grip_handle_t0_t1',
      'food_size_t0', 'food_size_t1', 'same_food_size_t0_t1',
      'plate_size_t0', 'plate_size_t1', 'same_plate_size_t0_t1',
      'camera_position_t0', 'camera_position_t1', 'same_camera_position_t0_t1',
      'cognitive_difficulty_t0', 'cognitive_difficulty_t1', 'same_cognitive_difficulty_t0_t1',
      'condition_duration_t0', 'condition_duration_t1', 'same_condition_duration_t0_t1',
      'corrective_feedback_t0', 'corrective_feedback_t1', 'same_corrective_feedback_t0_t1',
      'main_motor_outcome_change_dual_correct_per_min',
      'main_neuroscience_outcome_motor_dtc_reduction_t0_minus_t1',
      'dual_cognitive_accuracy_change_t1_minus_t0'
    ];
    outcomes.forEach(function (k) { head.push(k + '_t0', k + '_t1', k + '_change_t1_minus_t0'); });
    var slotMap = {};
    slots.forEach(function (s) { if (s.participantId) slotMap[s.participantId] = s.group || ''; });
    var rows = [head];
    ids.forEach(function (id) {
      var t0 = byId[id].T0 || {}, t1 = byId[id].T1 || {};
      var f0 = Number(t0.fthue_level), f1 = Number(t1.fthue_level);
      var transition = '';
      if (isFinite(f0) && isFinite(f1)) transition = f1 > f0 ? 'improved' : (f1 < f0 ? 'reduced' : 'unchanged');
      var tool0 = t0.setup_tool || '', tool1 = t1.setup_tool || '';
      var pinch0 = t0.pinch_type || '', pinch1 = t1.pinch_type || '';
      var order0 = t0.setup_condition_order || '', order1 = t1.setup_condition_order || '';
      var mainMotor = numericChange(t0.dual_correct_per_min, t1.dual_correct_per_min);
      var motorDtcReduction = numericChange(t1.motor_dtc_pct, t0.motor_dtc_pct);
      var h = hoursBetween((session5[id] || {}).session_datetime, t1.assessment_datetime);
      function pair(a, b) { return [a || '', b || '', comparable(a, b)]; }
      var row = [
        id, slotMap[id] || '', byId[id].T0 ? 'yes' : 'no', byId[id].T1 ? 'yes' : 'no',
        t0.setup_fthue_level || t0.fthue_level || '', transition,
        tool0, tool1, comparable(tool0, tool1),
        pinch0, pinch1, comparable(pinch0, pinch1),
        order0, order1, comparable(order0, order1),
        h, h === '' ? '' : (h >= 24 && h <= 48 ? 'yes' : 'no')
      ];
      [
        ['assessor_code', 'assessor_code'],
        ['affected_side', 'affected_side'],
        ['dynamometer_id', 'dynamometer_id'],
        ['grip_handle_setting', 'grip_handle_setting'],
        ['setup_food_size', 'setup_food_size'],
        ['setup_plate_size', 'setup_plate_size'],
        ['setup_camera_position', 'setup_camera_position'],
        ['setup_cognitive_difficulty', 'setup_cognitive_difficulty'],
        ['setup_condition_duration_sec', 'setup_condition_duration_sec'],
        ['setup_corrective_feedback', 'setup_corrective_feedback']
      ].forEach(function (k) { row = row.concat(pair(t0[k[0]], t1[k[1]])); });
      row.push(mainMotor, motorDtcReduction, numericChange(t0.dual_accuracy_pct, t1.dual_accuracy_pct));
      outcomes.forEach(function (k) {
        var a = t0[k] === undefined ? '' : t0[k];
        var b = t1[k] === undefined ? '' : t1[k];
        var change = '';
        if (a !== '' && b !== '' && isFinite(Number(a)) && isFinite(Number(b))) {
          change = Math.round((Number(b) - Number(a)) * 1000) / 1000;
        }
        row.push(a, b, change);
      });
      rows.push(row);
    });
    RC.downloadCSV('pilot_analysis_t0_t1.csv', rows);
    feedback('已下載 <b>pilot_analysis_t0_t1.csv</b>。已整理T1時間、標準化設定、主要動作結果、motor DTC及認知準確度。');
  }
  function numericChange(a, b) {
    if (a === '' || b === '' || a === undefined || b === undefined) return '';
    if (!isFinite(Number(a)) || !isFinite(Number(b))) return '';
    return Math.round((Number(b) - Number(a)) * 1000) / 1000;
  }
  function comparable(a, b) {
    if (!a || !b) return '';
    return String(a) === String(b) ? 'yes' : 'no';
  }
  function hoursBetween(a, b) {
    var x = Date.parse(a || ''), y = Date.parse(b || '');
    if (!isFinite(x) || !isFinite(y)) return '';
    return Math.round((y - x) / 3600000 * 10) / 10;
  }
  function median(values) {
    var v = values.filter(function (x) { return isFinite(Number(x)); }).map(Number).sort(function (a, b) { return a - b; });
    if (!v.length) return '';
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2 * 10) / 10;
  }
  function wilson(n, d) {
    if (!d) return ['', '', ''];
    var z = 1.96, p = n / d, z2 = z * z;
    var centre = (p + z2 / (2 * d)) / (1 + z2 / d);
    var half = z * Math.sqrt((p * (1 - p) + z2 / (4 * d)) / d) / (1 + z2 / d);
    return [Math.round(p * 1000) / 10, Math.round(Math.max(0, centre - half) * 1000) / 10, Math.round(Math.min(1, centre + half) * 1000) / 10];
  }
  function exportFeasibility() {
    var idsMap = {};
    slots.forEach(function (s) { if (s.participantId) idsMap[s.participantId] = true; });
    assessments.forEach(function (r) { if (r.participant_id) idsMap[r.participant_id] = true; });
    sessionsRows.forEach(function (r) { if (r.participant_id) idsMap[r.participant_id] = true; });
    var ids = Object.keys(idsMap).sort();
    if (!ids.length) { feedback('請先匯入評估或Session CSV。', 'danger'); return; }
    var slotMap = {};
    slots.forEach(function (s) { if (s.participantId) slotMap[s.participantId] = s.group || ''; });
    var byA = {}, byS = {};
    assessments.forEach(function (r) {
      if (!byA[r.participant_id]) byA[r.participant_id] = {};
      byA[r.participant_id][r.timepoint] = r;
    });
    sessionsRows.forEach(function (r) {
      if (!byS[r.participant_id]) byS[r.participant_id] = {};
      byS[r.participant_id][String(r.session)] = r;
    });
    var head = [
      'participant_id', 'allocation_group', 'baseline_fthue_stratum', 't1_completed',
      'sessions_completed_n', 'completed_all_5_sessions', 'total_active_training_sec',
      'planned_training_sec', 'training_minutes_delivered_pct', 'total_rest_sec',
      'interrupted_sessions_n', 'technical_failures_n', 'pain_increase_sessions_n',
      'fatigue_increase_sessions_n', 'adverse_events_n', 'serious_related_adverse_events_n',
      'mean_fidelity_pct', 'patient_wants_continue_yes_n',
      'patient_feedback_recorded_n', 'median_acceptability_1_5', 'therapist_setup_mean_min'
    ];
    for (var i = 1; i <= 5; i++) {
      head.push('s' + i + '_correct_per_min', 's' + i + '_drops', 's' + i + '_active_sec', 's' + i + '_fthue');
    }
    head.push('correct_per_min_change_s5_minus_s1', 'drops_change_s5_minus_s1');
    var rows = [head];
    ids.forEach(function (id) {
      var a = byA[id] || {}, s = byS[id] || {}, list = Object.keys(s).map(function (k) { return s[k]; });
      var completeN = list.filter(function (r) { return r.session_completion === 'yes'; }).length;
      var activeTotal = list.reduce(function (v, r) { return v + (Number(r.active_training_sec) || 0); }, 0);
      var plannedTotal = list.reduce(function (v, r) {
        if (isFinite(Number(r.planned_training_sec))) return v + Number(r.planned_training_sec);
        return v + ((Number(r.planned_min) || 0) * 60);
      }, 0);
      var restTotal = list.reduce(function (v, r) { return v + (Number(r.rest_total_sec) || 0); }, 0);
      var fid = list.filter(function (r) { return isFinite(Number(r.fidelity_score)) && Number(r.fidelity_total) > 0; })
        .map(function (r) { return 100 * Number(r.fidelity_score) / Number(r.fidelity_total); });
      var feedbackRows = list.filter(function (r) { return !!r.patient_wants_continue; });
      var setupVals = list.filter(function (r) { return isFinite(Number(r.therapist_setup_min)); }).map(function (r) { return Number(r.therapist_setup_min); });
      var acceptVals = list.map(function (r) { return r.patient_acceptability_1_5; });
      var row = [
        id, slotMap[id] || '', (a.T0 && (a.T0.setup_fthue_level || a.T0.fthue_level)) || '',
        a.T1 ? 'yes' : 'no', completeN, completeN === 5 ? 'yes' : 'no',
        activeTotal, plannedTotal, plannedTotal ? Math.round(activeTotal / plannedTotal * 1000) / 10 : '', restTotal,
        list.filter(function (r) { return r.session_interrupted === 'yes'; }).length,
        list.filter(function (r) { return r.technical_failure === 'yes'; }).length,
        list.filter(function (r) { return r.pain_increased === 'yes'; }).length,
        list.filter(function (r) { return r.fatigue_increased === 'yes'; }).length,
        list.filter(function (r) { return r.adverse_event === 'yes'; }).length,
        list.filter(function (r) {
          return r.adverse_event === 'yes' && r.adverse_event_serious === 'yes' &&
            (r.adverse_event_related === 'yes' || r.adverse_event_related === 'possible');
        }).length,
        fid.length ? Math.round(fid.reduce(function (x, y) { return x + y; }, 0) / fid.length * 10) / 10 : '',
        feedbackRows.filter(function (r) { return r.patient_wants_continue === 'yes'; }).length,
        feedbackRows.length, median(acceptVals),
        setupVals.length ? Math.round(setupVals.reduce(function (x, y) { return x + y; }, 0) / setupVals.length * 10) / 10 : ''
      ];
      for (var j = 1; j <= 5; j++) {
        var sj = s[String(j)] || {};
        row.push(sj.correct_per_min || '', sj.drops || '', sj.active_training_sec || '', sj.fthue_level || '');
      }
      row.push(
        numericChange((s['1'] || {}).correct_per_min, (s['5'] || {}).correct_per_min),
        numericChange((s['1'] || {}).drops, (s['5'] || {}).drops)
      );
      rows.push(row);
    });
    RC.downloadCSV('pilot_feasibility_session_trajectory.csv', rows);

    var allSessions = sessionsRows.length;
    var screened = Number($('#inpScreened').value) || 0;
    var eligible = Number($('#inpEligible').value) || 0;
    var consented = Number($('#inpConsented').value) || 0;
    var target = Number($('#inpRecruitmentTarget').value) || 0;
    var completedAll5 = ids.filter(function (id) {
        return byS[id] && Object.keys(byS[id]).filter(function (k) { return byS[id][k].session_completion === 'yes'; }).length === 5;
      }).length;
    var plannedAll = sessionsRows.reduce(function (v, r) {
      return v + (isFinite(Number(r.planned_training_sec)) ? Number(r.planned_training_sec) : (Number(r.planned_min) || 0) * 60);
    }, 0);
    var activeAll = sessionsRows.reduce(function (v, r) { return v + (Number(r.active_training_sec) || 0); }, 0);
    var techN = sessionsRows.filter(function (r) { return r.technical_failure === 'yes'; }).length;
    var seriousRelatedN = sessionsRows.filter(function (r) {
      return r.adverse_event === 'yes' && r.adverse_event_serious === 'yes' &&
        (r.adverse_event_related === 'yes' || r.adverse_event_related === 'possible');
    }).length;
    var accepts = sessionsRows.map(function (r) { return r.patient_acceptability_1_5; });
    var acceptMedian = median(accepts);
    var metrics = [
      ['Recruitment against target', consented, target, 'percent', '', ''],
      ['Eligibility among screened', eligible, screened, 'percent', '', ''],
      ['Consent among eligible', consented, eligible, 'percent', '', ''],
      ['T1 assessment completion', ids.filter(function (id) { return byA[id] && byA[id].T1; }).length, ids.length, 'percent', '', ''],
      ['Completed all 5 sessions', completedAll5, ids.length, 'percent', '>=80%', ids.length ? (completedAll5 / ids.length >= 0.8 ? 'yes' : 'no') : ''],
      ['Planned training minutes delivered', activeAll, plannedAll, 'percent', '>=80%', plannedAll ? (activeAll / plannedAll >= 0.8 ? 'yes' : 'no') : ''],
      ['Interrupted sessions', sessionsRows.filter(function (r) { return r.session_interrupted === 'yes'; }).length, allSessions, 'percent', '', ''],
      ['Technical failure', techN, allSessions, 'percent', '<=10%', allSessions ? (techN / allSessions <= 0.1 ? 'yes' : 'no') : ''],
      ['Pain increased', sessionsRows.filter(function (r) { return r.pain_increased === 'yes'; }).length, allSessions, 'percent', '', ''],
      ['Fatigue increased', sessionsRows.filter(function (r) { return r.fatigue_increased === 'yes'; }).length, allSessions, 'percent', '', ''],
      ['Adverse event', sessionsRows.filter(function (r) { return r.adverse_event === 'yes'; }).length, allSessions, 'percent', '', ''],
      ['Serious intervention-related adverse event', seriousRelatedN, allSessions, 'count', '0', seriousRelatedN === 0 ? 'yes' : 'no'],
      ['Median acceptability', acceptMedian, accepts.filter(function (x) { return isFinite(Number(x)); }).length, 'median_1_5', '>=4/5', acceptMedian === '' ? '' : (acceptMedian >= 4 ? 'yes' : 'no')],
      ['Would use again', sessionsRows.filter(function (r) { return r.patient_wants_continue === 'yes'; }).length,
        sessionsRows.filter(function (r) { return !!r.patient_wants_continue; }).length, 'percent', '', ''],
      ['Full fidelity sessions', sessionsRows.filter(function (r) { return Number(r.fidelity_score) === Number(r.fidelity_total) && Number(r.fidelity_total) > 0; }).length, allSessions, 'percent', '', '']
    ];
    var summary = [['metric', 'numerator_or_value', 'denominator_or_n', 'value', 'unit', 'wilson_95ci_lower_pct', 'wilson_95ci_upper_pct', 'local_progression_rule', 'pass']];
    metrics.forEach(function (m) {
      var ci = m[3] === 'percent' ? wilson(m[1], m[2]) : ['', '', ''];
      var value = m[3] === 'percent' ? ci[0] : m[1];
      summary.push([m[0], m[1], m[2], value, m[3], ci[1], ci[2], m[4], m[5]]);
    });
    setTimeout(function () { RC.downloadCSV('pilot_feasibility_summary.csv', summary); }, 250);
    feedback('已下載每位病人的五節走勢及可行性摘要，包括招募、完成率、訓練時間、技術問題、安全性、接受程度及本地進展準則。');
  }
  function exportDeviations() {
    var rows = [['index', 'participant_id', 'type', 'detail', 'source', 'datetime', 'recorded_by']];
    deviations.forEach(function (d) { rows.push([d.index, d.participant_id, d.type, d.detail, d.source, d.datetime, d.by]); });
    assessments.forEach(function (a) {
      if (String(a.possible_unblinding).toLowerCase() === 'yes') {
        rows.push([rows.length, a.participant_id, 'blinding_breach', a.unblinding_reason || '', 'assessment CSV',
          a.assessment_datetime || '', a.unblinding_logged_by || '']);
      }
    });
    RC.downloadCSV('deviation_breach_log.csv', rows);
    feedback('已下載 <b>deviation_breach_log.csv</b>（' + (rows.length - 1) + ' 列）。');
  }

  /* ---------- deviations ---------- */
  function addDeviation() {
    var id = $('#inpDevId').value.toUpperCase();
    $('#inpDevId').value = id;
    var r = RC.validateId(id);
    if (!r.ok) { feedback('未能加入：' + RC.esc(r.msg), 'danger'); return; }
    deviations.push({
      index: deviations.length + 1, participant_id: id, type: $('#selDevType').value,
      detail: $('#inpDevDetail').value, source: 'manual', datetime: RC.nowISO(), by: $('#inpDevBy').value.toUpperCase()
    });
    $('#inpDevDetail').value = '';
    renderDeviations(); renderProgress();
  }
  function renderDeviations() {
    $('#deviationBody').innerHTML = deviations.length ? deviations.map(function (d) {
      return '<tr data-testid="row-deviation-' + d.index + '"><td>' + d.index + '</td><td class="rs-mono">' + RC.esc(d.participant_id) +
        '</td><td>' + RC.esc(d.type) + '</td><td>' + RC.esc(d.detail) + '</td><td>' + RC.esc(d.source) +
        '</td><td>' + RC.esc(d.datetime) + '</td><td>' + RC.esc(d.by) + '</td></tr>';
    }).join('') : '<tr><td colspan="7">未有紀錄 No entries</td></tr>';
  }

  /* ---------- test data ---------- */
  function loadTestData() {
    $('#inpSeed').value = 'TEST-SEED';
    $('#inpNSlots').value = 6;
    generateSequence();
    ['TEST001', 'TEST002', 'TEST003'].forEach(function (id, i) {
      slots[i].participantId = id;
      slots[i].date = RC.nowISO().slice(0, 10);
    });
    assessments.push(
      { participant_id: 'TEST001', timepoint: 'T0', assessment_datetime: '2026-08-01T14:00', assessor_code: 'TESTAS',
        affected_side: 'right', fthue_level: '5', grip_mean_kg: '11', pinch_mean_kg: '3',
        dynamometer_id: 'DYN-01', grip_handle_setting: '2', pinch_type: 'three_jaw',
        setup_tool: 'chopsticks', setup_food_size: 'medium', setup_plate_size: 'medium',
        setup_camera_position: 'front_table', setup_cognitive_difficulty: 'standard',
        setup_condition_duration_sec: '120', setup_condition_order: 'motor,cognitive,dual',
        setup_corrective_feedback: 'off', motor_correct_per_min: '10', cognitive_accuracy_pct: '90',
        dual_correct_per_min: '7.5', dual_accuracy_pct: '80', motor_dtc_pct: '25', cognitive_dtc_pct: '11.1',
        pain_post: '4', fatigue_post: '6', possible_unblinding: 'no', test_record: 'TEST' },
      { participant_id: 'TEST001', timepoint: 'T1', assessment_datetime: '2026-08-08T14:00', assessor_code: 'TESTAS',
        affected_side: 'right', fthue_level: '6', grip_mean_kg: '13', pinch_mean_kg: '3.5',
        dynamometer_id: 'DYN-01', grip_handle_setting: '2', pinch_type: 'three_jaw',
        setup_tool: 'chopsticks', setup_food_size: 'medium', setup_plate_size: 'medium',
        setup_camera_position: 'front_table', setup_cognitive_difficulty: 'standard',
        setup_condition_duration_sec: '120', setup_condition_order: 'motor,cognitive,dual',
        setup_corrective_feedback: 'off', motor_correct_per_min: '11', cognitive_accuracy_pct: '90',
        dual_correct_per_min: '9.5', dual_accuracy_pct: '88', motor_dtc_pct: '13.6', cognitive_dtc_pct: '2.2',
        pain_post: '3', fatigue_post: '5', possible_unblinding: 'no', test_record: 'TEST' },
      { participant_id: 'TEST002', timepoint: 'T0', fthue_level: '4', grip_mean_kg: '8', pinch_mean_kg: '2', pain_post: '5', fatigue_post: '7', possible_unblinding: 'yes', unblinding_reason: '測試：病房職員在評估期間提及訓練內容。', unblinding_logged_by: 'TESTAS', test_record: 'TEST' },
      { participant_id: 'TEST003', timepoint: 'T0', fthue_level: '5', grip_mean_kg: '', pinch_mean_kg: '', pain_post: '', fatigue_post: '4', possible_unblinding: 'no', test_record: 'TEST' }
    );
    [1, 2, 3, 4, 5].forEach(function (n) {
      sessionsRows.push({
        participant_id: 'TEST001', session: String(n), session_datetime: '2026-08-0' + (n + 1) + 'T14:00',
        session_completion: 'yes', protocol_deviation: 'no', planned_training_sec: '900',
        active_training_sec: String(780 + n * 20), rest_total_sec: String(120 - n * 8),
        session_interrupted: 'no', technical_failure: 'no', pain_increased: 'no',
        fatigue_increased: n === 5 ? 'yes' : 'no', adverse_event: 'no',
        adverse_event_serious: 'no', adverse_event_related: 'no',
        patient_acceptability_1_5: n < 3 ? '4' : '5', patient_wants_continue: 'yes',
        correct_per_min: String(7 + n * 0.5), drops: String(Math.max(0, 3 - n)),
        fidelity_score: '8', fidelity_total: '8', fthue_level: n < 4 ? '5' : '6', test_record: 'TEST'
      });
    });
    sessionsRows.push(
      { participant_id: 'TEST003', session: '1', session_completion: 'partial', protocol_deviation: 'yes', deviation_detail: '測試：節次縮短至 9 分鐘。', active_training_sec: '540', rest_total_sec: '210', therapist_code: 'TESTOT', test_record: 'TEST' }
    );
    sessionsRows.forEach(function (r) {
      if (String(r.protocol_deviation).toLowerCase() === 'yes' && !deviations.some(function (d) { return d.participant_id === r.participant_id && d.source === 'test data'; })) {
        deviations.push({ index: deviations.length + 1, participant_id: r.participant_id, type: 'protocol_deviation', detail: r.deviation_detail, source: 'test data', datetime: RC.nowISO(), by: r.therapist_code });
      }
    });
    RC.applyTestChrome(true);
    renderAllocation(); renderDeviations();
    feedback('已載入 TEST001–TEST003 測試資料（全部標示 TEST，不可用作研究分析）。');
  }

  /* ---------- gate ---------- */
  function unlock() {
    var val = $('#inpPasscode').value;
    RC.sha256hex(val).then(function (h) {
      if (h === PASSCODE_HASH) {
        $('#gateShell').classList.add('rs-hidden');
        $('#workShell').classList.remove('rs-hidden');
        initWorkspace();
      } else {
        $('#gateError').textContent = '✖ 通行碼不正確 Incorrect passcode。';
      }
    }).catch(function () {
      $('#gateError').textContent = '✖ 此瀏覽器不支援 Web Crypto，無法核對通行碼。';
    });
  }

  var wsReady = false;
  function initWorkspace() {
    if (wsReady) return;
    wsReady = true;
    $('#inpAssignDate').value = RC.nowISO().slice(0, 10);
    $('#btnGenerate').addEventListener('click', generateSequence);
    $('#btnAssign').addEventListener('click', assignNext);
    $('#btnDownloadAllocation').addEventListener('click', exportAllocation);
    $('#btnExportDataset').addEventListener('click', exportDataset);
    $('#btnExportDeviations').addEventListener('click', exportDeviations);
    $('#btnAddDeviation').addEventListener('click', addDeviation);
    $('#btnLoadTestData').addEventListener('click', loadTestData);
    $('#inpImportAssessment').addEventListener('change', function () { importFiles(this.files, 'assessment'); });
    $('#inpImportSession').addEventListener('change', function () { importFiles(this.files, 'session'); });
    $('#inpImportSettings').addEventListener('change', function () { importFiles(this.files, 'settings'); });
    $('#btnExportChange').addEventListener('click', exportChange);
    $('#btnExportFeasibility').addEventListener('click', exportFeasibility);
    renderAllocation(); renderDeviations(); renderProgress();
    RC.installUnloadGuard(function () { return slots.length > 0 || assessments.length > 0 || sessionsRows.length > 0; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#btnUnlock').addEventListener('click', unlock);
    $('#inpPasscode').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });
  });

  window.__researcherQA = {
    unlockWith: function (code) { $('#inpPasscode').value = code; unlock(); },
    slots: function () { return slots; },
    generate: generateSequence,
    loadTestData: loadTestData,
    exportChange: exportChange,
    exportFeasibility: exportFeasibility
  };
})();
