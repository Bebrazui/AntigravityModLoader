// Main-process script (Node.js runtime with access to ipcMain & system)
module.exports = function(api, mod) {
  console.log(`[${mod.name}] Main process logic initialized!`);

  // Example: register a custom IPC handler
  api.registerIpcHandler('hello', async (event, name) => {
    return `Hello ${name} from ${mod.name} in Node.js!`;
  });
};
