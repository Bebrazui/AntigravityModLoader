#!/usr/bin/env node
// @ts-check
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const USER_HOME = os.homedir();
const MODS_BASE = path.join(USER_HOME, '.antigravity-mods');
const CRASH_LOG = path.join(MODS_BASE, 'crash.log');
const VBS_LAUNCHER = path.join(MODS_BASE, 'loader', 'Antigravity-Launcher.vbs');

const autoPatcher = require('../loader/auto-patcher');

const START_MENU_LNK = path.join(
  process.env.APPDATA || path.join(USER_HOME, 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Antigravity.lnk'
);
const DESKTOP_LNK = path.join(USER_HOME, 'Desktop', 'Antigravity.lnk');

function printBanner() {
  console.log('\n=======================================');
  console.log('      ANTIGRAVITY MODLOADER (CLI)      ');
  console.log('=======================================\n');
}

function installAutoPatch() {
  console.log('[*] Installing AutoPatcher integration for Windows shortcuts...');
  
  // Create or update VBS launcher link via PowerShell
  const psScript = `
    $sh = New-Object -ComObject WScript.Shell
    $exePath = "${autoPatcher.APP_EXE.replace(/\\/g, '\\\\')}"
    $vbsPath = "${VBS_LAUNCHER.replace(/\\/g, '\\\\')}"
    $workDir = "${autoPatcher.DEFAULT_INSTALL_DIR.replace(/\\/g, '\\\\')}"
    $wscript = "$env:SystemRoot\\System32\\wscript.exe"

    $targets = @("${START_MENU_LNK.replace(/\\/g, '\\\\')}", "${DESKTOP_LNK.replace(/\\/g, '\\\\')}")
    foreach ($target in $targets) {
      if (Test-Path $target) {
        $lnk = $sh.CreateShortcut($target)
        $lnk.TargetPath = $wscript
        $lnk.Arguments = '\"' + $vbsPath + '\"'
        $lnk.WorkingDirectory = $workDir
        $lnk.IconLocation = "$exePath,0"
        $lnk.Save()
        Write-Host "[+] Updated shortcut: $target"
      }
    }
  `;

  const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], { stdio: 'inherit' });
  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n[+] AutoPatcher installed! Antigravity will now auto-verify and patch mods every time you open it.');
    } else {
      console.error('[!] Failed to update shortcuts.');
    }
  });
}

function uninstallAutoPatch() {
  console.log('[*] Restoring original direct executable shortcuts...');
  const psScript = `
    $sh = New-Object -ComObject WScript.Shell
    $exePath = "${autoPatcher.APP_EXE.replace(/\\/g, '\\\\')}"
    $workDir = "${autoPatcher.DEFAULT_INSTALL_DIR.replace(/\\/g, '\\\\')}"

    $targets = @("${START_MENU_LNK.replace(/\\/g, '\\\\')}", "${DESKTOP_LNK.replace(/\\/g, '\\\\')}")
    foreach ($target in $targets) {
      if (Test-Path $target) {
        $lnk = $sh.CreateShortcut($target)
        $lnk.TargetPath = $exePath
        $lnk.Arguments = ""
        $lnk.WorkingDirectory = $workDir
        $lnk.IconLocation = "$exePath,0"
        $lnk.Save()
        Write-Host "[+] Restored direct shortcut: $target"
      }
    }
  `;
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', psScript], { stdio: 'inherit' });
  child.on('close', () => {
    console.log('[+] Restored default shortcuts.');
  });
}

function checkInstallation() {
  if (!fs.existsSync(autoPatcher.RESOURCES_DIR)) {
    console.error(`[Error] Antigravity installation not found at: ${autoPatcher.RESOURCES_DIR}`);
    process.exit(1);
  }
}

function patchApp() {
  checkInstallation();
  console.log('[*] Running Smart AutoPatcher...');
  const res = autoPatcher.applyPatch();
  if (res.alreadyPatched) {
    console.log('[!] Antigravity is ALREADY patched.');
  } else if (res.success) {
    console.log('[+] SUCCESS: Antigravity successfully patched with Smart Matcher!');
  } else {
    console.error(`[Error] Patch failed: ${res.reason || res.error}`);
  }
}

function unpatchApp() {
  checkInstallation();
  console.log('[*] Restoring pristine Antigravity package...');
  if (fs.existsSync(autoPatcher.BACKUP_ASAR)) {
    fs.copyFileSync(autoPatcher.BACKUP_ASAR, autoPatcher.APP_ASAR);
    console.log('[+] Restored original app.asar from backup.');
  }
  console.log('[+] Clean official state restored.\n');
}

function launchApp() {
  console.log('[*] Launching Antigravity via AutoPatcher launcher...');
  autoPatcher.ensurePatched();
  const child = spawn(autoPatcher.APP_EXE, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  console.log('[+] Antigravity launched.');
}

printBanner();
const args = process.argv.slice(2);
const cmd = args[0] || 'status';

switch (cmd) {
  case 'patch':
    patchApp();
    break;
  case 'unpatch':
    unpatchApp();
    break;
  case 'autopatch':
  case 'autopatcher':
    if (args[1] === 'install') {
      installAutoPatch();
    } else if (args[1] === 'uninstall' || args[1] === 'remove') {
      uninstallAutoPatch();
    } else {
      console.log('Usage: agy-mod autopatch [install|uninstall]');
    }
    break;
  case 'launch':
  case 'run':
    launchApp();
    break;
  case 'logs':
  case 'crash':
    if (fs.existsSync(CRASH_LOG)) {
      console.log(fs.readFileSync(CRASH_LOG, 'utf8'));
    } else {
      console.log('No crash logs recorded yet.');
    }
    break;
  case 'status':
  default:
    console.log(`Patched: ${autoPatcher.isPatched() ? '\x1b[32mYES\x1b[0m' : '\x1b[33mNO\x1b[0m'}`);
    console.log(`Crash log: ${CRASH_LOG}`);
    break;
}
