// @ts-check
const { spawn } = require('child_process');
const path = require('path');
const { ensurePatched, APP_EXE } = require('./auto-patcher');

try {
  ensurePatched();
} catch (e) {
  // Never block application launch even if patching encounters an edge case
}

const childArgs = process.argv.slice(2);
const child = spawn(APP_EXE, childArgs, {
  detached: true,
  stdio: 'ignore'
});
child.unref();
process.exit(0);
