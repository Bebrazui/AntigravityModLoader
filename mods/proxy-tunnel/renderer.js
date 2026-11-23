// @ts-check
(function() {
  console.log('[ProxyTunnel] Renderer script loaded.');

  function injectStatusWidget() {
    if (document.getElementById('agy-proxy-status-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'agy-proxy-status-widget';
    widget.className = 'agy-proxy-indicator';
    widget.title = 'Сетевой туннель: Кликните для проверки соединения';

    widget.innerHTML = `
      <div class="agy-net-badges">
        <span class="agy-badge agy-badge-proxy" id="agy-badge-proxy" title="Proxy статус">
          <span class="agy-dot"></span>PROXY
        </span>
        <span class="agy-badge agy-badge-dns" id="agy-badge-dns" title="DNS статус">
          <span class="agy-dot"></span>DNS
        </span>
        <span class="agy-badge agy-badge-vpn" id="agy-badge-vpn" title="VPN Bypass статус">
          <span class="agy-dot"></span>NO-VPN
        </span>
      </div>
    `;

    document.body.appendChild(widget);

    widget.addEventListener('click', async () => {
      widget.classList.add('testing');
      const proxyBadge = widget.querySelector('#agy-badge-proxy');
      if (proxyBadge) proxyBadge.setAttribute('data-state', 'testing');

      if (window.ModAPI) {
        try {
          const res = await window.ModAPI.invokeMain('proxy:test-connection');
          if (res && res.success) {
            if (proxyBadge) {
              proxyBadge.setAttribute('data-state', 'online');
              proxyBadge.innerText = `${res.timeMs}ms`;
              setTimeout(() => {
                proxyBadge.innerHTML = `<span class="agy-dot"></span>PROXY`;
                updateWidgetState();
              }, 3000);
            }
          } else {
            if (proxyBadge) proxyBadge.setAttribute('data-state', 'error');
            console.warn('[ProxyTunnel] Connection test error:', res ? res.error : 'Unknown');
          }

          // Test DNS
          const dnsRes = await window.ModAPI.invokeMain('proxy:test-dns');
          const dnsBadge = widget.querySelector('#agy-badge-dns');
          if (dnsBadge) {
            if (dnsRes && dnsRes.success) {
              dnsBadge.setAttribute('data-state', 'online');
            } else {
              dnsBadge.setAttribute('data-state', 'error');
            }
          }
        } catch (err) {
          if (proxyBadge) proxyBadge.setAttribute('data-state', 'error');
        } finally {
          widget.classList.remove('testing');
        }
      }
    });

    updateWidgetState();
  }

  function updateWidgetState() {
    const widget = document.getElementById('agy-proxy-status-widget');
    if (!widget) return;

    const proxyBadge = widget.querySelector('#agy-badge-proxy');
    const dnsBadge = widget.querySelector('#agy-badge-dns');
    const vpnBadge = widget.querySelector('#agy-badge-vpn');

    let enableProxy = false;
    let enableDns = false;
    let ignoreVpn = false;

    if (window.ModAPI && window.ModAPI.getSetting) {
      enableProxy = window.ModAPI.getSetting('proxy-tunnel', 'enableProxy', false);
      enableDns = window.ModAPI.getSetting('proxy-tunnel', 'enableDns', false);
      ignoreVpn = window.ModAPI.getSetting('proxy-tunnel', 'ignoreSystemVpn', false);
    }

    if (proxyBadge) {
      proxyBadge.setAttribute('data-active', enableProxy ? 'true' : 'false');
      if (!enableProxy) proxyBadge.removeAttribute('data-state');
    }

    if (dnsBadge) {
      dnsBadge.setAttribute('data-active', enableDns ? 'true' : 'false');
      if (!enableDns) dnsBadge.removeAttribute('data-state');
    }

    if (vpnBadge) {
      vpnBadge.setAttribute('data-active', ignoreVpn ? 'true' : 'false');
      if (!ignoreVpn) vpnBadge.removeAttribute('data-state');
    }

    if (!enableProxy && !enableDns && !ignoreVpn) {
      widget.style.opacity = '0.35';
    } else {
      widget.style.opacity = '1';
    }
  }

  setTimeout(injectStatusWidget, 1500);
  window.addEventListener('storage', updateWidgetState);
})();
