// @ts-check
const http = require('http');
const cp = require('child_process');
const { resolvePaths, isPatched, patch, unpatch } = require('./core');

const PORT = 58921;

function getHTML(status) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity ModLoader Setup</title>
  <style>
    :root {
      --bg: #121214;
      --card-bg: #18181b;
      --border: rgba(255, 255, 255, 0.08);
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --accent: #10b981;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; width: 100%; max-width: 520px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .title { font-size: 18px; font-weight: 600; }
    .version { font-size: 12px; color: var(--text-muted); }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .badge.active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge.inactive { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .info-group { margin-bottom: 16px; background: rgba(0,0,0,0.25); border-radius: 8px; padding: 12px; }
    .info-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: var(--text-muted); }
    .info-val { font-family: ui-monospace, Consolas, monospace; word-break: break-all; text-align: right; max-width: 65%; }
    .actions { display: flex; gap: 10px; margin-top: 24px; }
    .btn { flex: 1; padding: 12px; border-radius: 8px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
    .btn-primary { background: #27272a; color: #ffffff; border: 1px solid rgba(255,255,255,0.15); }
    .btn-primary:hover { background: #3f3f46; }
    .btn-danger { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.2); }
    .features { margin-top: 20px; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
    .features li { margin-left: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="title">Antigravity ModLoader</div>
        <div class="version">Кроссплатформенный установщик</div>
      </div>
      <div>
        ${status.isPatched 
          ? '<span class="badge active"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span>Установлен</span>' 
          : '<span class="badge inactive">Не установлен</span>'}
      </div>
    </div>

    <div class="info-group">
      <div class="info-row">
        <span class="info-label">Платформа:</span>
        <span class="info-val">${status.platform} (${process.arch})</span>
      </div>
      <div class="info-row">
        <span class="info-label">Antigravity:</span>
        <span class="info-val">${status.found ? 'Обнаружен' : 'Не найден'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Каталог:</span>
        <span class="info-val">${status.installDir || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">app.asar:</span>
        <span class="info-val">${status.appAsar || '—'}</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="doAction('install')">
        ${status.isPatched ? 'Переустановить / Обновить' : 'Установить ModLoader'}
      </button>
      ${status.isPatched ? '<button class="btn btn-danger" onclick="doAction(\'uninstall\')">Восстановить оригинал</button>' : ''}
    </div>

    <div class="features">
      <strong>В комплекте:</strong>
      <ul>
        <li>DNS-AI Proxy & Geo-Unblock (встроенный DoT + DoH без .bat)</li>
        <li>Quick Account Switcher (быстрый свап аккаунтов Google)</li>
        <li>Token Speedometer (спидометр скорости токенов и телеметрии)</li>
        <li>Разблокировка F12 DevTools и чистый графитовый UI</li>
      </ul>
    </div>
  </div>

  <script>
    async function doAction(act) {
      const res = await fetch('/api/' + act, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(act === 'install' ? 'Успешно установлено!' : 'Оригинальный файл восстановлен!');
        location.reload();
      } else {
        alert('Ошибка: ' + (data.reason || data.error));
      }
    }
  </script>
</body>
</html>`;
}

function startGUI() {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    
    if (parsed.pathname === '/') {
      const paths = resolvePaths();
      const status = {
        platform: process.platform,
        found: paths.found,
        installDir: paths.installDir,
        appAsar: paths.appAsar,
        isPatched: paths.found ? isPatched(paths.appAsar) : false
      };
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHTML(status));
      return;
    }

    if (parsed.pathname === '/api/install' && req.method === 'POST') {
      const result = patch();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (parsed.pathname === '/api/uninstall' && req.method === 'POST') {
      const result = unpatch();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`[GUI Installer] Запущен на ${url}`);
    
    // Кроссплатформенное открытие в браузере
    if (process.platform === 'win32') {
      cp.exec(`start ${url}`);
    } else if (process.platform === 'darwin') {
      cp.exec(`open ${url}`);
    } else {
      cp.exec(`xdg-open ${url}`);
    }
  });
}

if (require.main === module) {
  startGUI();
}

module.exports = { startGUI };
