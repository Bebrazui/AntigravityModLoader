// @ts-check
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

module.exports = function(api, mod) {
  const { discoverMods, getConfig, saveModSetting, CONFIG_FILE, MODS_DIR } = require('../../loader/registry');

  // IPC: get full mod list with details & config
  api.registerIpcHandler('manager:get-mods', async () => {
    const mods = discoverMods();
    const config = getConfig();
    return {
      mods,
      disabledMods: config.disabledMods || [],
      modSettings: config.modSettings || {},
      modsDir: MODS_DIR
    };
  });

  // IPC: save mod setting
  api.registerIpcHandler('manager:save-setting', async (event, modId, key, value) => {
    const updated = saveModSetting(modId, key, value);
    return { success: true, settings: updated };
  });

  // IPC: toggle mod status
  api.registerIpcHandler('manager:toggle-mod', async (event, modId, enable) => {
    const config = getConfig();
    let disabled = config.disabledMods || [];
    if (enable) {
      disabled = disabled.filter(id => id !== modId);
    } else {
      if (!disabled.includes(modId)) {
        disabled.push(modId);
      }
    }
    config.disabledMods = disabled;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return { success: true, disabledMods: disabled };
  });


  // IPC: open mods folder in Explorer
  api.registerIpcHandler('manager:open-mods-folder', async () => {
    if (!fs.existsSync(MODS_DIR)) {
      fs.mkdirSync(MODS_DIR, { recursive: true });
    }
    await shell.openPath(MODS_DIR);
    return true;
  });

  // IPC: reload current window
  api.registerIpcHandler('manager:reload-window', async (event) => {
    const win = api.BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.reload();
    }
    return true;
  });

  console.log('[Core Mod Manager] IPC handlers registered.');
};
