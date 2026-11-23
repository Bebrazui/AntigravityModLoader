// @ts-check
(function() {
  console.log('[F12 DevTools Mod] Initializing renderer listener...');

  const MOD_ID = 'f12-devtools';

  // Helper: check setting
  function getSetting(key, fallback) {
    if (window.ModAPI && typeof window.ModAPI.getSetting === 'function') {
      return window.ModAPI.getSetting(MOD_ID, key, fallback);
    }
    return fallback;
  }

  // Toast notification system
  let toastElement = null;
  let toastTimer = null;

  function showToast(message) {
    if (!getSetting('showToast', true)) return;

    if (!toastElement) {
      toastElement = document.createElement('div');
      toastElement.className = 'agy-devtools-toast';
      document.body.appendChild(toastElement);
    }

    toastElement.innerHTML = `
      <span class="agy-devtools-toast-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
      </span>
      <span class="agy-devtools-toast-text">${message}</span>
      <span class="agy-devtools-toast-badge">F12</span>
    `;

    toastElement.classList.add('visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastElement) {
        toastElement.classList.remove('visible');
      }
    }, 1800);
  }

  // Action dispatcher
  async function toggleDevTools() {
    if (!getSetting('enabled', true)) return;

    showToast('DevTools переключен');

    // 1. Antigravity's native IPC bridge exposed on window.electronNative
    try {
      // @ts-ignore
      if (window.electronNative && typeof window.electronNative.toggleDevTools === 'function') {
        // @ts-ignore
        window.electronNative.toggleDevTools();
      }
    } catch (e) {}

    // 2. ModLoader console bridge action
    console.log('__AGY_ACTION__:toggle-devtools');

    // 3. ModAPI invokeMain
    try {
      if (window.ModAPI && window.ModAPI.invokeMain) {
        window.ModAPI.invokeMain('manager:open-devtools');
      }
    } catch (e) {}
  }

  // Expose global API
  // @ts-ignore
  window.F12DevTools = {
    toggle: toggleDevTools,
    open: toggleDevTools
  };

  // Keyboard shortcut listener (Capture phase to precede code editors and nested DOM)
  window.addEventListener('keydown', (e) => {
    if (!getSetting('enabled', true)) return;

    const key = (e.key || '').toUpperCase();
    const code = (e.code || '').toUpperCase();
    const isF12 = key === 'F12' || code === 'F12' || e.keyCode === 123;
    const isCtrlShiftI = getSetting('ctrlShiftI', true) && 
      (e.ctrlKey || e.metaKey) && 
      e.shiftKey && 
      (key === 'I' || code === 'KEYI' || e.keyCode === 73);

    if (isF12 || isCtrlShiftI) {
      e.preventDefault();
      e.stopPropagation();
      toggleDevTools();
    }
  }, true);

  console.log('[F12 DevTools Mod] Ready. Press F12 to toggle DevTools.');
})();
