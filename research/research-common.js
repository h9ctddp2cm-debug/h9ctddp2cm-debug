/* ============================================================
   YCH OT Pilot — shared research utilities (RC)
   NO allocation / group / session-training data lives here.
   Memory-only: this file never uses localStorage, sessionStorage,
   indexedDB or cookies.
   ============================================================ */
(function (global) {
  'use strict';

  var RC = {};

  RC.VERSION = 'pilot-single-researcher-1.1.0';

  /* ---------- anonymous ID ---------- */
  RC.ID_PATTERN = /^[A-Z0-9_-]{3,20}$/;
  RC.validateId = function (raw) {
    var v = (raw == null ? '' : String(raw));
    if (v === '') return { ok: false, msg: '請輸入匿名 Participant ID（Anonymous ID required）。' };
    if (/\s/.test(v)) return { ok: false, msg: 'ID 不可包含空格（no spaces）。' };
    if (!/^[A-Z0-9_-]+$/.test(v)) {
      return { ok: false, msg: 'ID 只可使用大寫英文字母 A-Z、數字 0-9、底線 _ 及連字號 -（uppercase letters, digits, _ and - only）。不可輸入姓名、病歷號碼（MRN）、身分證或其他可識別資料。' };
    }
    if (v.length < 3 || v.length > 20) return { ok: false, msg: 'ID 長度須為 3–20 個字元（3–20 characters）。' };
    return { ok: true, msg: '' };
  };
  RC.ID_WARNING = '只可輸入匿名研究編號。嚴禁輸入姓名、病歷號碼（MRN）、身分證號碼、電話或出生日期。Anonymous study ID only — no name / MRN / HKID.';

  /* ---------- time helpers ---------- */
  RC.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  RC.nowISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + RC.pad(d.getMonth() + 1) + '-' + RC.pad(d.getDate()) +
      'T' + RC.pad(d.getHours()) + ':' + RC.pad(d.getMinutes()) + ':' + RC.pad(d.getSeconds());
  };
  RC.nowLocalInput = function () { return RC.nowISO().slice(0, 16); };
  RC.mmss = function (sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    return RC.pad(Math.floor(sec / 60)) + ':' + RC.pad(sec % 60);
  };

  /* ---------- numbers ---------- */
  RC.isNum = function (v) {
    return v !== '' && v !== null && v !== undefined && isFinite(Number(v));
  };
  RC.num = function (v) { return RC.isNum(v) ? Number(v) : null; };
  RC.round = function (v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return null;
    var f = Math.pow(10, dp === undefined ? 1 : dp);
    return Math.round(v * f) / f;
  };
  /** Mean of exactly-valid trials. Returns null (never 0) when incomplete. */
  RC.meanOf = function (values, requiredCount) {
    var vals = [], i;
    for (i = 0; i < values.length; i++) { if (RC.isNum(values[i])) vals.push(Number(values[i])); }
    if (requiredCount && vals.length < requiredCount) return null;
    if (!vals.length) return null;
    var s = 0;
    for (i = 0; i < vals.length; i++) s += vals[i];
    return RC.round(s / vals.length, 2);
  };
  /** Dual-task cost: (single - dual) / single * 100. Null when denominator is 0/missing. */
  RC.dtc = function (single, dual) {
    if (!RC.isNum(single) || !RC.isNum(dual)) return null;
    if (Number(single) === 0) return null;
    return RC.round(((Number(single) - Number(dual)) / Number(single)) * 100, 1);
  };
  RC.DTC_MOTOR_NA = 'Motor DTC不能計算，請報告raw scores。';
  RC.DTC_COG_NA = 'Cognitive Accuracy DTC不能計算，請報告raw scores。';
  /** Cognitive accuracy = (hits + correct rejections) / total * 100 */
  RC.accuracy = function (hits, misses, fa, cr) {
    var vals = [hits, misses, fa, cr], i, total = 0;
    for (i = 0; i < vals.length; i++) { if (!RC.isNum(vals[i])) return null; total += Number(vals[i]); }
    if (total <= 0) return null;
    return RC.round(((Number(hits) + Number(cr)) / total) * 100, 1);
  };
  /** Correct items per minute */
  RC.perMinute = function (count, seconds) {
    if (!RC.isNum(count) || !RC.isNum(seconds) || Number(seconds) <= 0) return null;
    return RC.round((Number(count) / (Number(seconds) / 60)), 2);
  };

  /* ---------- CSV ---------- */
  RC.csvCell = function (v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  RC.toCSV = function (rows) {
    var out = [], i, j, line;
    for (i = 0; i < rows.length; i++) {
      line = [];
      for (j = 0; j < rows[i].length; j++) line.push(RC.csvCell(rows[i][j]));
      out.push(line.join(','));
    }
    return out.join('\r\n') + '\r\n';
  };
  RC.BOM = '\uFEFF';

  RC.downloadText = function (filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
    return filename;
  };
  RC.downloadCSV = function (filename, rows) {
    return RC.downloadText(filename, RC.BOM + RC.toCSV(rows), 'text/csv');
  };
  RC.downloadJSON = function (filename, obj) {
    return RC.downloadText(filename, JSON.stringify(obj, null, 2), 'application/json');
  };

  /* ---------- file reading ---------- */
  RC.readFileText = function (file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result || '')); };
      fr.onerror = function () { reject(new Error('無法讀取檔案 (cannot read file)')); };
      fr.readAsText(file, 'utf-8');
    });
  };
  RC.parseJSONFile = function (text) {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  };
  /** Minimal RFC4180 CSV parser -> array of arrays. */
  RC.parseCSV = function (text) {
    text = text.replace(/^\uFEFF/, '');
    var rows = [], row = [], cur = '', q = false, i, c, n;
    for (i = 0; i < text.length; i++) {
      c = text[i]; n = text[i + 1];
      if (q) {
        if (c === '"' && n === '"') { cur += '"'; i++; }
        else if (c === '"') { q = false; }
        else cur += c;
      } else if (c === '"') { q = true; }
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim() !== ''; });
  };
  RC.csvToObjects = function (text) {
    var rows = RC.parseCSV(text);
    if (!rows.length) return [];
    var head = rows[0], out = [], i, j, o;
    for (i = 1; i < rows.length; i++) {
      o = {};
      for (j = 0; j < head.length; j++) o[head[j]] = rows[i][j] === undefined ? '' : rows[i][j];
      out.push(o);
    }
    return out;
  };

  /* ---------- voice instruction (speechSynthesis) ---------- */
  RC.voiceEnabled = true;
  RC.speak = function (text) {
    if (!text) return false;
    if (!('speechSynthesis' in global)) return false;
    try {
      global.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'zh-HK';
      u.rate = 0.92;
      global.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  };
  RC.stopSpeak = function () {
    try { if ('speechSynthesis' in global) global.speechSynthesis.cancel(); } catch (e) { /* noop */ }
  };

  /* ---------- dirty guard (beforeunload) ---------- */
  RC.dirty = false;
  RC.setDirty = function (v) {
    RC.dirty = !!v;
    var el = document.querySelector('[data-testid="status-download"]');
    if (el && RC.renderDownloadStatus) RC.renderDownloadStatus();
  };
  RC.installUnloadGuard = function (isDirtyFn) {
    global.addEventListener('beforeunload', function (e) {
      var d = isDirtyFn ? isDirtyFn() : RC.dirty;
      if (d) { e.preventDefault(); e.returnValue = ''; return ''; }
      return undefined;
    });
  };
  RC.UNSAVED_WARNING = '資料尚未永久保存。請先下載CSV及settings file，然後才關閉或重新整理頁面。';

  /* ---------- SHA-256 (Web Crypto) ---------- */
  RC.sha256hex = function (text) {
    if (!global.crypto || !global.crypto.subtle) return Promise.reject(new Error('Web Crypto unavailable'));
    var buf = new TextEncoder().encode(String(text));
    return global.crypto.subtle.digest('SHA-256', buf).then(function (hash) {
      var b = Array.prototype.slice.call(new Uint8Array(hash));
      return b.map(function (x) { return ('00' + x.toString(16)).slice(-2); }).join('');
    });
  };

  /* ---------- rest logger (participant-responsive, never fixed) ---------- */
  RC.RestLogger = function () {
    this.entries = [];
    this.active = null;
  };
  RC.RestLogger.prototype.start = function (reason, contextLabel) {
    if (this.active) return this.active;
    this.active = {
      index: this.entries.length + 1,
      reason: reason || '',
      context: contextLabel || '',
      startedAt: RC.nowISO(),
      startMs: Date.now(),
      durationSec: null,
      resumed: false
    };
    return this.active;
  };
  RC.RestLogger.prototype.resume = function () {
    if (!this.active) return null;
    var e = this.active;
    e.durationSec = Math.round((Date.now() - e.startMs) / 1000);
    e.endedAt = RC.nowISO();
    e.resumed = true;
    delete e.startMs;
    this.entries.push(e);
    this.active = null;
    return e;
  };
  RC.RestLogger.prototype.count = function () { return this.entries.length; };
  RC.RestLogger.prototype.totalSec = function () {
    return this.entries.reduce(function (s, e) { return s + (e.durationSec || 0); }, 0);
  };
  RC.RestLogger.prototype.rows = function () {
    return this.entries.map(function (e) {
      return [e.index, e.context, e.reason, e.startedAt, e.endedAt || '', e.durationSec, e.resumed ? 'yes' : 'no'];
    });
  };
  RC.REST_REASONS = [
    'Fatigue 疲勞', 'Pain 疼痛', 'Discomfort 不適', 'Postural adjustment 姿勢調整',
    'Participant request 參加者要求', 'Therapist safety decision 治療師安全決定', 'Other 其他'
  ];
  RC.RESUME_LABEL = '患者已準備好，繼續評估';

  /* ---------- misc DOM helpers ---------- */
  RC.$ = function (sel, root) { return (root || document).querySelector(sel); };
  RC.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  RC.el = function (tag, attrs, html) {
    var e = document.createElement(tag), k;
    if (attrs) for (k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]); }
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  RC.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- test mode ---------- */
  RC.isTestId = function (id) { return /^TEST\d*/.test(String(id || '')); };
  RC.applyTestChrome = function (on) {
    document.body.classList.toggle('rs-test', !!on);
  };

  global.RC = RC;
})(window);
