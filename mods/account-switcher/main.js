// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ACCOUNTS_DIR = path.join(os.homedir(), '.antigravity-mods', 'accounts');
const USER_SCOPE_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'credential-user-scope');
const APP_STORAGE_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'app_storage.json');
const READER_PS1 = path.join(__dirname, 'cred_reader.ps1');
const WRITER_PS1 = path.join(__dirname, 'cred_writer.ps1');

// OAuth credentials for personal Google accounts in Antigravity (runtime or env configured)
const OAUTH_CLIENT_ID = process.env.AG_OAUTH_CLIENT_ID || Buffer.from('MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==', 'base64').toString('ascii');
const OAUTH_CLIENT_SECRET = process.env.AG_OAUTH_CLIENT_SECRET || Buffer.from('R0NDU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=', 'base64').toString('ascii');
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/aicode',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
  'openid'
].join(' ');

/**
 * Читает секрет gemini:antigravity через PowerShell / C# Advapi32
 */
function readCurrentCredential() {
  try {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${READER_PS1}" -target gemini:antigravity`;
    const res = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim();
    if (!res) return null;
    return JSON.parse(res);
  } catch (err) {
    console.error('[AccountSwitcher] Error reading credential:', err.message);
    return null;
  }
}

/**
 * Записывает секрет в gemini:antigravity через PowerShell / C# Advapi32
 */
function writeCredential(secretJsonStr, userName = 'antigravity') {
  try {
    const b64 = Buffer.from(secretJsonStr, 'utf8').toString('base64');
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${WRITER_PS1}" -target gemini:antigravity -user "${userName}" -base64 "${b64}"`;
    const res = execSync(cmd, { encoding: 'utf8', windowsHide: true }).trim();
    return res === 'OK';
  } catch (err) {
    console.error('[AccountSwitcher] Error writing credential:', err.message);
    return false;
  }
}

/**
 * Получает список всех сохраненных аккаунтов + текущий активный
 */
function getAccountsList() {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  }

  const currentCred = readCurrentCredential();
  let activeEmail = currentCred?.id_token_email || null;

  if (activeEmail && currentCred) {
    saveAccountProfile(activeEmail, currentCred);
  }

  const files = fs.readdirSync(ACCOUNTS_DIR).filter(f => f.endsWith('.json'));
  const accounts = [];

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ACCOUNTS_DIR, f), 'utf8'));
      accounts.push({
        email: data.email || f.replace('.json', ''),
        authMethod: data.cred?.auth_method || 'consumer',
        isActive: data.email === activeEmail,
        updatedAt: data.updatedAt || 0
      });
    } catch (_) {}
  }

  return {
    activeEmail,
    accounts
  };
}

/**
 * Сохраняет профиль аккаунта в файл
 */
function saveAccountProfile(email, cred, userScope = null) {
  if (!userScope && fs.existsSync(USER_SCOPE_FILE)) {
    userScope = fs.readFileSync(USER_SCOPE_FILE, 'utf8').trim();
  }

  const profile = {
    email,
    cred,
    userScope: userScope || '',
    updatedAt: Date.now()
  };

  const safeFilename = email.replace(/[^a-zA-Z0-9_\-\.@]/g, '_') + '.json';
  fs.writeFileSync(path.join(ACCOUNTS_DIR, safeFilename), JSON.stringify(profile, null, 2), 'utf8');
}

/**
 * Переключает активный аккаунт
 */
function switchAccount(email) {
  const safeFilename = email.replace(/[^a-zA-Z0-9_\-\.@]/g, '_') + '.json';
  const filePath = path.join(ACCOUNTS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Профиль аккаунта ${email} не найден`);
  }

  const profile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const credStr = JSON.stringify(profile.cred);

  const ok = writeCredential(credStr, 'antigravity');
  if (!ok) {
    throw new Error('Не удалось записать учетные данные в Windows Credential Manager');
  }

  if (profile.userScope) {
    try {
      fs.writeFileSync(USER_SCOPE_FILE, profile.userScope, 'utf8');
    } catch (_) {}
  }

  if (fs.existsSync(APP_STORAGE_FILE)) {
    try {
      const storage = JSON.parse(fs.readFileSync(APP_STORAGE_FILE, 'utf8'));
      storage['agy.onboarding.lastLoginUsername'] = email;
      fs.writeFileSync(APP_STORAGE_FILE, JSON.stringify(storage, null, 2), 'utf8');
    } catch (_) {}
  }

  return true;
}

/**
 * Удаляет сохраненный профиль из списка
 */
function deleteAccountProfile(email) {
  const safeFilename = email.replace(/[^a-zA-Z0-9_\-\.@]/g, '_') + '.json';
  const filePath = path.join(ACCOUNTS_DIR, safeFilename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Запускает нативный OAuth flow Google:
 * 1. Поднимает временный локальный HTTP-сервер на 127.0.0.1
 * 2. Генерирует URL с prompt=select_account
 * 3. Открывает окно авторизации в Electron BrowserWindow
 * 4. Ловит callback, обменивает code на токены
 * 5. Сохраняет профиль и активирует аккаунт
 * 
 * @param {any} electron
 * @param {(status: string) => void} [onProgress]
 * @param {{ openInBrowser?: boolean }} [options]
 * @returns {Promise<{ email: string }>}
 */
function startNativeOAuthFlow(electron, onProgress = () => {}, options = {}) {
  return new Promise((resolve, reject) => {
    let authWindow = null;
    let localServer = null;

    const cleanup = () => {
      if (localServer) {
        try { localServer.close(); } catch (_) {}
        localServer = null;
      }
      if (authWindow && !authWindow.isDestroyed()) {
        try { authWindow.destroy(); } catch (_) {}
        authWindow = null;
      }
    };

    localServer = http.createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (parsedUrl.pathname !== '/auth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }

        const code = parsedUrl.searchParams.get('code');
        const error = parsedUrl.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<body style="background:#18181b;color:#f4f4f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><h2>Авторизация отменена</h2></body>');
          cleanup();
          reject(new Error(`Google OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing code');
          return;
        }

        onProgress('Обмен кода на токены...');

        const port = localServer.address().port;
        const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

        // Обмениваем code на токены у Google
        const tokenRes = await exchangeCodeForTokens(code, redirectUri);
        const { access_token, refresh_token, expires_in, id_token } = tokenRes;

        // Декодируем email из id_token
        let email = '';
        if (id_token) {
          try {
            const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString('utf8'));
            email = payload.email || '';
          } catch (_) {}
        }

        if (!email) {
          throw new Error('Не удалось извлечь email из полученного токена Google');
        }

        onProgress(`Успешно получен аккаунт: ${email}`);

        // Сохраняем в формат Antigravity
        const now = new Date();
        const expiry = new Date(now.getTime() + (expires_in || 3599) * 1000).toISOString();
        const writerId = crypto.randomBytes(32).toString('base64url').slice(0, 43);
        const userScope = 'ua' + crypto.randomBytes(8).toString('hex').slice(0, 15);

        const cred = {
          token: {
            access_token,
            token_type: 'Bearer',
            refresh_token: refresh_token || '',
            expiry,
            expires_in: expires_in || 3599
          },
          auth_method: 'consumer',
          id_token_email: email,
          writer_id: writerId
        };

        saveAccountProfile(email, cred, userScope);
        switchAccount(email);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<body style="background:#18181b;color:#f4f4f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;"><h2 style="margin:0 0 8px 0;font-weight:500;">Вход выполнен успешно!</h2><p style="color:#a1a1aa;margin:0;">Окно закрывается, Antigravity переключается на ' + email + '...</p></body>');

        setTimeout(() => {
          cleanup();
          resolve({ email });
        }, 1200);

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error: ' + err.message);
        cleanup();
        reject(err);
      }
    });

    localServer.listen(0, '127.0.0.1', () => {
      const port = localServer.address().port;
      const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        access_type: 'offline',
        prompt: 'select_account'
      }).toString();

      const openInExternal = options.openInBrowser !== false; // По умолчанию true: открывать в системном браузере

      if (openInExternal && electron.shell && electron.shell.openExternal) {
        onProgress('Открытие страницы входа в браузере...');
        electron.shell.openExternal(authUrl);
      } else {
        onProgress('Открытие окна входа Google...');

        const { BrowserWindow, session } = electron;
        const authSession = session.fromPartition('persist:agy_oauth_flow');

        authWindow = new BrowserWindow({
          width: 520,
          height: 680,
          title: 'Вход в аккаунт Google — Antigravity',
          backgroundColor: '#18181b',
          autoHideMenuBar: true,
          webPreferences: {
            session: authSession,
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        authWindow.loadURL(authUrl);

        authWindow.on('closed', () => {
          authWindow = null;
          cleanup();
        });
      }
    });

    localServer.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Обменивает auth code на токены
 */
function exchangeCodeForTokens(code, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }).toString();

    // Пробуем нативно через curl.exe (он не подвержен таймаутам TLS/IPv6 сетевого стека Node)
    // с фоллбеком на https.request
    try {
      const { execFile } = require('child_process');
      const curlArgs = [
        '-s',
        '-4',
        '--connect-timeout', '10',
        '-X', 'POST',
        'https://oauth2.googleapis.com/token',
        '-H', 'Content-Type: application/x-www-form-urlencoded',
        '-d', postData
      ];

      execFile('curl.exe', curlArgs, { timeout: 15000 }, (curlErr, stdout) => {
        if (!curlErr && stdout) {
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) {
              reject(new Error(parsed.error_description || parsed.error));
            } else {
              resolve(parsed);
            }
            return;
          } catch (_) {}
        }

        // Фоллбек на node https с принудительным family: 4
        const req = https.request('https://oauth2.googleapis.com/token', {
          method: 'POST',
          family: 4,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode >= 400 || parsed.error) {
                reject(new Error(parsed.error_description || parsed.error || 'Failed to exchange code'));
              } else {
                resolve(parsed);
              }
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(new Error('ETIMEDOUT connecting to Google OAuth endpoint'));
        });
        req.write(postData);
        req.end();
      });
      return;
    } catch (_) {}

    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      family: 4,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 || parsed.error) {
            reject(new Error(parsed.error_description || parsed.error || 'Failed to exchange code'));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  readCurrentCredential,
  writeCredential,
  getAccountsList,
  saveAccountProfile,
  switchAccount,
  deleteAccountProfile,
  startNativeOAuthFlow
};
