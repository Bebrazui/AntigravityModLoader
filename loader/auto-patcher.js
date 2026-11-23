// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const USER_HOME = os.homedir();
const MODS_BASE = path.join(USER_HOME, '.antigravity-mods');
const CRASH_LOG = path.join(MODS_BASE, 'crash.log');
const SHIM_FILE = path.join(MODS_BASE, 'shim', 'h.js');

function getPaths() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWin) {
    const installDir = path.join(
      process.env.LOCALAPPDATA || path.join(USER_HOME, 'AppData', 'Local'),
      'Programs',
      'antigravity'
    );
    const resources = path.join(installDir, 'resources');
    return {
      installDir,
      appExe: path.join(installDir, 'Antigravity.exe'),
      resourcesDir: resources,
      appAsar: path.join(resources, 'app.asar'),
      backupAsar: path.join(resources, 'app.asar.original')
    };
  } else if (isMac) {
    const installDir = '/Applications/Antigravity.app';
    const resources = path.join(installDir, 'Contents', 'Resources');
    return {
      installDir,
      appExe: path.join(installDir, 'Contents', 'MacOS', 'Antigravity'),
      resourcesDir: resources,
      appAsar: path.join(resources, 'app.asar'),
      backupAsar: path.join(resources, 'app.asar.original')
    };
  } else {
    // Linux
    const candidates = [
      '/opt/antigravity',
      '/opt/Antigravity',
      '/usr/lib/antigravity',
      '/usr/lib/Antigravity',
      '/usr/share/antigravity',
      '/usr/share/Antigravity',
      path.join(USER_HOME, '.local', 'share', 'antigravity'),
      path.join(USER_HOME, '.local', 'share', 'Antigravity')
    ];
    for (const c of candidates) {
      const asar = path.join(c, 'resources', 'app.asar');
      if (fs.existsSync(asar)) {
        const resources = path.join(c, 'resources');
        return {
          installDir: c,
          appExe: path.join(c, 'antigravity'),
          resourcesDir: resources,
          appAsar: asar,
          backupAsar: path.join(resources, 'app.asar.original')
        };
      }
    }
    const defRes = '/opt/antigravity/resources';
    return {
      installDir: '/opt/antigravity',
      appExe: '/opt/antigravity/antigravity',
      resourcesDir: defRes,
      appAsar: path.join(defRes, 'app.asar'),
      backupAsar: path.join(defRes, 'app.asar.original')
    };
  }
}

const paths = getPaths();
let DEFAULT_INSTALL_DIR = paths.installDir;
let APP_EXE = paths.appExe;
let RESOURCES_DIR = paths.resourcesDir;
let APP_ASAR = paths.appAsar;
let BACKUP_ASAR = paths.backupAsar;
const META_FILE = path.join(MODS_BASE, 'autopatch_meta.json');

function setCustomAsarPath(customAsar) {
  if (!customAsar) return;
  APP_ASAR = customAsar;
  RESOURCES_DIR = path.dirname(customAsar);
  BACKUP_ASAR = path.join(RESOURCES_DIR, 'app.asar.original');
}

function log(msg) {
  const line = `[${new Date().toISOString()}] [AutoPatcher] ${msg}\n`;
  try {
    fs.appendFileSync(CRASH_LOG, line, 'utf8');
  } catch (_) {}
}

/**
 * Checks if app.asar is already hooked with our loader
 */
function isPatched() {
  try {
    if (!fs.existsSync(APP_ASAR)) return false;
    const buf = fs.readFileSync(APP_ASAR);
    return buf.includes('.antigravity-mods');
  } catch (e) {
    return false;
  }
}

/**
 * Smart Signature Matcher:
 * Finds suitable injection location inside app.asar without relying on fragile hardcoded offsets.
 */
function findInjectionSlot(asarBuf) {
  const candidates = [
    {
      // Primary Anchor: Right after gotTheLock condition check
      anchor: 'if (!gotTheLock) {\n    electron_1.app.quit();\n    process.exit(0);\n}\n',
      commentPrefix: '// ---------------------------------------------------------------------------'
    },
    {
      // Fallback 1: Windows CRLF variant
      anchor: 'if (!gotTheLock) {\r\n    electron_1.app.quit();\r\n    process.exit(0);\r\n}\r\n',
      commentPrefix: '// ---------------------------------------------------------------------------'
    },
    {
      // Fallback 2: Any requestSingleInstanceLock check with standard exit
      regex: /if\s*\(!gotTheLock\)\s*\{\s*[^}]*process\.exit\(0\);\s*\}\s*(\r?\n)/,
      commentPrefix: '// '
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
      // String search as fallback
      const asarStr = asarBuf.toString('utf8');
      const match = cand.regex.exec(asarStr);
      if (match) {
        anchorPos = Buffer.byteLength(asarStr.slice(0, match.index), 'utf8');
        anchorLen = Buffer.byteLength(match[0], 'utf8');
      }
    }

    if (anchorPos !== -1) {
      const slotPos = anchorPos + anchorLen;
      // Examine existing comment block
      const slice = asarBuf.slice(slotPos, slotPos + 250).toString('utf8');
      if (slice.startsWith('//')) {
        // Find newline or block boundary where comments end
        // Look for the comment section up to the first executable code statement
        const stateIdx = slice.indexOf('\nlet ');
        const crlfStateIdx = slice.indexOf('\r\nlet ');
        let availableBytes = 166;
        if (stateIdx !== -1) {
          availableBytes = Buffer.byteLength(slice.slice(0, stateIdx + 1), 'utf8');
        } else if (crlfStateIdx !== -1) {
          availableBytes = Buffer.byteLength(slice.slice(0, crlfStateIdx + 2), 'utf8');
        }

        return {
          slotPos,
          slotLen: availableBytes
        };
      }
    }
  }

  return null;
}

/**
 * Performs byte-perfect patch
 */
function applyPatch() {
  if (!fs.existsSync(RESOURCES_DIR) || !fs.existsSync(APP_ASAR)) {
    log(`Antigravity not found at ${RESOURCES_DIR}`);
    return { success: false, reason: 'not_found' };
  }

  if (isPatched()) {
    log('Antigravity is already patched.');
    return { success: true, alreadyPatched: true };
  }

  const stat = fs.statSync(APP_ASAR);
  const currentSize = stat.size;

  log(`New unpatched app.asar detected (size: ${currentSize} bytes). Patching...`);

  // Create clean backup of this specific version
  try {
    fs.copyFileSync(APP_ASAR, BACKUP_ASAR);
    log(`Created pristine backup: ${BACKUP_ASAR}`);
  } catch (e) {
    log(`Failed to backup app.asar: ${e.message}`);
  }

  const asarBuf = fs.readFileSync(APP_ASAR);
  const slot = findInjectionSlot(asarBuf);

  if (!slot || slot.slotLen < 80) {
    log('Error: Could not locate suitable injection slot in app.asar!');
    return { success: false, reason: 'slot_not_found' };
  }

  const shimPath = SHIM_FILE.replace(/\\/g, '/');
  let patchCode = `try{require("${shimPath}")}catch(e){};`;

  if (Buffer.byteLength(patchCode, 'utf8') > slot.slotLen) {
    log(`Error: Patch code length (${Buffer.byteLength(patchCode, 'utf8')}) exceeds slot length (${slot.slotLen})`);
    return { success: false, reason: 'slot_too_small' };
  }

  // Pad to exact slotLen with safe comment, preserving the trailing newline
  // that terminates the line (otherwise the following let declarations
  // become part of the comment and the app fails to start).
  patchCode += '// ';
  while (Buffer.byteLength(patchCode, 'utf8') < slot.slotLen - 1) {
    patchCode += '-';
  }
  patchCode += '\n';

  const patchedBuf = Buffer.from(asarBuf);
  patchedBuf.write(patchCode, slot.slotPos, slot.slotLen, 'utf8');

  // Also patch isDebugConsoleEnabled() -> return true so Electron's Chromium DevTools
  // are never suppressed for BrowserWindows or menus in packaged builds
  const devToolsAnchor = 'function isDebugConsoleEnabled() {\n    return !electron_1.app.isPackaged;\n}';
  const devToolsRepl =   'function isDebugConsoleEnabled() {\n    return true;                      \n}';
  const dtPos = patchedBuf.indexOf(Buffer.from(devToolsAnchor, 'utf8'));
  if (dtPos !== -1) {
    patchedBuf.write(devToolsRepl, dtPos, Buffer.byteLength(devToolsRepl, 'utf8'), 'utf8');
    log(`Auto-unlocked Chromium DevTools (isDebugConsoleEnabled -> true at ${dtPos})`);
  }

  try {
    fs.writeFileSync(APP_ASAR, patchedBuf);
    log(`Successfully auto-patched app.asar (${slot.slotLen} bytes at offset ${slot.slotPos})`);

    // Save meta
    try {
      fs.writeFileSync(META_FILE, JSON.stringify({
        lastPatched: new Date().toISOString(),
        asarSize: currentSize,
        slotOffset: slot.slotPos
      }, null, 2), 'utf8');
    } catch (_) {}

    return { success: true, patchedNow: true };
  } catch (err) {
    log(`Failed to write patched app.asar: ${err.message}`);
    // Rollback from backup if write was interrupted
    if (fs.existsSync(BACKUP_ASAR)) {
      try {
        fs.copyFileSync(BACKUP_ASAR, APP_ASAR);
        log('Rollback restored original app.asar');
      } catch (_) {}
    }
    return { success: false, error: err.message };
  }
}

/**
 * Fast silent check and patch: called right before application starts
 */
function ensurePatched() {
  if (!isPatched()) {
    return applyPatch();
  }
  return { success: true, alreadyPatched: true };
}

module.exports = {
  isPatched,
  applyPatch,
  ensurePatched,
  setCustomAsarPath,
  APP_EXE,
  APP_ASAR,
  RESOURCES_DIR
};
