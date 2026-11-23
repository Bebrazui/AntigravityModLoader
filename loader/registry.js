// @ts-check
const path = require('path');
const fs = require('fs');

const MODS_DIR = path.join(__dirname, '..', 'mods');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

/**
 * Reads loader config
 */
function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (!cfg.modSettings) cfg.modSettings = {};
      return cfg;
    }
  } catch (e) {
    console.error('[ModLoader] Failed to read config:', e);
  }
  return { enabled: true, disabledMods: [], modSettings: {} };
}

function saveModSetting(modId, key, value) {
  const cfg = getConfig();
  if (!cfg.modSettings) cfg.modSettings = {};
  if (!cfg.modSettings[modId]) cfg.modSettings[modId] = {};
  cfg.modSettings[modId][key] = value;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  return cfg.modSettings[modId];
}


/**
 * Discovers all valid mods in ~/.antigravity-mods/mods/
 */
function discoverMods() {
  if (!fs.existsSync(MODS_DIR)) return [];
  const entries = fs.readdirSync(MODS_DIR, { withFileTypes: true });
  const mods = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const modDir = path.join(MODS_DIR, entry.name);
    const manifestPath = path.join(modDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      mods.push({
        dir: modDir,
        id: manifest.id || entry.name,
        name: manifest.name || entry.name,
        version: manifest.version || '1.0.0',
        author: manifest.author || 'Anonymous',
        description: manifest.description || '',
        settings: manifest.settings || null,
        main: manifest.main || (fs.existsSync(path.join(modDir, 'main.js')) ? 'main.js' : null),
        renderer: manifest.renderer || (fs.existsSync(path.join(modDir, 'renderer.js')) ? 'renderer.js' : null),
        styles: manifest.styles || (fs.existsSync(path.join(modDir, 'style.css')) ? ['style.css'] : [])
      });
    } catch (e) {
      console.error(`[ModLoader] Failed to parse manifest for ${entry.name}:`, e);
    }
  }
  return mods;
}

module.exports = {
  MODS_DIR,
  CONFIG_FILE,
  getConfig,
  saveModSetting,
  discoverMods
};

