'use strict';
// ============================================================================
//  main-процесс: следит за language_server.log, вытаскивает реальную причину
//  ошибки (HTTP-код / reset / timeout / DNS) и отдаёт её в UI через
//  window.__AGY_MODEL_LAST_ERROR__ + событие "agy-model-error".
//
//  Только чтение лога. Ничего не патчит и не меняет поведение агента.
// ============================================================================
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseLine } = require('./parse');

module.exports = function (api, mod) {
  const app = api && api.app;
  const HOME = os.homedir();
  const APP_DATA = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
  const LOG = path.join(APP_DATA, 'Antigravity', 'logs', 'language_server.log');
  const DUMP = path.join(HOME, '.antigravity-mods', 'model-last-error.json');

  const targets = new Set();
  let last = null;
  let pos = 0;
  let carry = '';

  function log(msg) {
    try {
      fs.appendFileSync(path.join(HOME, '.antigravity-mods', 'crash.log'),
        '[' + new Date().toISOString() + '] [model-errors] ' + msg + '\n', 'utf8');
    } catch (e) {}
  }

  function emit(payload) {
    last = payload;

    try {
      fs.writeFileSync(DUMP, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    log('error captured: [' + (payload.status || payload.kind) + '] ' + (payload.summary || '') +
      ' | targets=' + targets.size);

    const json = JSON.stringify(payload);
    const code =
      'window.__AGY_MODEL_LAST_ERROR__=' + json + ';' +
      'try{window.dispatchEvent(new CustomEvent("agy-model-error",{detail:' + json + '}))}catch(e){}';

    targets.forEach(function (wc) {
      try {
        if (!wc.isDestroyed()) {
          const p = wc.executeJavaScript(code);
          if (p && p.catch) p.catch(function () {});
        }
      } catch (e) {}
    });
  }

  function isErrorish(line) {
    if (line.indexOf('retrying in') !== -1) return true;
    if (line.indexOf('API error') !== -1) return true;
    if (line.indexOf('daily-cloudcode-pa') === -1) return false;
    return line.indexOf('errorreport.go') !== -1 ||
      line.indexOf('error_parsing.go') !== -1 ||
      line.indexOf('Singleflight refresh failed') !== -1;
  }

  function feed(chunk) {
    const text = carry + chunk;
    const parts = text.split(/\r?\n/);
    carry = parts.pop() || '';

    for (let i = 0; i < parts.length; i++) {
      const line = parts[i];
      if (!line) continue;
      if (!isErrorish(line)) continue;
      const parsed = parseLine(line);
      if (parsed) emit(parsed);
    }
  }

  function readNew() {
    try {
      const st = fs.statSync(LOG);
      if (st.size < pos) {         // файл пересоздан/ротирован
        pos = 0;
        carry = '';
      }
      if (st.size === pos) return;

      const tail = Math.min(st.size - pos, 262144); // максимум 256 КБ новых данных
      const buf = Buffer.alloc(tail);
      const fd = fs.openSync(LOG, 'r');
      let read = 0;
      try {
        read = fs.readSync(fd, buf, 0, tail, st.size - tail);
      } finally {
        fs.closeSync(fd);
      }
      pos = st.size;
      feed(buf.toString('utf8', 0, read));
    } catch (e) {
      // лог могут удалить между stat и read — просто подождём следующего тика
    }
  }

  try {
    pos = fs.statSync(LOG).size;   // начинаем с конца: старые ошибки не показываем
  } catch (e) {
    pos = 0;
  }

  const timer = setInterval(readNew, 700);
  if (timer.unref) timer.unref();

  log('watcher started, log=' + LOG + ' pos=' + pos + ', app=' + (app ? 'yes' : 'no'));

  if (app) {
    app.on('web-contents-created', function (_event, wc) {
      targets.add(wc);
      try {
        wc.on('destroyed', function () { targets.delete(wc); });
        wc.on('did-finish-load', function () {
          if (!last) return;
          const json = JSON.stringify(last);
          try {
            const p = wc.executeJavaScript('window.__AGY_MODEL_LAST_ERROR__=' + json + ';');
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        });
      } catch (e) {}
    });
  }

  if (api && api.registerIpcHandler) {
    api.registerIpcHandler('model-errors:last', function () {
      return last;
    });
  }
};
