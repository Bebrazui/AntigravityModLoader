// @ts-check
// ============================================================================
//  Account Switcher (Рендерер)
//  • Кнопка «Аккаунты» в сайдбаре над системной кнопкой «Настройки»
//  • Выпадающее меню со списком аккаунтов, быстрым свапом в 1 клик
//  • Автономный прямой OAuth flow Google без ручных инструкций
//  • Строгий нейтральный графит без синего оттенка (AutoClaw UI)
// ============================================================================
(function () {
  'use strict';

  console.log('[Account Switcher] Initializing...');

  let accountsData = {
    activeEmail: null,
    accounts: []
  };

  let isLoggingIn = false;

  function getOpenInBrowser() {
    try {
      const stored = localStorage.getItem('agy_account_open_in_browser');
      if (stored !== null) return stored === 'true';
      // @ts-ignore
      const modSettings = window.__AGY_MOD_DATA__?.modSettings?.['account-switcher'];
      if (modSettings && typeof modSettings.openInBrowser === 'boolean') {
        return modSettings.openInBrowser;
      }
    } catch (_) {}
    return true; // по умолчанию открывать в браузере
  }

  function setOpenInBrowser(val) {
    try {
      localStorage.setItem('agy_account_open_in_browser', String(val));
      console.log(`__AGY_ACTION__:save-setting:account-switcher:openInBrowser:${val}`);
    } catch (_) {}
  }

  const ICONS = {
    user: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T225-378q62-31 126-46.5T480-440q65 0 129 15.5T735-378q29.5 15 47.25 43.5T800-272v112H160Zm60-60h520v-52q0-16-8.5-30T708-326q-54-27-111-40.5T480-380q-60 0-117 13.5T252-326q-15 8-23.5 22t-8.5 30v52Zm260-320q39 0 69.5-30.5T580-640q0-39-30.5-69.5T480-740q-39 0-69.5 30.5T380-640q0 39 30.5 69.5T480-540Zm0-100Zm0 420Z"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    spinner: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32" stroke-dashoffset="12" style="animation: agy-spin 0.8s linear infinite;"><circle cx="12" cy="12" r="10"/></svg>`
  };

  function requestAccounts() {
    console.log('__AGY_ACTION__:get-accounts-list');
  }

  window.addEventListener('agy-accounts-data', (e) => {
    // @ts-ignore
    if (e.detail && Array.isArray(e.detail.accounts)) {
      // @ts-ignore
      accountsData = e.detail;
      isLoggingIn = false;
      updateMenuUI();
    }
  });

  window.addEventListener('agy-oauth-error', (e) => {
    isLoggingIn = false;
    updateMenuUI();
    // @ts-ignore
    const msg = e.detail?.message || 'Не удалось выполнить вход';
    console.warn('[AccountSwitcher] OAuth error:', msg);
  });

  // @ts-ignore
  if (window.__AGY_ACCOUNTS_DATA__) {
    // @ts-ignore
    accountsData = window.__AGY_ACCOUNTS_DATA__;
  }

  /**
   * Надежный поиск кнопки «Настройки» в нижней части сайдбара
   */
  function findSettingsButton() {
    // 1. По data-testid
    const byTestId = document.querySelector('[data-testid="settings-button"]');
    if (byTestId) return byTestId;

    // 2. По SVG path шестеренки
    const gearSvgs = document.querySelectorAll('svg path[d*="M387.69-100"]');
    if (gearSvgs.length > 0) {
      const btn = gearSvgs[0].closest('button, a');
      if (btn) return btn;
    }

    // 3. По тексту "Настройки" или "Settings" внизу сайдбара
    const allButtons = document.querySelectorAll('[role="navigation"] button, [role="navigation"] a');
    for (let i = allButtons.length - 1; i >= 0; i--) {
      const txt = (allButtons[i].textContent || '').trim().toLowerCase();
      if (txt === 'настройки' || txt === 'settings') {
        return allButtons[i];
      }
    }

    return null;
  }

  function injectSidebarButton() {
    if (document.getElementById('agy-account-switcher-btn')) return;

    const settingsBtn = findSettingsButton();
    if (!settingsBtn || !settingsBtn.parentNode) return;

    const btn = document.createElement('button');
    btn.id = 'agy-account-switcher-btn';
    btn.className = settingsBtn.className;
    btn.title = 'Переключение аккаунтов Google';
    btn.style.cursor = 'pointer';
    btn.style.position = 'relative';

    btn.innerHTML = `
      <span class="shrink-0 flex items-center">
        ${ICONS.user}
      </span>
      <span class="truncate">Аккаунты</span>
    `;

    const menu = document.createElement('div');
    menu.id = 'agy-account-switcher-menu';
    menu.className = 'agy-account-menu';
    menu.style.display = 'none';

    settingsBtn.parentNode.insertBefore(btn, settingsBtn);
    document.body.appendChild(menu);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleMenu(btn, menu);
    });

    document.addEventListener('click', (e) => {
      // @ts-ignore
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
      }
    });

    requestAccounts();
  }

  function toggleMenu(btn, menu) {
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
      return;
    }

    requestAccounts();
    updateMenuUI();

    const rect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.width = `240px`;
    menu.style.display = 'block';
  }

  function updateMenuUI() {
    const menu = document.getElementById('agy-account-switcher-menu');
    if (!menu) return;

    const accounts = accountsData.accounts || [];
    const activeEmail = accountsData.activeEmail;

    menu.innerHTML = `
      <div class="agy-account-menu-header">
        <span>Аккаунты Google</span>
      </div>

      <div class="agy-account-list">
        ${accounts.length === 0 ? `
          <div class="agy-account-empty">Нет сохраненных аккаунтов</div>
        ` : accounts.map(acc => {
          const isCurrent = acc.isActive || acc.email === activeEmail;
          return `
            <div class="agy-account-item ${isCurrent ? 'active' : ''}" data-email="${acc.email}">
              <div class="agy-account-info">
                <span class="agy-account-email truncate" title="${acc.email}">${acc.email}</span>
                <span class="agy-account-type">${acc.authMethod || 'Google'}</span>
              </div>
              <div class="agy-account-actions">
                ${isCurrent ? `<span class="agy-account-check">${ICONS.check}</span>` : `
                  <button class="agy-account-del-btn" title="Удалить из списка" data-del="${acc.email}">
                    ${ICONS.trash}
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="agy-account-menu-footer">
        <div class="agy-account-browser-toggle" id="agy-account-toggle-browser" title="Открывать авторизацию во внешнем браузере системы">
          <input type="checkbox" id="agy-account-browser-checkbox" ${getOpenInBrowser() ? 'checked' : ''} style="cursor:pointer;accent-color:#52525b;">
          <label for="agy-account-browser-checkbox" style="cursor:pointer;font-size:11px;color:#a1a1aa;user-select:none;">В браузере по умолчанию</label>
        </div>
        <button class="agy-account-add-btn ${isLoggingIn ? 'loading' : ''}" id="agy-account-add-new" ${isLoggingIn ? 'disabled' : ''}>
          ${isLoggingIn ? `${ICONS.spinner} Вход в Google...` : `${ICONS.plus} Добавить аккаунт`}
        </button>
      </div>
    `;

    // Переключение профиля
    const items = menu.querySelectorAll('.agy-account-item:not(.active)');
    items.forEach(it => {
      it.addEventListener('click', (e) => {
        // @ts-ignore
        if (e.target.closest('.agy-account-del-btn')) return;
        const email = it.getAttribute('data-email');
        if (email) {
          console.log(`__AGY_ACTION__:switch-account:${encodeURIComponent(email)}`);
          menu.style.display = 'none';
        }
      });
    });

    // Удаление профиля
    const delBtns = menu.querySelectorAll('.agy-account-del-btn');
    delBtns.forEach(d => {
      d.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = d.getAttribute('data-del');
        if (email && confirm(`Удалить аккаунт ${email} из сохраненных?`)) {
          console.log(`__AGY_ACTION__:delete-account:${encodeURIComponent(email)}`);
        }
      });
    });

    // Переключатель "В браузере по умолчанию"
    const browserCb = menu.querySelector('#agy-account-browser-checkbox');
    if (browserCb) {
      browserCb.addEventListener('change', (e) => {
        // @ts-ignore
        const checked = e.target.checked;
        setOpenInBrowser(checked);
      });
    }

    // Добавление аккаунта: напрямую запускает Google OAuth
    const addBtn = menu.querySelector('#agy-account-add-new');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLoggingIn) return;
        isLoggingIn = true;
        updateMenuUI();
        const mode = getOpenInBrowser() ? 'browser' : 'window';
        console.log(`__AGY_ACTION__:start-oauth-login:${mode}`);
      });
    }
  }

  function injectStyles() {
    if (document.getElementById('agy-account-switcher-styles')) return;
    const style = document.createElement('style');
    style.id = 'agy-account-switcher-styles';
    style.textContent = `
      @keyframes agy-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .agy-account-menu {
        background: #18181b;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        padding: 6px;
        z-index: 99999;
        font-family: inherit;
        user-select: none;
      }

      .agy-account-menu-header {
        font-size: 11px;
        font-weight: 600;
        color: #a1a1aa;
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 4px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }

      .agy-account-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
      }

      .agy-account-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.12s;
      }

      .agy-account-item:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      .agy-account-item.active {
        background: rgba(255, 255, 255, 0.09);
        cursor: default;
      }

      .agy-account-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }

      .agy-account-email {
        font-size: 12px;
        font-weight: 500;
        color: #f4f4f5;
      }

      .agy-account-item.active .agy-account-email {
        color: #ffffff;
        font-weight: 600;
      }

      .agy-account-type {
        font-size: 10px;
        color: #71717a;
      }

      .agy-account-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
      }

      .agy-account-check {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .agy-account-del-btn {
        background: transparent;
        border: none;
        color: #71717a;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.12s, background 0.12s;
      }

      .agy-account-del-btn:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .agy-account-empty {
        font-size: 12px;
        color: #71717a;
        padding: 12px 8px;
        text-align: center;
      }

      .agy-account-menu-footer {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin-top: 4px;
        padding-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .agy-account-browser-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.12s;
      }

      .agy-account-browser-toggle:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .agy-account-add-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 6px;
        background: transparent;
        border: none;
        color: #a1a1aa;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
      }

      .agy-account-add-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.06);
        color: #f4f4f5;
      }

      .agy-account-add-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    injectSidebarButton();

    setInterval(() => {
      injectSidebarButton();
    }, 2000);

    // @ts-ignore
    if (window.ModAPI && window.ModAPI.onDOMChange) {
      // @ts-ignore
      window.ModAPI.onDOMChange(() => {
        injectSidebarButton();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
