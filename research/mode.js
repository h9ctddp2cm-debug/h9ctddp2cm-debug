(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var mode = params.get('mode');
  var isTest = mode === 'test';
  var isNormal = mode === 'normal';

  RC.mode = isTest ? 'test' : 'normal';
  RC.isTestMode = isTest;
  RC.applyTestChrome(isTest);

  RC.$$('[data-test-only]').forEach(function (el) {
    el.classList.toggle('rs-hidden', !isTest);
  });

  RC.$$('[data-mode-link]').forEach(function (link) {
    var url = new URL(link.href);
    url.searchParams.set('mode', RC.mode);
    link.href = url.pathname + url.search;
  });

  if (document.body.dataset.page !== 'hub') return;

  var choice = RC.$('#modeChoice');
  var workflow = RC.$('#workflowChoice');
  if (!isTest && !isNormal) {
    choice.classList.remove('rs-hidden');
    workflow.classList.add('rs-hidden');
    return;
  }

  choice.classList.add('rs-hidden');
  workflow.classList.remove('rs-hidden');
  RC.$('#modeTitle').textContent = isTest ? '測試模式' : '正常模式';
  RC.$('#modeDescription').textContent = isTest
    ? '沒有病人，只用來試按版面；所有編號會標示為 TEST'
    : '正式收集病人數據';

})();
