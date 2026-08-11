/* ============================================================
   Intervention therapist bundle — Session 1-5 delivery record.
   Memory-only. Kept separate from the outcome-assessment form.
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
    assistance: 'unobserved', trunk: 'unobserved', painPre: '', painPost: '', fatiguePre: '', fatiguePost: '',
    patientDifficulty: '', patientMotivation: '', acceptability: '', movementQuality: '', setupMin: '', therapistComment: '',
    techFailure: '', interrupted: '', techDetail: '', adverseEvent: '', aeSerious: '', aeRelated: '', aeDetail: '', deviation: '', deviationDetail: '',
    completion: '', fidelity: {}, safetyConfirmed: false, autoSource: '',
    score: '', grabs: '', pauseCount: '', trackingLossSec: '', technicalFailures: ''
  };
  var rest = new RC.RestLogger();
  var sessions = [];
  var dirty = false;
  var restTick = null;
  var timer = { running: false, startMs: 0, acc: 0 };
  var uiStep = 1;
  var STEP_NAMES = ['病人及節數', '今節數據', '完成及下載'];

  var MAP = [
    ['#inpParticipantId', 'participantId'], ['#selGroup', 'group'], ['#selSession', 'session'],
    ['#inpSessionDatetime', 'datetime'], ['#inpTherapistCode', 'therapistCode'], ['#selFthue', 'fthue'],
    ['#selAffectedSide', 'affectedSide'], ['#selDeliveryType', 'deliveryType'], ['#selScenario', 'scenario'],
    ['#selTool', 'tool'], ['#selDifficulty', 'difficulty'], ['#inpConventional', 'conventional'],
    ['#inpPlannedMin', 'plannedMin'], ['#inpActiveSec', 'activeSec'], ['#inpCorrect', 'correct'],
    ['#inpWrong', 'wrong'], ['#inpDrops', 'drops'], ['#selAssistance', 'assistance'], ['#selTrunk', 'trunk'],
    ['#inpPainPre', 'painPre'], ['#inpPainPost', 'painPost'], ['#inpFatiguePre', 'fatiguePre'],
      ['#inpFatiguePost', 'fatiguePost'], ['#selPatientDifficulty', 'patientDifficulty'],
    ['#selPatientMotivation', 'patientMotivation'], ['#selAcceptability', 'acceptability'], ['#selMovementQuality', 'movementQuality'],
    ['#inpSetupMin', 'setupMin'], ['#inpTherapistComment', 'therapistComment'],
    ['#selTechFailure', 'techFailure'], ['#selInterrupted', 'interrupted'], ['#inpTechDetail', 'techDetail'],
    ['#selAdverseEvent', 'adverseEvent'], ['#selAeSerious', 'aeSerious'], ['#selAeRelated', 'aeRelated'],
    ['#inpAeDetail', 'aeDetail'], ['#selDeviation', 'deviation'],
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
    $('#chkSafety').checked = !!F.safetyConfirmed;
    FIDELITY.forEach(function (f) {
      var c = $('[data-testid="checkbox-fidelity-' + f[0] + '"]');
      if (c) c.checked = !!F.fidelity[f[0]];
    });
    renderFidelityScore(); renderAuto(); renderRest(); renderGroupFlow(); renderAutoSummary();
  }
  function bind() {
    MAP.forEach(function (m) {
      var el = $(m[0]); if (!el) return;
      var handler = function () {
        F[m[1]] = m[1] === 'participantId' ? el.value.toUpperCase() : el.value;
        if (m[1] === 'participantId') { el.value = F.participantId; validateId(); }
        if (m[1] === 'group') renderGroupFlow();
        markDirty();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    $('#chkSafety').addEventListener('change', function () {
      F.safetyConfirmed = $('#chkSafety').checked;
      markDirty();
    });
    $('[data-testid="button-timer-start"]').addEventListener('click', startTimer);
    $('[data-testid="button-timer-stop"]').addEventListener('click', stopTimer);
    $('[data-testid="button-add-session"]').addEventListener('click', addSession);
    $('[data-testid="button-download-sessions"]').addEventListener('click', downloadSessions);
    $('[data-testid="button-download-rest-log"]').addEventListener('click', downloadRestLog);
    $('#btnMarkNormal').addEventListener('click', markNormalSession);
    $('#btnLaunchGame').addEventListener('click', launchGame);
    $('#btnConventionalDone').addEventListener('click', function () {
      stopTimer();
      F.completion = F.completion || 'yes';
      gotoStep(3);
    });
    $('#btnInterventionPrev').addEventListener('click', function () { gotoStep(uiStep - 1); });
    $('#btnInterventionNext').addEventListener('click', function () {
      if (validateStep(uiStep)) gotoStep(uiStep + 1);
    });
    $('#btnFinishDownload').addEventListener('click', function () {
      if (addSession()) downloadSessions();
    });
  }
  function showBlocker(msg) {
    $('#interventionBlocker').innerHTML = msg ? '<div class="rs-note rs-note-danger"><span class="rs-note-icon">✖</span><span>' + RC.esc(msg) + '</span></div>' : '';
  }
  function validateStep(step) {
    showBlocker('');
    if (step === 1) {
      var id = RC.validateId(F.participantId);
      if (!id.ok) { showBlocker(id.msg); return false; }
      if (RC.isTestMode && !RC.isTestId(F.participantId)) { showBlocker('測試模式請使用 TEST 開頭的編號，例如 TEST001。'); return false; }
      if (!RC.isTestMode && RC.isTestId(F.participantId)) { showBlocker('正常模式不可使用 TEST 編號。請輸入正式匿名編號，例如 P001。'); return false; }
      if (!F.group || !F.fthue || !F.affectedSide) {
        showBlocker('請填完這頁'); return false;
      }
      if (!F.safetyConfirmed) { showBlocker('請先確認病人可以安全開始'); return false; }
    }
    if (step === 2) {
      if (!F.deliveryType) { showBlocker('請選擇訓練'); return false; }
      if ((F.deliveryType === 'game' || F.deliveryType === 'mixed') && (!F.scenario || !F.tool || !F.difficulty)) {
        showBlocker('請選擇遊戲、工具和難度'); return false;
      }
    }
    return true;
  }
  function gotoStep(next) {
    uiStep = Math.max(1, Math.min(3, next));
    $$('.rs-intervention-step').forEach(function (el) {
      el.classList.toggle('rs-hidden', Number(el.getAttribute('data-intervention-step')) !== uiStep);
    });
    $('#interventionProgressLabel').textContent = uiStep + ' / 3　' + STEP_NAMES[uiStep - 1];
    $('#interventionProgressBar').style.width = (uiStep * 100 / 3) + '%';
    $('#btnInterventionPrev').disabled = uiStep === 1;
    $('#btnInterventionNext').classList.toggle('rs-hidden', uiStep !== 1);
    if (uiStep === 3) $('.rs-rest-dock').classList.add('rs-hidden');
    else renderGroupFlow();
    showBlocker('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function renderGroupFlow() {
    var isGame = F.group !== 'conventional_control';
    if (F.group) F.deliveryType = isGame ? 'game' : 'conventional';
    $('#step2Title').textContent = isGame ? '選擇遊戲' : '傳統治療記錄';
    $('#gameChoiceFields').classList.toggle('rs-hidden', !isGame);
    $('#gameLaunchPanel').classList.toggle('rs-hidden', !isGame);
    $('#conventionalRecordPanel').classList.toggle('rs-hidden', isGame);
    $('.rs-rest-dock').classList.toggle('rs-hidden', isGame && F.autoSource !== 'game-result');
  }
  function launchGame() {
    if (!validateStep(1) || !validateStep(2)) return;
    var scenarioMap = {
      tea_house: 'dimsum', mahjong: 'mahjong', cards: 'cards',
      laundry: 'laundry', flower: 'flowers'
    };
    var params = new URLSearchParams({
      role: 'intervention',
      source: 'session-recorder',
      autostart: '1',
      mode: RC.isTestMode ? 'test' : 'normal',
      participant: F.participantId,
      visit: 's' + F.session,
      arm: 'game_intervention',
      level: F.fthue,
      side: F.affectedSide,
      scenario: scenarioMap[F.scenario] || 'dimsum',
      tool: F.tool,
      track: F.difficulty,
      safety: 'confirmed',
      return: 'research/intervention.html'
    });
    window.location.href = '../index.html?' + params.toString();
  }
  function markNormalSession() {
    F.techFailure = 'no';
    F.interrupted = 'no';
    F.techDetail = '';
    F.adverseEvent = 'no';
    F.aeSerious = 'no';
    F.aeRelated = 'no';
    F.aeDetail = '';
    F.deviation = 'no';
    F.deviationDetail = '';
    F.completion = 'yes';
    FIDELITY.forEach(function (f) { F.fidelity[f[0]] = true; });
    sync();
    markDirty();
    feedback('已記錄「今節一切正常」。如情況有變，可展開「有問題或未能完成時才填」修改。');
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
    $('#restSummary').textContent = '休息 ' + rest.count() + ' 次 · ' + RC.mmss(rest.totalSec());
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
    var cpm = RC.perMinute(F.correct, F.activeSec);
    $('[data-testid="text-session-auto"]').textContent =
      '訓練 ' + (RC.isNum(F.activeSec) ? F.activeSec + ' 秒' : '—') +
      ' · 休息 ' + rest.totalSec() + ' 秒' +
      ' · 正確／分鐘 ' + (cpm === null ? '—' : cpm);
  }
  function renderAutoSummary() {
    var panel = $('#autoGameSummary');
    var isAuto = F.autoSource === 'game-result';
    panel.classList.toggle('rs-hidden', !isAuto);
    if (!isAuto) return;
    $('#autoGameMetrics').textContent =
      '時間 ' + (F.activeSec || 0) + ' 秒　·　正確 ' + (F.correct || 0) +
      '　·　錯誤 ' + (F.wrong || 0) + '　·　跌落 ' + (F.drops || 0);
    ['#inpActiveSec', '#inpCorrect', '#inpWrong', '#inpDrops'].forEach(function (selector) {
      $(selector).readOnly = true;
    });
  }
  function symptomText(v) {
    return ({ none: '無', mild: '少少', moderate: '幾', severe: '好', unable: '未能可靠回答' })[v] || '—';
  }
  function symptomOrdinal(v) {
    return ({ none: 0, mild: 1, moderate: 2, severe: 3 })[v];
  }
  function symptomDelta(pre, post) {
    var a = symptomOrdinal(pre), b = symptomOrdinal(post);
    return a === undefined || b === undefined ? '' : b - a;
  }

  /* sessions list + export */
  function rowObject() {
    var o = {
      record_version: RC.VERSION,
      record_type: 'intervention_session',
      collection_mode: RC.isTestMode ? 'test' : 'normal',
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
      planned_training_sec: RC.isNum(F.plannedMin) ? Number(F.plannedMin) * 60 : '',
      active_training_sec: F.activeSec,
      training_delivered_pct: RC.isNum(F.plannedMin) && Number(F.plannedMin) > 0 && RC.isNum(F.activeSec)
        ? Math.round(Number(F.activeSec) / (Number(F.plannedMin) * 60) * 1000) / 10 : '',
      session_interrupted: F.interrupted,
      rest_count: F.autoSource === 'game-result' ? F.pauseCount : rest.count(),
      rest_total_sec: rest.totalSec(),
      correct: F.correct, wrong: F.wrong, drops: F.drops,
      game_score: F.score, game_pickups: F.grabs,
      game_pause_count: F.pauseCount,
      game_tracking_loss_sec: F.trackingLossSec,
      game_technical_failures: F.technicalFailures,
      objective_data_source: F.autoSource || 'manual',
      correct_per_min: RC.perMinute(F.correct, F.activeSec),
      assistance: F.assistance, trunk_compensation: F.trunk,
      symptom_rating_method: 'verbal_4_or_unable',
      pain_pre: F.painPre, pain_post: F.painPost,
      pain_delta: symptomDelta(F.painPre, F.painPost),
      pain_increased: symptomDelta(F.painPre, F.painPost) === '' ? '' : (symptomDelta(F.painPre, F.painPost) > 0 ? 'yes' : 'no'),
      fatigue_pre: F.fatiguePre, fatigue_post: F.fatiguePost,
      fatigue_delta: symptomDelta(F.fatiguePre, F.fatiguePost),
      fatigue_increased: symptomDelta(F.fatiguePre, F.fatiguePost) === '' ? '' : (symptomDelta(F.fatiguePre, F.fatiguePost) > 0 ? 'yes' : 'no'),
      patient_perceived_difficulty: F.patientDifficulty,
      patient_wants_continue: F.patientMotivation,
      patient_acceptability_1_5: F.acceptability,
      observed_movement_quality: F.movementQuality,
      therapist_setup_min: F.setupMin,
      therapist_comment: F.therapistComment,
      technical_failure: F.techFailure, technical_detail: F.techDetail,
      adverse_event: F.adverseEvent, adverse_event_serious: F.aeSerious,
      adverse_event_related: F.aeRelated, adverse_event_detail: F.aeDetail,
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
    if (!r.ok) { feedback('未能加入：' + RC.esc(r.msg), 'danger'); return false; }
    if (!F.group) { feedback('未能加入：請選擇組別。', 'danger'); return false; }
    sessions.push(rowObject());
    renderSessions();
    dirty = true; renderStatus();
    feedback('已加入 Session ' + RC.esc(F.session) + '（記憶體）。請記得下載 CSV。');
    return true;
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
    var list = [rowObject()];
    var head = Object.keys(list[0]);
    var rows = [head].concat(list.map(function (o) { return head.map(function (k) { return o[k]; }); }));
    var name = (F.participantId || 'UNKNOWN') + '_S' + F.session + '_session.csv';
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
    F.painPre = 'mild'; F.painPost = 'mild'; F.fatiguePre = 'mild'; F.fatiguePost = 'moderate';
    F.patientDifficulty = 'just_right'; F.patientMotivation = 'yes'; F.movementQuality = 'better';
    F.acceptability = '4';
    F.setupMin = '3'; F.therapistComment = '操作順暢';
    F.techFailure = 'no'; F.interrupted = 'no'; F.adverseEvent = 'no'; F.aeSerious = 'no'; F.aeRelated = 'no';
    F.deviation = 'no'; F.completion = 'yes';
    FIDELITY.forEach(function (f) { F.fidelity[f[0]] = true; });
    if (code === 'TEST002') {
      var r1 = rest.start('Fatigue 疲勞', 'Session 1'); r1.startMs = Date.now() - 110000; rest.resume();
      var r2 = rest.start('Participant request 參加者要求', 'Session 1'); r2.startMs = Date.now() - 60000; rest.resume();
    }
    if (code === 'TEST003') {
      F.group = 'conventional_control'; F.deliveryType = 'conventional'; F.scenario = '';
      F.correct = ''; F.wrong = ''; F.painPost = ''; F.completion = 'partial';
      F.interrupted = 'yes'; F.acceptability = '';
      F.deviation = 'yes'; F.deviationDetail = '節次縮短至 9 分鐘（參加者疲勞）。';
      FIDELITY.forEach(function (f, i) { F.fidelity[f[0]] = i < 4; });
    }
    RC.applyTestChrome(true);
    sync(); renderStatus();
  }

  function applyGameReturn() {
    var p = new URLSearchParams(window.location.search);
    if (p.get('source') !== 'game-result') return false;
    var scenarioMap = {
      dimsum: 'tea_house', mahjong: 'mahjong', cards: 'cards',
      laundry: 'laundry', flowers: 'flower'
    };
    F.participantId = (p.get('participant') || '').toUpperCase();
    F.group = p.get('group') || 'game_intervention';
    F.session = p.get('session') || '1';
    F.fthue = p.get('fthue') || '';
    F.affectedSide = p.get('side') || '';
    F.deliveryType = 'game';
    F.scenario = scenarioMap[p.get('scenario')] || 'tea_house';
    F.tool = p.get('tool') || 'none';
    F.difficulty = p.get('difficulty') || 'simple_sort_motor';
    F.activeSec = p.get('active_sec') || '';
    F.correct = p.get('correct') || '0';
    F.wrong = p.get('wrong') || '0';
    F.drops = p.get('drops') || '0';
    F.score = p.get('score') || '';
    F.grabs = p.get('grabs') || '';
    F.pauseCount = p.get('pause_count') || '0';
    F.trackingLossSec = p.get('tracking_loss_sec') || '0';
    F.technicalFailures = p.get('technical_failures') || '0';
    F.techFailure = Number(F.technicalFailures) > 0 ? 'yes' : 'no';
    F.completion = 'yes';
    F.assistance = 'unobserved';
    F.trunk = 'unobserved';
    F.safetyConfirmed = true;
    F.autoSource = 'game-result';
    return true;
  }

  function init() {
    var returnedFromGame = applyGameReturn();
    if (RC.isTestMode && !F.participantId) F.participantId = 'TEST001';
    dirty = returnedFromGame;
    renderFidelity();
    bind();
    initRest();
    sync();
    renderSessions();
    renderStatus();
    gotoStep(returnedFromGame ? 3 : 1);
    RC.installUnloadGuard(function () { return dirty; });
  }
  document.addEventListener('DOMContentLoaded', init);
  window.__interventionQA = { form: function () { return F; }, sessions: function () { return sessions; }, row: rowObject, step: function () { return uiStep; } };
})();
