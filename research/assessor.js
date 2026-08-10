/* ============================================================
   Blinded assessor bundle — T0/T1 standardized assessment.
   BLINDING RULE: this file must never load, reference, fetch or
   store allocation / group / session-training information.
   Memory-only. No localStorage / sessionStorage / indexedDB / cookies.
   ============================================================ */
(function () {
  'use strict';

  var $ = RC.$, $$ = RC.$$;
  var TOTAL_STEPS = 10;
  var SCENARIO = '茶樓飲茶';

  var ADL_ITEMS = [
    { key: 'feeding', zh: '進食 Feeding' },
    { key: 'grooming', zh: '梳洗 Grooming' },
    { key: 'dressing', zh: '穿上衣 Upper-garment dressing' }
  ];

  var COND_LABEL = {
    motor: '單一動作 Single motor',
    cognitive: '單一認知 Single cognitive',
    dual: '雙重任務 Dual task'
  };
  var INSTR_MOTOR = '請將點心放到正確位置。現在不需要回答其他問題，請盡量做得準確。';
  var INSTR_DUAL = '請將點心放到正確位置，同時聽住播出的點心名稱。聽到『燒賣』就講『有』。兩樣都要做，唔好只集中做其中一樣。';
  var INSTR_COG = '請聽住播出的點心名稱。聽到『燒賣』就講『有』；聽到『蝦餃』或『叉燒包』就唔好出聲。';

  /* ---------------- state ---------------- */
  function blankMotor() {
    return { correct: '', wrong: '', drops: '', activeSec: '', assistance: '', trunk: '' };
  }
  function blankCog() { return { hits: '', misses: '', fa: '', cr: '' }; }
  function blankAdl() {
    return { score: '', timeSec: '', physicalAssist: '', verbalCues: '', device: '', unable: false, unableReason: '' };
  }
  function newState() {
    return {
      participantId: '', timepoint: 'T0', datetime: RC.nowLocalInput(), assessorCode: '', affectedSide: '',
      blindGroup: false, blindRecords: false, possibleUnblinding: false, breachReason: '', breachAssessor: '',
      medicalStable: '', painPre: null, fatiguePre: null,
      painMethodPre: '', painVerbalPre: '', fatigueMethodPre: '', fatigueVerbalPre: '',
      readyToStart: '', pauseReason: '',
      fthue: { level: '', completed: '', unableReason: '', assistance: '', cues: '', trunk: '', painLimited: '', fatigueLimited: '' },
      grip: { dynId: '', handle: '', t1: '', t2: '', t3: '', unable: false, unableReason: '' },
      pinch: { type: '', t1: '', t2: '', t3: '', unable: false, unableReason: '' },
      adl: { feeding: blankAdl(), grooming: blankAdl(), dressing: blankAdl() },
      setup: {
        fthue: '', motorTask: '', tool: '', foodSize: '', plateSize: '', camera: '',
        cognitiveTask: 'auditory_target', cognitiveDifficulty: '', duration: 120,
        order: 'motor,cognitive,dual', feedbackOff: false,
        locked: false, randomizedOnce: false
      },
      cond: {
        motor: { motor: blankMotor(), cog: null },
        cognitive: { motor: null, cog: blankCog() },
        dual: { motor: blankMotor(), cog: blankCog() }
      },
      post: { painPost: null, fatiguePost: null, painMethodPost: '', painVerbalPost: '',
        fatigueMethodPost: '', fatigueVerbalPost: '', newSymptom: '', adverseEvent: '', aeDescription: '', completed: '' },
      rest: new RC.RestLogger(),
      audit: [],
      locked: false,
      testMode: '',
      t0Import: null,
      downloaded: { assessment: false, settings: false },
      touched: false
    };
  }
  var S = newState();

  var ui = { step: 1, adlIndex: 0, condIndex: 0, restTick: null };

  /* ---------------- helpers ---------------- */
  function markDirty() {
    S.touched = true;
    S.downloaded.assessment = false;
    renderDownloadStatus();
  }
  function isDirty() { return S.touched && !S.downloaded.assessment; }

  function renderDownloadStatus() {
    var el = $('#statusDownload');
    if (!el) return;
    var ok = S.downloaded.assessment && (S.timepoint === 'T1' || S.downloaded.settings);
    el.className = 'rs-status-pill ' + (ok ? 'rs-status-done' : 'rs-status-pending');
    el.textContent = ok ? '✔ 已下載 Downloaded' : '⬤ 尚未下載 Not downloaded';
  }

  function condOrder() { return S.setup.order.split(','); }

  /* ---------------- 0-10 scales ---------------- */
  var SCALE_ICONS = ['○ 無', '·', '··', '···', '▲', '▲▲', '▲▲▲', '■', '■■', '■■■', '✖ 極'];
  function buildScale(container) {
    var key = container.getAttribute('data-scale');
    var slug = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    container.innerHTML = '';
    for (var i = 0; i <= 10; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-testid', 'button-' + slug + '-' + i);
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('data-val', String(i));
      b.innerHTML = '<span>' + i + '</span><span class="rs-scale-icon">' + SCALE_ICONS[i] + '</span>';
      b.addEventListener('click', (function (k, v, node) {
        return function () { setScale(k, v); };
      })(key, i, b));
      container.appendChild(b);
    }
  }
  function setScale(key, val) {
    if (S.locked) return alertLocked();
    if (key === 'painPre') { S.painPre = val; S.painMethodPre = 'numeric_0_10'; S.painVerbalPre = ''; }
    else if (key === 'fatiguePre') { S.fatiguePre = val; S.fatigueMethodPre = 'numeric_0_10'; S.fatigueVerbalPre = ''; }
    else if (key === 'painPost') { S.post.painPost = val; S.post.painMethodPost = 'numeric_0_10'; S.post.painVerbalPost = ''; }
    else if (key === 'fatiguePost') { S.post.fatiguePost = val; S.post.fatigueMethodPost = 'numeric_0_10'; S.post.fatigueVerbalPost = ''; }
    markDirty();
    syncScales();
    renderAutoSummary();
  }
  function scaleValue(key) {
    if (key === 'painPre') return S.painPre;
    if (key === 'fatiguePre') return S.fatiguePre;
    if (key === 'painPost') return S.post.painPost;
    return S.post.fatiguePost;
  }
  function syncScales() {
    $$('.rs-scale').forEach(function (c) {
      var key = c.getAttribute('data-scale');
      var v = scaleValue(key);
      $$('button', c).forEach(function (b) {
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-val')) === v));
      });
    });
    $$('.rs-simple-rating').forEach(function (c) {
      var key = c.getAttribute('data-simple-rating');
      var v = verbalValue(key);
      $$('button', c).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-val') === v)); });
    });
  }
  function verbalValue(key) {
    if (key === 'painPre') return S.painMethodPre === 'unable' ? 'unable' : S.painVerbalPre;
    if (key === 'fatiguePre') return S.fatigueMethodPre === 'unable' ? 'unable' : S.fatigueVerbalPre;
    if (key === 'painPost') return S.post.painMethodPost === 'unable' ? 'unable' : S.post.painVerbalPost;
    return S.post.fatigueMethodPost === 'unable' ? 'unable' : S.post.fatigueVerbalPost;
  }
  function setVerbal(key, val) {
    if (S.locked) return alertLocked();
    var method = val === 'unable' ? 'unable' : 'verbal_4';
    if (key === 'painPre') { S.painMethodPre = method; S.painVerbalPre = val === 'unable' ? '' : val; S.painPre = null; }
    else if (key === 'fatiguePre') { S.fatigueMethodPre = method; S.fatigueVerbalPre = val === 'unable' ? '' : val; S.fatiguePre = null; }
    else if (key === 'painPost') { S.post.painMethodPost = method; S.post.painVerbalPost = val === 'unable' ? '' : val; S.post.painPost = null; }
    else { S.post.fatigueMethodPost = method; S.post.fatigueVerbalPost = val === 'unable' ? '' : val; S.post.fatiguePost = null; }
    markDirty(); syncScales(); renderAutoSummary();
  }
  function ratingComplete(key) {
    if (key === 'painPre') return !!S.painMethodPre;
    if (key === 'fatiguePre') return !!S.fatigueMethodPre;
    if (key === 'painPost') return !!S.post.painMethodPost;
    return !!S.post.fatigueMethodPost;
  }
  function ratingText(method, verbal, numeric) {
    if (method === 'numeric_0_10') return numeric + '/10';
    if (method === 'unable') return '未能可靠回答';
    return ({ none: '無', mild: '少少', moderate: '幾', severe: '好' })[verbal] || '—';
  }

  /* ---------------- Y/N toggle buttons ---------------- */
  function syncYN() {
    $$('[data-yn]').forEach(function (b) {
      var f = b.getAttribute('data-yn');
      var cur = (f === 'medicalStable') ? S.medicalStable : S.readyToStart;
      b.setAttribute('aria-pressed', String(cur === b.getAttribute('data-val')));
    });
    $('#pauseBlock').classList.toggle('rs-hidden', !(S.medicalStable === 'no' || S.readyToStart === 'no'));
  }

  /* ---------------- field binding ---------------- */
  var BINDINGS = [
    ['#inpParticipantId', function (v) { S.participantId = v.toUpperCase(); }, function () { return S.participantId; }],
    ['#selTimepoint', function (v) { S.timepoint = v; onTimepointChange(); }, function () { return S.timepoint; }],
    ['#inpAssessDatetime', function (v) { S.datetime = v; }, function () { return S.datetime; }],
    ['#inpAssessorCode', function (v) { S.assessorCode = v.toUpperCase(); }, function () { return S.assessorCode; }],
    ['#selAffectedSide', function (v) { S.affectedSide = v; }, function () { return S.affectedSide; }],
    ['#inpBreachReason', function (v) { S.breachReason = v; }, function () { return S.breachReason; }],
    ['#inpBreachAssessor', function (v) { S.breachAssessor = v.toUpperCase(); }, function () { return S.breachAssessor; }],
    ['#inpPauseReason', function (v) { S.pauseReason = v; }, function () { return S.pauseReason; }],
    ['#selFthueLevel', function (v) { S.fthue.level = v; }, function () { return S.fthue.level; }],
    ['#selFthueCompleted', function (v) { S.fthue.completed = v; }, function () { return S.fthue.completed; }],
    ['#inpFthueUnableReason', function (v) { S.fthue.unableReason = v; }, function () { return S.fthue.unableReason; }],
    ['#selFthueAssistance', function (v) { S.fthue.assistance = v; }, function () { return S.fthue.assistance; }],
    ['#inpFthueCues', function (v) { S.fthue.cues = v; }, function () { return S.fthue.cues; }],
    ['#selFthueTrunk', function (v) { S.fthue.trunk = v; }, function () { return S.fthue.trunk; }],
    ['#selFthuePain', function (v) { S.fthue.painLimited = v; }, function () { return S.fthue.painLimited; }],
    ['#selFthueFatigue', function (v) { S.fthue.fatigueLimited = v; }, function () { return S.fthue.fatigueLimited; }],
    ['#inpDynamometerId', function (v) { S.grip.dynId = v; }, function () { return S.grip.dynId; }],
    ['#selHandleSetting', function (v) { S.grip.handle = v; }, function () { return S.grip.handle; }],
    ['#inpGrip1', function (v) { S.grip.t1 = v; renderGrip(); }, function () { return S.grip.t1; }],
    ['#inpGrip2', function (v) { S.grip.t2 = v; renderGrip(); }, function () { return S.grip.t2; }],
    ['#inpGrip3', function (v) { S.grip.t3 = v; renderGrip(); }, function () { return S.grip.t3; }],
    ['#inpGripUnableReason', function (v) { S.grip.unableReason = v; }, function () { return S.grip.unableReason; }],
    ['#selPinchType', function (v) { S.pinch.type = v; }, function () { return S.pinch.type; }],
    ['#inpPinch1', function (v) { S.pinch.t1 = v; renderPinch(); }, function () { return S.pinch.t1; }],
    ['#inpPinch2', function (v) { S.pinch.t2 = v; renderPinch(); }, function () { return S.pinch.t2; }],
    ['#inpPinch3', function (v) { S.pinch.t3 = v; renderPinch(); }, function () { return S.pinch.t3; }],
    ['#inpPinchUnableReason', function (v) { S.pinch.unableReason = v; }, function () { return S.pinch.unableReason; }],
    ['#selSetupFthue', function (v) { S.setup.fthue = v; }, function () { return S.setup.fthue; }],
    ['#selMotorTask', function (v) { S.setup.motorTask = v; }, function () { return S.setup.motorTask; }],
    ['#selSetupTool', function (v) { S.setup.tool = v; }, function () { return S.setup.tool; }],
    ['#selFoodSize', function (v) { S.setup.foodSize = v; }, function () { return S.setup.foodSize; }],
    ['#selPlateSize', function (v) { S.setup.plateSize = v; }, function () { return S.setup.plateSize; }],
    ['#selCameraPosition', function (v) { S.setup.camera = v; }, function () { return S.setup.camera; }],
    ['#selCognitiveTask', function (v) { S.setup.cognitiveTask = v; }, function () { return S.setup.cognitiveTask; }],
    ['#selCognitiveDifficulty', function (v) { S.setup.cognitiveDifficulty = v; }, function () { return S.setup.cognitiveDifficulty; }],
    ['#inpConditionDuration', function (v) { S.setup.duration = v; }, function () { return S.setup.duration; }],
    ['#selConditionOrder', function (v) { S.setup.order = v; renderCondition(); }, function () { return S.setup.order; }],
    ['#selNewSymptom', function (v) { S.post.newSymptom = v; }, function () { return S.post.newSymptom; }],
    ['#selAdverseEvent', function (v) { S.post.adverseEvent = v; }, function () { return S.post.adverseEvent; }],
    ['#inpAeDescription', function (v) { S.post.aeDescription = v; }, function () { return S.post.aeDescription; }],
    ['#selAssessmentCompleted', function (v) { S.post.completed = v; }, function () { return S.post.completed; }]
  ];

  function bindFields() {
    BINDINGS.forEach(function (b) {
      var el = $(b[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        if (S.locked) { syncFields(); return alertLocked(); }
        b[1](el.value);
        if (b[0] === '#inpParticipantId') { el.value = S.participantId; validateIdField(); }
        markDirty();
      });
      el.addEventListener('change', function () {
        if (S.locked) { syncFields(); return alertLocked(); }
        b[1](el.value);
        markDirty();
      });
    });

    // checkboxes
    [['#chkBlindGroup', 'blindGroup'], ['#chkBlindRecords', 'blindRecords'], ['#chkPossibleUnblinding', 'possibleUnblinding']]
      .forEach(function (p) {
        $(p[0]).addEventListener('change', function () {
          if (S.locked) { syncFields(); return alertLocked(); }
          S[p[1]] = this.checked;
          $('#breachBlock').classList.toggle('rs-hidden', !S.possibleUnblinding);
          markDirty();
        });
      });
    $('#chkGripUnable').addEventListener('change', function () {
      if (S.locked) { syncFields(); return alertLocked(); }
      S.grip.unable = this.checked; renderGrip(); markDirty();
    });
    $('#chkPinchUnable').addEventListener('change', function () {
      if (S.locked) { syncFields(); return alertLocked(); }
      S.pinch.unable = this.checked; renderPinch(); markDirty();
    });
    $('#chkFeedbackOff').addEventListener('change', function () {
      if (S.locked) { syncFields(); return alertLocked(); }
      S.setup.feedbackOff = this.checked; markDirty();
    });

    $$('[data-yn]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (S.locked) return alertLocked();
        var f = b.getAttribute('data-yn');
        if (f === 'medicalStable') S.medicalStable = b.getAttribute('data-val');
        else S.readyToStart = b.getAttribute('data-val');
        syncYN(); markDirty();
      });
    });

    $$('[data-voice]').forEach(function (b) {
      b.addEventListener('click', function () { RC.speak(b.getAttribute('data-voice')); });
    });
    $$('.rs-simple-rating button').forEach(function (b) {
      b.addEventListener('click', function () { setVerbal(b.parentNode.getAttribute('data-simple-rating'), b.getAttribute('data-val')); });
    });
  }

  function syncFields() {
    BINDINGS.forEach(function (b) {
      var el = $(b[0]); if (!el) return;
      var v = b[2]();
      el.value = (v === null || v === undefined) ? '' : v;
    });
    $('#chkBlindGroup').checked = S.blindGroup;
    $('#chkBlindRecords').checked = S.blindRecords;
    $('#chkPossibleUnblinding').checked = S.possibleUnblinding;
    $('#breachBlock').classList.toggle('rs-hidden', !S.possibleUnblinding);
    $('#chkGripUnable').checked = S.grip.unable;
    $('#chkPinchUnable').checked = S.pinch.unable;
    $('#chkFeedbackOff').checked = S.setup.feedbackOff;
    syncScales(); syncYN(); renderGrip(); renderPinch(); renderSetupLock();
  }

  function validateIdField() {
    var r = RC.validateId(S.participantId);
    var el = $('#idError');
    el.textContent = S.participantId === '' ? '' : (r.ok ? '✔ 格式正確 Valid anonymous ID' : '✖ ' + r.msg);
    el.style.color = r.ok ? '#12482E' : '#A32217';
    return r;
  }

  function alertLocked() {
    showBlocker('紀錄已鎖定，不可直接修改。如需更正，請使用第 10 步的「鎖定後更正」功能（append-only audit）。');
  }
  function showBlocker(msg) {
    var n = $('#blockerNote');
    $('#blockerText').textContent = msg;
    n.classList.remove('rs-hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function hideBlocker() { $('#blockerNote').classList.add('rs-hidden'); }

  /* ---------------- rest logger ---------------- */
  function initRest() {
    var sel = $('#selRestReason');
    sel.innerHTML = '<option value="">請選擇休息原因 Select reason</option>' +
      RC.REST_REASONS.map(function (r) { return '<option value="' + RC.esc(r) + '">' + RC.esc(r) + '</option>'; }).join('');
    $('#btnRestStart').addEventListener('click', function () { startRest(currentContext()); });
    $('#btnRestResume').addEventListener('click', resumeRest);
    sel.addEventListener('change', function () {
      if (S.rest.active) { S.rest.active.reason = sel.value; markDirty(); }
    });
    $$('[data-rest-context]').forEach(function (b) {
      b.addEventListener('click', function () { startRest(b.getAttribute('data-rest-context')); });
    });
    $('[data-testid="button-grip-ready-next-trial"]').addEventListener('click', function () {
      if (S.rest.active) resumeRest();
      $('[data-testid="text-grip-trial-note"]').textContent = '已記錄：參加者準備好下一次測試（' + RC.nowISO() + '）';
    });
    $('[data-testid="button-pinch-ready-next-trial"]').addEventListener('click', function () {
      if (S.rest.active) resumeRest();
    });
  }
  function currentContext() {
    if (ui.step === 8) return '第 8 步 · ' + COND_LABEL[condOrder()[ui.condIndex]];
    return '第 ' + ui.step + ' 步';
  }
  function startRest(context) {
    if (S.rest.active) return;
    pauseConditionTimer();
    S.rest.start('', context || currentContext());
    $('#btnRestStart').classList.add('rs-hidden');
    $('#btnRestResume').classList.remove('rs-hidden');
    $('#selRestReason').classList.remove('rs-hidden');
    $('#selRestReason').value = '';
    $('#restTimer').classList.remove('rs-hidden');
    ui.restTick = setInterval(renderRest, 1000);
    renderRest();
    markDirty();
  }
  function resumeRest() {
    if (!S.rest.active) return;
    if (!$('#selRestReason').value) {
      showBlocker('請先選擇休息原因（rest reason is required），然後才可繼續評估。');
      return;
    }
    S.rest.active.reason = $('#selRestReason').value;
    S.rest.resume();
    clearInterval(ui.restTick); ui.restTick = null;
    $('#btnRestStart').classList.remove('rs-hidden');
    $('#btnRestResume').classList.add('rs-hidden');
    $('#selRestReason').classList.add('rs-hidden');
    $('#restTimer').classList.add('rs-hidden');
    hideBlocker();
    renderRest(); renderRestLog(); markDirty();
  }
  function renderRest() {
    var t = S.rest.active ? Math.round((Date.now() - S.rest.active.startMs) / 1000) : 0;
    $('#restTimer').textContent = '休息中 Resting ' + RC.mmss(t);
    $('#restSummary').textContent = '休息次數 ' + S.rest.count() + ' · 總休息時間 ' + RC.mmss(S.rest.totalSec());
  }
  function renderRestLog() {
    var body = $('#restLogBody');
    body.innerHTML = S.rest.entries.length
      ? S.rest.rows().map(function (r, i) {
        return '<tr data-testid="row-rest-' + (i + 1) + '"><td>' + r.map(RC.esc).join('</td><td>') + '</td></tr>';
      }).join('')
      : '<tr><td colspan="7">未有休息紀錄 No rest recorded</td></tr>';
    $('[data-testid="text-rest-totals"]').textContent =
      '休息次數 ' + S.rest.count() + ' · 總休息時間 ' + S.rest.totalSec() + ' 秒';
  }

  /* condition timer (paused during rest) */
  var condTimer = { running: false, startMs: 0, accSec: 0, key: null };
  function startConditionTimer(key) {
    if (S.rest.active) { showBlocker('休息中，請先按「' + RC.RESUME_LABEL + '」。'); return; }
    if (condTimer.running && condTimer.key === key) return;
    condTimer = { running: true, startMs: Date.now(), accSec: condTimer.key === key ? condTimer.accSec : 0, key: key };
    renderCondTimer();
  }
  function pauseConditionTimer() {
    if (!condTimer.running) return;
    condTimer.accSec += Math.round((Date.now() - condTimer.startMs) / 1000);
    condTimer.running = false;
    renderCondTimer();
  }
  function stopConditionTimer() {
    pauseConditionTimer();
    if (condTimer.key) {
      var slot = S.cond[condTimer.key];
      if (slot && slot.motor) { slot.motor.activeSec = condTimer.accSec; }
      else if (slot) { slot.activeSecCog = condTimer.accSec; }
      markDirty();
      renderCondition();
    }
  }
  function renderCondTimer() {
    var el = $('[data-testid="text-condition-timer"]');
    if (!el) return;
    var t = condTimer.accSec + (condTimer.running ? Math.round((Date.now() - condTimer.startMs) / 1000) : 0);
    el.textContent = 'Active time ' + RC.mmss(t) + (condTimer.running ? '（進行中 running）' : '（已暫停 paused）');
  }
  setInterval(function () { if (condTimer.running) renderCondTimer(); }, 1000);

  /* ---------------- grip / pinch ---------------- */
  function renderGrip() {
    $('#inpGripUnableReason').classList.toggle('rs-hidden', !S.grip.unable);
    var mean = S.grip.unable ? null : RC.meanOf([S.grip.t1, S.grip.t2, S.grip.t3], 3);
    $('[data-testid="text-grip-mean"]').textContent = '平均值 Mean：' +
      (S.grip.unable ? 'N.A.（未能完成 unable — 不計為 0）' : (mean === null ? '—（需三次有效測試 requires 3 valid trials）' : mean.toFixed(2) + ' kg'));
  }
  function renderPinch() {
    $('#inpPinchUnableReason').classList.toggle('rs-hidden', !S.pinch.unable);
    var mean = S.pinch.unable ? null : RC.meanOf([S.pinch.t1, S.pinch.t2, S.pinch.t3], 3);
    $('[data-testid="text-pinch-mean"]').textContent = '平均值 Mean：' +
      (S.pinch.unable ? 'N.A.（未能完成 unable — 不計為 0）' : (mean === null ? '—（需三次有效測試 requires 3 valid trials）' : mean.toFixed(2) + ' kg'));
  }
  function gripMean() { return S.grip.unable ? null : RC.meanOf([S.grip.t1, S.grip.t2, S.grip.t3], 3); }
  function pinchMean() { return S.pinch.unable ? null : RC.meanOf([S.pinch.t1, S.pinch.t2, S.pinch.t3], 3); }

  /* ---------------- ADL mini-screens ---------------- */
  function renderAdl() {
    var item = ADL_ITEMS[ui.adlIndex];
    var d = S.adl[item.key];
    $('[data-testid="text-adl-substep"]').textContent = '項目 ' + (ui.adlIndex + 1) + ' of ' + ADL_ITEMS.length + '：' + item.zh;
    $('#adlT1Reminder').classList.toggle('rs-hidden', S.timepoint !== 'T1');
    var k = item.key;
    $('#adlContainer').innerHTML =
      '<fieldset class="rs-fieldset"><legend>' + RC.esc(item.zh) + '</legend><div class="rs-grid">' +
      '<div class="rs-field"><label for="adlScore">醫院正式 ADL 分數 Official score</label>' +
      '<input id="adlScore" class="rs-input" data-testid="input-adl-score-' + k + '" data-adl="score" value="' + RC.esc(d.score) + '" placeholder="按醫院使用的評分工具填寫"></div>' +
      '<div class="rs-field"><label for="adlTime">完成時間（秒，選填）Completion time</label>' +
      '<input id="adlTime" type="number" min="0" max="3600" step="1" class="rs-input" data-testid="input-adl-time-' + k + '" data-adl="timeSec" value="' + RC.esc(d.timeSec) + '"></div>' +
      '<div class="rs-field"><label for="adlAssist">身體協助 Physical assistance</label>' +
      '<select id="adlAssist" class="rs-select" data-testid="select-adl-assist-' + k + '" data-adl="physicalAssist">' + opts([['', '未記錄'], ['none', '無 None'], ['min', '少量 Minimal'], ['mod', '中度 Moderate'], ['max', '大量 Maximal']], d.physicalAssist) + '</select></div>' +
      '<div class="rs-field"><label for="adlCues">口頭提示次數 Verbal cues</label>' +
      '<input id="adlCues" type="number" min="0" max="99" step="1" class="rs-input" data-testid="input-adl-cues-' + k + '" data-adl="verbalCues" value="' + RC.esc(d.verbalCues) + '"></div>' +
      '<div class="rs-field"><label for="adlDevice">Assistive device</label>' +
      '<input id="adlDevice" class="rs-input" data-testid="input-adl-device-' + k + '" data-adl="device" value="' + RC.esc(d.device) + '" maxlength="80"></div>' +
      '<div class="rs-field"><label class="rs-check"><input type="checkbox" data-testid="checkbox-adl-unable-' + k + '" data-adl="unable"' + (d.unable ? ' checked' : '') + '><span>未能完成 Unable</span></label>' +
      '<input class="rs-input' + (d.unable ? '' : ' rs-hidden') + '" data-testid="input-adl-unable-reason-' + k + '" data-adl="unableReason" value="' + RC.esc(d.unableReason) + '" placeholder="未能完成原因 Unable reason" maxlength="200"></div>' +
      '</div></fieldset>';
    $$('#adlContainer [data-adl]').forEach(function (el) {
      var f = el.getAttribute('data-adl');
      var ev = el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, function () {
        if (S.locked) { renderAdl(); return alertLocked(); }
        S.adl[k][f] = el.type === 'checkbox' ? el.checked : el.value;
        markDirty();
        if (f === 'unable') renderAdl();
      });
    });
  }
  function opts(list, cur) {
    return list.map(function (o) {
      return '<option value="' + RC.esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + RC.esc(o[1]) + '</option>';
    }).join('');
  }

  /* ---------------- conditions ---------------- */
  function renderCondition() {
    var order = condOrder();
    if (ui.condIndex >= order.length) ui.condIndex = 0;
    var key = order[ui.condIndex];
    var slot = S.cond[key];
    $('[data-testid="text-condition-progress"]').textContent = '第 ' + (ui.condIndex + 1) + ' 個，共 3 個：' + COND_LABEL[key];
    var instr = key === 'motor' ? INSTR_MOTOR : (key === 'dual' ? INSTR_DUAL : INSTR_COG);
    var html = '<div class="rs-note rs-note-info" data-testid="text-condition-instruction"><span class="rs-note-icon" aria-hidden="true">🗣</span><span><b>指示 Instruction：</b>' + RC.esc(instr) + '</span></div>' +
      '<div class="rs-inline">' +
      '<button type="button" class="rs-btn rs-btn-secondary rs-btn-small" data-testid="button-condition-voice">🔊 播放指示</button>' +
      '<button type="button" class="rs-btn rs-btn-small" data-testid="button-condition-start">▶ 開始計時</button>' +
      '<button type="button" class="rs-btn rs-btn-secondary rs-btn-small" data-testid="button-condition-stop">■ 完成計時</button>' +
      '<button type="button" class="rs-btn rs-btn-rest rs-btn-small" data-testid="button-condition-rest">⏸ 患者需要休息</button>' +
      '<span data-testid="text-condition-timer">測試時間 00:00（已暫停）</span></div>';

    if (slot.motor) {
      var m = slot.motor;
      html += '<fieldset class="rs-fieldset"><legend>動作表現 Motor performance</legend><div class="rs-grid">' +
        numField('correct', '正確 Correct', m.correct, key) +
        numField('wrong', '錯誤 Wrong', m.wrong, key) +
        numField('drops', '跌落 Drops', m.drops, key) +
        numField('activeSec', 'Active time（秒）', m.activeSec, key) +
        '<div class="rs-field"><label>協助 Assistance</label><select class="rs-select" data-testid="select-' + key + '-assistance" data-cond="' + key + '" data-mf="assistance">' +
        opts([['', '未記錄'], ['none', '無 None'], ['verbal', '口頭提示 Verbal'], ['physical', '身體協助 Physical']], m.assistance) + '</select></div>' +
        '<div class="rs-field"><label>軀幹代償 Trunk compensation</label><select class="rs-select" data-testid="select-' + key + '-trunk" data-cond="' + key + '" data-mf="trunk">' +
        opts([['', '未記錄'], ['none', '無 None'], ['mild', '輕微 Mild'], ['marked', '明顯 Marked']], m.trunk) + '</select></div>' +
        '</div><p class="rs-lead" data-testid="text-' + key + '-cpm">正確／分鐘 Correct per minute：' + fmt(RC.perMinute(m.correct, m.activeSec)) + '</p></fieldset>';
    }
    if (slot.cog) {
      var c = slot.cog;
      html += '<fieldset class="rs-fieldset"><legend>認知表現 Cognitive（目標 target：燒賣；非目標 non-target：蝦餃／叉燒包；只在目標時答「有」）</legend><div class="rs-grid">' +
        cogField('hits', 'Hits 命中', c.hits, key) +
        cogField('misses', 'Misses 漏答', c.misses, key) +
        cogField('fa', 'False alarms 錯答', c.fa, key) +
        cogField('cr', 'Correct rejections 正確不答', c.cr, key) +
        '</div><p class="rs-lead" data-testid="text-' + key + '-accuracy">Accuracy：' + fmt(RC.accuracy(c.hits, c.misses, c.fa, c.cr), '%') + '</p></fieldset>';
    }
    $('#conditionContainer').innerHTML = html;

    $('[data-testid="button-condition-voice"]').addEventListener('click', function () { RC.speak(instr); });
    $('[data-testid="button-condition-start"]').addEventListener('click', function () { startConditionTimer(key); });
    $('[data-testid="button-condition-stop"]').addEventListener('click', stopConditionTimer);
    $('[data-testid="button-condition-rest"]').addEventListener('click', function () { startRest('Step 8 · ' + COND_LABEL[key]); });
    $$('#conditionContainer [data-mf]').forEach(function (el) {
      el.addEventListener('input', function () { onCondInput(el, 'motor'); });
      el.addEventListener('change', function () { onCondInput(el, 'motor'); });
    });
    $$('#conditionContainer [data-cf]').forEach(function (el) {
      el.addEventListener('input', function () { onCondInput(el, 'cog'); });
    });
    renderCondTimer();
    renderDTC();
  }
  function onCondInput(el, group) {
    if (S.locked) { renderCondition(); return alertLocked(); }
    var key = el.getAttribute('data-cond');
    var f = el.getAttribute(group === 'motor' ? 'data-mf' : 'data-cf');
    S.cond[key][group][f] = el.value;
    markDirty();
    updateCondDerived(key);
    renderDTC();
  }
  function updateCondDerived(key) {
    var slot = S.cond[key];
    if (slot.motor) {
      var e = $('[data-testid="text-' + key + '-cpm"]');
      if (e) e.textContent = '正確／分鐘 Correct per minute：' + fmt(RC.perMinute(slot.motor.correct, slot.motor.activeSec));
    }
    if (slot.cog) {
      var a = $('[data-testid="text-' + key + '-accuracy"]');
      if (a) a.textContent = 'Accuracy：' + fmt(RC.accuracy(slot.cog.hits, slot.cog.misses, slot.cog.fa, slot.cog.cr), '%');
    }
  }
  function numField(f, label, val, key) {
    return '<div class="rs-field"><label>' + RC.esc(label) + '</label><input type="number" min="0" step="1" class="rs-input" ' +
      'data-testid="input-' + key + '-' + f + '" data-cond="' + key + '" data-mf="' + f + '" value="' + RC.esc(val) + '"></div>';
  }
  function cogField(f, label, val, key) {
    return '<div class="rs-field"><label>' + RC.esc(label) + '</label><input type="number" min="0" step="1" class="rs-input" ' +
      'data-testid="input-' + key + '-' + f + '" data-cond="' + key + '" data-cf="' + f + '" value="' + RC.esc(val) + '"></div>';
  }
  function fmt(v, suffix) {
    return (v === null || v === undefined) ? '—' : (v + (suffix || ''));
  }
  function motorCPM(key) {
    var m = S.cond[key].motor;
    return m ? RC.perMinute(m.correct, m.activeSec) : null;
  }
  function cogAcc(key) {
    var c = S.cond[key].cog;
    return c ? RC.accuracy(c.hits, c.misses, c.fa, c.cr) : null;
  }
  function motorDTC() { return RC.dtc(motorCPM('motor'), motorCPM('dual')); }
  function cogDTC() { return RC.dtc(cogAcc('cognitive'), cogAcc('dual')); }
  function ratePerMin(value, sec) { return RC.perMinute(value, sec); }
  function cogCorrect(c) {
    if (!c || !RC.isNum(c.hits) || !RC.isNum(c.cr)) return null;
    return Number(c.hits) + Number(c.cr);
  }
  function renderDTC() {
    var sm = motorCPM('motor'), dm = motorCPM('dual');
    var md = motorDTC();
    var mEl = $('[data-testid="text-motor-dtc"]');
    if (mEl) {
      mEl.textContent = 'Motor DTC：' + (md !== null ? md + ' %'
        : ((RC.isNum(sm) && Number(sm) === 0) ? RC.DTC_MOTOR_NA : '—（資料未齊 incomplete）'));
    }
    var sc = cogAcc('cognitive');
    var cd = cogDTC();
    var cEl = $('[data-testid="text-cognitive-dtc"]');
    if (cEl) {
      cEl.textContent = 'Cognitive Accuracy DTC：' + (cd !== null ? cd + ' %'
        : ((RC.isNum(sc) && Number(sc) === 0) ? RC.DTC_COG_NA : '—（資料未齊 incomplete）'));
    }
  }

  /* ---------------- setup lock / T0-T1 ---------------- */
  var SETUP_LOCK_IDS = ['#selSetupFthue', '#selMotorTask', '#selSetupTool', '#selFoodSize', '#selPlateSize',
    '#selCameraPosition', '#selCognitiveTask', '#selCognitiveDifficulty', '#inpConditionDuration',
    '#selConditionOrder', '#chkFeedbackOff'];
  function renderSetupLock() {
    var locked = S.setup.locked;
    SETUP_LOCK_IDS.forEach(function (sel) { var e = $(sel); if (e) e.disabled = locked; });
    var pinchSel = $('#selPinchType');
    if (pinchSel) {
      pinchSel.disabled = (S.timepoint === 'T1' && !!S.t0Import);
      $('[data-testid="text-pinch-lock-note"]').textContent = pinchSel.disabled
        ? '已由 T0 設定檔鎖定 Locked from T0 settings file。' : 'T0 選擇後，T1 會由設定檔自動鎖定。';
    }
    var st = $('#setupLockStatus');
    st.className = 'rs-status-pill ' + (locked ? 'rs-status-done' : 'rs-status-pending');
    st.textContent = locked ? '✔ 已鎖定 Locked' : '未鎖定 Unlocked';
    $('#btnRandomizeOrder').disabled = (S.timepoint === 'T1') || S.setup.locked || S.setup.randomizedOnce;
    $('#btnLockSetup').disabled = locked;
    var side = $('#selAffectedSide');
    if (side) side.disabled = (S.timepoint === 'T1' && !!S.t0Import);
  }
  function onTimepointChange() {
    $('#t1UploadBlock').classList.toggle('rs-hidden', S.timepoint !== 'T1');
    $('#t1RetentionNote').classList.toggle('rs-hidden', S.timepoint !== 'T1');
    $('#adlT1Reminder') && $('#adlT1Reminder').classList.toggle('rs-hidden', S.timepoint !== 'T1');
    renderSetupLock();
  }

  function settingsObject() {
    return {
      schema: 'ych-ot-pilot-assessment-settings',
      version: RC.VERSION,
      participant_id: S.participantId,
      timepoint: 'T0',
      created_at: RC.nowISO(),
      scenario: SCENARIO,
      affected_side: S.affectedSide,
      fthue_level_setup: S.setup.fthue,
      motor_task: S.setup.motorTask,
      tool: S.setup.tool,
      pinch_type: S.pinch.type,
      food_size: S.setup.foodSize,
      plate_size: S.setup.plateSize,
      camera_position: S.setup.camera,
      cognitive_task: S.setup.cognitiveTask,
      cognitive_difficulty: S.setup.cognitiveDifficulty,
      condition_duration_sec: S.setup.duration,
      condition_order: S.setup.order,
      corrective_feedback: S.setup.feedbackOff ? 'off' : 'on',
      pain_rating_method: S.painMethodPre,
      fatigue_rating_method: S.fatigueMethodPre,
      dynamometer_id: S.grip.dynId,
      handle_setting: S.grip.handle,
      test_record: RC.isTestId(S.participantId)
    };
  }

  function applyT0Settings(obj) {
    S.t0Import = obj;
    S.affectedSide = obj.affected_side || S.affectedSide;
    S.setup.fthue = obj.fthue_level_setup || '';
    S.setup.motorTask = obj.motor_task || '';
    S.setup.tool = obj.tool || '';
    S.pinch.type = obj.pinch_type || '';
    S.setup.foodSize = obj.food_size || '';
    S.setup.plateSize = obj.plate_size || '';
    S.setup.camera = obj.camera_position || '';
    S.setup.cognitiveTask = obj.cognitive_task || 'auditory_target';
    S.setup.cognitiveDifficulty = obj.cognitive_difficulty || '';
    S.setup.duration = obj.condition_duration_sec || 120;
    S.setup.order = obj.condition_order || 'motor,cognitive,dual';
    S.setup.feedbackOff = obj.corrective_feedback === 'off';
    S.grip.dynId = obj.dynamometer_id || S.grip.dynId;
    S.grip.handle = obj.handle_setting || S.grip.handle;
    S.setup.locked = true;
    syncFields();
    renderCondition();
    markDirty();
  }

  function handleSettingsUpload(file) {
    var status = $('#settingsUploadStatus');
    var expected = (S.participantId || 'ParticipantID') + '_T0_settings.json';
    RC.readFileText(file).then(function (txt) {
      var obj;
      try { obj = RC.parseJSONFile(txt); }
      catch (e) { throw new Error('JSON 格式錯誤 Invalid JSON file。'); }
      if (obj.schema !== 'ych-ot-pilot-assessment-settings') throw new Error('檔案格式不符 Unrecognized settings file。');
      if (!S.participantId) throw new Error('請先輸入 Participant ID，再上載設定檔。');
      if (String(obj.participant_id).toUpperCase() !== S.participantId.toUpperCase()) {
        throw new Error('Participant ID 不符：檔案為 ' + obj.participant_id + '，目前為 ' + S.participantId + '。');
      }
      applyT0Settings(obj);
      status.innerHTML = '<span class="rs-note rs-note-ok" style="margin-top:10px"><span class="rs-note-icon">✔</span><span>已載入並鎖定 T0 設定（' + RC.esc(file.name) + '）。Loaded and locked.</span></span>';
    }).catch(function (err) {
      status.innerHTML = '<span class="rs-note rs-note-danger" style="margin-top:10px"><span class="rs-note-icon">✖</span><span>' +
        RC.esc(err.message) + ' 預期檔名 expected: ' + RC.esc(expected) + '</span></span>';
    });
  }

  /* ---------------- export field map ---------------- */
  function activeTimeTotal() {
    var t = 0, any = false;
    ['motor', 'dual'].forEach(function (k) {
      var m = S.cond[k].motor;
      if (m && RC.isNum(m.activeSec)) { t += Number(m.activeSec); any = true; }
    });
    if (RC.isNum(S.cond.cognitive.activeSecCog)) { t += Number(S.cond.cognitive.activeSecCog); any = true; }
    return any ? t : null;
  }
  function delta(a, b) { return (a === null || b === null || a === undefined || b === undefined) ? null : (b - a); }
  function nn(v) { return (v === '' || v === null || v === undefined) ? null : v; }

  function flatFields() {
    var f = [];
    function add(name, value, desc) { f.push({ name: name, value: (value === null || value === undefined) ? '' : value, desc: desc }); }
    add('record_version', RC.VERSION, 'Assessor bundle version');
    add('record_type', 'blinded_assessment', 'Record type (assessor bundle, no allocation data)');
    add('test_record', RC.isTestId(S.participantId) ? 'TEST' : '', 'TEST marker for non-research practice data');
    add('participant_id', S.participantId, 'Anonymous participant ID [A-Z0-9_-]');
    add('timepoint', S.timepoint, 'T0 or T1');
    add('assessment_datetime', S.datetime, 'Local date-time of assessment');
    add('assessor_code', S.assessorCode, 'Assessor code');
    add('affected_side', S.affectedSide, 'Affected upper limb');
    add('scenario', SCENARIO, 'Fixed assessment scenario');
    add('blinding_confirm_unaware', S.blindGroup ? 'yes' : 'no', 'Assessor confirmed being unaware of study assignment');
    add('blinding_confirm_no_records', S.blindRecords ? 'yes' : 'no', 'Assessor confirmed no training records were viewed');
    add('possible_unblinding', S.possibleUnblinding ? 'yes' : 'no', 'Possible unblinding flagged');
    add('unblinding_reason', S.breachReason, 'Reason for possible unblinding');
    add('unblinding_logged_by', S.breachAssessor, 'Assessor code logging the breach');
    add('medical_stability', S.medicalStable, 'Medically stable (yes/no)');
    add('pain_pre_method', S.painMethodPre, 'Pain response method: verbal_4 / numeric_0_10 / unable');
    add('pain_pre_verbal', S.painVerbalPre, 'Pain verbal category');
    add('pain_pre_0_10', S.painPre, 'Pain numeric score, blank unless numeric method used');
    add('fatigue_pre_method', S.fatigueMethodPre, 'Fatigue response method');
    add('fatigue_pre_verbal', S.fatigueVerbalPre, 'Fatigue verbal category');
    add('fatigue_pre_0_10', S.fatiguePre, 'Fatigue numeric score, blank unless numeric method used');
    add('ready_to_start', S.readyToStart, 'Participant ready to start');
    add('pause_reason', S.pauseReason, 'Reason if assessment paused');
    add('fthue_level', S.fthue.level, 'Official FTHUE-HK level 1-7');
    add('fthue_completed', S.fthue.completed, 'FTHUE-HK completed');
    add('fthue_unable_reason', S.fthue.unableReason, 'Reason unable to complete FTHUE-HK');
    add('fthue_assistance', S.fthue.assistance, 'Assistance during FTHUE-HK');
    add('fthue_verbal_cues', nn(S.fthue.cues), 'Verbal cue count during FTHUE-HK');
    add('fthue_trunk_compensation', S.fthue.trunk, 'Trunk compensation during FTHUE-HK');
    add('fthue_pain_limited', S.fthue.painLimited, 'Performance limited by pain');
    add('fthue_fatigue_limited', S.fthue.fatigueLimited, 'Performance limited by fatigue');
    add('dynamometer_id', S.grip.dynId, 'Dynamometer identifier');
    add('grip_handle_setting', S.grip.handle, 'Dynamometer handle position');
    add('grip_trial1_kg', S.grip.unable ? '' : nn(S.grip.t1), 'Grip trial 1 (kg)');
    add('grip_trial2_kg', S.grip.unable ? '' : nn(S.grip.t2), 'Grip trial 2 (kg)');
    add('grip_trial3_kg', S.grip.unable ? '' : nn(S.grip.t3), 'Grip trial 3 (kg)');
    add('grip_mean_kg', gripMean(), 'Mean of 3 valid grip trials (blank if incomplete)');
    add('grip_unable', S.grip.unable ? 'yes' : 'no', 'Unable to perform grip test');
    add('grip_unable_reason', S.grip.unableReason, 'Reason unable (grip)');
    add('pinch_type', S.pinch.type, 'Pinch type: tip / three_jaw / lateral');
    add('pinch_trial1_kg', S.pinch.unable ? '' : nn(S.pinch.t1), 'Pinch trial 1 (kg)');
    add('pinch_trial2_kg', S.pinch.unable ? '' : nn(S.pinch.t2), 'Pinch trial 2 (kg)');
    add('pinch_trial3_kg', S.pinch.unable ? '' : nn(S.pinch.t3), 'Pinch trial 3 (kg)');
    add('pinch_mean_kg', pinchMean(), 'Mean of 3 valid pinch trials (blank if incomplete)');
    add('pinch_unable', S.pinch.unable ? 'yes' : 'no', 'Unable to perform pinch test');
    add('pinch_unable_reason', S.pinch.unableReason, 'Reason unable (pinch)');
    ADL_ITEMS.forEach(function (it) {
      var d = S.adl[it.key];
      add('adl_' + it.key + '_score', d.unable ? '' : nn(d.score), 'Official hospital ADL score — ' + it.zh);
      add('adl_' + it.key + '_time_sec', nn(d.timeSec), 'Optional completion time (s) — ' + it.zh);
      add('adl_' + it.key + '_physical_assist', d.physicalAssist, 'Physical assistance — ' + it.zh);
      add('adl_' + it.key + '_verbal_cues', nn(d.verbalCues), 'Verbal cues — ' + it.zh);
      add('adl_' + it.key + '_device', d.device, 'Assistive device — ' + it.zh);
      add('adl_' + it.key + '_unable', d.unable ? 'yes' : 'no', 'Unable to complete — ' + it.zh);
      add('adl_' + it.key + '_unable_reason', d.unableReason, 'Reason unable — ' + it.zh);
    });
    add('setup_fthue_level', S.setup.fthue, 'FTHUE stratum used for standardized setup');
    add('setup_motor_task', S.setup.motorTask, 'Standardized motor task');
    add('setup_tool', S.setup.tool, 'Standardized tool');
    add('setup_food_size', S.setup.foodSize, 'Food item size');
    add('setup_plate_size', S.setup.plateSize, 'Plate size');
    add('setup_camera_position', S.setup.camera, 'Camera position');
    add('setup_cognitive_task', S.setup.cognitiveTask, 'Cognitive task type');
    add('setup_cognitive_difficulty', S.setup.cognitiveDifficulty, 'Cognitive presentation rate');
    add('setup_condition_duration_sec', S.setup.duration, 'Planned duration per condition (s)');
    add('setup_condition_order', S.setup.order, 'Locked condition order');
    add('setup_corrective_feedback', S.setup.feedbackOff ? 'off' : 'on', 'Corrective feedback and score display during standardized assessment');
    add('setup_locked', S.setup.locked ? 'yes' : 'no', 'Setup locked');
    add('t0_settings_imported', S.t0Import ? 'yes' : 'no', 'T1 loaded settings from the T0 settings file');
    ['motor', 'cognitive', 'dual'].forEach(function (k) {
      var slot = S.cond[k];
      if (slot.motor) {
        add(k + '_correct', nn(slot.motor.correct), COND_LABEL[k] + ' — correct placements');
        add(k + '_wrong', nn(slot.motor.wrong), COND_LABEL[k] + ' — wrong placements');
        add(k + '_drops', nn(slot.motor.drops), COND_LABEL[k] + ' — drops');
        add(k + '_active_sec', nn(slot.motor.activeSec), COND_LABEL[k] + ' — active time (s)');
        add(k + '_assistance', slot.motor.assistance, COND_LABEL[k] + ' — assistance');
        add(k + '_trunk_compensation', slot.motor.trunk, COND_LABEL[k] + ' — trunk compensation');
        add(k + '_correct_per_min', motorCPM(k), COND_LABEL[k] + ' — auto correct/min');
        add(k + '_wrong_per_min', ratePerMin(slot.motor.wrong, slot.motor.activeSec), COND_LABEL[k] + ' — auto wrong/min');
        add(k + '_drops_per_min', ratePerMin(slot.motor.drops, slot.motor.activeSec), COND_LABEL[k] + ' — auto drops/min');
      }
      if (slot.cog) {
        add(k + '_hits', nn(slot.cog.hits), COND_LABEL[k] + ' — hits');
        add(k + '_misses', nn(slot.cog.misses), COND_LABEL[k] + ' — misses');
        add(k + '_false_alarms', nn(slot.cog.fa), COND_LABEL[k] + ' — false alarms');
        add(k + '_correct_rejections', nn(slot.cog.cr), COND_LABEL[k] + ' — correct rejections');
        add(k + '_cognitive_correct_responses', cogCorrect(slot.cog), COND_LABEL[k] + ' — hits plus correct rejections');
        add(k + '_cognitive_incorrect_responses', nn(slot.cog.fa), COND_LABEL[k] + ' — false alarms');
        add(k + '_cognitive_missed_responses', nn(slot.cog.misses), COND_LABEL[k] + ' — misses');
        add(k + '_accuracy_pct', cogAcc(k), COND_LABEL[k] + ' — auto accuracy %');
      }
    });
    var md = motorDTC(), cd = cogDTC();
    add('motor_dtc_pct', md, 'Auto Motor DTC = (single CPM - dual CPM)/single CPM*100');
    add('motor_dtc_note', md === null ? RC.DTC_MOTOR_NA : '', 'Note when Motor DTC cannot be calculated');
    add('cognitive_dtc_pct', cd, 'Auto Cognitive Accuracy DTC');
    add('cognitive_dtc_note', cd === null ? RC.DTC_COG_NA : '', 'Note when Cognitive DTC cannot be calculated');
    add('rest_count', S.rest.count(), 'Number of participant-responsive rests');
    add('rest_total_sec', S.rest.totalSec(), 'Total rest duration (s)');
    add('active_time_total_sec', activeTimeTotal(), 'Total active condition time (s)');
    add('pain_post_method', S.post.painMethodPost, 'Pain response method after assessment');
    add('pain_post_verbal', S.post.painVerbalPost, 'Pain verbal category after assessment');
    add('pain_post_0_10', S.post.painPost, 'Pain numeric score after assessment');
    add('fatigue_post_method', S.post.fatigueMethodPost, 'Fatigue response method after assessment');
    add('fatigue_post_verbal', S.post.fatigueVerbalPost, 'Fatigue verbal category after assessment');
    add('fatigue_post_0_10', S.post.fatiguePost, 'Fatigue numeric score after assessment');
    add('pain_delta_0_10', S.painMethodPre === 'numeric_0_10' && S.post.painMethodPost === 'numeric_0_10' ? delta(S.painPre, S.post.painPost) : '', 'Numeric delta only when both use 0-10');
    add('fatigue_delta_0_10', S.fatigueMethodPre === 'numeric_0_10' && S.post.fatigueMethodPost === 'numeric_0_10' ? delta(S.fatiguePre, S.post.fatiguePost) : '', 'Numeric delta only when both use 0-10');
    add('new_symptom', S.post.newSymptom, 'New symptom reported');
    add('adverse_event', S.post.adverseEvent, 'Adverse event occurred');
    add('adverse_event_description', S.post.aeDescription, 'Adverse event description');
    add('assessment_completed', S.post.completed, 'Assessment completed: yes / partial / no');
    add('record_locked', S.locked ? 'yes' : 'no', 'Record locked after validation');
    add('correction_count', S.audit.length, 'Number of appended corrections');
    add('exported_at', RC.nowISO(), 'Export timestamp');
    return f;
  }

  /* ---------------- validation ---------------- */
  function runValidation() {
    var issues = [];
    function err(msg) { issues.push({ level: 'error', msg: msg }); }
    function warn(msg) { issues.push({ level: 'warn', msg: msg }); }

    var idr = RC.validateId(S.participantId);
    if (!idr.ok) err('Participant ID：' + idr.msg);
    if (!S.assessorCode) err('缺少評估員代碼 Missing assessor code。');
    if (!S.affectedSide) err('缺少患側 Missing affected side。');
    if (!S.datetime) err('缺少評估日期及時間 Missing assessment date-time。');
    if (!S.blindGroup || !S.blindRecords) warn('盲法確認未全部勾選 Blinding confirmations incomplete。');
    if (S.possibleUnblinding && (!S.breachReason || !S.breachAssessor)) err('已標示可能解除盲法，必須填寫原因及評估員代碼。');
    if (!ratingComplete('painPre')) err('缺少評估前疼痛回答。');
    if (!ratingComplete('fatiguePre')) err('缺少評估前疲勞回答。');
    if (!ratingComplete('painPost')) err('缺少評估後疼痛回答。');
    if (!ratingComplete('fatiguePost')) err('缺少評估後疲勞回答。');
    if (S.painMethodPre === 'unable' || S.fatigueMethodPre === 'unable' || S.post.painMethodPost === 'unable' || S.post.fatigueMethodPost === 'unable') warn('病人有項目未能可靠回答；已保留為 missing，不會當作 0。');
    [['painPre', S.painPre], ['fatiguePre', S.fatiguePre], ['painPost', S.post.painPost], ['fatiguePost', S.post.fatiguePost]]
      .forEach(function (p) { if (p[1] !== null && (p[1] < 0 || p[1] > 10)) err(p[0] + ' 超出 0–10 範圍 out of range。'); });
    if (!S.fthue.level) warn('缺少 FTHUE-HK level。');
    if (S.fthue.completed === 'no' && !S.fthue.unableReason) err('FTHUE-HK 未完成但沒有填寫原因（unable without reason）。');
    if (S.grip.unable && !S.grip.unableReason) err('握力標示 unable 但沒有原因（unable without reason）。');
    if (!S.grip.unable && gripMean() === null) warn('握力平均值未能計算：需三次有效測試。');
    if (S.pinch.unable && !S.pinch.unableReason) err('捏力標示 unable 但沒有原因（unable without reason）。');
    if (!S.pinch.unable && pinchMean() === null) warn('捏力平均值未能計算：需三次有效測試。');
    if (!S.pinch.type) err('缺少捏力類型 Missing pinch type。');
    ADL_ITEMS.forEach(function (it) {
      var d = S.adl[it.key];
      if (d.unable && !d.unableReason) err('ADL ' + it.zh + '：unable 但沒有原因。');
      if (!d.unable && d.score === '') warn('ADL ' + it.zh + '：缺少官方分數。');
    });
    ['fthue', 'motorTask', 'tool', 'foodSize', 'plateSize', 'camera', 'cognitiveDifficulty'].forEach(function (k) {
      if (!S.setup[k]) warn('標準化設定缺少欄位 Missing setup field：' + k + '。');
    });
    if (!S.setup.locked) warn('標準化設定尚未鎖定 Setup not locked。');
    if (!S.setup.feedbackOff) warn('標準化測試應關閉得分及更正提示。');
    // T0/T1 consistency
    if (S.timepoint === 'T1') {
      if (!S.t0Import) err('T1 必須上載 T0 設定檔 T1 requires the T0 settings file。');
      else {
        var t = S.t0Import;
        if (t.tool && t.tool !== S.setup.tool) err('T0／T1 工具不一致 tool mismatch（T0：' + t.tool + '）。');
        if (t.pinch_type && t.pinch_type !== S.pinch.type) err('T0／T1 捏力類型不一致 pinch type mismatch（T0：' + t.pinch_type + '）。');
        if (t.condition_order && t.condition_order !== S.setup.order) err('T0／T1 condition order 不一致 order mismatch。');
        if (t.cognitive_difficulty && t.cognitive_difficulty !== S.setup.cognitiveDifficulty) err('T0／T1 cognitive difficulty 不一致 mismatch。');
        if (t.affected_side && t.affected_side !== S.affectedSide) err('T0／T1 患側不一致 affected side mismatch。');
        if (t.corrective_feedback && t.corrective_feedback !== (S.setup.feedbackOff ? 'off' : 'on')) err('T0／T1 corrective feedback 設定不一致。');
        if (t.pain_rating_method && S.painMethodPre && t.pain_rating_method !== S.painMethodPre) warn('T1 疼痛問法與 T0 不同；如病人能力許可，請沿用相同問法。');
        if (t.fatigue_rating_method && S.fatigueMethodPre && t.fatigue_rating_method !== S.fatigueMethodPre) warn('T1 疲勞問法與 T0 不同；如病人能力許可，請沿用相同問法。');
      }
    }
    // condition data
    condOrder().forEach(function (k) {
      var slot = S.cond[k];
      if (slot.motor) {
        if (slot.motor.correct === '') warn(COND_LABEL[k] + '：缺少正確次數 missing correct count。');
        var a = RC.num(slot.motor.activeSec);
        if (a === null) warn(COND_LABEL[k] + '：缺少 active time。');
        else if (a < 30) warn(COND_LABEL[k] + '：active time 少於 30 秒，數據可能不足 insufficient active time。');
      }
      if (slot.cog) {
        ['hits', 'misses', 'fa', 'cr'].forEach(function (f) {
          if (slot.cog[f] === '') warn(COND_LABEL[k] + '：缺少 ' + f + '。');
        });
      }
    });
    if (motorDTC() === null) warn(RC.DTC_MOTOR_NA);
    if (cogDTC() === null) warn(RC.DTC_COG_NA);
    if (!S.post.completed) warn('缺少評估完成情況 Missing completion status。');
    if (S.post.adverseEvent === 'yes' && !S.post.aeDescription) err('已標示不良事件但沒有描述 AE without description。');
    return issues;
  }
  function renderValidation() {
    var issues = runValidation();
    var errs = issues.filter(function (i) { return i.level === 'error'; });
    var box = $('#validationResults');
    box.innerHTML =
      '<div class="rs-note ' + (errs.length ? 'rs-note-danger' : 'rs-note-ok') + '" data-testid="text-validation-summary">' +
      '<span class="rs-note-icon" aria-hidden="true">' + (errs.length ? '✖' : '✔') + '</span><span>' +
      (errs.length ? errs.length + ' 項必須修正 errors' : '沒有必須修正項目 No blocking errors') +
      ' · ' + (issues.length - errs.length) + ' 項提示 warnings</span></div>' +
      (issues.length ? '<ul data-testid="list-validation-issues">' + issues.map(function (i, n) {
        return '<li data-testid="item-validation-' + n + '"><b>' + (i.level === 'error' ? '✖ 必須修正' : '⚠ 提示') + '：</b> ' + RC.esc(i.msg) + '</li>';
      }).join('') + '</ul>' : '');
    $('#btnConfirmLock').disabled = errs.length > 0 || S.locked;
    return issues;
  }

  /* ---------------- lock + audit ---------------- */
  function lockRecord() {
    var issues = renderValidation();
    if (issues.filter(function (i) { return i.level === 'error'; }).length) {
      showBlocker('仍有必須修正項目，未能鎖定。Fix blocking errors before locking.');
      return;
    }
    S.locked = true;
    var st = $('#recordLockStatus');
    st.className = 'rs-status-pill rs-status-done';
    st.textContent = '✔ 已鎖定 Locked';
    $('#correctionBlock').classList.remove('rs-hidden');
    populateCorrectionFields();
    setAllInputsDisabled(true);
    hideBlocker();
  }
  function setAllInputsDisabled(on) {
    $$('#assessorShell input, #assessorShell select, #assessorShell textarea').forEach(function (el) {
      if (el.closest('#correctionBlock')) return;
      if (el.id === 'selTestPreset') return;
      el.disabled = on;
    });
    $$('#assessorShell [data-yn], #assessorShell .rs-scale button, #assessorShell .rs-simple-rating button').forEach(function (b) { b.disabled = on; });
  }
  function populateCorrectionFields() {
    var sel = $('#selCorrectionField');
    sel.innerHTML = flatFields().map(function (f) {
      return '<option value="' + RC.esc(f.name) + '">' + RC.esc(f.name) + '</option>';
    }).join('');
  }
  function addCorrection() {
    var field = $('#selCorrectionField').value;
    var val = $('#inpCorrectionValue').value;
    var reason = $('#inpCorrectionReason').value;
    var who = $('#inpCorrectionAssessor').value.toUpperCase();
    if (!field || val === '' || !reason || !who) {
      showBlocker('更正紀錄必須填寫欄位、更正值、原因及評估員代碼。');
      return;
    }
    var current = flatFields().filter(function (f) { return f.name === field; })[0];
    S.audit.push({
      index: S.audit.length + 1,
      field: field,
      original: current ? String(current.value) : '',
      corrected: val,
      reason: reason,
      datetime: RC.nowISO(),
      assessor: who
    });
    $('#inpCorrectionValue').value = ''; $('#inpCorrectionReason').value = '';
    S.downloaded.assessment = false;
    renderAudit(); renderDownloadStatus(); hideBlocker();
  }
  function renderAudit() {
    $('#auditBody').innerHTML = S.audit.length ? S.audit.map(function (a) {
      return '<tr data-testid="row-audit-' + a.index + '"><td>' + a.index + '</td><td>' + RC.esc(a.field) + '</td><td>' +
        RC.esc(a.original) + '</td><td>' + RC.esc(a.corrected) + '</td><td>' + RC.esc(a.reason) + '</td><td>' +
        RC.esc(a.datetime) + '</td><td>' + RC.esc(a.assessor) + '</td></tr>';
    }).join('') : '<tr><td colspan="7">未有更正紀錄 No corrections</td></tr>';
  }

  /* ---------------- auto summary ---------------- */
  function renderAutoSummary() {
    var el = $('[data-testid="text-auto-summary"]');
    if (!el) return;
    var painPreText = ratingText(S.painMethodPre, S.painVerbalPre, S.painPre);
    var painPostText = ratingText(S.post.painMethodPost, S.post.painVerbalPost, S.post.painPost);
    var fatiguePreText = ratingText(S.fatigueMethodPre, S.fatigueVerbalPre, S.fatiguePre);
    var fatiguePostText = ratingText(S.post.fatigueMethodPost, S.post.fatigueVerbalPost, S.post.fatiguePost);
    el.textContent = '自動摘要：疼痛 ' + painPreText + ' → ' + painPostText +
      ' · 疲勞 ' + fatiguePreText + ' → ' + fatiguePostText +
      ' · Active time ' + (activeTimeTotal() === null ? '—' : activeTimeTotal() + ' 秒') +
      ' · 休息 ' + S.rest.count() + ' 次 / ' + S.rest.totalSec() + ' 秒';
  }

  /* ---------------- exports ---------------- */
  function baseName() {
    return (S.participantId || 'UNKNOWN') + '_' + S.timepoint;
  }
  function feedback(html, kind) {
    $('#downloadFeedback').innerHTML = '<div class="rs-note rs-note-' + (kind || 'ok') + '"><span class="rs-note-icon">' +
      (kind === 'danger' ? '✖' : '✔') + '</span><span>' + html + '</span></div>';
  }
  function downloadAssessment() {
    var idr = RC.validateId(S.participantId);
    if (!idr.ok) { feedback('未能下載：' + RC.esc(idr.msg), 'danger'); return; }
    var f = flatFields();
    var rows = [f.map(function (x) { return x.name; }), f.map(function (x) { return x.value; })];
    var name = baseName() + '_assessment.csv';
    RC.downloadCSV(name, rows);
    S.downloaded.assessment = true;
    renderDownloadStatus();
    feedback('已下載 <b>' + RC.esc(name) + '</b>（' + f.length + ' 欄，UTF-8 BOM）。' +
      (S.timepoint === 'T0' && !S.downloaded.settings ? ' 請同時下載 settings JSON。' : ''));
  }
  function downloadSettings() {
    var idr = RC.validateId(S.participantId);
    if (!idr.ok) { feedback('未能下載：' + RC.esc(idr.msg), 'danger'); return; }
    if (S.timepoint !== 'T0') { feedback('Settings file 只在 T0 產生；T1 須沿用 T0 檔案。', 'danger'); return; }
    var name = S.participantId + '_T0_settings.json';
    RC.downloadJSON(name, settingsObject());
    S.downloaded.settings = true;
    renderDownloadStatus();
    feedback('已下載 <b>' + RC.esc(name) + '</b>。T1 評估時必須上載此檔案。');
  }
  function downloadConditions() {
    var rows = [['participant_id', 'timepoint', 'condition_index', 'condition', 'instruction_given',
      'correct', 'wrong', 'drops', 'active_sec', 'assistance', 'trunk_compensation',
      'correct_per_min', 'wrong_per_min', 'drops_per_min',
      'hits', 'misses', 'false_alarms', 'correct_rejections',
      'cognitive_correct_responses', 'cognitive_incorrect_responses',
      'cognitive_missed_responses', 'accuracy_pct', 'test_record']];
    condOrder().forEach(function (k, i) {
      var slot = S.cond[k], m = slot.motor, c = slot.cog;
      rows.push([S.participantId, S.timepoint, i + 1, k,
        k === 'motor' ? INSTR_MOTOR : (k === 'dual' ? INSTR_DUAL : INSTR_COG),
        m ? nn(m.correct) : '', m ? nn(m.wrong) : '', m ? nn(m.drops) : '', m ? nn(m.activeSec) : '',
        m ? m.assistance : '', m ? m.trunk : '', m ? motorCPM(k) : '',
        m ? ratePerMin(m.wrong, m.activeSec) : '', m ? ratePerMin(m.drops, m.activeSec) : '',
        c ? nn(c.hits) : '', c ? nn(c.misses) : '', c ? nn(c.fa) : '', c ? nn(c.cr) : '',
        c ? cogCorrect(c) : '', c ? nn(c.fa) : '', c ? nn(c.misses) : '', c ? cogAcc(k) : '',
        RC.isTestId(S.participantId) ? 'TEST' : '']);
    });
    var name = baseName() + '_conditions.csv';
    RC.downloadCSV(name, rows);
    feedback('已下載 condition-level raw CSV <b>' + RC.esc(name) + '</b>。');
  }
  function downloadRestAe() {
    var rows = [['participant_id', 'timepoint', 'entry_type', 'index', 'context', 'reason', 'start', 'end', 'duration_sec', 'resumed', 'test_record']];
    S.rest.entries.forEach(function (e) {
      rows.push([S.participantId, S.timepoint, 'rest', e.index, e.context, e.reason, e.startedAt, e.endedAt || '',
        e.durationSec, e.resumed ? 'yes' : 'no', RC.isTestId(S.participantId) ? 'TEST' : '']);
    });
    rows.push([S.participantId, S.timepoint, 'adverse_event', 1, 'post-assessment', S.post.aeDescription, '', '', '',
      S.post.adverseEvent || 'not recorded', RC.isTestId(S.participantId) ? 'TEST' : '']);
    S.audit.forEach(function (a) {
      rows.push([S.participantId, S.timepoint, 'correction', a.index, a.field,
        'original=' + a.original + ' | corrected=' + a.corrected + ' | reason=' + a.reason,
        a.datetime, '', '', a.assessor, RC.isTestId(S.participantId) ? 'TEST' : '']);
    });
    var name = baseName() + '_rest_ae_log.csv';
    RC.downloadCSV(name, rows);
    feedback('已下載 rest／adverse event log <b>' + RC.esc(name) + '</b>（包括 append-only 更正紀錄）。');
  }
  function downloadDictionary() {
    var rows = [['field_name', 'description', 'example_or_current_value']];
    flatFields().forEach(function (f) { rows.push([f.name, f.desc, f.value]); });
    RC.downloadCSV('assessment_data_dictionary.csv', rows);
    feedback('已下載 data dictionary <b>assessment_data_dictionary.csv</b>。');
  }

  /* ---------------- navigation ---------------- */
  function gotoStep(n) {
    ui.step = Math.min(TOTAL_STEPS, Math.max(1, n));
    $$('.rs-step').forEach(function (s) {
      s.classList.toggle('rs-hidden', Number(s.getAttribute('data-step')) !== ui.step);
    });
    $('#progressLabel').textContent = 'Step ' + ui.step + ' of ' + TOTAL_STEPS;
    $('#progressBar').style.width = (ui.step / TOTAL_STEPS * 100) + '%';
    $('#btnPrev').disabled = ui.step === 1;
    $('#btnNext').disabled = ui.step === TOTAL_STEPS;
    if (ui.step === 6) renderAdl();
    if (ui.step === 8) renderCondition();
    if (ui.step === 9) renderRestLog();
    if (ui.step === 10) { renderAutoSummary(); renderAudit(); }
    hideBlocker();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function canLeaveStep() {
    if (S.rest.active) { showBlocker('休息進行中，請先按「' + RC.RESUME_LABEL + '」。'); return false; }
    if (ui.step === 1) {
      var r = RC.validateId(S.participantId);
      if (!r.ok) { showBlocker(r.msg); return false; }
      if (!S.assessorCode) { showBlocker('請輸入評估員代碼 Assessor code。'); return false; }
      if (!S.affectedSide) { showBlocker('請選擇患側 Affected side。'); return false; }
      if (S.possibleUnblinding && (!S.breachReason || !S.breachAssessor)) {
        showBlocker('已選「可能已解除盲法」，必須填寫原因及評估員代碼。評估資料會保留並記錄事件。');
        return false;
      }
      return true;
    }
    if (ui.step === 2) {
      if (S.medicalStable === '' || S.readyToStart === '') { showBlocker('請完成安全確認 Complete safety questions。'); return false; }
      if (!ratingComplete('painPre') || !ratingComplete('fatiguePre')) { showBlocker('請各選一個疼痛及疲勞答案；答不到可選「未能可靠回答」。'); return false; }
      if (S.medicalStable === 'no' || S.readyToStart === 'no') {
        if (!S.pauseReason) { showBlocker('暫停評估：必須填寫原因 Pause reason required。'); return false; }
        showBlocker('暫停評估 Assessment paused — 不可繼續。已記錄原因；如情況改善可重新確認安全狀態。');
        return false;
      }
      return true;
    }
    if (ui.step === 6 && ui.adlIndex < ADL_ITEMS.length - 1) {
      ui.adlIndex++; renderAdl(); return false;
    }
    if (ui.step === 7 && S.timepoint === 'T1' && !S.t0Import) {
      showBlocker('T1 必須先上載 ' + (S.participantId || 'ParticipantID') + '_T0_settings.json。');
      return false;
    }
    if (ui.step === 8 && ui.condIndex < 2) { ui.condIndex++; renderCondition(); return false; }
    return true;
  }

  /* ---------------- test presets ---------------- */
  function applyPreset(code) {
    if (!code) { S = newState(); ui.step = 1; ui.adlIndex = 0; ui.condIndex = 0; RC.applyTestChrome(false); syncFields(); gotoStep(1); return; }
    S = newState();
    S.testMode = code;
    RC.applyTestChrome(true);
    S.participantId = code;
    S.assessorCode = 'TESTAS';
    S.affectedSide = 'right';
    S.blindGroup = true; S.blindRecords = true;
    S.medicalStable = 'yes'; S.readyToStart = 'yes';
    S.painMethodPre = 'verbal_4'; S.painVerbalPre = 'mild'; S.painPre = null;
    S.fatigueMethodPre = 'verbal_4'; S.fatigueVerbalPre = 'mild'; S.fatiguePre = null;
    S.fthue = { level: '5', completed: 'yes', unableReason: '', assistance: 'none', cues: '2', trunk: 'mild', painLimited: 'no', fatigueLimited: 'no' };
    S.grip = { dynId: 'DYN-01', handle: '2', t1: '10', t2: '12', t3: '11', unable: false, unableReason: '' };
    S.pinch = { type: 'three_jaw', t1: '2', t2: '3', t3: '4', unable: false, unableReason: '' };
    ADL_ITEMS.forEach(function (it) {
      S.adl[it.key] = { score: '8', timeSec: '95', physicalAssist: 'none', verbalCues: '1', device: '', unable: false, unableReason: '' };
    });
    S.setup = {
      fthue: '5', motorTask: 'grasp_release', tool: 'chopsticks', foodSize: 'medium', plateSize: 'medium',
      camera: 'front_table', cognitiveTask: 'auditory_target', cognitiveDifficulty: 'standard', duration: 120,
      order: 'motor,cognitive,dual', feedbackOff: true, locked: true, randomizedOnce: true
    };
    S.cond.motor.motor = { correct: '20', wrong: '2', drops: '1', activeSec: '120', assistance: 'none', trunk: 'none' };
    S.cond.cognitive.cog = { hits: '9', misses: '1', fa: '2', cr: '18' };
    S.cond.dual.motor = { correct: '15', wrong: '3', drops: '2', activeSec: '120', assistance: 'verbal', trunk: 'mild' };
    S.cond.dual.cog = { hits: '7', misses: '3', fa: '4', cr: '16' };
    S.post = { painPost: null, fatiguePost: null, painMethodPost: 'verbal_4', painVerbalPost: 'moderate',
      fatigueMethodPost: 'verbal_4', fatigueVerbalPost: 'moderate', newSymptom: 'no', adverseEvent: 'no', aeDescription: '', completed: 'yes' };

    if (code === 'TEST001') {
      // complete T0 + a matching T1 import available via downloaded settings
      S.timepoint = 'T0';
    } else if (code === 'TEST002') {
      S.timepoint = 'T0';
      var r1 = S.rest.start('Fatigue 疲勞', 'Step 8 · 單一動作 Single motor');
      r1.startMs = Date.now() - 95000; S.rest.resume();
      var r2 = S.rest.start('Pain 疼痛', 'Step 8 · 雙重任務 Dual task');
      r2.startMs = Date.now() - 140000; S.rest.resume();
      S.readyToStart = 'no'; S.pauseReason = '參加者要求暫停，血壓需要重新量度。';
    } else if (code === 'TEST003') {
      S.timepoint = 'T0';
      S.pinch = { type: 'lateral', t1: '', t2: '', t3: '', unable: true, unableReason: '患側手指痛楚，未能完成捏力測試。' };
      S.adl.dressing = { score: '', timeSec: '', physicalAssist: '', verbalCues: '', device: '', unable: true, unableReason: '' };
      S.grip.t3 = '';
      S.cond.cognitive.cog = { hits: '0', misses: '10', fa: '0', cr: '0' };
      S.cond.motor.motor.correct = '0';
      S.cond.motor.motor.activeSec = '20';
      S.post.painMethodPost = ''; S.post.painVerbalPost = ''; S.post.painPost = null;
    }
    S.touched = true;
    syncFields(); renderRest(); renderRestLog(); renderAdl(); renderCondition(); renderAutoSummary(); renderDownloadStatus();
    gotoStep(1);
  }

  /* ---------------- init ---------------- */
  function init() {
    $$('.rs-scale').forEach(buildScale);
    bindFields();
    initRest();
    syncFields();
    onTimepointChange();
    renderAdl(); renderCondition(); renderRestLog(); renderAutoSummary(); renderDownloadStatus();
    gotoStep(1);

    $('#btnNext').addEventListener('click', function () { if (canLeaveStep()) gotoStep(ui.step + 1); });
    $('#btnPrev').addEventListener('click', function () {
      if (ui.step === 6 && ui.adlIndex > 0) { ui.adlIndex--; renderAdl(); return; }
      if (ui.step === 8 && ui.condIndex > 0) { ui.condIndex--; renderCondition(); return; }
      gotoStep(ui.step - 1);
    });
    $('#btnSaveDraft').addEventListener('click', function () {
      showDraftToast();
    });
    $('[data-testid="button-adl-prev"]').addEventListener('click', function () {
      if (ui.adlIndex > 0) { ui.adlIndex--; renderAdl(); }
    });
    $('[data-testid="button-adl-next"]').addEventListener('click', function () {
      if (ui.adlIndex < ADL_ITEMS.length - 1) { ui.adlIndex++; renderAdl(); }
    });
    $('[data-testid="button-condition-prev"]').addEventListener('click', function () {
      if (ui.condIndex > 0) { ui.condIndex--; renderCondition(); }
    });
    $('[data-testid="button-condition-next"]').addEventListener('click', function () {
      if (ui.condIndex < 2) { ui.condIndex++; renderCondition(); }
    });
    $('#btnRandomizeOrder').addEventListener('click', function () {
      if (S.timepoint === 'T1' || S.setup.locked || S.setup.randomizedOnce) return;
      var orders = ['motor,cognitive,dual', 'motor,dual,cognitive', 'cognitive,motor,dual',
        'cognitive,dual,motor', 'dual,motor,cognitive', 'dual,cognitive,motor'];
      S.setup.order = orders[Math.floor(Math.random() * orders.length)];
      S.setup.randomizedOnce = true;
      syncFields(); renderCondition(); markDirty();
    });
    $('#btnLockSetup').addEventListener('click', function () {
      S.setup.locked = true; renderSetupLock(); markDirty();
    });
    $('#inpSettingsUpload').addEventListener('change', function () {
      if (this.files && this.files[0]) handleSettingsUpload(this.files[0]);
    });
    $('#btnRunValidation').addEventListener('click', renderValidation);
    $('#btnReturnModify').addEventListener('click', function () { gotoStep(1); });
    $('#btnConfirmLock').addEventListener('click', lockRecord);
    $('#btnAddCorrection').addEventListener('click', addCorrection);
    $('#btnDownloadAssessment').addEventListener('click', downloadAssessment);
    $('#btnDownloadSettings').addEventListener('click', downloadSettings);
    $('#btnDownloadConditions').addEventListener('click', downloadConditions);
    $('#btnDownloadRestAe').addEventListener('click', downloadRestAe);
    $('#btnDownloadDictionary').addEventListener('click', downloadDictionary);
    $('#btnToggleVoice').addEventListener('click', function () {
      RC.voiceEnabled = !RC.voiceEnabled;
      this.textContent = RC.voiceEnabled ? '🔊 語音：開' : '🔇 語音：關';
      if (!RC.voiceEnabled) RC.stopSpeak();
    });
    $('#selTestPreset').addEventListener('change', function () { applyPreset(this.value); });

    RC.installUnloadGuard(isDirty);
  }
  function showDraftToast() {
    var n = document.createElement('div');
    n.className = 'rs-note rs-note-info';
    n.setAttribute('data-testid', 'text-draft-saved');
    n.innerHTML = '<span class="rs-note-icon">💾</span><span>草稿已保存於本頁記憶體（in-memory draft）。' + RC.esc(RC.UNSAVED_WARNING) + '</span>';
    var shell = $('#assessorShell');
    var old = $('[data-testid="text-draft-saved"]');
    if (old) old.remove();
    shell.insertBefore(n, shell.firstChild);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 6000);
  }

  // Voice gate honouring the toggle
  var rawSpeak = RC.speak;
  RC.speak = function (t) { if (!RC.voiceEnabled) return false; return rawSpeak(t); };

  document.addEventListener('DOMContentLoaded', init);

  // expose for automated QA only (no allocation data present)
  window.__assessorQA = {
    state: function () { return S; },
    fields: flatFields,
    validation: runValidation,
    goto: gotoStep,
    preset: applyPreset,
    applyT0Settings: applyT0Settings,
    settingsObject: settingsObject
  };
})();
