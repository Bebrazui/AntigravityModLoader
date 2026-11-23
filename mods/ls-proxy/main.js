// ls-proxy — прокидывает прокси в окружение language_server.
//
// Проблема: Antigravity запускается через explorer.exe (чтобы не работать от
// админа), поэтому AG_LS_PROXY из HKCU\Environment до процесса не доходит.
// language_server стартует как дочерний процесс Electron и наследует
// process.env главного процесса (см. app.asar: env = {...process.env,
// ...loginShellEnv}), поэтому достаточно выставить переменные здесь — до
// момента спавна LS. Моды грузятся на верхнем уровне main-injector.js, то есть
// раньше app.whenReady(), а LS стартует уже внутри whenReady.

const fs = require('fs');
const path = require('path');

const PROXY_URL = process.env.AG_LS_PROXY || 'http://127.0.0.1:44129';
const LOG_FILE = path.join(__dirname, '..', '..', 'ls-proxy.log');

function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch (e) {
    /* логировать некуда — не падаем */
  }
}

function apply() {
  const before = {
    AG_LS_PROXY: process.env.AG_LS_PROXY || '',
    HTTPS_PROXY: process.env.HTTPS_PROXY || '',
    HTTP_PROXY: process.env.HTTP_PROXY || ''
  };

  process.env.AG_LS_PROXY = PROXY_URL;
  // Go-клиент language_server читает HTTPS_PROXY как обычную переменную;
  // регистр важен: lowercase-варианты Go не использует на Windows.
  process.env.HTTPS_PROXY = PROXY_URL;
  process.env.HTTP_PROXY = PROXY_URL;
  process.env.NO_PROXY = 'localhost,127.0.0.1,::1';

  log(
    `applied ${PROXY_URL} | before: AG_LS_PROXY="${before.AG_LS_PROXY}" ` +
      `HTTPS_PROXY="${before.HTTPS_PROXY}" HTTP_PROXY="${before.HTTP_PROXY}"`
  );
}

// Модуль грузится до whenReady — этого достаточно, но init() тоже вызывается.
apply();

module.exports = {
  init(api, mod) {
    try {
      apply();
      log(`init ok (mod=${mod && mod.id})`);
    } catch (e) {
      log('init failed: ' + (e && e.message));
    }
  }
};
