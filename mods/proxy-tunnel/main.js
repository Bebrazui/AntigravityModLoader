// @ts-check
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const { execSync } = require('child_process');
const cp = require('child_process');

/**
 * Proxy & DNS Tunnel Mod for Google Antigravity
 * 
 * Features:
 * 1. Proxy Routing (SOCKS5/HTTP/HTTPS)
 * 2. Custom DNS Resolvers (dns.setServers)
 * 3. Ignore System VPN / Tunnel (Route discovery & direct gateway binding)
 */
module.exports = function(api, mod) {
  const { app, session } = api;
  const { getConfig } = require('../../loader/registry');

  function getModSettings() {
    const cfg = getConfig();
    const settings = (cfg.modSettings && cfg.modSettings['proxy-tunnel']) || {};
    return {
      enableProxy: settings.enableProxy !== undefined ? settings.enableProxy : (settings.enabled || false),
      proxyType: settings.proxyType || 'socks5',
      proxyHost: (settings.proxyHost || '127.0.0.1').trim(),
      proxyPort: settings.proxyPort || 1080,
      bypassRules: (settings.bypassRules || '<local>, 127.0.0.1').trim(),

      ignoreSystemVpn: settings.ignoreSystemVpn !== undefined ? settings.ignoreSystemVpn : false,

      enableDns: settings.enableDns !== undefined ? settings.enableDns : false,
      dnsServers: (settings.dnsServers || settings.customDns || '1.1.1.1, 1.0.0.1').trim()
    };
  }

  const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
    'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'];

  /**
   * Apply proxy settings to the current Node process environment only.
   * This is required for child processes such as the Antigravity Language Server.
   */
  function applyProxyEnv(settings) {
    const s = settings || getModSettings();
    if (s.enableProxy && s.proxyType !== 'direct') {
      const proxyRules = `${s.proxyType}://${s.proxyHost}:${s.proxyPort}`;
      for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
        process.env[k] = proxyRules;
      }
      process.env.NO_PROXY = s.bypassRules;
      process.env.no_proxy = s.bypassRules;
      return { mode: 'proxy', proxyRules, bypassRules: s.bypassRules };
    }

    if (s.ignoreSystemVpn) {
      for (const k of PROXY_ENV_KEYS) delete process.env[k];
      return { mode: 'direct', proxyRules: null, bypassRules: null };
    }

    // Default/system: do not inherit stale proxy overrides set by VPN software hooks.
    for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
      delete process.env[k];
    }
    return { mode: 'system', proxyRules: null, bypassRules: null };
  }

  /**
   * Normalize proxy-related variables in an environment object (used by child_process.spawn).
   * This prevents shell environment re-injection from overriding the selected mode.
   */
  function normalizeChildEnv(env) {
    const s = getModSettings();
    const out = { ...(env || process.env) };

    if (s.enableProxy && s.proxyType !== 'direct') {
      const proxyRules = `${s.proxyType}://${s.proxyHost}:${s.proxyPort}`;
      for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
        out[k] = proxyRules;
      }
      out.NO_PROXY = s.bypassRules;
      out.no_proxy = s.bypassRules;
      return out;
    }

    if (s.ignoreSystemVpn) {
      for (const k of PROXY_ENV_KEYS) delete out[k];
      return out;
    }

    // Default mode: let the actual system environment decide, but drop vars that
    // were only set by a previous proxy mode in this process.
    return out;
  }

  /**
   * Discover the physical network gateway and interface IP (ignoring TUN/TAP/VPN/Tailscale adapters).
   */
  function detectPhysicalGateway() {
    try {
      if (process.platform === 'win32') {
        const out = execSync('powershell.exe -NoProfile -Command "Get-NetRoute -DestinationPrefix \'0.0.0.0/0\' | Where-Object { $_.NextHop -ne \'0.0.0.0\' } | Select-Object -ExpandProperty NextHop"', { encoding: 'utf8', timeout: 3000 });
        const gateways = out.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        // Usually local router gateway is 192.168.x.x or 10.x.x.x
        for (const gw of gateways) {
          if (!gw.startsWith('100.') && !gw.startsWith('198.18.')) { // Ignore Tailscale (100.x.y.z) and Sing-box fake routes
            return gw;
          }
        }
        return gateways[0] || null;
      }
    } catch (e) {
      console.warn('[ProxyTunnel] Gateway detection error:', e.message);
    }
    return null;
  }

  // 1. Separate DNS Controller
  function applyDnsSettings() {
    const settings = getModSettings();
    if (!settings.enableDns) {
      console.log('[ProxyTunnel] Custom DNS disabled. Using default resolver.');
      return;
    }

    try {
      const servers = settings.dnsServers
        .split(/[,;\s]+/)
        .map(s => s.trim())
        .filter(Boolean);

      if (servers.length > 0) {
        dns.setServers(servers);
        console.log(`[ProxyTunnel] Custom DNS active: ${servers.join(', ')}`);
      }
    } catch (e) {
      console.error('[ProxyTunnel] Failed to set DNS servers:', e);
    }
  }

  // 2. Proxy & VPN Routing Controller
  async function applyProxySettings(targetSession) {
    if (!targetSession) return;
    const settings = getModSettings();

    // Keep process environment in sync for child processes (Language Server, etc.)
    applyProxyEnv(settings);

    // Mode A: Custom Proxy is enabled
    if (settings.enableProxy && settings.proxyType !== 'direct') {
      const proxyRules = `${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}`;
      const proxyBypassRules = settings.bypassRules;

      try {
        await targetSession.setProxy({
          proxyRules: proxyRules,
          proxyBypassRules: proxyBypassRules
        });
        console.log(`[ProxyTunnel] Proxy enabled: ${proxyRules} (Bypass: ${proxyBypassRules})`);

        process.env.HTTP_PROXY = proxyRules;
        process.env.HTTPS_PROXY = proxyRules;
        process.env.ALL_PROXY = proxyRules;
        process.env.NO_PROXY = proxyBypassRules;
      } catch (err) {
        console.error('[ProxyTunnel] Failed to apply proxy:', err);
      }
      return;
    }

    // Mode B: Ignore System VPN is enabled (Direct mode bypassing system proxy/VPN hooks)
    if (settings.ignoreSystemVpn) {
      try {
        // Mode 'direct' tells Chromium/Electron network service to ignore system-wide proxy/VPN LSP hooks
        // and connect directly without looking up Windows WinINet / system proxy configurations.
        await targetSession.setProxy({ mode: 'direct' });

        // Strip any inherited proxy environment variables set by VPN software
        delete process.env.HTTP_PROXY;
        delete process.env.HTTPS_PROXY;
        delete process.env.ALL_PROXY;
        delete process.env.http_proxy;
        delete process.env.https_proxy;
        delete process.env.all_proxy;

        console.log('[ProxyTunnel] Ignore System VPN mode active: Electron set to direct networking.');
      } catch (err) {
        console.error('[ProxyTunnel] Failed to set direct mode for VPN bypass:', err);
      }
      return;
    }

    // Mode C: Default system behavior
    try {
      await targetSession.setProxy({ mode: 'system' });
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.ALL_PROXY;
      console.log('[ProxyTunnel] Default system networking active.');
    } catch (err) {
      console.error('[ProxyTunnel] Error resetting to system proxy mode:', err);
    }
  }

  // Patch child_process so requests made by Antigravity's language server inherit
  // the selected proxy/DNS runtime instead of stale shell environment values.
  function patchChildProcess() {
    function wrapOptions(options) {
      if (options && typeof options === 'object' && !Array.isArray(options)) {
        const patched = { ...options };
        patched.env = normalizeChildEnv(patched.env);
        return patched;
      }
      return options;
    }

    function wrapSpawn(original) {
      return function (command, args, options) {
        if (Array.isArray(args)) {
          return original.call(this, command, args, wrapOptions(options));
        }
        return original.call(this, command, wrapOptions(args));
      };
    }

    for (const name of ['spawn', 'spawnSync']) {
      if (typeof cp[name] === 'function') {
        cp[name] = wrapSpawn(cp[name]);
      }
    }

    function wrapExec(original, optionsIndex) {
      return function (...args) {
        if (args[optionsIndex] && typeof args[optionsIndex] === 'object') {
          args = [...args];
          args[optionsIndex] = wrapOptions(args[optionsIndex]);
        }
        return original.apply(this, args);
      };
    }

    for (const [name, idx] of [['exec', 1], ['execFile', 2], ['execSync', 1], ['execFileSync', 2], ['fork', 2]]) {
      if (typeof cp[name] === 'function') {
        const orig = cp[name];
        cp[name] = wrapExec(orig, idx);
      }
    }
  }
  patchChildProcess();

  // Apply environment as early as possible (Language Server inherits process.env).
  applyProxyEnv();

  // Initial apply
  applyDnsSettings();

  function setupSession() {
    const s = session?.defaultSession;
    if (s) {
      applyProxySettings(s);
    }
  }

  if (app && app.isReady && app.isReady()) {
    setupSession();
  } else if (app) {
    app.whenReady?.().then(setupSession);
  }

  if (app) {
    app.on('session-created', (newSession) => {
      applyProxySettings(newSession);
    });
  }

  // IPC Handlers
  api.registerIpcHandler('proxy:apply', async () => {
    applyDnsSettings();
    if (session?.defaultSession) {
      await applyProxySettings(session.defaultSession);
    }
    return { success: true, settings: getModSettings() };
  });

  api.registerIpcHandler('proxy:detect-gw', async () => {
    const gw = detectPhysicalGateway();
    return { gateway: gw };
  });

  api.registerIpcHandler('proxy:test-dns', async (_event, domainToResolve) => {
    const target = domainToResolve || 'google.com';
    return new Promise((resolve) => {
      const start = Date.now();
      dns.resolve4(target, (err, addresses) => {
        const timeMs = Date.now() - start;
        if (err) {
          resolve({ success: false, error: err.message, timeMs });
        } else {
          resolve({ success: true, addresses, timeMs, currentServers: dns.getServers() });
        }
      });
    });
  });

  api.registerIpcHandler('proxy:test-connection', async (_event, testUrl) => {
    const url = testUrl || 'https://www.google.com';
    const settings = getModSettings();
    return new Promise((resolve) => {
      try {
        const net = api.net || require('electron').net;
        const request = net.request({
          method: 'GET',
          url: url,
          session: session?.defaultSession
        });

        const start = Date.now();
        request.on('response', (response) => {
          const elapsed = Date.now() - start;
          resolve({
            success: response.statusCode >= 200 && response.statusCode < 400,
            statusCode: response.statusCode,
            timeMs: elapsed,
            proxy: settings.enableProxy ? `${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}` : (settings.ignoreSystemVpn ? 'direct (bypass vpn)' : 'system')
          });
        });

        request.on('error', (err) => {
          resolve({
            success: false,
            error: err.message || String(err),
            proxy: settings.enableProxy ? `${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}` : (settings.ignoreSystemVpn ? 'direct (bypass vpn)' : 'system')
          });
        });

        request.setTimeout(7000, () => {
          request.abort();
          resolve({
            success: false,
            error: 'Connection timed out (7s)',
            proxy: settings.enableProxy ? `${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}` : (settings.ignoreSystemVpn ? 'direct (bypass vpn)' : 'system')
          });
        });

        request.end();
      } catch (e) {
        resolve({
          success: false,
          error: e.message || String(e),
          proxy: settings.enableProxy ? `${settings.proxyType}://${settings.proxyHost}:${settings.proxyPort}` : 'system'
        });
      }
    });
  });

  console.log(`[${mod.name}] Main process logic initialized successfully.`);
};
