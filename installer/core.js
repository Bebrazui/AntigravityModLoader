// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');

const USER_HOME = os.homedir();
const MODS_BASE = path.join(USER_HOME, '.antigravity-mods');
const SHIM_FILE = path.join(MODS_BASE, 'shim', 'h.js');

/**
 * Кроссплатформенное автоопределение путей установки Antigravity
 * Поддерживает Windows, macOS, Linux
 * @param {string} [customPath]
 * @returns {{ installDir: string, resourcesDir: string, appAsar: string, backupAsar: string, exePath: string, platform: string, found: boolean }}
 */
function resolvePaths(customPath) {
  const platform = process.platform;
  let installDir = customPath || '';
  let resourcesDir = '';
  let exePath = '';

  if (customPath && fs.existsSync(customPath)) {
    if (customPath.endsWith('.asar')) {
      resourcesDir = path.dirname(customPath);
      installDir = path.dirname(resourcesDir);
    } else if (fs.existsSync(path.join(customPath, 'resources', 'app.asar'))) {
      resourcesDir = path.join(customPath, 'resources');
      installDir = customPath;
    } else if (fs.existsSync(path.join(customPath, 'app.asar'))) {
      resourcesDir = customPath;
      installDir = path.dirname(resourcesDir);
    }
  }

  if (!resourcesDir) {
    if (platform === 'win32') {
      const candidates = [
        path.join(process.env.LOCALAPPDATA || path.join(USER_HOME, 'AppData', 'Local'), 'Programs', 'antigravity'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Antigravity'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Antigravity')
      ];
      for (const c of candidates) {
        const asar = path.join(c, 'resources', 'app.asar');
        if (fs.existsSync(asar)) {
          installDir = c;
          resourcesDir = path.join(c, 'resources');
          exePath = path.join(c, 'Antigravity.exe');
          break;
        }
      }
    } else if (platform === 'darwin') {
      const candidates = [
        '/Applications/Antigravity.app',
        path.join(USER_HOME, 'Applications', 'Antigravity.app')
      ];
      for (const c of candidates) {
        const asar = path.join(c, 'Contents', 'Resources', 'app.asar');
        if (fs.existsSync(asar)) {
          installDir = c;
          resourcesDir = path.join(c, 'Contents', 'Resources');
          exePath = path.join(c, 'Contents', 'MacOS', 'Antigravity');
          break;
        }
      }
    } else if (platform === 'linux') {
      const candidates = [
        '/opt/Antigravity',
        '/usr/lib/antigravity',
        '/usr/share/antigravity',
        path.join(USER_HOME, '.local', 'share', 'antigravity'),
        path.join(USER_HOME, 'antigravity')
      ];
      for (const c of candidates) {
        const asar = path.join(c, 'resources', 'app.asar');
        if (fs.existsSync(asar)) {
          installDir = c;
          resourcesDir = path.join(c, 'resources');
          exePath = path.join(c, 'antigravity');
          break;
        }
      }
    }
  }

  const appAsar = resourcesDir ? path.join(resourcesDir, 'app.asar') : '';
  const backupAsar = resourcesDir ? path.join(resourcesDir, 'app.asar.original') : '';
  const found = Boolean(appAsar && fs.existsSync(appAsar));

  return {
    installDir,
    resourcesDir,
    appAsar,
    backupAsar,
    exePath,
    platform,
    found
  };
}

/**
 * Проверка: пропатчен ли app.asar загрузчиком
 * @param {string} appAsarPath
 */
function isPatched(appAsarPath) {
  try {
    if (!fs.existsSync(appAsarPath)) return false;
    const buf = fs.readFileSync(appAsarPath);
    return buf.includes('.antigravity-mods') || buf.includes('h.js');
  } catch (_) {
    return false;
  }
}

/**
 * Поиск слота для инжекции в app.asar
 * @param {Buffer} asarBuf
 */
function findInjectionSlot(asarBuf) {
  const candidates = [
    {
      anchor: 'if (!gotTheLock) {\n    electron_1.app.quit();\n    process.exit(0);\n}\n',
    },
    {
      anchor: 'if (!gotTheLock) {\r\n    electron_1.app.quit();\r\n    process.exit(0);\r\n}\r\n',
    },
    {
      regex: /if\s*\(!gotTheLock\)\s*\{\s*[^}]*process\.exit\(0\);\s*\}\s*(\r?\n)/
    }
  ];

  for (const cand of candidates) {
    let anchorPos = -1;
    let anchorLen = 0;

    if (cand.anchor) {
      const anchorBuf = Buffer.from(cand.anchor, 'utf8');
      anchorPos = asarBuf.indexOf(anchorBuf);
      if (anchorPos !== -1) {
        anchorLen = anchorBuf.length;
      }
    } else if (cand.regex) {
      const asarStr = asarBuf.toString('utf8');
      const match = cand.regex.exec(asarStr);
      if (match) {
        anchorPos = Buffer.byteLength(asarStr.slice(0, match.index), 'utf8');
        anchorLen = Buffer.byteLength(match[0], 'utf8');
      }
    }

    if (anchorPos !== -1) {
      const slotPos = anchorPos + anchorLen;
      const slice = asarBuf.slice(slotPos, slotPos + 250).toString('utf8');
      if (slice.startsWith('//')) {
        const stateIdx = slice.indexOf('\nlet ');
        const crlfStateIdx = slice.indexOf('\r\nlet ');
        let availableBytes = 166;
        if (stateIdx !== -1) {
          availableBytes = Buffer.byteLength(slice.slice(0, stateIdx + 1), 'utf8');
        } else if (crlfStateIdx !== -1) {
          availableBytes = Buffer.byteLength(slice.slice(0, crlfStateIdx + 2), 'utf8');
        }
        return { slotPos, slotLen: availableBytes };
      }
    }
  }

  return null;
}

/**
 * Создает или обновляет кроссплатформенный файл шима (~/.antigravity-mods/shim/h.js)
 */
function ensureShimFile() {
  const shimDir = path.dirname(SHIM_FILE);
  if (!fs.existsSync(shimDir)) {
    fs.mkdirSync(shimDir, { recursive: true });
  }

  const mainInjectorPath = path.join(MODS_BASE, 'loader', 'main-injector.js').replace(/\\/g, '/');
  const crashLogPath = path.join(MODS_BASE, 'crash.log').replace(/\\/g, '/');

  const shimCode = `// @ts-check\ntry {\n  require('${mainInjectorPath}');\n} catch (e) {\n  try {\n    require('fs').appendFileSync('${crashLogPath}', '[HOOK_ERR] ' + (e.stack || e) + '\\n');\n  } catch (_) {}\n}\n`;

  fs.writeFileSync(SHIM_FILE, shimCode, 'utf8');
}

/**
 * Применяет патч к app.asar
 * @param {string} [customPath]
 * @returns {{ success: boolean, alreadyPatched?: boolean, reason?: string, error?: string, path?: string }}
 */
function patch(customPath) {
  const paths = resolvePaths(customPath);
  if (!paths.found) {
    return { success: false, reason: 'Antigravity app.asar не найден на этой системе.' };
  }

  if (isPatched(paths.appAsar)) {
    return { success: true, alreadyPatched: true, path: paths.appAsar };
  }

  ensureShimFile();

  const asarBuf = fs.readFileSync(paths.appAsar);
  const slot = findInjectionSlot(asarBuf);

  if (!slot || slot.slotLen < 80) {
    return { success: false, reason: 'Слот инжекции в app.asar не найден (несовместимая версия сборки).' };
  }

  // Создаем чистый бэкап оригинала
  try {
    if (!fs.existsSync(paths.backupAsar)) {
      fs.copyFileSync(paths.appAsar, paths.backupAsar);
    }
  } catch (be) {
    return { success: false, error: 'Ошибка создания бэкапа app.asar.original: ' + be.message };
  }

  const shimPath = SHIM_FILE.replace(/\\/g, '/');
  let patchCode = `try{require("${shimPath}")}catch(e){};`;

  if (Buffer.byteLength(patchCode, 'utf8') > slot.slotLen) {
    return { success: false, reason: 'Длина пути шима превышает доступный слот в файле.' };
  }

  patchCode += '// ';
  while (Buffer.byteLength(patchCode, 'utf8') < slot.slotLen - 1) {
    patchCode += '-';
  }
  patchCode += '\n';

  const patchedBuf = Buffer.from(asarBuf);
  patchedBuf.write(patchCode, slot.slotPos, slot.slotLen, 'utf8');

  // Разблокировка Chromium DevTools
  const devToolsAnchor = 'function isDebugConsoleEnabled() {\n    return !electron_1.app.isPackaged;\n}';
  const devToolsRepl =   'function isDebugConsoleEnabled() {\n    return true;                      \n}';
  const dtPos = patchedBuf.indexOf(Buffer.from(devToolsAnchor, 'utf8'));
  if (dtPos !== -1) {
    patchedBuf.write(devToolsRepl, dtPos, Buffer.byteLength(devToolsRepl, 'utf8'), 'utf8');
  }

  try {
    fs.writeFileSync(paths.appAsar, patchedBuf);
    return { success: true, path: paths.appAsar };
  } catch (err) {
    // Откат при ошибке записи
    if (fs.existsSync(paths.backupAsar)) {
      try { fs.copyFileSync(paths.backupAsar, paths.appAsar); } catch (_) {}
    }
    return { success: false, error: err.message };
  }
}

/**
 * Восстанавливает оригинальный app.asar из бэкапа
 * @param {string} [customPath]
 * @returns {{ success: boolean, reason?: string, error?: string, path?: string }}
 */
function unpatch(customPath) {
  const paths = resolvePaths(customPath);
  if (!paths.found) {
    return { success: false, reason: 'Antigravity не найден.' };
  }

  if (!fs.existsSync(paths.backupAsar)) {
    return { success: false, reason: 'Файл бэкапа app.asar.original не найден.' };
  }

  try {
    fs.copyFileSync(paths.backupAsar, paths.appAsar);
    return { success: true, path: paths.appAsar };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  resolvePaths,
  isPatched,
  patch,
  unpatch,
  ensureShimFile
};
