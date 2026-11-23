// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = path.join(os.homedir(), '.antigravity-mods', 'crash.log');

function log(type, msg, err) {
  try {
    const entry = `[${new Date().toISOString()}] [${type}] ${msg}\n${err ? (err.stack || err.toString()) + '\n' : ''}`;
    fs.appendFileSync(LOG_FILE, entry, 'utf8');
  } catch (e) {}
}

// 1. Process-level exception & rejection capture
process.on('uncaughtException', (err) => {
  log('CRASH:uncaughtException', err.message, err);
});

process.on('unhandledRejection', (reason, promise) => {
  log('CRASH:unhandledRejection', String(reason), reason instanceof Error ? reason : null);
});

log('INIT', 'Main injector bootstrap started successfully');

let electron;
try {
  electron = require('electron');
} catch (e) {
  log('CRASH:require_electron', 'Failed to require electron', e);
}

if (!electron) return;
const { app, ipcMain, BrowserWindow, shell } = electron;

// Force enable DevTools on all BrowserWindows created by Antigravity
try {
  const OrigBW = electron.BrowserWindow;
  if (OrigBW && !OrigBW.__devtools_patched) {
    const PatchedBW = new Proxy(OrigBW, {
      construct(target, args, newTarget) {
        if (args && args[0]) {
          if (!args[0].webPreferences) args[0].webPreferences = {};
          args[0].webPreferences.devTools = true;
        }
        return Reflect.construct(target, args, newTarget);
      }
    });
    PatchedBW.__devtools_patched = true;
    electron.BrowserWindow = PatchedBW;
    log('INIT', 'Patched electron.BrowserWindow: forced devTools=true');
  }
} catch (e) {
  log('ERROR:patch_bw', e.message);
}

const { discoverMods, getConfig, CONFIG_FILE, MODS_DIR } = require('./registry');

// Проброс прокси в language_server.
// 1. Если задан внешний прокси (AG_LS_PROXY), используем его.
// 2. Иначе автономно стартуем встроенный DNS-AI прокси (с валидацией узлов через TLS и SMART_PINS).
try {
  const cp = require('child_process');
  const external = (process.env.AG_LS_PROXY || '').trim();
  let proxyUrl = external || 'http://127.0.0.1:53129';

  // Патчим spawn сразу, синхронно: language_server стартует с готовым адресом
  if (!cp.__proxy_patched) {
    const origSpawn = cp.spawn;
    cp.spawn = function (command, args, options) {
      if (options && typeof command === 'string' && command.toLowerCase().includes('language_server') && proxyUrl) {
        if (!options.env) options.env = { ...process.env };
        options.env.HTTP_PROXY = proxyUrl;
        options.env.HTTPS_PROXY = proxyUrl;
        options.env.ALL_PROXY = proxyUrl;
        options.env.AG_LS_PROXY = proxyUrl;
        log('PROXY', `Injected proxy ${proxyUrl} into language_server spawn`);
      }
      return origSpawn.apply(this, arguments);
    };
    cp.__proxy_patched = true;
  }

  if (external) {
    log('PROXY', `language_server proxy = ${external} (using external proxy)`);
  } else {
    const dnsAiMod = require('../mods/dns-ai-proxy/main.js');
    dnsAiMod.startProxy().then((port) => {
      proxyUrl = `http://127.0.0.1:${port}`;
      log('PROXY', `Built-in DNS-AI proxy active on 127.0.0.1:${port}`);
    }).catch((err) => {
      log('ERROR:dns_proxy_start', err.message);
    });
  }
} catch (e) {
  log('ERROR:dns_proxy_init', e.message);
}

// 2. Client Injection with Client-Side ModAPI
if (app) {
  app.on('web-contents-created', (_event, webContents) => {
    try {
      try {
        if (webContents.getWebPreferences) {
          const wp = webContents.getWebPreferences();
          if (wp) wp.devTools = true;
        }
      } catch (_) {}

      // Unlock DevTools shortcut natively at Electron webContents level
      webContents.on('before-input-event', (_ev, input) => {
        if (input.type === 'keyDown' && !input.isAutoRepeat) {
          const key = (input.key || '').toUpperCase();
          const isF12 = key === 'F12';
          const isCtrlShiftI = (input.control || input.meta) && input.shift && key === 'I';
          if (isF12 || isCtrlShiftI) {
            try {
              if (webContents.getWebPreferences) {
                const wp = webContents.getWebPreferences();
                if (wp) wp.devTools = true;
              }
              if (webContents.isDevToolsOpened()) {
                webContents.closeDevTools();
              } else {
                webContents.openDevTools({ mode: 'detach' });
              }
            } catch (e) {
              log('ERROR:before_input_devtools', e.message);
            }
          }
        }
      });
      // Listen to console messages from webContents to capture errors and actions
      webContents.on('console-message', (arg1, arg2, arg3, arg4, arg5) => {
        let level = 0;
        let message = '';
        let line = 0;
        let sourceId = '';

        if (arg1 && typeof arg1 === 'object' && 'message' in arg1) {
          // Modern Electron: Event object has message, level, line, sourceId
          level = arg1.level || 0;
          message = arg1.message || '';
          line = arg1.line || 0;
          sourceId = arg1.sourceId || '';
        } else {
          // Legacy Electron: (event, level, message, line, sourceId)
          level = arg2 || 0;
          message = arg3 || '';
          line = arg4 || 0;
          sourceId = arg5 || '';
        }

        if (level >= 2 || (message && (message.includes('Error') || message.includes('Uncaught') || message.startsWith('__AGY_ACTION__:') || message.includes('Mod')))) {
          log('DEVTOOLS_CONSOLE:' + level, `${message} (${sourceId}:${line})`);
        }
        if (message && message.startsWith('__AGY_ACTION__:')) {
          const action = message.replace('__AGY_ACTION__:', '').trim();
          log('CLIENT_ACTION', action);
          if (action === 'open-mods-folder') {
            log('IPC', `Opening folder: ${MODS_DIR}`);
            shell.openPath(MODS_DIR).catch(() => {
              require('child_process').exec(`explorer "${MODS_DIR}"`);
            });
          } else if (action === 'reload-window') {
            webContents.reload();
          } else if (action === 'open-devtools' || action === 'toggle-devtools') {
            log('IPC', 'Toggling DevTools via action');
            try {
              const targetWC = (webContents && !webContents.isDestroyed()) ? webContents : null;
              const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
              const wc = targetWC || (win && win.webContents);
              if (wc && !wc.isDestroyed()) {
                try {
                  const wp = wc.getWebPreferences?.();
                  if (wp) wp.devTools = true;
                } catch (_) {}
                if (wc.isDevToolsOpened()) {
                  wc.closeDevTools();
                } else {
                  wc.openDevTools({ mode: 'detach' });
                }
              }
            } catch (e) {
              log('ERROR:open-devtools', e.message);
            }
          } else if (action === 'get-radar-tokens' || action.startsWith('get-radar-tokens:')) {
            try {
              const explicitConvoId = action.includes(':') ? action.split(':')[1].trim() : null;
              const url = webContents.getURL?.() || '';
              const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
              if (fs.existsSync(brainDir)) {
                let activeConvoId = explicitConvoId;
                if (!activeConvoId) {
                  const match = url.match(/\/c\/([a-f0-9\-]+)/i);
                  if (match && match[1]) activeConvoId = match[1];
                }

                let targetTranscript = null;
                if (activeConvoId) {
                  const specificPath = path.join(brainDir, activeConvoId, '.system_generated', 'logs', 'transcript.jsonl');
                  if (fs.existsSync(specificPath)) {
                    targetTranscript = specificPath;
                  } else {
                    // New conversation that has not written to disk yet
                    const payload = JSON.stringify({
                      convoId: activeConvoId,
                      totalTokens: 0,
                      cachedTokens: 0,
                      inputTokens: 0,
                      maxTokens: 1048576,
                      percentUsed: 0
                    });
                    webContents.executeJavaScript(`
                      window.__AGY_RADAR_DATA__ = ${payload};
                      window.dispatchEvent(new CustomEvent('agy-radar-data', { detail: ${payload} }));
                      if (window.updateRadarUI) window.updateRadarUI();
                    `).catch(() => {});
                    return;
                  }
                }

                if (targetTranscript && fs.existsSync(targetTranscript)) {
                  let foundStep = null;
                  try {
                    const stat = fs.statSync(targetTranscript);
                    const readSize = Math.min(stat.size, 65536); // Read last 64KB
                    const buffer = Buffer.alloc(readSize);
                    const fd = fs.openSync(targetTranscript, 'r');
                    fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
                    fs.closeSync(fd);

                    const chunk = buffer.toString('utf8');
                    const lines = chunk.trim().split('\n');
                    for (let i = lines.length - 1; i >= 0; i--) {
                      try {
                        const step = JSON.parse(lines[i]);
                        if (step.source === 'MODEL' && (step.input_tokens || step.cache_read_tokens)) {
                          foundStep = step;
                          break;
                        }
                      } catch (e) {}
                    }
                  } catch (e) {}

                  let total = 0;
                  let cached = 0;
                  let input = 0;

                  if (foundStep) {
                    input = foundStep.input_tokens || 0;
                    cached = foundStep.cache_read_tokens || 0;
                    total = input + cached;
                  }


                  let maxTokens = 1048576;
                  const payload = JSON.stringify({
                    convoId: activeConvoId,
                    totalTokens: total,
                    cachedTokens: cached,
                    inputTokens: input,
                    maxTokens: maxTokens,
                    percentUsed: Math.min(100, (total / maxTokens) * 100)
                  });

                  // Синхронно подтягиваем телеметрию скорости для активного диалога
                  let telemetryPayload = null;
                  try {
                    const telemetryMod = require('../mods/token-speedometer/main.js');
                    const tData = telemetryMod.getTaskTelemetry(activeConvoId || undefined);
                    if (tData) {
                      telemetryPayload = JSON.stringify(tData);
                    }
                  } catch (_) {}

                  webContents.executeJavaScript(`
                    window.__AGY_RADAR_DATA__ = ${payload};
                    window.dispatchEvent(new CustomEvent('agy-radar-data', { detail: ${payload} }));
                    if (window.updateRadarUI) window.updateRadarUI();
                    ${telemetryPayload ? `
                    window.__AGY_TELEMETRY_DATA__ = ${telemetryPayload};
                    window.dispatchEvent(new CustomEvent('agy-telemetry-data', { detail: ${telemetryPayload} }));
                    ` : ''}
                  `).catch(() => {});
                }
              }
            } catch (e) {}
          } else if (action === 'get-accounts-list') {
            try {
              const accountMod = require('../mods/account-switcher/main.js');
              const data = accountMod.getAccountsList();
              const payload = JSON.stringify(data);
              webContents.executeJavaScript(`
                window.__AGY_ACCOUNTS_DATA__ = ${payload};
                window.dispatchEvent(new CustomEvent('agy-accounts-data', { detail: ${payload} }));
              `).catch(() => {});
            } catch (accErr) {
              log('ERROR:get-accounts-list', accErr.message, accErr);
            }
          } else if (action.startsWith('switch-account:')) {
            try {
              const email = decodeURIComponent(action.split(':')[1]?.trim() || '');
              const accountMod = require('../mods/account-switcher/main.js');
              accountMod.switchAccount(email);
              log('ACCOUNTS', `Switched account to: ${email}`);
              // Автоматически перезагружаем окно для реинициализации language_server
              const win = BrowserWindow.fromWebContents(webContents);
              if (win) win.reload();
            } catch (swErr) {
              log('ERROR:switch-account', swErr.message, swErr);
            }
          } else if (action.startsWith('delete-account:')) {
            try {
              const email = decodeURIComponent(action.split(':')[1]?.trim() || '');
              const accountMod = require('../mods/account-switcher/main.js');
              accountMod.deleteAccountProfile(email);
              const data = accountMod.getAccountsList();
              const payload = JSON.stringify(data);
              webContents.executeJavaScript(`
                window.__AGY_ACCOUNTS_DATA__ = ${payload};
                window.dispatchEvent(new CustomEvent('agy-accounts-data', { detail: ${payload} }));
              `).catch(() => {});
            } catch (delErr) {
              log('ERROR:delete-account', delErr.message, delErr);
            }
          } else if (action === 'start-oauth-login' || action.startsWith('start-oauth-login:')) {
            try {
              const accountMod = require('../mods/account-switcher/main.js');
              const cfg = getConfig();
              const openInBrowserSetting = cfg.modSettings?.['account-switcher']?.openInBrowser;
              // Если передан флаг в action (start-oauth-login:browser или start-oauth-login:window), учитываем его
              const mode = action.split(':')[1];
              const openInBrowser = mode === 'window' ? false : (mode === 'browser' ? true : (openInBrowserSetting !== false));

              log('ACCOUNTS', `Starting native Google OAuth flow (openInBrowser=${openInBrowser})...`);
              accountMod.startNativeOAuthFlow(electron, (msg) => {
                log('ACCOUNTS:progress', msg);
              }, { openInBrowser }).then((result) => {
                log('ACCOUNTS:success', `Successfully added account: ${result.email}`);
                const win = BrowserWindow.fromWebContents(webContents);
                if (win) {
                  win.reload();
                }
              }).catch((err) => {
                log('ERROR:start-oauth-login', err.message, err);
                const errMsg = JSON.stringify(err.message || 'Ошибка входа');
                webContents.executeJavaScript(`
                  window.dispatchEvent(new CustomEvent('agy-oauth-error', { detail: { message: ${errMsg} } }));
                `).catch(() => {});
              });
            } catch (oauthErr) {
              log('ERROR:start-oauth-login_init', oauthErr.message, oauthErr);
            }
          } else if (action.startsWith('save-setting:')) {
            try {
              // format: save-setting:<modId>:<key>:<encodedValue>
              const parts = action.split(':');
              const modId = parts[1];
              const key = parts[2];
              const rawVal = parts.slice(3).join(':');
              let val = rawVal;
              try { val = JSON.parse(decodeURIComponent(rawVal)); } catch (e) {}
              const { saveModSetting } = require('./registry');
              saveModSetting(modId, key, val);
              log('IPC', `Saved mod setting: ${modId}.${key} = ${JSON.stringify(val)}`);
            } catch (e) {}
          } else if (action.startsWith('save-loader-config:')) {
            try {
              const parts = action.split(':');
              const key = parts[1];
              const val = parts[2] === 'true';
              const currentConfig = getConfig();
              currentConfig[key] = val;
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
              log('IPC', `Saved loader config: ${key} = ${val}`);
            } catch (e) {}
          } else if (action.startsWith('toggle-mod:')) {
            const parts = action.split(':');
            const modId = parts[1];
            const enable = parts[2] === 'true';
            const currentConfig = getConfig();
            let disabled = currentConfig.disabledMods || [];
            if (enable) disabled = disabled.filter(id => id !== modId);
            else if (!disabled.includes(modId)) disabled.push(modId);
            currentConfig.disabledMods = disabled;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
          } else if (action.startsWith('delete-mod:')) {
            try {
              const modId = action.split(':')[1].trim();
              if (modId && modId !== 'core-mod-manager') {
                const targetModDir = path.join(MODS_DIR, modId);
                if (fs.existsSync(targetModDir)) {
                  fs.rmSync(targetModDir, { recursive: true, force: true });
                  log('IPC', `Deleted mod directory: ${targetModDir}`);
                }
                const currentConfig = getConfig();
                if (currentConfig.disabledMods) {
                  currentConfig.disabledMods = currentConfig.disabledMods.filter(id => id !== modId);
                }
                if (currentConfig.modSettings && currentConfig.modSettings[modId]) {
                  delete currentConfig.modSettings[modId];
                }
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
                const refreshedMods = discoverMods();
                const refreshedConfig = getConfig();
                webContents.executeJavaScript(`
                  if (window.__AGY_MOD_DATA__) {
                    window.__AGY_MOD_DATA__.mods = ${JSON.stringify(refreshedMods)};
                    window.__AGY_MOD_DATA__.disabledMods = ${JSON.stringify(refreshedConfig.disabledMods || [])};
                    window.__AGY_MOD_DATA__.modSettings = ${JSON.stringify(refreshedConfig.modSettings || {})};
                  }
                  window.dispatchEvent(new CustomEvent('agy-mods-updated'));
                `).catch(() => {});
              }
            } catch (delErr) {
              log('ERROR:delete-mod', delErr.message);
            }
          } else if (action === 'get-analytics-data') {
            try {
              const brainBase = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
              const dbPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');

              const titleMap = {};
              if (fs.existsSync(dbPath)) {
                try {
                  const { DatabaseSync } = require('node:sqlite');
                  const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
                  const rows = db.prepare('SELECT conversation_id, title, preview FROM conversation_summaries').all();
                  for (let r = 0; r < rows.length; r++) {
                    titleMap[rows[r].conversation_id] = rows[r].title || rows[r].preview || '';
                  }
                } catch (dbe) {}
              }

              let totalInput = 0;
              let totalCached = 0;
              let totalOutput = 0;
              let stepCount = 0;
              let userMessagesCount = 0;
              let totalUserChars = 0;
              let totalToolCalls = 0;
              let totalThinkingChars = 0;
              let thinkingSteps = 0;
              const modelBreakdown = {};
              const dailyStats = {};
              const toolsBreakdown = {};
              const hourlyStats = new Array(24).fill(0);
              const heavySessions = [];

              if (fs.existsSync(brainBase)) {
                const convos = fs.readdirSync(brainBase, { withFileTypes: true });
                for (let c = 0; c < convos.length; c++) {
                  if (!convos[c].isDirectory()) continue;
                  const cid = convos[c].name;
                  const p = path.join(brainBase, cid, '.system_generated', 'logs', 'transcript.jsonl');
                  if (!fs.existsSync(p)) continue;
                  try {
                    const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
                    let sTokens = 0, sSteps = 0, sTools = 0;
                    for (let i = 0; i < lines.length; i++) {
                      const l = lines[i];
                      if (!l) continue;
                      if (l.includes('USER_INPUT')) {
                        try {
                          const uObj = JSON.parse(l);
                          if (uObj.type === 'USER_INPUT') {
                            userMessagesCount++;
                            if (uObj.content) totalUserChars += uObj.content.length;
                          }
                        } catch (ue) {}
                      }
                      if (!l.includes('PLANNER_RESPONSE')) continue;
                      try {
                        const obj = JSON.parse(l);
                        if (obj.type === 'PLANNER_RESPONSE') {
                          const inp = obj.input_tokens || 0;
                          const cached = obj.cache_read_tokens || 0;
                          const out = obj.output_tokens || 0;
                          if (inp || cached || out) {
                            stepCount++;
                            sSteps++;
                            const stepTotal = inp + cached + out;
                            sTokens += stepTotal;
                            totalInput += inp;
                            totalCached += cached;
                            totalOutput += out;

                            let rawModel = obj.model || 'gemini-3.8-flash';
                            if (rawModel.includes('MODEL_PLACEHOLDER')) {
                              rawModel = 'Gemini 3.8 Flash (Fallback)';
                            }
                            if (!modelBreakdown[rawModel]) modelBreakdown[rawModel] = { input: 0, cached: 0, output: 0, count: 0 };
                            modelBreakdown[rawModel].input += inp;
                            modelBreakdown[rawModel].cached += cached;
                            modelBreakdown[rawModel].output += out;
                            modelBreakdown[rawModel].count++;

                            const day = (obj.created_at || '').slice(0, 10);
                            if (day && day.length === 10) {
                              if (!dailyStats[day]) dailyStats[day] = { input: 0, cached: 0, output: 0, requests: 0 };
                              dailyStats[day].input += inp;
                              dailyStats[day].cached += cached;
                              dailyStats[day].output += out;
                              dailyStats[day].requests++;
                            }

                            if (obj.created_at) {
                              const h = new Date(obj.created_at).getHours();
                              if (!isNaN(h) && h >= 0 && h < 24) hourlyStats[h]++;
                            }

                            if (obj.thinking && typeof obj.thinking === 'string') {
                              thinkingSteps++;
                              totalThinkingChars += obj.thinking.length;
                            }

                            if (obj.tool_calls && Array.isArray(obj.tool_calls)) {
                              totalToolCalls += obj.tool_calls.length;
                              sTools += obj.tool_calls.length;
                              for (let tc = 0; tc < obj.tool_calls.length; tc++) {
                                const tName = obj.tool_calls[tc].name || 'unknown';
                                toolsBreakdown[tName] = (toolsBreakdown[tName] || 0) + 1;
                              }
                            }
                          }
                        }
                      } catch (pe) {}
                    }
                    if (sSteps > 0) {
                      heavySessions.push({
                        id: cid,
                        title: titleMap[cid] || 'Сессия ' + cid.slice(0, 8),
                        steps: sSteps,
                        tokens: sTokens,
                        tools: sTools
                      });
                    }
                  } catch (fe) {}
                }
              }

              heavySessions.sort((a, b) => b.tokens - a.tokens);

              const analyticsPayload = JSON.stringify({
                totalInput,
                totalCached,
                totalOutput,
                stepCount,
                userMessagesCount,
                avgUserChars: Math.round(totalUserChars / (userMessagesCount || 1)),
                totalToolCalls,
                thinkingSteps,
                avgThinkingChars: Math.round(totalThinkingChars / (thinkingSteps || 1)),
                modelBreakdown,
                dailyStats,
                toolsBreakdown,
                hourlyStats,
                heavySessions: heavySessions.slice(0, 10)
              });

              const analyticsCacheFile = 'C:/Users/ttt79/.antigravity-mods/analytics-cache.json';
              try {
                fs.writeFileSync(analyticsCacheFile, analyticsPayload, 'utf8');
              } catch (we) {}

              webContents.executeJavaScript(`
                window.__AGY_ANALYTICS_DATA__ = ${analyticsPayload};
                window.dispatchEvent(new CustomEvent('agy-analytics-data', { detail: ${analyticsPayload} }));
              `).catch(() => {});
            } catch (aErr) {
              log('ERROR:get-analytics-data', aErr.message);
            }
          } else if (action.startsWith('get-session-deep-dive:')) {
            try {
              const convoId = action.split(':')[1].trim();
              const brainBase = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
              const transcriptPath = path.join(brainBase, convoId, '.system_generated', 'logs', 'transcript.jsonl');
              
              const timeline = [];
              const commands = [];
              const files = new Set();
              let sInput = 0, sCached = 0, sOutput = 0, sSteps = 0;

              if (fs.existsSync(transcriptPath)) {
                const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const l = lines[i];
                  if (!l) continue;
                  try {
                    const obj = JSON.parse(l);
                    if (obj.type === 'PLANNER_RESPONSE') {
                      sSteps++;
                      const inp = obj.input_tokens || 0;
                      const cch = obj.cache_read_tokens || 0;
                      const out = obj.output_tokens || 0;
                      sInput += inp;
                      sCached += cch;
                      sOutput += out;

                      if (obj.created_at) {
                        timeline.push({
                          time: obj.created_at,
                          tokens: inp + cch + out,
                          cached: cch
                        });
                      }

                      if (obj.tool_calls && Array.isArray(obj.tool_calls)) {
                        for (const tc of obj.tool_calls) {
                          if (tc.name === 'run_command' && tc.args && tc.args.CommandLine) {
                            commands.push({
                              time: obj.created_at,
                              cmd: tc.args.CommandLine,
                              summary: tc.args.toolSummary || ''
                            });
                          }
                          if ((tc.name === 'edit_file' || tc.name === 'write_file' || tc.name === 'read_file') && tc.args && tc.args.Path) {
                            files.add(tc.args.Path);
                          }
                        }
                      }
                    }
                  } catch (pe) {}
                }
              }

              const divePayload = JSON.stringify({
                convoId,
                steps: sSteps,
                totalTokens: sInput + sCached + sOutput,
                inputTokens: sInput,
                cachedTokens: sCached,
                outputTokens: sOutput,
                commandsCount: commands.length,
                filesCount: files.size,
                timeline: timeline.slice(-30), // last 30 step checkpoints
                commands: commands.slice(-40), // last 40 commands
                files: Array.from(files).slice(0, 50)
              });

              webContents.executeJavaScript(`
                window.__AGY_SESSION_DIVE__ = ${divePayload};
                window.dispatchEvent(new CustomEvent('agy-session-dive', { detail: ${divePayload} }));
              `).catch(() => {});
            } catch (sdErr) {
              log('ERROR:get-session-deep-dive', sdErr.message);
            }
          } else if (action === 'get-inspector-data' || action.startsWith('get-inspector-data:')) {
            try {
              const explicitConvoId = action.includes(':') ? action.split(':')[1].trim() : null;
              const brainBase = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
              let activeConvoId = explicitConvoId;
              if (!activeConvoId) {
                const url = webContents.getURL?.() || '';
                const match = url.match(/\/c\/([a-f0-9\-]+)/i);
                if (match && match[1]) activeConvoId = match[1];
              }

              // Fallback to most recent conversation if not in URL
              if (!activeConvoId && fs.existsSync(brainBase)) {
                try {
                  const dirs = fs.readdirSync(brainBase, { withFileTypes: true });
                  let maxTime = 0;
                  for (const d of dirs) {
                    if (d.isDirectory()) {
                      const stat = fs.statSync(path.join(brainBase, d.name));
                      if (stat.mtimeMs > maxTime) {
                        maxTime = stat.mtimeMs;
                        activeConvoId = d.name;
                      }
                    }
                  }
                } catch (e) {}
              }

              const pluginsBase = path.join(os.homedir(), '.gemini', 'config', 'plugins');
              const skillsBase = path.join(os.homedir(), '.gemini', 'config', 'skills');
              const builtinSkillsBase = path.join(os.homedir(), '.gemini', 'antigravity', 'builtin', 'skills');

              const rules = [];
              const skills = [];

              if (fs.existsSync(pluginsBase)) {
                try {
                  const pList = fs.readdirSync(pluginsBase);
                  for (const p of pList) {
                    const rDir = path.join(pluginsBase, p, 'rules');
                    if (fs.existsSync(rDir)) {
                      for (const f of fs.readdirSync(rDir)) {
                        rules.push({ name: `${p}/${f}`, content: fs.readFileSync(path.join(rDir, f), 'utf8') });
                      }
                    }
                  }
                } catch (e) {}
              }

              function scanSkills(dir, type) {
                if (!fs.existsSync(dir)) return;
                try {
                  for (const s of fs.readdirSync(dir)) {
                    const sMd = path.join(dir, s, 'SKILL.md');
                    if (fs.existsSync(sMd)) {
                      skills.push({ id: s, type, content: fs.readFileSync(sMd, 'utf8') });
                    }
                  }
                } catch (e) {}
              }
              scanSkills(skillsBase, 'user');
              scanSkills(builtinSkillsBase, 'builtin');

              const steps = [];
              if (activeConvoId && fs.existsSync(brainBase)) {
                const logsDir = path.join(brainBase, activeConvoId, '.system_generated', 'logs');
                const fullLog = path.join(logsDir, 'transcript_full.jsonl');
                const compLog = path.join(logsDir, 'transcript.jsonl');
                const tFile = fs.existsSync(fullLog) ? fullLog : (fs.existsSync(compLog) ? compLog : null);
                if (tFile) {
                  try {
                    const lines = fs.readFileSync(tFile, 'utf8').trim().split('\n');
                    for (let i = 0; i < lines.length; i++) {
                      if (!lines[i]) continue;
                      try {
                        const step = JSON.parse(lines[i]);
                        step._index = i;
                        steps.push(step);
                      } catch (pe) {}
                    }
                  } catch (e) {}
                }
              }

              const cacheFile = 'C:/Users/ttt79/.antigravity-mods/inspector-cache.json';
              fs.writeFileSync(cacheFile, JSON.stringify({
                convoId: activeConvoId,
                totalSteps: steps.length,
                steps: steps,
                rules: rules,
                skills: skills
              }), 'utf8');

              log('INSPECTOR', `Dumped ${steps.length} steps, ${rules.length} rules, ${skills.length} skills to ${cacheFile}`);

              // Notify client to read cache or update
              webContents.executeJavaScript(`
                window.__AGY_INSPECTOR_READY__ = true;
                window.dispatchEvent(new CustomEvent('agy-inspector-updated', { detail: { convoId: "${activeConvoId}", totalSteps: ${steps.length} } }));
              `).catch(() => {});
            } catch (inspErr) {
              log('ERROR:inspector-action', inspErr.message, inspErr);
            }
          } else if (action.startsWith('get-telemetry-data')) {
            try {
              const convoId = action.split(':')[1]?.trim() || '';
              const telemetryMod = require('../mods/token-speedometer/main.js');
              const data = telemetryMod.getTaskTelemetry(convoId || undefined);
              if (data) {
                const payload = JSON.stringify(data);
                webContents.executeJavaScript(`
                  window.__AGY_TELEMETRY_DATA__ = ${payload};
                  window.dispatchEvent(new CustomEvent('agy-telemetry-data', { detail: ${payload} }));
                `).catch(() => {});
              }
            } catch (tErr) {
              log('ERROR:telemetry-action', tErr.message, tErr);
            }
          }
        }
      });

      webContents.on('dom-ready', () => {
        try {
          const url = webContents.getURL?.() || '';
          log('DOM_READY', `Window ready: ${url}`);

          if (!url.startsWith('https://127.0.0.1') && !url.startsWith('http://127.0.0.1') && !url.startsWith('file://')) {
            return;
          }

          const currentMods = discoverMods();
          const currentConfig = getConfig();
          const activeMods = currentConfig.enabled === false ? [] : currentMods.filter(m => !currentConfig.disabledMods?.includes(m.id));

          // 3. Client-side ModAPI initialization snippet
          const modApiPayload = JSON.stringify({
            mods: currentMods,
            disabledMods: currentConfig.disabledMods || [],
            modSettings: currentConfig.modSettings || {},
            modsDir: MODS_DIR
          });

          let initialInspectorCache = '{}';
          try {
            const cPath = 'C:/Users/ttt79/.antigravity-mods/inspector-cache.json';
            if (fs.existsSync(cPath)) {
              const raw = fs.readFileSync(cPath, 'utf8').trim();
              if (raw && (raw.startsWith('{') || raw.startsWith('['))) {
                initialInspectorCache = raw;
              }
            }
          } catch (e) {}

          let initialAnalyticsCache = 'null';
          try {
            const aPath = 'C:/Users/ttt79/.antigravity-mods/analytics-cache.json';
            if (fs.existsSync(aPath)) {
              const rawA = fs.readFileSync(aPath, 'utf8').trim();
              if (rawA && rawA.startsWith('{')) {
                initialAnalyticsCache = rawA;
              }
            }
          } catch (e) {}

          const initModApiScript = `
            (function() {
              window.__AGY_MOD_DATA__ = ${modApiPayload};
              window.__AGY_INSPECTOR_DATA__ = ${initialInspectorCache};
              window.__AGY_ANALYTICS_DATA__ = ${initialAnalyticsCache};

              // --- Performance Guard Ecosystem ---
              const _domListeners = [];
              let _domScheduled = false;

              // Shared debounced MutationObserver: instead of 10-20 observers, there is exactly ONE
              const _sharedObserver = new MutationObserver(() => {
                if (_domScheduled) return;
                _domScheduled = true;
                (window.requestIdleCallback || window.requestAnimationFrame)(() => {
                  _domScheduled = false;
                  for (let i = 0; i < _domListeners.length; i++) {
                    try {
                      _domListeners[i]();
                    } catch (e) {
                      console.error('[ModAPI:DOMListenerError]', e);
                    }
                  }
                });
              });

              if (document.body) {
                _sharedObserver.observe(document.body, { childList: true, subtree: true });
              } else {
                document.addEventListener('DOMContentLoaded', () => {
                  _sharedObserver.observe(document.body, { childList: true, subtree: true });
                }, { once: true });
              }

              window.ModAPI = {
                version: '1.1.0',

                // Performance utilities for mods
                throttle: function(fn, delay) {
                  let lastCall = 0;
                  return function(...args) {
                    const now = Date.now();
                    if (now - lastCall >= delay) {
                      lastCall = now;
                      return fn.apply(this, args);
                    }
                  };
                },

                debounce: function(fn, delay) {
                  let timer = null;
                  return function(...args) {
                    clearTimeout(timer);
                    timer = setTimeout(() => fn.apply(this, args), delay);
                  };
                },

                // High-performance RAF wrapper
                raf: function(fn) {
                  return window.requestAnimationFrame(fn);
                },

                // Shared DOM watcher: replaces expensive individual subtree MutationObservers
                onDOMChange: function(callback) {
                  if (typeof callback === 'function') {
                    _domListeners.push(callback);
                    // trigger immediately
                    callback();
                  }
                  return () => {
                    const idx = _domListeners.indexOf(callback);
                    if (idx !== -1) _domListeners.splice(idx, 1);
                  };
                },

                getSetting: function(modId, key, fallback) {
                  const s = window.__AGY_MOD_DATA__.modSettings && window.__AGY_MOD_DATA__.modSettings[modId];
                  if (s && s[key] !== undefined) return s[key];
                  return fallback;
                },

                invokeMain: async function(channel, ...args) {
                  if (channel === 'manager:get-mods') {
                    return window.__AGY_MOD_DATA__;
                  }
                  if (channel === 'manager:open-mods-folder') {
                    console.log('__AGY_ACTION__:open-mods-folder');
                    return true;
                  }
                  if (channel === 'manager:reload-window') {
                    console.log('__AGY_ACTION__:reload-window');
                    return true;
                  }
                  if (channel === 'manager:open-devtools' || channel === 'devtools:toggle' || channel === 'devtools:open') {
                    console.log('__AGY_ACTION__:toggle-devtools');
                    return true;
                  }
                  if (channel === 'radar:get-metrics') {
                    return window.__AGY_RADAR_DATA__;
                  }
                  if (channel === 'analytics:get-data') {
                    if (window.__AGY_ANALYTICS_DATA__) {
                      return window.__AGY_ANALYTICS_DATA__;
                    }
                    return new Promise((resolve) => {
                      const onData = (e) => {
                        window.removeEventListener('agy-analytics-data', onData);
                        resolve(e.detail || window.__AGY_ANALYTICS_DATA__);
                      };
                      window.addEventListener('agy-analytics-data', onData);
                      console.log('__AGY_ACTION__:get-analytics-data');
                      setTimeout(() => {
                        window.removeEventListener('agy-analytics-data', onData);
                        resolve(window.__AGY_ANALYTICS_DATA__ || null);
                      }, 2500);
                    });
                  }
                  if (channel === 'analytics:session-deep-dive') {
                    const convoId = args[0] || '';
                    return new Promise((resolve) => {
                      const onDive = (e) => {
                        window.removeEventListener('agy-session-dive', onDive);
                        resolve(e.detail || window.__AGY_SESSION_DIVE__);
                      };
                      window.addEventListener('agy-session-dive', onDive);
                      console.log('__AGY_ACTION__:get-session-deep-dive:' + convoId);
                      setTimeout(() => {
                        window.removeEventListener('agy-session-dive', onDive);
                        resolve(window.__AGY_SESSION_DIVE__ || null);
                      }, 3000);
                    });
                  }
                  if (channel === 'inspector:get-data') {
                    const convoId = args[0] || '';
                    console.log('__AGY_ACTION__:get-inspector-data' + (convoId ? (':' + convoId) : ''));
                    return window.__AGY_INSPECTOR_DATA__ || null;
                  }
                  if (channel === 'inspector:read-cache') {
                    try {
                      const cacheFile = 'C:/Users/ttt79/.antigravity-mods/inspector-cache.json';
                      if (window.require) {
                        const fs = window.require('fs');
                        if (fs.existsSync(cacheFile)) {
                          return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                        }
                      }
                    } catch (e) {}
                    return null;
                  }
                  if (channel === 'manager:save-setting') {
                    const modId = args[0];
                    const key = args[1];
                    const val = args[2];
                    if (!window.__AGY_MOD_DATA__.modSettings) window.__AGY_MOD_DATA__.modSettings = {};
                    if (!window.__AGY_MOD_DATA__.modSettings[modId]) window.__AGY_MOD_DATA__.modSettings[modId] = {};
                    window.__AGY_MOD_DATA__.modSettings[modId][key] = val;
                    const encoded = encodeURIComponent(JSON.stringify(val));
                    console.log('__AGY_ACTION__:save-setting:' + modId + ':' + key + ':' + encoded);
                    return { success: true, value: val };
                  }
                  if (channel === 'manager:save-loader-config') {
                    const key = args[0];
                    const val = args[1];
                    console.log('__AGY_ACTION__:save-loader-config:' + key + ':' + val);
                    return { success: true };
                  }
                  if (channel === 'manager:toggle-mod') {
                    const modId = args[0];
                    const enable = args[1];
                    console.log('__AGY_ACTION__:toggle-mod:' + modId + ':' + enable);
                    let disabled = window.__AGY_MOD_DATA__.disabledMods || [];
                    if (enable) disabled = disabled.filter(id => id !== modId);
                    else if (!disabled.includes(modId)) disabled.push(modId);
                    window.__AGY_MOD_DATA__.disabledMods = disabled;
                    return { success: true, disabledMods: disabled };
                  }
                  if (channel === 'manager:delete-mod') {
                    const modId = args[0];
                    console.log('__AGY_ACTION__:delete-mod:' + modId);
                    if (window.__AGY_MOD_DATA__ && window.__AGY_MOD_DATA__.mods) {
                      window.__AGY_MOD_DATA__.mods = window.__AGY_MOD_DATA__.mods.filter(m => m.id !== modId);
                    }
                    return { success: true };
                  }
                  return null;
                }
              };
            })();
          `;

          // Non-blocking fast injection immediately on dom-ready
          setTimeout(async () => {
            if (webContents.isDestroyed()) return;
            try {
              await webContents.executeJavaScript(initModApiScript);
            } catch (e) {}

            // 4. Inject CSS from active mods immediately
            for (const mod of activeMods) {
              if (Array.isArray(mod.styles)) {
                for (const relStyle of mod.styles) {
                  const cssPath = path.join(mod.dir, relStyle);
                  if (fs.existsSync(cssPath)) {
                    const css = fs.readFileSync(cssPath, 'utf8');
                    webContents.insertCSS(css).catch(err => {
                      log('ERROR:insertCSS', `Mod ${mod.id}: ${err.message}`);
                    });
                  }
                }
              }
            }

            // 5. Injection of Renderer JS
            for (const mod of activeMods) {
              if (mod.renderer) {
                const rendererPath = path.join(mod.dir, mod.renderer);
                if (fs.existsSync(rendererPath)) {
                  const script = fs.readFileSync(rendererPath, 'utf8');
                  const wrappedScript = `
                    try {
                      ${script}
                    } catch (modErr) {
                      console.error('[MOD_ERROR:${mod.id}] ' + (modErr ? (modErr.stack || modErr.message) : 'Unknown error'));
                    }
                  `;
                  webContents.executeJavaScript(wrappedScript).catch(err => {
                    log('ERROR:executeJavaScript', `Mod ${mod.id}: ${err.message}`, err);
                  });
                }
              }
            }
          }, 0);
        } catch (domErr) {
          log('ERROR:dom-ready-handler', domErr.message, domErr);
        }
      });
    } catch (wcErr) {
      log('ERROR:web-contents-created', wcErr.message, wcErr);
    }
  });
}

// 6. Main Mod API for custom main.js scripts
const mainModAPI = {
  version: '1.0.0',
  electron,
  app,
  ipcMain,
  BrowserWindow,
  session: electron.session,
  net: electron.net,
  registerIpcHandler: (channel, handler) => {
    try {
      ipcMain.handle(`agy-mod:${channel}`, (event, ...args) => handler(event, ...args));
    } catch (e) {
      log('ERROR:registerIpcHandler', `Channel ${channel}`, e);
    }
  }
};


const currentMods = discoverMods();
const currentConfig = getConfig();
const activeMods = currentConfig.enabled === false ? [] : currentMods.filter(m => !currentConfig.disabledMods?.includes(m.id));

for (const mod of activeMods) {

  if (mod.main) {
    const mainPath = path.join(mod.dir, mod.main);
    if (fs.existsSync(mainPath)) {
      try {
        const modMain = require(mainPath);
        if (typeof modMain === 'function') {
          modMain(mainModAPI, mod);
        } else if (modMain && typeof modMain.init === 'function') {
          modMain.init(mainModAPI, mod);
        }
        log('INFO', `Initialized main script for mod: ${mod.id}`);
      } catch (err) {
        log('ERROR:mod_main', `Failed mod ${mod.id}`, err);
      }
    }
  }
}

if (app) {
  app.whenReady().then(() => {
    // Регистрация обработчиков обновления для клиентского окна
    try {
      const updater = require('./updater');
      const { getConfig, CONFIG_FILE } = require('./registry');

      ipcMain.handle('modloader:check-updates', async () => {
        return await updater.checkReleaseInfo();
      });

      ipcMain.handle('modloader:apply-update', async (event, data) => {
        try {
          const downloadUrl = data && data.downloadUrl;
          const targetVer = data && data.targetVer;
          await updater.performUpdate(downloadUrl, targetVer);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      ipcMain.handle('modloader:ignore-version', async (event, ver) => {
        try {
          const cfg = getConfig();
          cfg.ignoredUpdateVersion = ver;
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      ipcMain.handle('modloader:set-auto-update', async (event, enabled) => {
        try {
          const cfg = getConfig();
          cfg.autoUpdate = enabled;
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      // Фоновая проверка обновлений
      setTimeout(() => {
        updater.checkForUpdates(true, (updateData) => {
          // Отправляем уведомление во все открытые окна рендерера
          BrowserWindow.getAllWindows().forEach(win => {
            if (win && win.webContents) {
              win.webContents.send('modloader:update-available', updateData);
            }
          });
        }).catch(() => {});
      }, 5000);
    } catch (e) {
      log('ERROR:updater_init', e.message);
    }

    try {
      const { globalShortcut } = electron;
      if (globalShortcut) {
        globalShortcut.register('F12', () => {
          const win = BrowserWindow.getFocusedWindow();
          if (win && win.webContents) {
            if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
            else win.webContents.openDevTools({ mode: 'detach' });
          }
        });
        globalShortcut.register('CommandOrControl+Shift+I', () => {
          const win = BrowserWindow.getFocusedWindow();
          if (win && win.webContents) {
            if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
            else win.webContents.openDevTools({ mode: 'detach' });
          }
        });
        log('SHORTCUTS', 'Registered F12 and Ctrl+Shift+I global shortcuts');
      }
    } catch (e) {
      log('ERROR:shortcuts', e.message);
    }
  }).catch(() => {});
}

module.exports = { mainModAPI };
