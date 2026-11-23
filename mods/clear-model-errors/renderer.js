// @ts-check
// ============================================================================
//  clear-model-errors — понятные сообщения вместо
//  "Model unavailable, retrying in Xs (attempt X/9)"
//
//  Работает только в UI-процессе (renderer). Ничего не патчит и не трогает
//  логику приложения: заменяет текст в момент отрисовки и на каждой
//  последующей правке этого же узла (React перезаписывает — мы правим снова).
// ============================================================================
(function () {
  'use strict';

  var MOD_ID = 'clear-model-errors';
  var TAG = '[clear-model-errors]';

  // ------------------------------------------------------------------ настройки
  function setting(key, fallback) {
    try {
      if (typeof ModAPI !== 'undefined' && ModAPI.getSetting) {
        var v = ModAPI.getSetting(MOD_ID, key, fallback);
        return (v === undefined || v === null || v === '') ? fallback : v;
      }
    } catch (e) {}
    return fallback;
  }

  var STYLE_FULL = String(setting('style', 'short')) === 'full';
  var HINT_FROM = parseInt(setting('hintFromAttempt', 3), 10);
  if (!isFinite(HINT_FROM) || HINT_FROM < 1) HINT_FROM = 3;
  var TOOLTIP = setting('tooltipOriginal', true) !== false;
  var LOG = setting('consoleLog', false) === true;

  // ------------------------------------------------- реальная причина (из main.js)
  // main.js читает language_server.log и присылает:
  //   { at, status, kind, summary, raw, attempt, delay }
  var detail = null;

  function freshDetail() {
    if (!detail) return null;
    if (detail.status === null && detail.kind === 'other') return null;
    var age = Date.now() - Date.parse(detail.at);
    if (!isFinite(age) || age < 0) age = 0;
    return age <= 45000 ? detail : null;   // показываем только свежую ошибку
  }

  function detailCode(d) {
    if (d.status) return String(d.status);
    if (d.kind === 'reset') return 'RST';
    if (d.kind === 'timeout') return 'TIMEOUT';
    if (d.kind === 'dns') return 'DNS';
    if (d.kind === 'tls') return 'TLS';
    return 'ERR';
  }

  function detailTail() {
    var d = freshDetail();
    if (!d) return '';
    var s = d.summary || '';
    if (d.status && s.indexOf(String(d.status)) === -1) s += ' (' + d.status + ')';
    var code = detailCode(d);
    return s ? ' — [' + code + '] ' + s : ' — [' + code + ']';
  }

  function detailRaw() {
    var d = freshDetail();
    if (!d) return '';
    return ' | сервер: ' + (d.raw || d.line || '');
  }

  // ------------------------------------------------------------------ шаблоны
  // "Model unavailable, retrying in 4s (attempt 1/9)"
  // допускаем варианты: retry/retrying, "attempt 1 of 9", скобки/без скобок
  var RE_RETRY = /Model\s+unavailable\s*[,;:\u2014-]?\s*(?:retry|retrying|will retry)\s+in\s*([0-9]+(?:[.,][0-9]+)?)\s*s(?:ec(?:onds?)?)?\s*[(\[]?\s*attempt\s*([0-9]+)\s*(?:\/|of)\s*([0-9]+)\s*[)\]]?/i;

  // одиночное "Model unavailable" без деталей
  function fmtDelay(raw) {
    var s = String(raw).replace(',', '.').replace(/\.0+$/, '');
    return s.replace('.', ',');
  }

  function retryText(delay, attempt, max) {
    var head = 'Модель не ответила — повтор через ' + fmtDelay(delay) + ' с (попытка ' + attempt + ' из ' + max + ')';

    if (attempt >= max) {
      return 'Модель так и не ответила — все ' + max + ' попыток исчерпаны' + detailTail() + '. Проверь прокси и маршрут до сервера.';
    }

    var parts = [head + detailTail()];
    if (STYLE_FULL) {
      parts.push('это ответ сервера/сети, а не твои лимиты');
    }
    if (attempt >= HINT_FROM) {
      parts.push('повторы не помогают — проверь прокси/маршрут');
    }
    return parts.join(' · ');
  }

  function plainText() {
    return 'Модель не отвечает' + detailTail();
  }

  // Разбитые по узлам фрагменты (React может рендерить сообщение несколькими
  // спанами). Тогда переводим по кускам — текст остаётся понятным.
  var FRAGMENTS = [
    { re: /Model\s+unavailable\s*[,;:]?\s*/gi, to: 'Модель не ответила — ' },
    { re: /retrying\s+in\s*/gi, to: 'повтор через ' },
    { re: /\(\s*attempt\s+([0-9]+)\s*(?:\/|of)\s*([0-9]+)\s*\)/gi, to: '(попытка $1 из $2)' },
    { re: /attempt\s+([0-9]+)\s*(?:\/|of)\s*([0-9]+)/gi, to: 'попытка $1 из $2' },
    { re: /([0-9]+(?:[.,][0-9]+)?)\s*s(?:ec(?:onds?)?)?(?=\s*(?:\(|$|[,.]))/gi, to: '$1 с' }
  ];

  function applyFragments(value) {
    var text = value;
    for (var i = 0; i < FRAGMENTS.length; i++) {
      FRAGMENTS[i].re.lastIndex = 0;
      var before = text;
      text = text.replace(FRAGMENTS[i].re, FRAGMENTS[i].to);
      if (text !== before) {
        // продолжаем: применяем остальные правила
      }
    }
    return text;
  }

  function renderValue(value) {
    var trimmed = value.trim().toLowerCase();
    var retry = RE_RETRY.exec(value);
    if (trimmed === 'model unavailable' || trimmed === 'model unavailable.' || trimmed === 'model unavailable!') {
      return { text: plainText(), source: value };
    }
    if (retry) {
      return {
        text: value.replace(RE_RETRY, retryText(retry[1], parseInt(retry[2], 10), parseInt(retry[3], 10))),
        source: value
      };
    }
    return { text: applyFragments(value), source: value };
  }

  // Узлы, которые мы уже переписали: когда из лога приходит реальная причина,
  // текст обновляется повторно, хотя исходной фразы в нём уже нет.
  var recorded = [];
  var recordedSet = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function remember(node, source) {
    try {
      if (recordedSet && recordedSet.has(node)) {
        for (var i = 0; i < recorded.length; i++) {
          if (recorded[i].node === node) { recorded[i].src = source; return; }
        }
        return;
      }
      if (recordedSet) recordedSet.add(node);
      recorded.push({ node: node, src: source });
      if (recorded.length > 60) recorded.shift();
    } catch (e) {}
  }

  function refreshRecorded() {
    for (var i = recorded.length - 1; i >= 0; i--) {
      var rec = recorded[i];
      var node = rec.node;
      if (!node || !node.isConnected) { recorded.splice(i, 1); continue; }
      try {
        var t = renderValue(rec.src).text;
        if (node.nodeValue !== t) node.nodeValue = t;
        var el = node.parentElement;
        if (el && TOOLTIP) el.setAttribute('title', 'Оригинал: ' + String(rec.src).trim() + detailRaw());
      } catch (e) {}
    }
  }

  // ------------------------------------------------------------------ замена
  function replaceInNode(node) {
    var value = node && node.nodeValue;
    if (!value || value.length < 12) return false;

    // быстрый отсев: 99.9% текстовых узлов не содержат нужной фразы
    if (value.toLowerCase().indexOf('model unavailable') === -1) return false;

    var original = value;
    var next = renderValue(value).text;

    if (next === original) return false;

    try {
      node.nodeValue = next;
    } catch (e) {
      return false;
    }

    remember(node, original);

    // подсказка при наведении — только атрибут, структуру DOM не меняем
    try {
      var el = node.parentElement;
      if (el) {
        el.setAttribute('data-agy-model-error', '1');
        if (TOOLTIP) el.setAttribute('title', 'Оригинал: ' + original.trim() + detailRaw());
      }
    } catch (e) {}

    if (LOG) {
      try { console.debug(TAG, 'replaced:', original.trim(), '->', next.trim()); } catch (e) {}
    }
    return true;
  }

  function scanSubtree(root) {
    if (!root) return 0;
    var hits = 0;
    if (root.nodeType === 3) {
      return replaceInNode(root) ? 1 : 0;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return 0;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (replaceInNode(node)) hits++;
    }
    return hits;
  }

  // ------------------------------------------------------------------ наблюдатели
  var queued = false;

  function flush() {
    queued = false;
    try { scanSubtree(document.body); } catch (e) {}
  }

  function schedule() {
    if (queued) return;
    queued = true;
    (window.requestIdleCallback || window.requestAnimationFrame)(flush);
  }

  function startObserver() {
    if (!document.body) return;
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'characterData') {
          replaceInNode(r.target);
          continue;
        }
        if (r.type === 'childList') {
          for (var j = 0; j < r.addedNodes.length; j++) {
            var n = r.addedNodes[j];
            if (n.nodeType === 3) replaceInNode(n);
            else if (n.nodeType === 1) scanSubtree(n);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return observer;
  }

  // ------------------------------------------------------------------ запуск
  var started = false;
  var observer = null;

  function acceptDetail(payload) {
    if (!payload || typeof payload !== 'object') return;
    detail = payload;
    try { refreshRecorded(); } catch (e) {}   // дописать код в уже показанное сообщение
    schedule();
  }

  function boot() {
    if (started) return;
    started = true;

    try {
      if (window.__AGY_MODEL_LAST_ERROR__) acceptDetail(window.__AGY_MODEL_LAST_ERROR__);
    } catch (e) {}

    window.addEventListener('agy-model-error', function (ev) {
      acceptDetail(ev && ev.detail);
    });

    scanSubtree(document.body);
    observer = startObserver();

    // страховка: если React вставил узел без мутации (innerHTML/document.write)
    setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      try { scanSubtree(document.body); } catch (e) {}
    }, 2500);

    // отладочный интерфейс из консоли
    window.__AGY_CLEAR_ERRORS__ = {
      rescan: function () { return scanSubtree(document.body); },
      last: function () { return detail; },
      observer: observer
    };

    if (LOG) {
      try { console.info(TAG, 'active, style=' + (STYLE_FULL ? 'full' : 'short')); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
