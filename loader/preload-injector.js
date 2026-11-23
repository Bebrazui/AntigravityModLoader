// @ts-check
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { discoverMods, getConfig } = require('./registry');

console.log('[Antigravity ModLoader] Preload Hook Initializing...');
try {
  fs.appendFileSync('C:/Users/ttt79/.antigravity-mods/debug.log', new Date().toISOString() + ' PRELOAD HOOK RUNNING\n');
} catch (e) {}

const config = getConfig();
const mods = discoverMods().filter(m => !config.disabledMods.includes(m.id));

// Collect styles to inject
const stylesToInject = [];
for (const mod of mods) {
  if (Array.isArray(mod.styles)) {
    for (const relStyle of mod.styles) {
      const fullPath = path.join(mod.dir, relStyle);
      if (fs.existsSync(fullPath)) {
        stylesToInject.push({ modId: mod.id, file: relStyle, css: fs.readFileSync(fullPath, 'utf8') });
      }
    }
  }
}

// Function to inject CSS into document safely
function injectCSS(id, css) {
  const apply = () => {
    let styleEl = document.getElementById(`antigravity-mod-${id}`);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = `antigravity-mod-${id}`;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = css;
  };

  if (document.head || document.documentElement) {
    apply();
  } else {
    document.addEventListener('DOMContentLoaded', apply);
  }
}

// Auto-inject mod styles
for (const item of stylesToInject) {
  injectCSS(`${item.modId}-${item.file.replace(/[^a-zA-Z0-9]/g, '_')}`, item.css);
}

// Expose Client-Side ModAPI
const modAPI = {
  version: '1.0.0',
  getLoadedMods: () => mods.map(m => ({ id: m.id, name: m.name, version: m.version })),
  injectCSS: (id, css) => injectCSS(id, css),
  invokeMain: (channel, ...args) => ipcRenderer.invoke(`agy-mod:${channel}`, ...args),
  onMainEvent: (channel, callback) => {
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(`agy-mod:${channel}`, handler);
    return () => ipcRenderer.removeListener(`agy-mod:${channel}`, handler);
  }
};

try {
  contextBridge.exposeInMainWorld('ModAPI', modAPI);
} catch (e) {
  // If contextIsolation is off or in non-isolated realm
  window.ModAPI = modAPI;
}

// Execute renderer scripts after DOM is available
window.addEventListener('DOMContentLoaded', () => {
  for (const mod of mods) {
    if (mod.renderer) {
      const rendererPath = path.join(mod.dir, mod.renderer);
      if (fs.existsSync(rendererPath)) {
        try {
          const code = fs.readFileSync(rendererPath, 'utf8');
          const modFn = new Function('ModAPI', 'mod', code);
          modFn(modAPI, mod);
          console.log(`[Antigravity ModLoader] Loaded renderer for mod: ${mod.id}`);
        } catch (err) {
          console.error(`[Antigravity ModLoader] Error running renderer for ${mod.id}:`, err);
        }
      }
    }
  }
});
