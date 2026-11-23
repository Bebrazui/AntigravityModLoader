// arch-mode v1.0 — «Режим сборки архитектуры».
//
// Как работает:
//  * Рядом с полем ввода появляется пилюля «Архитектура / Код» (+ Ctrl+Alt+P).
//  * В режиме «Архитектура» каждый ваш промпт перед отправкой оборачивается
//    в инструкцию: агент СНАЧАЛА строит архитектуру решения — карту компонентов,
//    контракты, план сборки (.arch/<задача>/{overview.md, contracts.md,
//    build-plan.md}), задаёт уточняющие вопросы и НЕ трогает код,
//    пока вы явно не напишете «Собирай» / «Архитектура одобрена».
//  * Фраза-одобрение («Собирай», «Архитектура одобрена», «Одобряю», approved)
//    автоматически переключает мод в режим «Код».
//  * Ctrl+Alt+Shift+P — изменить шаблон инструкции (%TEXT% = ваш запрос).

(function () {
  'use strict';

  var LS_MODE = 'agy_arch_mode';        // '1' — режим Архитектура, '0' — Код
  var LS_TEMPLATE = 'agy_arch_template';
  var MARKER = '[РЕЖИМ СБОРКИ АРХИТЕКТУРЫ';

  var DEFAULT_TEMPLATE = [
    '[РЕЖИМ СБОРКИ АРХИТЕКТУРЫ — КОД ЗАПРЕЩЁН]',
    'Перед тем как изменить хотя бы одну строку кода, ты обязан собрать архитектуру решения — сначала карта, потом стройка.',
    '',
    '1. Создай/обнови папку `.arch/<короткое-имя-задачи>/` с тремя файлами:',
    '   • **overview.md** — обзор решения: из каких компонентов состоит, что за что отвечает, как данные текут между ними, какие части трогаем, а какие нет;',
    '   • **contracts.md** — контракты между частями: интерфейсы, сигнатуры функций/классов, схемы данных, форматы файлов — всё, что связывает компоненты, до написания кода;',
    '   • **build-plan.md** — план сборки: последовательность небольших проверяемых шагов (сначала скелет и заглушки, потом наполнение, в конце интеграция); каждый шаг — с критерием «как проверим».',
    '',
    '2. Если задача неоднозначна — сначала задай уточняющие вопросы (выбор архитектурного стиля, границы системы, нефункциональные требования).',
    '',
    '3. СТРОГО ЗАПРЕЩЕНО: изменять код проекта, запускать команды записи/генерации, редактировать любые файлы, кроме трёх файлов архитектуры выше.',
    '',
    '4. Заверши ответ краткой схемой архитектуры (компоненты и связи, 5–10 строк) и фразой «Жду одобрения архитектуры».',
    '',
    '5. Сборка начинается только после моего явного ответа «Собирай». После одобрения реализуй строго по build-plan.md, отмечая выполненные шаги `[x]`; если в ходе сборки всплыло неучтённое — сначала обнови архитектуру и запроси повторное одобрение, а не импровизируй.',
    '',
    '---',
    'Запрос:',
    '%TEXT%'
  ].join('\n');

  var APPROVE_RE = /^(собирай|собирать|начинай\s+собирать|архитектура\s*одобрена|архитектуру\s*одобряю|одобряю|согласен|утверждаю|go\s+ahead|approved|build\s+it)\b/i;

  // ------------------------------------------------------------ утилиты
  /** Отладка: пишется в crash.log приложения (main-injector логирует console). */
  var _lastDbg = '';
  function dbg(msg) {
    if (msg === _lastDbg) return;
    _lastDbg = msg;
    try { console.log('__AGY_ACTION__:pm-debug ' + msg); } catch (e) {}
  }

  function mode() {
    try { return localStorage.getItem(LS_MODE) === '1'; } catch (e) { return false; }
  }
  function setMode(on) {
    try { localStorage.setItem(LS_MODE, on ? '1' : '0'); } catch (e) {}
    paintButton();
  }
  function template() {
    try { return localStorage.getItem(LS_TEMPLATE) || DEFAULT_TEMPLATE; }
    catch (e) { return DEFAULT_TEMPLATE; }
  }
  function toast(text) {
    var t = document.createElement('div');
    t.className = 'agy-pm agy-pm-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2600);
  }

  // ------------------------------------------------------- поиск редактора
  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    var r = el.getClientRects();
    return r.length > 0 && r[0].width > 0 && r[0].height > 0;
  }
  function isComposer(el) {
    if (!el || el.nodeType !== 1 || el.closest('.agy-pm')) return false;
    if (el.closest('.monaco-editor, .cm-editor, .view-lines, .CodeMirror')) return false;
    return el.isContentEditable || el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' && /^(text|search|)$/.test((el.getAttribute('type') || 'text')));
  }
  /** Ближайший к низу экрана видимый редактор (поле ввода чата). */
  function findComposer() {
    var nodes = document.querySelectorAll('div[contenteditable="true"], textarea, input[type="text"]');
    var best = null, bestBottom = -1;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isComposer(el) || !isVisible(el)) continue;
      var b = el.getBoundingClientRect().bottom;
      if (b > bestBottom) { bestBottom = b; best = el; }
    }
    return best;
  }
  function getText(el) {
    if (!el) return '';
    return el.isContentEditable ? el.innerText : el.value;
  }

  function selectAllIn(el) {
    try {
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (e) { return false; }
  }

  /** Симуляция вставки через clipboard-событие — так понимают Lexical/Slate/ProseMirror. */
  function tryPaste(el, text) {
    try {
      var dt = null;
      try { dt = new DataTransfer(); dt.setData('text/plain', text); } catch (e) {}
      var ev = new ClipboardEvent('paste', {
        clipboardData: dt, bubbles: true, cancelable: true
      });
      el.dispatchEvent(ev);
      return getText(el).indexOf(MARKER) !== -1;
    } catch (e) { return false; }
  }

  /** beforeinput(insertFromPaste) — второй путь для React-редакторов. */
  function tryBeforeInput(el, text) {
    try {
      var dt = null;
      try { dt = new DataTransfer(); dt.setData('text/plain', text); } catch (e) {}
      var ev = new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'insertFromPaste',
        data: text, dataTransfer: dt
      });
      el.dispatchEvent(ev);
      return getText(el).indexOf(MARKER) !== -1;
    } catch (e) { return false; }
  }

  /** Одна попытка вставки (выполняется синхронно, проверка — асинхронно). */
  function insertOnce(el, text, strategy, cb) {
    if (strategy === 'paste') {
      selectAllIn(el);
      tryPaste(el, text);
    } else if (strategy === 'exec') {
      selectAllIn(el);
      try { document.execCommand('insertText', false, text); } catch (e) {}
    } else if (strategy === 'beforeinput') {
      selectAllIn(el);
      tryBeforeInput(el, text);
    } else {
      try {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      } catch (e) {}
    }
    // React-редакторы применяют изменения асинхронно — ждём и проверяем
    setTimeout(function () { cb(getText(el).indexOf(MARKER) !== -1); }, 70);
  }

  /**
   * Асинхронная вставка: по одной стратегии за раз, пока текст не появится.
   * cb(ok) вызывается ровно один раз.
   */
  function insertAsync(el, text, cb) {
    var order = ['paste', 'exec', 'beforeinput', 'dom'];
    var i = 0;
    function next(ok) {
      if (ok) { dbg('insert ok via ' + order[i - 1]); return cb(true); }
      if (i >= order.length) {
        dbg('insert: ALL FAILED (class=' + String(el.className).slice(0, 60) + ')');
        return cb(false);
      }
      insertOnce(el, text, order[i++], next);
    }
    insertOnce(el, text, order[i++], next);
  }
  function isApproval(text) {
    return APPROVE_RE.test(String(text || '').trim());
  }
  function wrap(text) {
    var tpl = template();
    if (tpl.indexOf('%TEXT%') === -1) tpl += '\n\n%TEXT%';
    return tpl.replace(/%TEXT%/g, text.trim());
  }

  // --------------------------------------------------- перехват отправки
  /** Нужно ли оборачивать текст (проверка без побочных эффектов). */
  function needsWrap(el) {
    if (!mode() || !el) return false;
    var txt = getText(el);
    if (!txt.trim()) return false;
    if (txt.indexOf(MARKER) !== -1) return false;  // уже завёрнут
    if (isApproval(txt)) return false;
    return true;
  }

  // true — наша рекурсивная переотправка, её не перехватываем повторно
  var suppress = false;

  /** Оборачивает текст асинхронно; cb(ok) — ровно один раз. */
  function wrapAsync(el, cb) {
    var txt = getText(el);
    lastUserText = txt;                         // запоминаем для границы сворачивания
    insertAsync(el, wrap(txt), function (ok) {
      dbg(ok ? 'WRAPPED ok (in=' + txt.length + ')' : 'WRAP FAILED');
      cb(ok);
    });
  }

  /** Входящий текст = «Собирай» / «Архитектура одобрена»? → выключаем режим. */
  function checkApproval(el) {
    if (!mode() || !el) return false;
    if (!isApproval(getText(el))) return false;
    setMode(false);
    toast('Архитектура одобрена — режим «Код» включён');
    dbg('approval detected, mode off');
    return true;
  }

  // Enter (отправка) — перехват в фазе capture, ДО обработчиков приложения.
  // Слушаем на window: фаза capture у window идёт раньше document, поэтому
  // даже если приложение перехватывает Enter рано, мы успеваем первыми.
  function onKeydown(e) {
    // хоткеи переключения
    if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      e.stopPropagation();
      setMode(!mode());
      toast(mode() ? 'Режим «Архитектура»: сначала карта решения, потом код' : 'Режим «Код»: обычный чат');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      e.stopPropagation();
      editTemplate();
      return;
    }
    if (suppress) return;
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    var el = (e.target && e.target.closest)
      ? e.target.closest('div[contenteditable="true"], textarea, input[type="text"]')
      : null;
    if (!isComposer(el)) el = document.activeElement;
    dbg('Enter pressed, target=' + (e.target && e.target.nodeName) +
        ', composer=' + (el && el.nodeName) + ', mode=' + mode());
    if (!isComposer(el)) return;
    if (checkApproval(el)) return;                 // «Собирай» — уходит как есть
    if (!needsWrap(el)) return;                    // режим выключен / пусто / уже обёрнуто

    // блокируем отправку, пока вставка не завершится, потом шлём Enter заново
    e.preventDefault();
    e.stopPropagation();
    suppress = true;
    wrapAsync(el, function (ok) {
      suppress = false;
      if (!ok) { toast('Не удалось вставить инструкцию — сообщение не отправлено'); return; }
      toast('Отправлено с инструкцией сборки архитектуры');
      setTimeout(function () {
        suppress = true;
        el.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true
        }));
        setTimeout(function () { suppress = false; }, 150);
      }, 50);
    });
  }

  window.addEventListener('keydown', onKeydown, true);

  // Тест без отправки: Ctrl+Alt+Shift+W — просто оборачивает текст в поле.
  window.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !e.altKey || !e.shiftKey) return;
    if (e.key !== 'w' && e.key !== 'W') return;
    e.preventDefault();
    e.stopPropagation();
    var el = findComposer();
    dbg('manual wrap: composer=' + (el && el.nodeName) + ', mode=' + mode());
    if (!el) { toast('Поле ввода не найдено'); return; }
    var wasMode = mode();
    setMode(true);
    if (getText(el).indexOf(MARKER) !== -1) { toast('Уже обёрнуто'); if (!wasMode) setMode(false); return; }
    suppress = true;
    wrapAsync(el, function (ok) {
      suppress = false;
      if (!ok && !wasMode) setMode(false);
      if (!ok) toast('Текст не обёрнут (поле пустое?)');
    });
  }, true);

  function editTemplate() {
    var cur = template();
    var next = window.prompt(
      'Шаблон инструкции сборки архитектуры.\n%TEXT% подставит ваш запрос.\n\nПустой ввод — вернуть стандартный шаблон:',
      cur
    );
    if (next === null) return;
    try {
      if (next.trim() === '') localStorage.removeItem(LS_TEMPLATE);
      else localStorage.setItem(LS_TEMPLATE, next);
    } catch (e) {}
    toast('Шаблон сохранён');
  }

  // Кнопка «Отправить» — тоже оборачиваем перед кликом.
  document.addEventListener('click', function (e) {
    if (suppress || !mode()) return;
    var sbtn = e.target && e.target.closest && e.target.closest('button');
    if (!sbtn) return;
    var label = (sbtn.getAttribute('aria-label') || sbtn.getAttribute('title') || sbtn.textContent || '');
    if (!/send|отправ/i.test(label)) return;
    var c = findComposer();
    if (!c) return;
    var box = c.closest('form, [class*="composer"], [class*="Composer"], [class*="prompt"]') || c.parentElement;
    var inBox = !!(box && box.contains(sbtn));
    dbg('send-click, btn="' + String(label).trim().slice(0, 30) + '", inBox=' + inBox);
    if (!inBox || !needsWrap(c)) return;

    e.preventDefault();
    e.stopPropagation();
    suppress = true;
    wrapAsync(c, function (ok) {
      suppress = false;
      if (!ok) { toast('Не удалось вставить инструкцию — сообщение не отправлено'); return; }
      toast('Отправлено с инструкцией сборки архитектуры');
      setTimeout(function () {
        suppress = true;
        sbtn.click();
        setTimeout(function () { suppress = false; }, 150);
      }, 50);
    });
  }, true);

  // ------------------------------------------------- пилюля «Архитектура/Код»
  var btn = null;

  function buildButton() {
    btn = document.createElement('button');
    btn.className = 'agy-pm agy-pm-btn';
    btn.title = 'Режим сборки архитектуры (Ctrl+Alt+P). Архитектура — агент сначала строит overview/contracts/build-plan и не трогает код, пока вы не скажете «Собирай».';
    btn.addEventListener('click', function () {
      setMode(!mode());
      toast(mode() ? 'Режим «Архитектура»: сначала карта решения, потом код' : 'Режим «Код»: обычный чат');
    });
    document.body.appendChild(btn);
    paintButton();
    positionButton();
  }

  function paintButton() {
    if (!btn) return;
    btn.textContent = mode() ? 'Архит.' : 'Код';
    btn.classList.toggle('on', mode());
  }

  function positionButton() {
    if (!btn) return;
    var c = findComposer();
    var bottom = 120;
    if (c) {
      var r = c.getBoundingClientRect();
      if (r.top > 80) bottom = window.innerHeight - r.top + 12;
    }
    btn.style.bottom = Math.max(70, bottom) + 'px';
  }

  // ------------------------------------- сворачивание инструкции в ленте
  //  Сообщение рендерится как markdown (много абзацев), поэтому работаем
  //  не с одним текстовым узлом, а с блоками-детьми контейнера сообщения:
  //  от абзаца с маркером до разделителя «---» / «Запрос:» / <hr>.
  var MARKERS = [MARKER, '[РЕЖИМ ПЛАНИРОВАНИЯ'];  // + старый маркер plan-mode
  var lastUserText = '';   // что реально отправили — помогает найти границу

  function collapseInstruction(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
    var hits = [];
    var n;
    while ((n = walker.nextNode())) {
      var v = n.nodeValue || '';
      var has = false;
      for (var mi = 0; mi < MARKERS.length; mi++) {
        if (v.indexOf(MARKERS[mi]) !== -1) { has = true; break; }
      }
      if (!has) continue;
      var el = n.parentElement;
      if (!el || el.closest('[contenteditable="true"], .agy-pm')) continue;
      hits.push(el);
    }
    for (var h = 0; h < hits.length; h++) collapseFrom(hits[h]);
  }

  function collapseFrom(el) {
    // поднимаемся к контейнеру, где лежат все абзацы сообщения
    var target = el, found = null;
    for (var up = 0; up < 10; up++) {
      var par = target.parentElement;
      if (!par) break;
      var tc = par.textContent || '';
      var hasMarker = false;
      for (var mi = 0; mi < MARKERS.length; mi++) {
        if (tc.indexOf(MARKERS[mi]) !== -1) { hasMarker = true; break; }
      }
      if (hasMarker && (tc.indexOf('Запрос') !== -1 || par.querySelector('hr, [class*="separator"]'))) {
        found = par; break;
      }
      target = par;
    }
    if (!found) return;
    if (found.__agy_pm_collapsed) return;
    found.__agy_pm_collapsed = true;

    var kids = Array.prototype.slice.call(found.children);
    if (!kids.length) return;
    var startIdx = -1, endIdx = -1;
    for (var i = 0; i < kids.length; i++) {
      var t = kids[i].textContent || '';
      if (startIdx === -1) {
        var has = false;
        for (var m2 = 0; m2 < MARKERS.length; m2++) {
          if (t.indexOf(MARKERS[m2]) !== -1) { has = true; break; }
        }
        if (has) startIdx = i;
        continue;
      }
      var tt = t.trim();
      if (tt === '---' || tt === '***' || kids[i].tagName === 'HR' ||
          t.indexOf('Запрос') !== -1 ||
          (lastUserText && tt === lastUserText.trim())) {
        endIdx = i;
        break;
      }
    }
    if (startIdx === -1) return;
    if (endIdx === -1) endIdx = kids.length - 1;

    var det = document.createElement('details');
    det.className = 'agy-pm agy-pm-spec';
    var sum = document.createElement('summary');
    sum.textContent = 'Инструкция сборки архитектуры отправлена';
    det.appendChild(sum);
    var pre = document.createElement('pre');
    var instrText = '';
    for (var k = startIdx; k <= endIdx; k++) instrText += (kids[k].textContent || '') + '\n';
    pre.textContent = instrText.trim();
    det.appendChild(pre);

    found.insertBefore(det, kids[startIdx]);
    for (var r = startIdx; r <= endIdx; r++) {
      if (kids[r].parentNode) kids[r].parentNode.removeChild(kids[r]);
    }
    dbg('collapsed instruction blocks ' + startIdx + '..' + endIdx);
  }

  function start() {
    buildButton();
    setInterval(positionButton, 800);
    var collapseTimer = null;
    var mo = new MutationObserver(function (muts) {
      positionButton();
      // сворачиваем инструкцию в новых сообщениях (с дебаунсом)
      var relevant = false;
      for (var i = 0; i < muts.length && !relevant; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1 || added[j].nodeType === 3) { relevant = true; break; }
        }
      }
      if (!relevant) return;
      if (collapseTimer) clearTimeout(collapseTimer);
      collapseTimer = setTimeout(function () { collapseInstruction(document.body); }, 120);
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(function () { collapseInstruction(document.body); }, 1500);
    dbg('MOD LOADED, mode=' + mode() + ', composer=' + (findComposer() && findComposer().nodeName));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
