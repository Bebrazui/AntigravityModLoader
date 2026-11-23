// @ts-check
try {
  require('C:/Users/ttt79/.antigravity-mods/loader/main-injector.js');
} catch (e) {
  try {
    require('fs').appendFileSync('C:/Users/ttt79/.antigravity-mods/crash.log', '[HOOK_ERR] ' + e.stack + '\n');
  } catch (_) {}
}
