// @ts-check
// ============================================================================
//  DNS-AI Proxy Status (Рендерер)
//  Отображает компактный индикатор статуса встроенного DoT / DNS-AI прокси
//  в статусной строке интерфейса Antigravity.
// ============================================================================
(function () {
  'use strict';

  console.log('[DNS-AI Proxy Renderer] Loaded.');

  function injectStatusWidget() {
    if (document.getElementById('agy-dns-proxy-badge')) return;

    // Вставляем рядом с остальными модами в статус-баре
    const target = document.querySelector('footer') || document.querySelector('header');
    if (!target) return;

    const badge = document.createElement('div');
    badge.id = 'agy-dns-proxy-badge';
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      font-size: 11px;
      color: #71717a;
      border-radius: 6px;
      user-select: none;
      font-family: inherit;
    `;
    badge.title = 'Встроенный DNS-AI Proxy (DoT + DoH unblock) активен';
    badge.innerHTML = `
      <span style="width:6px;height:6px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.4);"></span>
      <span style="font-weight:500;color:#a1a1aa;">DNS-AI</span>
    `;

    target.appendChild(badge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStatusWidget, { once: true });
  } else {
    injectStatusWidget();
  }
})();
