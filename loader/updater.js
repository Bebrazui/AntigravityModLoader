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
      return data.version || '1.0.0';
    }
  } catch (_) {}
  return '1.0.0';
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
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch(_) {}
      reject(err);
    });
  });
}

function extractZip(zipPath, targetDir) {
  // 1. Попытка через adm-zip
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    return true;
  } catch (_) {}

  // 2. В Linux/macOS через системный unzip
  if (process.platform !== 'win32') {
    try {
      cp.execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`);
      return true;
    } catch (_) {}
  } else {
    // 3. В Windows через встроенный PowerShell Expand-Archive
    try {
      cp.execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
      return true;
    } catch (_) {}
  }

  // 4. Fallback через python3
  try {
    cp.execSync(`python3 -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${targetDir}')"`);
    return true;
  } catch (_) {}

  return false;
}

/**
 * Проверка и фоновое обновление модов с GitHub
 */
async function checkForUpdates(silent = true) {
  try {
    const { getConfig } = require('./registry');
    const cfg = getConfig();
    const repo = cfg.githubRepo || GITHUB_REPO;
    const currentVer = getCurrentVersion();

    log(`Checking updates for ${repo} (current: ${currentVer})...`);
    const releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const release = await fetchJson(releaseUrl);

    if (!release || !release.tag_name) {
      log('No releases found on GitHub');
      return { hasUpdate: false };
    }

    const latestVer = release.tag_name.replace(/^v/, '');
    if (latestVer === currentVer) {
      log(`Already on latest version (${currentVer})`);
      return { hasUpdate: false, version: currentVer };
    }

    log(`Found new version: ${latestVer} (current: ${currentVer})`);

    const asset = (release.assets || []).find(a => a.name === 'payload.zip' || a.name.endsWith('.zip'));
    if (!asset || !asset.browser_download_url) {
      log('No zip payload asset in release');
      return { hasUpdate: true, version: latestVer, downloaded: false };
    }

    const targetDir = path.join(os.homedir(), '.antigravity-mods');
    const tempZip = path.join(targetDir, 'update_payload.zip');
    await downloadFile(asset.browser_download_url, tempZip);
    log(`Downloaded new payload to ${tempZip}`);

    const extracted = extractZip(tempZip, targetDir);
    if (extracted) {
      try { fs.unlinkSync(tempZip); } catch(_) {}
      fs.writeFileSync(VERSION_FILE, JSON.stringify({ version: latestVer, updated_at: new Date().toISOString() }, null, 2));
      log(`Successfully updated to ${latestVer}`);
      return { hasUpdate: true, version: latestVer, updated: true };
    } else {
      log('Failed to extract update zip');
      return { hasUpdate: true, version: latestVer, downloaded: true };
    }
  } catch (err) {
    if (!silent) log(`Update check error: ${err.message}`);
    return { hasUpdate: false, error: err.message };
  }
}

module.exports = {
  getCurrentVersion,
  checkForUpdates
};
