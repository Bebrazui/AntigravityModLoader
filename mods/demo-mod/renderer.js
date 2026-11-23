// Example client-side script for demo-mod
(function() {
  console.log('[Demo Mod] Client UI script initialized successfully!');

  // Optional: add a slight accent glow or test notification
  if (typeof ModAPI !== 'undefined') {
    ModAPI.invokeMain('hello', 'Antigravity User').then(res => {
      console.log('[Demo Mod] Response from Main Process:', res);
    }).catch(() => {});
  }
})();
