/* ============================================================
   Researcher / data-management bundle.
   Holds randomization + allocation. NEVER referenced by the
   blinded assessor bundle. Memory-only.
   ============================================================ */
(function () {
  'use strict';
  var $ = RC.$, $$ = RC.$$;

  /* SHA-256 of the documented temporary default passcode `YCH-PILOT-2026`.
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
      { participant_id: 'TEST001', timepoint: 'T0', fthue_level: '5', grip_mean_kg: '11', pinch_mean_kg: '3', pain_post: '4', fatigue_post: '6', possible_unblinding: 'no', test_record: 'TEST' },
      { participant_id: 'TEST001', timepoint: 'T1', fthue_level: '6', grip_mean_kg: '13', pinch_mean_kg: '3.5', pain_post: '3', fatigue_post: '5', possible_unblinding: 'no', test_record: 'TEST' },
      { participant_id: 'TEST002', timepoint: 'T0', fthue_level: '4', grip_mean_kg: '8', pinch_mean_kg: '2', pain_post: '5', fatigue_post: '7', possible_unblinding: 'yes', unblinding_reason: '測試：病房職員在評估期間提及訓練內容。', unblinding_logged_by: 'TESTAS', test_record: 'TEST' },
      { participant_id: 'TEST003', timepoint: 'T0', fthue_level: '5', grip_mean_kg: '', pinch_mean_kg: '', pain_post: '', fatigue_post: '4', possible_unblinding: 'no', test_record: 'TEST' }
    );
    sessionsRows.push(
      { participant_id: 'TEST001', session: '1', session_completion: 'yes', protocol_deviation: 'no', active_training_sec: '780', rest_total_sec: '120', test_record: 'TEST' },
      { participant_id: 'TEST001', session: '2', session_completion: 'yes', protocol_deviation: 'no', active_training_sec: '800', rest_total_sec: '95', test_record: 'TEST' },
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
    loadTestData: loadTestData
  };
})();
