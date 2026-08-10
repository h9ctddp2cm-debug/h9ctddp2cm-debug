/* ============================================================
   Intervention therapist bundle — Session 1-5 delivery record.
   Memory-only. Never loaded by the blinded assessor bundle.
   ============================================================ */
(function () {
  'use strict';
  var $ = RC.$, $$ = RC.$$;

  var FIDELITY = [
    ['affected_hand', '使用指定患側上肢 Correct affected hand used'],
    ['prescribed_tool', '使用 protocol 指定工具 Prescribed tool used'],
    ['seating', '坐姿及擺位符合 protocol Seating / positioning per protocol'],
    ['grasp_open', '拿取時閉手、放下時張手 Grasp closes / release opens'],
    ['cognitive_flow', '認知任務按 protocol 進行 Cognitive flow per protocol'],
    ['difficulty_consistent', '難度版本與前幾節一致 Same difficulty track'],
    ['rest_responsive', '休息按參加者需要，非固定時間 Participant-responsive rest'],
    ['feedback_settings', '回饋及獎勵設定依 protocol Feedback settings per protocol']
  ];

  var F = {
    participantId: '', group: '', session: '1', datetime: RC.nowLocalInput(), therapistCode: '',
    fthue: '', affectedSide: '', deliveryType: '', scenario: '', tool: '', difficulty: '',
    conventional: '', plannedMin: 15, activeSec: '', correct: '', wrong: '', drops: '',
    assistance: '', trunk: '', painPre: '', painPost: '', fatiguePre: '', fatiguePost: '',
    techFailure: '', techDetail: '', adverseEvent: '', aeDetail: '', deviation: '', deviationDetail: '',
    completion: '', fidelity: {}
  };
  var rest = new RC.RestLogger();
  var sessions = [];
  var dirty = false;
  var restTick = null;
  var timer = { running: false, startMs: 0, acc: 0 };

  var MAP = [
    ['#inpParticipantId', 'participantId'], ['#selGroup', 'group'], ['#selSession', 'session'],
    ['#inpSessionDatetime', 'datetime'], ['#inpTherapistCode', 'therapistCode'], ['#selFthue', 'fthue'],
    ['#selAffectedSide', 'affectedSide'], ['#selDeliveryType', 'deliveryType'], ['#selScenario', 'scenario'],
    ['#selTool', 'tool'], ['#selDifficulty', 'difficulty'], ['#inpConventional', 'conventional'],
    ['#inpPlannedMin', 'plannedMin'], ['#inpActiveSec', 'activeSec'], ['#inpCorrect', 'correct'],
    ['#inpWrong', 'wrong'], ['#inpDrops', 'drops'], ['#selAssistance', 'assistance'], ['#selTrunk', 'trunk'],
    ['#inpPainPre', 'painPre'], ['#inpPainPost', 'painPost'], ['#inpFatiguePre', 'fatiguePre'],
    ['#inpFatiguePost', 'fatiguePost'], ['#selTechFailure', 'techFailure'], ['#inpTechDetail', 'techDetail'],
    ['#selAdverseEvent', 'adverseEvent'], ['#inpAeDetail', 'aeDetail'], ['#selDeviation', 'deviation'],
    ['#inpDeviationDetail', 'deviationDetail'], ['#selCompletion', 'completion']
  ];

  function markDirty() { dirty = true; renderStatus(); renderAuto(); }
  function renderStatus() {
    var el = $('#statusDownload');
    el.className = 'rs-status-pill ' + (dirty ? 'rs-status-pending' : 'rs-status-done');
    el.textContent = dirty ? '⬤ 尚未下載 Not downloaded' : '✔ 已下載 Downloaded';
  }
  function sync() {
    MAP.forEach(function (m) { var e = $(m[0]); if (e) e.value = F[m[1]] === null ? '' : F[m[1]]; });
    FIDELITY.forEach(function (f) {
      var c = $('[data-testid="checkbox-fidelity-' + f[0] + '"]');
      if (c) c.checked = !!F.fidelity[f[0]];
    });
    renderFidelityScore(); renderAuto(); renderRest();
  }
  function bind() {
    MAP.forEach(function (m) {
      var el = $(m[0]); if (!el) return;
      var handler = function () {
        F[m[1]] = m[1] === 'participantId' ? el.value.toUpperCase() : el.value;
        if (m[1] === 'participantId') { el.value = F.participantId; validateId(); }
        markDirty();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    $('[data-testid="button-timer-start"]').addEventListener('click', startTimer);
    $('[data-testid="button-timer-stop"]').addEventListener('click', stopTimer);
    $('[data-testid="button-add-session"]').addEventListener('click', addSession);
    $('[data-testid="button-download-sessions"]').addEventListener('click', downloadSessions);
    $('[data-testid="button-download-rest-log"]').addEventListener('click', downloadRestLog);
    $('#selTestPreset').addEventListener('change', function () { applyPreset(this.value); });
  }
  function validateId() {
    var r = RC.validateId(F.participantId);
    var el = $('#idError');
    el.textContent = F.participantId === '' ? '' : (r.ok ? '✔ 格式正確 Valid anonymous ID' : '✖ ' + r.msg);
    el.style.color = r.ok ? '#12482E' : '#A32217';
    RC.applyTestChrome(RC.isTestId(F.participantId));
    return r;
  }

  /* fidelity */
  function renderFidelity() {
    $('#fidelityList').innerHTML = FIDELITY.map(function (f) {
      return '<label class="rs-check"><input type="checkbox" data-testid="checkbox-fidelity-' + f[0] + '" data-fid="' + f[0] + '"><span>' + RC.esc(f[1]) + '</span></label>';
    }).join('');
    $$('#fidelityList [data-fid]').forEach(function (c) {
      c.addEventListener('change', function () {
        F.fidelity[c.getAttribute('data-fid')] = c.checked;
        renderFidelityScore(); markDirty();
      });
    });
  }
  function fidelityScore() {
    return FIDELITY.filter(function (f) { return !!F.fidelity[f[0]]; }).length;
  }
  function renderFidelityScore() {
    $('[data-testid="text-fidelity-score"]').textContent = 'Fidelity：' + fidelityScore() + ' / ' + FIDELITY.length;
  }

  /* rest */
  function initRest() {
    var sel = $('#selRestReason');
    sel.innerHTML = '<option value="">請選擇休息原因 Select reason</option>' +
      RC.REST_REASONS.map(function (r) { return '<option value="' + RC.esc(r) + '">' + RC.esc(r) + '</option>'; }).join('');
    $('#btnRestStart').addEventListener('click', function () {
      if (rest.active) return;
      pauseTimer();
      rest.start('', 'Session ' + F.session);
      $('#btnRestStart').classList.add('rs-hidden');
      $('#btnRestResume').classList.remove('rs-hidden');
      sel.classList.remove('rs-hidden'); sel.value = '';
      $('#restTimer').classList.remove('rs-hidden');
      restTick = setInterval(renderRest, 1000);
      renderRest(); markDirty();
    });
    $('#btnRestResume').addEventListener('click', function () {
      if (!rest.active) return;
      if (!sel.value) { alert('請先選擇休息原因 Rest reason is required.'); return; }
      rest.active.reason = sel.value;
      rest.resume();
      clearInterval(restTick); restTick = null;
      $('#btnRestStart').classList.remove('rs-hidden');
      $('#btnRestResume').classList.add('rs-hidden');
      sel.classList.add('rs-hidden');
      $('#restTimer').classList.add('rs-hidden');
      renderRest(); markDirty();
    });
  }
  function renderRest() {
    var t = rest.active ? Math.round((Date.now() - rest.active.startMs) / 1000) : 0;
    $('#restTimer').textContent = '休息中 Resting ' + RC.mmss(t);
    $('#restSummary').textContent = '休息次數 ' + rest.count() + ' · 總休息時間 ' + RC.mmss(rest.totalSec());
  }

  /* session timer */
  function startTimer() {
    if (rest.active) { alert('休息中，請先按「患者已準備好，繼續訓練」。'); return; }
    if (timer.running) return;
    timer.running = true; timer.startMs = Date.now();
    renderTimer();
  }
  function pauseTimer() {
    if (!timer.running) return;
    timer.acc += Math.round((Date.now() - timer.startMs) / 1000);
    timer.running = false;
    renderTimer();
  }
  function stopTimer() {
    pauseTimer();
    F.activeSec = timer.acc;
    $('#inpActiveSec').value = timer.acc;
    markDirty();
  }
  function renderTimer() {
    var t = timer.acc + (timer.running ? Math.round((Date.now() - timer.startMs) / 1000) : 0);
    $('[data-testid="text-session-timer"]').textContent = RC.mmss(t) + (timer.running ? '（進行中）' : '（已暫停）');
  }
  setInterval(function () { if (timer.running) renderTimer(); }, 1000);

  function renderAuto() {
    var pd = (RC.isNum(F.painPre) && RC.isNum(F.painPost)) ? (Number(F.painPost) - Number(F.painPre)) : null;
    var fd = (RC.isNum(F.fatiguePre) && RC.isNum(F.fatiguePost)) ? (Number(F.fatiguePost) - Number(F.fatiguePre)) : null;
    var cpm = RC.perMinute(F.correct, F.activeSec);
    $('[data-testid="text-session-auto"]').textContent =
      '自動摘要：active ' + (RC.isNum(F.activeSec) ? F.activeSec + ' 秒' : '—') +
      ' · rest ' + rest.totalSec() + ' 秒（' + rest.count() + ' 次）' +
      ' · 正確／分鐘 ' + (cpm === null ? '—' : cpm) +
      ' · 疼痛 Δ ' + (pd === null ? '—' : pd) + ' · 疲勞 Δ ' + (fd === null ? '—' : fd);
  }

  /* sessions list + export */
  function rowObject() {
    var o = {
      record_version: RC.VERSION,
      record_type: 'intervention_session',
      test_record: RC.isTestId(F.participantId) ? 'TEST' : '',
      participant_id: F.participantId,
      group: F.group,
      session: F.session,
      session_datetime: F.datetime,
      therapist_code: F.therapistCode,
      fthue_level: F.fthue,
      affected_side: F.affectedSide,
      delivery_type: F.deliveryType,
      chosen_scenario: F.scenario,
      tool: F.tool,
      difficulty_track: F.difficulty,
      conventional_activities: F.conventional,
      planned_min: F.plannedMin,
      active_training_sec: F.activeSec,
      rest_count: rest.count(),
      rest_total_sec: rest.totalSec(),
      correct: F.correct, wrong: F.wrong, drops: F.drops,
      correct_per_min: RC.perMinute(F.correct, F.activeSec),
      assistance: F.assistance, trunk_compensation: F.trunk,
      pain_pre: F.painPre, pain_post: F.painPost,
      pain_delta: (RC.isNum(F.painPre) && RC.isNum(F.painPost)) ? Number(F.painPost) - Number(F.painPre) : '',
      fatigue_pre: F.fatiguePre, fatigue_post: F.fatiguePost,
      fatigue_delta: (RC.isNum(F.fatiguePre) && RC.isNum(F.fatiguePost)) ? Number(F.fatiguePost) - Number(F.fatiguePre) : '',
      technical_failure: F.techFailure, technical_detail: F.techDetail,
      adverse_event: F.adverseEvent, adverse_event_detail: F.aeDetail,
      protocol_deviation: F.deviation, deviation_detail: F.deviationDetail,
      session_completion: F.completion,
      fidelity_score: fidelityScore(),
      fidelity_total: FIDELITY.length,
      recorded_at: RC.nowISO()
    };
    FIDELITY.forEach(function (f) { o['fidelity_' + f[0]] = F.fidelity[f[0]] ? 'yes' : 'no'; });
    return o;
  }
  function addSession() {
    var r = RC.validateId(F.participantId);
    if (!r.ok) { feedback('未能加入：' + RC.esc(r.msg), 'danger'); return; }
    if (!F.group) { feedback('未能加入：請選擇研究組別。', 'danger'); return; }
    sessions.push(rowObject());
    renderSessions();
    dirty = true; renderStatus();
    feedback('已加入 Session ' + RC.esc(F.session) + '（記憶體）。請記得下載 CSV。');
  }
  function renderSessions() {
    $('#sessionBody').innerHTML = sessions.length ? sessions.map(function (s, i) {
      return '<tr data-testid="row-session-' + (i + 1) + '"><td>' + (i + 1) + '</td><td>' + RC.esc(s.participant_id) +
        '</td><td>' + RC.esc(s.session) + '</td><td>' + RC.esc(s.group) + '</td><td>' + RC.esc(s.active_training_sec) +
        '</td><td>' + RC.esc(s.rest_total_sec) + '</td><td>' + s.fidelity_score + '/' + s.fidelity_total +
        '</td><td>' + RC.esc(s.protocol_deviation) + '</td><td>' + RC.esc(s.test_record) + '</td></tr>';
    }).join('') : '<tr><td colspan="9">未有節次紀錄 No sessions recorded</td></tr>';
  }
  function feedback(html, kind) {
    $('#downloadFeedback').innerHTML = '<div class="rs-note rs-note-' + (kind || 'ok') + '"><span class="rs-note-icon">' +
      (kind === 'danger' ? '✖' : '✔') + '</span><span>' + html + '</span></div>';
  }
  function downloadSessions() {
    var list = sessions.length ? sessions : [rowObject()];
    var head = Object.keys(list[0]);
    var rows = [head].concat(list.map(function (o) { return head.map(function (k) { return o[k]; }); }));
    var name = (F.participantId || 'UNKNOWN') + '_intervention_sessions.csv';
    RC.downloadCSV(name, rows);
    dirty = false; renderStatus();
    feedback('已下載 <b>' + RC.esc(name) + '</b>（' + head.length + ' 欄，UTF-8 BOM）。');
  }
  function downloadRestLog() {
    var rows = [['participant_id', 'session', 'entry_type', 'index', 'context', 'reason', 'start', 'end', 'duration_sec', 'resumed', 'test_record']];
    rest.entries.forEach(function (e) {
      rows.push([F.participantId, F.session, 'rest', e.index, e.context, e.reason, e.startedAt, e.endedAt || '',
        e.durationSec, e.resumed ? 'yes' : 'no', RC.isTestId(F.participantId) ? 'TEST' : '']);
    });
    rows.push([F.participantId, F.session, 'adverse_event', 1, 'session', F.aeDetail, '', '', '',
      F.adverseEvent || 'not recorded', RC.isTestId(F.participantId) ? 'TEST' : '']);
    rows.push([F.participantId, F.session, 'protocol_deviation', 1, 'session', F.deviationDetail, '', '', '',
      F.deviation || 'not recorded', RC.isTestId(F.participantId) ? 'TEST' : '']);
    var name = (F.participantId || 'UNKNOWN') + '_S' + F.session + '_rest_ae_log.csv';
    RC.downloadCSV(name, rows);
    feedback('已下載 <b>' + RC.esc(name) + '</b>。');
  }

  /* presets */
  function applyPreset(code) {
    if (!code) { location.reload(); return; }
    F.participantId = code; F.group = 'game_intervention'; F.session = '1';
    F.therapistCode = 'TESTOT'; F.fthue = '5'; F.affectedSide = 'right';
    F.deliveryType = 'game'; F.scenario = 'tea_house'; F.tool = 'chopsticks';
    F.difficulty = 'simple_sort_motor'; F.conventional = 'Peg board / 15 / 60';
    F.activeSec = 780; F.correct = 24; F.wrong = 3; F.drops = 1;
    F.assistance = 'verbal'; F.trunk = 'mild';
    F.painPre = 2; F.painPost = 3; F.fatiguePre = 3; F.fatiguePost = 6;
    F.techFailure = 'no'; F.adverseEvent = 'no'; F.deviation = 'no'; F.completion = 'yes';
    FIDELITY.forEach(function (f) { F.fidelity[f[0]] = true; });
    if (code === 'TEST002') {
      var r1 = rest.start('Fatigue 疲勞', 'Session 1'); r1.startMs = Date.now() - 110000; rest.resume();
      var r2 = rest.start('Participant request 參加者要求', 'Session 1'); r2.startMs = Date.now() - 60000; rest.resume();
    }
    if (code === 'TEST003') {
      F.group = 'conventional_control'; F.deliveryType = 'conventional'; F.scenario = '';
      F.correct = ''; F.wrong = ''; F.painPost = ''; F.completion = 'partial';
      F.deviation = 'yes'; F.deviationDetail = '節次縮短至 9 分鐘（參加者疲勞）。';
      FIDELITY.forEach(function (f, i) { F.fidelity[f[0]] = i < 4; });
    }
    RC.applyTestChrome(true);
    sync(); renderStatus();
  }

  function init() {
    renderFidelity();
    bind();
    initRest();
    sync();
    renderSessions();
    renderStatus();
    RC.installUnloadGuard(function () { return dirty; });
  }
  document.addEventListener('DOMContentLoaded', init);
  window.__interventionQA = { form: function () { return F; }, sessions: function () { return sessions; }, row: rowObject };
})();
