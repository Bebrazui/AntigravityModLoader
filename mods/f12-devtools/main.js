// @ts-check
const path = require('path');
const fs = require('fs');

/**
 * F12 DevTools Mod - Main Process Logic
 * Intercepts F12 and Ctrl+Shift+I at native Electron level and ensures devTools=true.
 */
module.exports = function(api, mod) {
  const { app, BrowserWindow, electron } = api;

  function getModSettings() {
    try {
      const { getConfig } = require('../../loader/registry');
      const cfg = getConfig();
      return (cfg && cfg.modSettings && cfg.modSettings[mod.id]) || {};
    } catch (e) {
      return {};
    }
  }

  function getActiveMode() {
    const s = getModSettings();
    return s.mode || 'detach';
  }

  function isEnabled() {
    const s = getModSettings();
    return s.enabled !== false;
  }

  function isCtrlShiftIAllowed() {
    const s = getModSettings();
    return s.ctrlShiftI !== false;
  }

  function toggleDevToolsForWindow(targetWin) {
    if (!targetWin || targetWin.isDestroyed()) {
      targetWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    }
    if (!targetWin || targetWin.isDestroyed() || !targetWin.webContents || targetWin.webContents.isDestroyed()) {
      return { success: false, error: 'No active window found' };
    }

    const wc = targetWin.webContents;
    const mode = getActiveMode();

    try {
      if (wc.getWebPreferences) {
        const wp = wc.getWebPreferences();
        if (wp) wp.devTools = true;
      }
    } catch (_) {}

    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
      return { success: true, opened: false, mode };
    } else {
      wc.openDevTools({ mode });
      return { success: true, opened: true, mode };
    }
  }

  // 1. Register IPC handlers for renderer
  api.registerIpcHandler('devtools:toggle', async (event, customMode) => {
    let win = BrowserWindow.fromWebContents(event.sender);
    if (!win) win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    return toggleDevToolsForWindow(win);
  });

  api.registerIpcHandler('devtools:open', async (event, customMode) => {
    let win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const mode = customMode || getActiveMode();
    if (win && win.webContents && !win.webContents.isDestroyed()) {
      try {
        if (win.webContents.getWebPreferences) {
          const wp = win.webContents.getWebPreferences();
          if (wp) wp.devTools = true;
        }
      } catch (_) {}
      win.webContents.openDevTools({ mode });
      return { success: true, opened: true, mode };
    }
    return { success: false };
  });

  api.registerIpcHandler('devtools:close', async (event) => {
    let win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.closeDevTools();
      return { success: true, opened: false };
    }
    return { success: false };
  });

  // 2. Attach native Chromium 'before-input-event' handler to all webContents
  function attachDevToolsShortcut(webContents) {
    if (!webContents || webContents.isDestroyed() || webContents.__f12_hooked) return;
    webContents.__f12_hooked = true;

    try {
      if (webContents.getWebPreferences) {
        const wp = webContents.getWebPreferences();
        if (wp) wp.devTools = true;
      }
    } catch (_) {}

    webContents.on('before-input-event', (event, input) => {
      if (!isEnabled()) return;
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;

      const key = (input.key || '').toUpperCase();
      const isF12 = key === 'F12';
      const isCtrlShiftI = isCtrlShiftIAllowed() && (input.control || input.meta) && input.shift && key === 'I';

      if (isF12 || isCtrlShiftI) {
        event.preventDefault();
        try {
          if (webContents.getWebPreferences) {
            const wp = webContents.getWebPreferences();
            if (wp) wp.devTools = true;
          }
          const mode = getActiveMode();
          if (webContents.isDevToolsOpened()) {
            webContents.closeDevTools();
          } else {
            webContents.openDevTools({ mode });
          }
        } catch (e) {
          console.error('[F12 DevTools Mod] Error toggling devtools:', e);
        }
      }
    });
  }

  // Attach to existing windows immediately
  if (BrowserWindow && BrowserWindow.getAllWindows) {
    BrowserWindow.getAllWindows().forEach(win => {
      if (win && win.webContents) attachDevToolsShortcut(win.webContents);
    });
  }

  // Attach to any future webContents / windows
  if (app) {
    app.on('web-contents-created', (_event, webContents) => {
      attachDevToolsShortcut(webContents);
    });
  }

  console.log(`[${mod.name}] Native F12 & DevTools handlers registered.`);
};
