// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const cp = require('child_process');

const GITHUB_REPO = 'Bebrazui/AntigravityModLoader';
const VERSION_FILE = path.join(os.homedir(), '.antigravity-mods', 'version.json');
const LOG_FILE = path.join(os.homedir(), '.antigravity-mods', 'crash.log');

function log(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [Updater] ${msg}\n`, 'utf8');
  } catch (_) {}
}

function getCurrentVersion() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
      return data.version || '1.1.0';
    }
  } catch (_) {}
  return '1.1.0';
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'AntigravityModLoader-Updater'
      }
    };
    https.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'AntigravityModLoader' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          setTimeout(resolve, 200);
        });
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch(_) {}
      reject(err);
    });
  });
}

function extractZip(zipPath, targetDir) {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    return true;
  } catch (_) {}

  if (process.platform !== 'win32') {
    try {
      cp.execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`);
      return true;
    } catch (_) {}
  } else {
    try {
      cp.execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
      return true;
    } catch (_) {}
  }

  try {
    cp.execSync(`python3 -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${targetDir}')"`);
    return true;
  } catch (_) {}

  return false;
}

/**
 * Проверка наличия свежего релиза
 */
async function checkReleaseInfo() {
  const { getConfig } = require('./registry');
  const cfg = getConfig();
  const repo = cfg.githubRepo || GITHUB_REPO;
  const currentVer = getCurrentVersion();

  log(`Checking release for ${repo} (local: ${currentVer})...`);
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const release = await fetchJson(releaseUrl);

  if (!release || !release.tag_name) {
    return { hasUpdate: false, currentVer };
  }

  const latestVer = release.tag_name.replace(/^v/, '');
  const asset = (release.assets || []).find(a => a.name === 'payload.zip' || a.name.endsWith('.zip'));

  return {
    hasUpdate: latestVer !== currentVer,
    latestVer,
    currentVer,
    releaseNotes: release.body || '',
    downloadUrl: asset ? asset.browser_download_url : null
  };
}

/**
 * Скачивание и применение обновления
 */
async function performUpdate(downloadUrl, targetVer) {
  if (!downloadUrl) throw new Error('Download URL not specified');
  const targetDir = path.join(os.homedir(), '.antigravity-mods');
  const tempZip = path.join(targetDir, 'update_payload.zip');

  log(`Downloading update ${targetVer} from ${downloadUrl}...`);
  await downloadFile(downloadUrl, tempZip);

  log(`Extracting update into ${targetDir}...`);
  const extracted = extractZip(tempZip, targetDir);
  if (extracted) {
    try { fs.unlinkSync(tempZip); } catch(_) {}
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ version: targetVer, updated_at: new Date().toISOString() }, null, 2));
    log(`Update to ${targetVer} applied successfully.`);
    return true;
  } else {
    throw new Error('Failed to extract update zip archive');
  }
}

/**
 * Основной оркестратор проверки
 */
async function checkForUpdates(silent = true, onPromptUser = null) {
  try {
    const { getConfig } = require('./registry');
    const cfg = getConfig();
    const autoUpdateEnabled = cfg.autoUpdate !== false; // по умолчанию включено
    const ignoredVer = cfg.ignoredUpdateVersion || '';

    const info = await checkReleaseInfo();
    if (!info.hasUpdate) {
      log(`Already up to date (${info.currentVer}).`);
      return { hasUpdate: false, version: info.currentVer };
    }

    log(`Update available: ${info.latestVer} (current: ${info.currentVer})`);

    // Если автообновление выключено
    if (!autoUpdateEnabled) {
      if (ignoredVer === info.latestVer) {
        log(`User ignored version ${info.latestVer}. Skipping prompt.`);
        return { hasUpdate: true, version: info.latestVer, ignored: true };
      }

      log(`Auto-update disabled, prompting user for version ${info.latestVer}`);
      if (typeof onPromptUser === 'function') {
        onPromptUser({
          latestVer: info.latestVer,
          currentVer: info.currentVer,
          releaseNotes: info.releaseNotes,
          downloadUrl: info.downloadUrl
        });
      }
      return { hasUpdate: true, version: info.latestVer, promptShown: true };
    }

    // Если автообновление включено: обновляем сразу в фоне
    if (info.downloadUrl) {
      await performUpdate(info.downloadUrl, info.latestVer);
      return { hasUpdate: true, version: info.latestVer, updated: true };
    } else {
      log('No payload.zip asset available in latest release');
      return { hasUpdate: true, version: info.latestVer, downloaded: false };
    }
  } catch (err) {
    if (!silent) log(`Update check error: ${err.message}`);
    return { hasUpdate: false, error: err.message };
  }
}

module.exports = {
  getCurrentVersion,
  checkReleaseInfo,
  performUpdate,
  checkForUpdates
};
