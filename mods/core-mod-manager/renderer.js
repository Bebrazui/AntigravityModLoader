// @ts-check
(function() {
  console.log('[Core Mod Manager] Initializing content-pane screen injection...');

  const ICONS = {
    arrowLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
    puzzle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg>`,
    folder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    refresh: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
    gear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
    terminal: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zm-9.7-4.3L5.7 16 4.3 14.6l2.6-2.6-2.6-2.6L5.7 8l4 4.1.6.6z"/></svg>`,
    search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    chart: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/><path d="M19 19H5V5H3v16h18v-2z"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
  };

  let screenEl = null;
  let activeNav = 'mods'; // 'mods', 'analytics', 'settings'
  let currentSearchQuery = '';
  let currentFilter = 'all'; // 'all', 'active', 'disabled'
  let analyticsDateRange = 'all'; // 'all', '30d', '7d', 'today'

  function findMainContainer() {
    const pane = document.querySelector('[data-split-fill-edge="left"]');
    if (pane) return pane;

    const sheet = document.querySelector('.agy-sheet');
    if (sheet) return sheet;

    const bodyChildren = Array.from(document.body.children);
    for (const child of bodyChildren) {
      if (child.id === 'agy-mods-sidebar-tab' || child.classList.contains('agy-mods-screen-overlay')) continue;
      if (child.clientWidth > 400 && child.clientHeight > 400) {
        return child;
      }
    }
    return document.body;
  }

  function createScreen() {
    const targetParent = findMainContainer();

    if (screenEl && screenEl.parentElement === targetParent) {
      return screenEl;
    }

    if (screenEl && screenEl.parentElement) {
      screenEl.parentElement.removeChild(screenEl);
    }

    screenEl = document.createElement('div');
    screenEl.className = 'agy-mods-screen-overlay';
    screenEl.style.display = 'none';
    screenEl.innerHTML = `
      <div class="agy-mods-screen-header">
        <div class="agy-mods-header-left">
          <button class="agy-mods-back-btn" id="agy-mods-back" title="Назад">
            ${ICONS.arrowLeft}
          </button>
          <div class="agy-mods-header-titles">
            <span class="agy-mods-header-title">ModLoader</span>
            <span class="agy-mods-header-version">v1.1.0</span>
          </div>
        </div>
        <div class="agy-mods-header-right">
          <button class="agy-mods-btn" id="agy-mods-devtools">
            ${ICONS.terminal} DevTools
          </button>
          <button class="agy-mods-btn" id="agy-mods-open-folder">
            ${ICONS.folder} Open Folder
          </button>
          <button class="agy-mods-btn agy-mods-btn-primary" id="agy-mods-reload">
            ${ICONS.refresh} Apply & Reload
          </button>
        </div>
      </div>

      <div class="agy-mods-screen-content">
        <div class="agy-mods-screen-nav">
          <button class="agy-mods-nav-item active" data-nav="mods">
            <span>Моды</span>
            <span class="agy-mods-nav-count" id="agy-nav-count">0</span>
          </button>
          <button class="agy-mods-nav-item" data-nav="analytics">
            <span>Аналитика</span>
          </button>
          <button class="agy-mods-nav-item" data-nav="settings">
            <span>Настройки лоадера</span>
          </button>
        </div>

        <div class="agy-mods-screen-main" id="agy-screen-main">
          <!-- Dynamically filled -->
        </div>
      </div>
    `;

    if (targetParent !== document.body) {
      const computed = window.getComputedStyle(targetParent);
      if (computed.position === 'static') {
        targetParent.style.position = 'relative';
      }
    }
    targetParent.appendChild(screenEl);

    screenEl.querySelector('#agy-mods-back').addEventListener('click', closeScreen);

    screenEl.querySelector('#agy-mods-devtools').addEventListener('click', () => {
      console.log('__AGY_ACTION__:open-devtools');
      if (window.ModAPI && window.ModAPI.invokeMain) {
        window.ModAPI.invokeMain('manager:open-devtools');
      }
    });

    screenEl.querySelector('#agy-mods-open-folder').addEventListener('click', () => {
      if (window.ModAPI) {
        window.ModAPI.invokeMain('manager:open-mods-folder');
      }
    });

    screenEl.querySelector('#agy-mods-reload').addEventListener('click', () => {
      if (window.ModAPI) {
        window.ModAPI.invokeMain('manager:reload-window');
      } else {
        window.location.reload();
      }
    });

    const navItems = screenEl.querySelectorAll('.agy-mods-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        activeNav = item.getAttribute('data-nav') || 'mods';
        renderContent();
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && screenEl && screenEl.classList.contains('open')) {
        closeScreen();
      }
    });

    return screenEl;
  }

  function renderContent() {
    const container = document.getElementById('agy-screen-main');
    if (!container) return;

    if (activeNav === 'mods') {
      renderModsView(container);
    } else if (activeNav === 'analytics') {
      renderAnalyticsView(container);
    } else if (activeNav === 'settings') {
      renderSettingsView(container);
    }
  }

  async function renderModsView(container) {
    container.innerHTML = `
      <div class="agy-mods-subbar">
        <div class="agy-mods-search-wrap">
          <span class="agy-mods-search-icon">${ICONS.search}</span>
          <input type="text" class="agy-mods-search-input" id="agy-mods-search" placeholder="Поиск по имени или описанию..." value="${currentSearchQuery}">
        </div>
        <div class="agy-mods-filter-pills">
          <button class="agy-mods-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
          <button class="agy-mods-pill ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">Активные</button>
          <button class="agy-mods-pill ${currentFilter === 'disabled' ? 'active' : ''}" data-filter="disabled">Отключенные</button>
        </div>
      </div>
      <div class="agy-mods-list" id="agy-mods-list">
        <div style="color: var(--muted-foreground, #71717A); font-size: 13px; padding: 20px 0;">Загрузка модов...</div>
      </div>
    `;

    const searchInput = container.querySelector('#agy-mods-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        // @ts-ignore
        currentSearchQuery = (e.target.value || '').trim().toLowerCase();
        populateModList();
      });
    }

    const pills = container.querySelectorAll('.agy-mods-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter') || 'all';
        populateModList();
      });
    });

    await populateModList();
  }

  async function populateModList() {
    const listContainer = document.getElementById('agy-mods-list');
    const navCount = document.getElementById('agy-nav-count');
    if (!listContainer) return;

    try {
      let data = window.__AGY_MOD_DATA__ || { mods: [], disabledMods: [] };
      if (window.ModAPI) {
        const res = await window.ModAPI.invokeMain('manager:get-mods');
        if (res && res.mods) data = res;
      }
      const rawMods = data.mods || [];
      const disabled = data.disabledMods || [];

      if (navCount) navCount.textContent = String(rawMods.length);

      const mods = rawMods.filter(m => {
        const isEnabled = !disabled.includes(m.id);
        if (currentFilter === 'active' && !isEnabled) return false;
        if (currentFilter === 'disabled' && isEnabled) return false;

        if (currentSearchQuery) {
          const name = (m.name || m.id || '').toLowerCase();
          const desc = (m.description || '').toLowerCase();
          const author = (m.author || '').toLowerCase();
          if (!name.includes(currentSearchQuery) && !desc.includes(currentSearchQuery) && !author.includes(currentSearchQuery)) {
            return false;
          }
        }
        return true;
      });

      if (rawMods.length === 0) {
        listContainer.innerHTML = `
          <div style="color: var(--muted-foreground, #71717A); font-size: 13px; padding: 30px 0;">
            Нет установленных модов. Папка: <code>~/.antigravity-mods/mods/</code>
          </div>
        `;
        return;
      }

      if (mods.length === 0) {
        listContainer.innerHTML = `
          <div style="color: var(--muted-foreground, #71717A); font-size: 13px; padding: 30px 0;">
            Ничего не найдено по текущему фильтру.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';
      const allSettings = data.modSettings || {};

      for (const m of mods) {
        const isEnabled = !disabled.includes(m.id);
        const card = document.createElement('div');
        card.className = 'agy-mod-card';

        let rawSettings = m.settings;
        let normalizedSettings = [];
        if (Array.isArray(rawSettings)) {
          normalizedSettings = rawSettings;
        } else if (rawSettings && typeof rawSettings === 'object') {
          normalizedSettings = Object.entries(rawSettings).map(([key, def]) => ({
            id: key,
            label: def.title || def.label || key,
            description: def.description || '',
            type: def.type || 'text',
            default: def.default,
            options: def.options,
            min: def.min,
            max: def.max
          }));
        }

        let hasSettings = normalizedSettings.length > 0;
        const currentModSettings = allSettings[m.id] || {};

        let settingsHtml = '';
        if (hasSettings) {
          settingsHtml = `<div class="agy-mod-settings-panel" id="agy-settings-${m.id}">`;
          for (const setting of normalizedSettings) {
            const key = setting.id;
            const title = setting.label || key;
            const desc = setting.description || '';
            const type = setting.type || 'text';
            const val = currentModSettings[key] !== undefined ? currentModSettings[key] : (setting.default !== undefined ? setting.default : '');

            settingsHtml += `
              <div class="agy-setting-row">
                <div class="agy-setting-label">
                  <span class="agy-setting-title">${title}</span>
                  ${desc ? `<span class="agy-setting-desc">${desc}</span>` : ''}
                </div>
                <div class="agy-setting-control">
            `;

            if (type === 'boolean') {
              settingsHtml += `
                <label class="agy-switch">
                  <input type="checkbox" data-mod="${m.id}" data-key="${key}" class="agy-setting-field" ${val ? 'checked' : ''}>
                  <span class="agy-slider"></span>
                </label>
              `;
            } else if (type === 'select' && Array.isArray(setting.options)) {
              settingsHtml += `
                <select data-mod="${m.id}" data-key="${key}" class="agy-setting-select agy-setting-field">
                  ${setting.options.map(opt => {
                    const optVal = typeof opt === 'object' && opt.value !== undefined ? opt.value : opt;
                    const optLabel = typeof opt === 'object' && opt.label !== undefined ? opt.label : optVal;
                    return `<option value="${optVal}" ${String(val) === String(optVal) ? 'selected' : ''}>${optLabel}</option>`;
                  }).join('')}
                </select>
              `;
            } else if (type === 'number') {
              settingsHtml += `
                <input type="number" data-mod="${m.id}" data-key="${key}" class="agy-setting-input agy-setting-field" value="${val}" ${setting.min !== undefined ? `min="${setting.min}"` : ''} ${setting.max !== undefined ? `max="${setting.max}"` : ''} style="width: 70px;">
              `;
            } else {
              settingsHtml += `
                <input type="text" data-mod="${m.id}" data-key="${key}" class="agy-setting-input agy-setting-field" value="${val}" style="width: 160px;">
              `;
            }

            settingsHtml += `
                </div>
              </div>
            `;
          }

          if (m.id !== 'core-mod-manager') {
            settingsHtml += `
              <div class="agy-setting-row agy-setting-danger-row">
                <div class="agy-setting-label">
                  <span class="agy-setting-title" style="color: var(--error, #EF4444);">Удаление мода</span>
                  <span class="agy-setting-desc">Удаляет папку мода из ~/.antigravity-mods/mods/ и очищает настройки.</span>
                </div>
                <div class="agy-setting-control">
                  <button class="agy-mods-btn agy-mods-btn-danger agy-delete-mod-btn" data-mod="${m.id}" data-name="${m.name || m.id}">
                    ${ICONS.trash} Удалить мод
                  </button>
                </div>
              </div>
            `;
          }

          settingsHtml += `</div>`;
        } else if (m.id !== 'core-mod-manager') {
          hasSettings = true;
          settingsHtml = `
            <div class="agy-mod-settings-panel" id="agy-settings-${m.id}">
              <div class="agy-setting-row agy-setting-danger-row">
                <div class="agy-setting-label">
                  <span class="agy-setting-title" style="color: var(--error, #EF4444);">Удаление мода</span>
                  <span class="agy-setting-desc">Удаляет папку мода из ~/.antigravity-mods/mods/ и очищает настройки.</span>
                </div>
                <div class="agy-setting-control">
                  <button class="agy-mods-btn agy-mods-btn-danger agy-delete-mod-btn" data-mod="${m.id}" data-name="${m.name || m.id}">
                    ${ICONS.trash} Удалить мод
                  </button>
                </div>
              </div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="agy-mod-card-main">
            <div class="agy-mod-info">
              <div class="agy-mod-header-row">
                <span class="agy-mod-name">${m.name || m.id}</span>
                <span class="agy-mod-version">v${m.version || '1.0.0'}</span>
                ${m.author ? `<span class="agy-mod-author">by ${m.author}</span>` : ''}
              </div>
              <div class="agy-mod-desc">${m.description || 'Без описания.'}</div>
            </div>
            <div class="agy-mod-actions-wrap">
              ${hasSettings ? `
                <button class="agy-mod-settings-btn" data-target="agy-settings-${m.id}" title="Параметры">
                  ${ICONS.gear}
                </button>
              ` : ''}
              <label class="agy-switch">
                <input type="checkbox" ${isEnabled ? 'checked' : ''} ${m.id === 'core-mod-manager' ? 'disabled' : ''}>
                <span class="agy-slider"></span>
              </label>
            </div>
          </div>
          ${settingsHtml}
        `;

        const checkbox = card.querySelector('.agy-mod-actions-wrap > .agy-switch input');
        if (checkbox) {
          checkbox.addEventListener('change', async (e) => {
            // @ts-ignore
            const checked = e.target.checked;
            if (window.ModAPI) {
              await window.ModAPI.invokeMain('manager:toggle-mod', m.id, checked);
            }
          });
        }

        const gearBtn = card.querySelector('.agy-mod-settings-btn');
        if (gearBtn) {
          gearBtn.addEventListener('click', () => {
            const panel = card.querySelector('.agy-mod-settings-panel');
            if (panel) {
              const isOpen = panel.classList.toggle('open');
              gearBtn.classList.toggle('open', isOpen);
            }
          });
        }

        const settingFields = card.querySelectorAll('.agy-setting-field');
        settingFields.forEach(field => {
          field.addEventListener('change', async (e) => {
            const target = e.target;
            // @ts-ignore
            const modId = target.getAttribute('data-mod');
            // @ts-ignore
            const key = target.getAttribute('data-key');
            // @ts-ignore
            let val = target.type === 'checkbox' ? target.checked : (target.type === 'number' ? Number(target.value) : target.value);

            if (window.ModAPI) {
              await window.ModAPI.invokeMain('manager:save-setting', modId, key, val);
            }
          });
        });

        const deleteBtn = card.querySelector('.agy-delete-mod-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            const modName = deleteBtn.getAttribute('data-name') || m.id;
            const confirmDelete = window.confirm(`Удалить мод «${modName}» безвозвратно?`);
            if (confirmDelete) {
              if (window.ModAPI) {
                await window.ModAPI.invokeMain('manager:delete-mod', m.id);
              }
              card.remove();
              populateModList();
            }
          });
        }

        listContainer.appendChild(card);
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="color: var(--error, #EF4444); padding: 20px 0;">Ошибка загрузки модов: ${err.message}</div>`;
    }
  }

  function renderSettingsView(container) {
    const config = (window.__AGY_MOD_DATA__ && window.__AGY_MOD_DATA__.config) || {};
    const isGlobalEnabled = config.enabled !== false;

    container.innerHTML = `
      <h2 class="agy-section-title">Настройки ModLoader</h2>
      <p class="agy-section-desc">Управление автопатчингом, путями и глобальным состоянием системы модификаций.</p>

      <div class="agy-options-list">
        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">Загрузка модов</span>
            <span class="agy-option-desc">Включает или полностью отключает инъекцию всех модов при старте приложения.</span>
          </div>
          <label class="agy-switch">
            <input type="checkbox" id="agy-opt-enabled" ${isGlobalEnabled ? 'checked' : ''}>
            <span class="agy-slider"></span>
          </label>
        </div>

        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">AutoPatcher ASAR</span>
            <span class="agy-option-desc">Автоматическое поддержание хука в app.asar после официальных обновлений Antigravity.</span>
          </div>
          <span style="font-size: 12px; color: var(--success, #10B981);">Активен</span>
        </div>

        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">Автообновление модлоадера</span>
            <span class="agy-option-desc">Автоматически проверять и тихо загружать обновления с GitHub. Если выключено — показывать диалог с выбором.</span>
          </div>
          <label class="agy-switch">
            <input type="checkbox" id="agy-opt-autoupdate" ${((window.ModAPI && window.ModAPI.getConfig) ? (window.ModAPI.getConfig().autoUpdate !== false) : true) ? 'checked' : ''}>
            <span class="agy-slider"></span>
          </label>
        </div>

        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">Дневной лимит расходов ($)</span>
            <span class="agy-option-desc">Мягкий порог бюджета в день. При превышении 80% контекстный радар в чате меняет цвет на предупреждающий.</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="number" id="agy-opt-daily-budget" min="0" max="100" step="1" value="${(window.ModAPI && window.ModAPI.getSetting) ? (window.ModAPI.getSetting('context-radar', 'dailyBudget', 10) || 10) : 10}" class="agy-setting-input" style="width:60px;">
            <span style="font-size:12px; color:var(--muted-foreground)">USD</span>
          </div>
        </div>

        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">Рабочая папка модов</span>
            <span class="agy-option-desc">%USERPROFILE%\\.antigravity-mods\\mods</span>
          </div>
          <button class="agy-mods-btn" id="agy-opt-open-dir">Открыть</button>
        </div>

        <div class="agy-option-item">
          <div class="agy-option-text">
            <span class="agy-option-title">Версия загрузчика</span>
            <span class="agy-option-desc">Antigravity ModLoader Core v1.1.0</span>
          </div>
          <span style="font-size: 12px; color: var(--muted-foreground, #71717A);">1.1.0</span>
        </div>
      </div>
    `;

    const openDirBtn = container.querySelector('#agy-opt-open-dir');
    if (openDirBtn) {
      openDirBtn.addEventListener('click', () => {
        if (window.ModAPI) window.ModAPI.invokeMain('manager:open-mods-folder');
      });
    }

    const budgetInput = container.querySelector('#agy-opt-daily-budget');
    if (budgetInput) {
      budgetInput.addEventListener('change', async (e) => {
        // @ts-ignore
        const val = Number(e.target.value) || 0;
        if (window.ModAPI) {
          await window.ModAPI.invokeMain('manager:save-setting', 'context-radar', 'dailyBudget', val);
          if (window.updateRadarUI) window.updateRadarUI();
        }
      });
    }

    const autoUpdateToggle = container.querySelector('#agy-opt-autoupdate');
    if (autoUpdateToggle) {
      autoUpdateToggle.addEventListener('change', async (e) => {
        // @ts-ignore
        const checked = e.target.checked;
        if (window.ModAPI) {
          await window.ModAPI.invokeMain('manager:save-loader-config', 'autoUpdate', checked);
        }
      });
    }

    const enabledToggle = container.querySelector('#agy-opt-enabled');
    if (enabledToggle) {
      enabledToggle.addEventListener('change', async (e) => {
        // @ts-ignore
        const checked = e.target.checked;
        if (window.ModAPI) {
          await window.ModAPI.invokeMain('manager:save-loader-config', 'enabled', checked);
        }
      });
    }
  }

  function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(Math.round(num));
  }

  function formatCost(usd) {
    if (usd < 0.01 && usd > 0) return '<$0.01';
    return '$' + usd.toFixed(2);
  }

  async function renderAnalyticsView(container) {
    container.innerHTML = `
      <div class="agy-analytics-header">
        <div>
          <h2 class="agy-section-title">Token & Cost Analytics</h2>
          <p class="agy-section-desc">Суммарный расход токенов, эффективность кэширования, затраты и динамика по сессиям.</p>
        </div>
        <div class="agy-analytics-actions">
          <div class="agy-date-filter-group">
            <button class="agy-date-btn ${analyticsDateRange === 'all' ? 'active' : ''}" data-range="all">Всё время</button>
            <button class="agy-date-btn ${analyticsDateRange === '30d' ? 'active' : ''}" data-range="30d">30 дней</button>
            <button class="agy-date-btn ${analyticsDateRange === '7d' ? 'active' : ''}" data-range="7d">7 дней</button>
            <button class="agy-date-btn ${analyticsDateRange === 'today' ? 'active' : ''}" data-range="today">Сегодня</button>
          </div>
          <button class="agy-mods-btn" id="agy-analytics-refresh">
            ${ICONS.refresh} Обновить
          </button>
        </div>
      </div>
      <div id="agy-analytics-content">
        <div style="color: var(--muted-foreground, #71717A); font-size: 13px; padding: 40px 0;">Анализ истории запросов и логов...</div>
      </div>
    `;

    const dateBtns = container.querySelectorAll('.agy-date-btn');
    dateBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        analyticsDateRange = btn.getAttribute('data-range') || 'all';
        renderAnalyticsView(container);
      });
    });

    const refreshBtn = container.querySelector('#agy-analytics-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        window.__AGY_ANALYTICS_DATA__ = null;
        renderAnalyticsView(container);
      });
    }

    let data = window.__AGY_ANALYTICS_DATA__;
    // Всегда запрашиваем свежие данные из логов при входе на вкладку или по кнопке
    if (window.ModAPI) {
      data = await window.ModAPI.invokeMain('analytics:get-data');
      if (data) {
        window.__AGY_ANALYTICS_DATA__ = data;
      }
    }

    const contentEl = container.querySelector('#agy-analytics-content');
    if (!contentEl) return;

    if (!data || !data.stepCount) {
      contentEl.innerHTML = `
        <div class="agy-analytics-empty">
          <div style="font-size: 14px; font-weight: 500; color: var(--foreground, #FFFFFF);">Нет данных аналитики</div>
          <div style="font-size: 12px; color: var(--muted-foreground, #71717A); margin-top: 4px;">История шагов пуста или логи транскрипта пока не сформированы.</div>
        </div>
      `;
      return;
    }

    const totalIn = data.totalInput || 0;
    const totalCached = data.totalCached || 0;
    const totalOut = data.totalOutput || 0;
    const totalProcessed = totalIn + totalCached + totalOut;
    const totalRequests = data.stepCount || 1;

    // Cache hit efficiency %
    const totalInputAndCache = totalIn + totalCached;
    const cacheHitRate = totalInputAndCache > 0 ? ((totalCached / totalInputAndCache) * 100).toFixed(1) : '0';

    // Pricing calculation (Standard Flash rates: $0.10/M input, $0.025/M cached input, $0.40/M output)
    const costIn = (totalIn / 1000000) * 0.10;
    const costCached = (totalCached / 1000000) * 0.025;
    const costOut = (totalOut / 1000000) * 0.40;
    const totalEstimatedCost = costIn + costCached + costOut;

    // Saved by caching
    const savedByCacheUsd = (totalCached / 1000000) * (0.10 - 0.025);

    // Averages
    const avgTokensPerReq = Math.round(totalProcessed / totalRequests);
    const avgOutPerReq = Math.round(totalOut / totalRequests);

    const dailyEntries = Object.entries(data.dailyStats || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const daysCount = dailyEntries.length || 1;
    const avgTokensPerDay = Math.round(totalProcessed / daysCount);
    const avgCostPerDay = totalEstimatedCost / daysCount;

    // Last 14 days chart
    const recentDays = dailyEntries.slice(-14);
    const maxDayTokens = Math.max(...recentDays.map(([_, s]) => (s.input + s.cached + s.output)), 1);

    const chartBarsHtml = recentDays.map(([day, stat]) => {
      const dayTotal = stat.input + stat.cached + stat.output;
      const heightPercent = Math.max(6, Math.min(100, Math.round((dayTotal / maxDayTokens) * 100)));
      const shortDate = day.slice(5); // MM-DD
      const dayCachedPercent = dayTotal > 0 ? Math.round((stat.cached / dayTotal) * 100) : 0;
      return `
        <div class="agy-chart-col" title="${day}: ${formatNumber(dayTotal)} токенов (${stat.requests} req, кэш ${dayCachedPercent}%)">
          <div class="agy-chart-bar-wrap">
            <div class="agy-chart-bar" style="height: ${heightPercent}%;">
              <div class="agy-chart-bar-cached" style="height: ${dayCachedPercent}%;"></div>
            </div>
          </div>
          <span class="agy-chart-label">${shortDate}</span>
        </div>
      `;
    }).join('');

    // Models breakdown list
    const modelEntries = Object.entries(data.modelBreakdown || {}).sort((a, b) => {
      const totalA = a[1].input + a[1].cached + a[1].output;
      const totalB = b[1].input + b[1].cached + b[1].output;
      return totalB - totalA;
    });

    const modelsHtml = modelEntries.map(([modelName, mStat]) => {
      const mTotal = mStat.input + mStat.cached + mStat.output;
      const mShare = totalProcessed > 0 ? ((mTotal / totalProcessed) * 100).toFixed(1) : '0';
      const mCost = ((mStat.input / 1000000) * 0.10) + ((mStat.cached / 1000000) * 0.025) + ((mStat.output / 1000000) * 0.40);
      return `
        <div class="agy-model-stat-row">
          <div class="agy-model-info">
            <div class="agy-model-name-wrap">
              <span class="agy-model-name">${modelName}</span>
              <span class="agy-model-count">${mStat.count.toLocaleString()} вызовов · ${mShare}%</span>
            </div>
            <div class="agy-model-progress-bar">
              <div class="agy-model-progress-fill" style="width: ${mShare}%;"></div>
            </div>
          </div>
          <div class="agy-model-tokens">
            <div class="agy-model-total-tok">${formatNumber(mTotal)} tok</div>
            <div class="agy-model-sub-tok">in: ${formatNumber(mStat.input)} · cache: ${formatNumber(mStat.cached)} · out: ${formatNumber(mStat.output)}</div>
          </div>
          <div class="agy-model-cost">${formatCost(mCost)}</div>
        </div>
      `;
    }).join('');

    // Hourly Heatmap (24 hours)
    const hourlyStats = data.hourlyStats || new Array(24).fill(0);
    const maxHourCalls = Math.max(...hourlyStats, 1);
    const hourlyHtml = hourlyStats.map((count, h) => {
      const intensity = count > 0 ? Math.max(0.12, (count / maxHourCalls)) : 0;
      const formattedH = (h < 10 ? '0' : '') + h + ':00';
      return `
        <div class="agy-hour-col" title="${formattedH} — ${count} вызовов">
          <div class="agy-hour-box" style="background: ${count > 0 ? `rgba(56, 189, 248, ${intensity})` : 'rgba(255,255,255,0.03)'};"></div>
          <span class="agy-hour-lbl">${h % 3 === 0 ? h : ''}</span>
        </div>
      `;
    }).join('');

    // Tools breakdown list
    const toolEntries = Object.entries(data.toolsBreakdown || {}).sort((a, b) => b[1] - a[1]);
    const totalTools = data.totalToolCalls || toolEntries.reduce((acc, cur) => acc + cur[1], 0) || 1;
    const toolsHtml = toolEntries.map(([tName, tCount]) => {
      const tShare = ((tCount / totalTools) * 100).toFixed(1);
      return `
        <div class="agy-tool-row">
          <div class="agy-tool-info">
            <div class="agy-tool-header">
              <span class="agy-tool-name">${tName}</span>
              <span class="agy-tool-count">${tCount.toLocaleString()} (${tShare}%)</span>
            </div>
            <div class="agy-tool-bar">
              <div class="agy-tool-fill" style="width: ${tShare}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Heaviest Sessions table
    const heavyList = data.heavySessions || [];
    const sessionsHtml = heavyList.map((s, idx) => {
      const sCost = (s.tokens / 1000000) * 0.03; // blended avg
      return `
        <div class="agy-session-row agy-session-clickable" data-convoid="${s.id}">
          <div class="agy-session-rank">#${idx + 1}</div>
          <div class="agy-session-details">
            <div class="agy-session-title">${s.title}</div>
            <div class="agy-session-meta">${s.steps} шагов · ${s.tools} вызовов инструментов</div>
          </div>
          <div class="agy-session-tokens">
            <div class="agy-session-val">${formatNumber(s.tokens)} tok</div>
            <div class="agy-session-sub">~${formatCost(sCost)}</div>
          </div>
          <button class="agy-session-dive-btn" data-dive="${s.id}" title="Детальный аудит сессии">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Cost without prompt caching
    const costWithoutCache = (totalProcessed / 1000000) * 0.10;
    const savingsPercent = costWithoutCache > 0 ? (((costWithoutCache - totalEstimatedCost) / costWithoutCache) * 100).toFixed(1) : '0';

    contentEl.innerHTML = `
      <div class="agy-analytics-grid">
        <div class="agy-stat-card">
          <span class="agy-stat-title">Всего токенов</span>
          <div class="agy-stat-val">${formatNumber(totalProcessed)}</div>
          <div class="agy-stat-sub">
            <span>In: ${formatNumber(totalIn)}</span> · <span>Out: ${formatNumber(totalOut)}</span>
          </div>
        </div>

        <div class="agy-stat-card">
          <span class="agy-stat-title">Контекстный кэш</span>
          <div class="agy-stat-val text-primary">${formatNumber(totalCached)}</div>
          <div class="agy-stat-sub">
            <span class="agy-badge-success">${cacheHitRate}% попаданий</span> · экон. ~${formatCost(savedByCacheUsd)}
          </div>
        </div>

        <div class="agy-stat-card">
          <span class="agy-stat-title">Ориентировочная стоимость</span>
          <div class="agy-stat-val">${formatCost(totalEstimatedCost)}</div>
          <div class="agy-stat-sub">По стандартным Flash-тарифам Google</div>
        </div>

        <div class="agy-stat-card">
          <span class="agy-stat-title">Запросов модели</span>
          <div class="agy-stat-val">${totalRequests.toLocaleString()}</div>
          <div class="agy-stat-sub">В среднем ~${formatNumber(avgTokensPerReq)} tok/req</div>
        </div>
      </div>

      <!-- Cache Savings Banner -->
      <div class="agy-savings-banner">
        <div class="agy-savings-text">
          Без контекстного кэширования этот объем стоил бы <strong style="color:var(--foreground)">${formatCost(costWithoutCache)}</strong>. 
          Благодаря Prompt Caching сэкономлено <strong style="color:#34D399">${formatCost(savedByCacheUsd)} (${savingsPercent}%)</strong>.
        </div>
      </div>

      <div class="agy-analytics-row">
        <div class="agy-card-box agy-chart-box">
          <div class="agy-box-header">
            <div class="agy-box-title">Динамика использования (последние 14 дней)</div>
            <div class="agy-box-legend">
              <span class="agy-legend-item"><span class="agy-legend-dot"></span> Прямой ввод/вывод</span>
              <span class="agy-legend-item"><span class="agy-legend-dot agy-dot-cache"></span> Кэш токенов</span>
            </div>
          </div>
          <div class="agy-chart-container">
            ${chartBarsHtml}
          </div>
        </div>

        <div class="agy-card-box agy-averages-box">
          <div class="agy-box-title">Средние метрики</div>
          <div class="agy-avg-list">
            <div class="agy-avg-row">
              <span class="agy-avg-label">Токенов в день</span>
              <span class="agy-avg-val">${formatNumber(avgTokensPerDay)}</span>
            </div>
            <div class="agy-avg-row">
              <span class="agy-avg-label">Затраты в день</span>
              <span class="agy-avg-val">${formatCost(avgCostPerDay)}</span>
            </div>
            <div class="agy-avg-row">
              <span class="agy-avg-label">Ответ модели / шаг</span>
              <span class="agy-avg-val">${formatNumber(avgOutPerReq)} tok</span>
            </div>
            <div class="agy-avg-row">
              <span class="agy-avg-label">Вызовов тулов на шаг</span>
              <span class="agy-avg-val">${(totalTools / totalRequests).toFixed(2)}</span>
            </div>
            <div class="agy-avg-row">
              <span class="agy-avg-label">Ср. длина CoT (мышления)</span>
              <span class="agy-avg-val">${data.avgThinkingChars || 0} симв.</span>
            </div>
            <div class="agy-avg-row">
              <span class="agy-avg-label">Активных дней</span>
              <span class="agy-avg-val">${daysCount} дн.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Heatmap (By Hours) -->
      <div class="agy-card-box" style="margin-top: 12px;">
        <div class="agy-box-header" style="margin-bottom: 8px;">
          <div class="agy-box-title">Суточная активность (распределение вызовов по часам, 00:00 — 23:00)</div>
          <div style="font-size: 11px; color: var(--muted-foreground, #71717A);">Всего шагов: ${totalRequests.toLocaleString()}</div>
        </div>
        <div class="agy-hourly-container">
          ${hourlyHtml}
        </div>
      </div>

      <!-- 2-column: Models & Tools -->
      <div class="agy-analytics-row" style="margin-top: 12px;">
        <div class="agy-card-box">
          <div class="agy-box-title" style="margin-bottom: 12px;">Расход по моделям</div>
          <div class="agy-models-list">
            ${modelsHtml}
          </div>
        </div>

        <div class="agy-card-box">
          <div class="agy-box-header" style="margin-bottom: 12px;">
            <div class="agy-box-title">Вызовы инструментов</div>
            <div style="font-size: 11px; color: var(--muted-foreground, #71717A);">${totalTools.toLocaleString()} всего</div>
          </div>
          <div class="agy-tools-list">
            ${toolsHtml}
          </div>
        </div>
      </div>

      <!-- Heaviest Sessions -->
      <div class="agy-card-box" style="margin-top: 12px;">
        <div class="agy-box-header" style="margin-bottom: 12px;">
          <div class="agy-box-title">Топ-10 самых ресурсоемких сессий</div>
          <div style="font-size: 11px; color: var(--muted-foreground, #71717A);">Клик по диалогу открывает чат</div>
        </div>
        <div class="agy-sessions-list">
          ${sessionsHtml}
        </div>
      </div>
    `;

    // Click handler for Session Deep Dive
    const diveBtns = contentEl.querySelectorAll('.agy-session-dive-btn');
    diveBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const convoId = btn.getAttribute('data-dive');
        if (!convoId) return;
        showSessionDeepDiveModal(convoId);
      });
    });

    // Click handler to switch conversations
    const sessionRows = contentEl.querySelectorAll('.agy-session-clickable');
    sessionRows.forEach(row => {
      row.addEventListener('click', (e) => {
        // @ts-ignore
        if (e.target.closest('.agy-session-dive-btn')) return;
        const convoId = row.getAttribute('data-convoid');
        if (!convoId) return;

        // Try 1: Click existing item in sidebar if visible
        const sidebarLink = document.querySelector(`a[href*="/c/${convoId}"], div[data-conversation-id="${convoId}"]`);
        if (sidebarLink) {
          sidebarLink.click();
          closeScreen();
          return;
        }

        // Try 2: HTML5 History API pushState
        try {
          const currentUrl = new URL(window.location.href);
          currentUrl.pathname = `/c/${convoId}`;
          window.history.pushState({}, '', currentUrl.toString());
          window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('agy:switch-conversation', { detail: { convoId } }));
        closeScreen();
      });
    });
  }

  async function showSessionDeepDiveModal(convoId) {
    let modal = document.getElementById('agy-deep-dive-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'agy-deep-dive-modal';
      modal.className = 'agy-modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="agy-modal-card">
        <div class="agy-modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:600; font-size:14px; color:var(--foreground)">Аудит сессии</span>
            <span style="font-size:11px; color:var(--muted-foreground); font-family:monospace;">${convoId.slice(0, 12)}...</span>
          </div>
          <button class="agy-modal-close-btn" id="agy-dive-close">✕</button>
        </div>
        <div class="agy-modal-body" id="agy-dive-body">
          <div style="color:var(--muted-foreground); font-size:12px; padding:20px 0;">Анализ хронологии и вызовов инструментов...</div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    modal.querySelector('#agy-dive-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    let diveData = null;
    if (window.ModAPI) {
      diveData = await window.ModAPI.invokeMain('analytics:session-deep-dive', convoId);
    }

    const bodyEl = modal.querySelector('#agy-dive-body');
    if (!bodyEl) return;

    if (!diveData || !diveData.steps) {
      bodyEl.innerHTML = `<div style="color:var(--muted-foreground); font-size:12px;">Не удалось прочитать детали сессии.</div>`;
      return;
    }

    const timelinePoints = (diveData.timeline || []).map((pt, i) => {
      return `<div class="agy-dive-point" title="${pt.time}: ${formatNumber(pt.tokens)} tok" style="height:${Math.max(10, Math.min(100, Math.round((pt.tokens / 100000) * 100)))}%;"></div>`;
    }).join('');

    const cmdList = (diveData.commands || []).map(c => `
      <div class="agy-dive-cmd-item">
        <span class="agy-dive-cmd-summary">${c.summary || 'Command'}</span>
        <code class="agy-dive-code">${(c.cmd || '').replace(/\\"/g, '"').slice(0, 110)}</code>
      </div>
    `).join('');

    const fileList = (diveData.files || []).map(f => `
      <div class="agy-dive-file-item">
        <span class="agy-dive-file-name">${f.split(/\\\\|\//).pop()}</span>
        <span class="agy-dive-file-path">${f}</span>
      </div>
    `).join('');

    bodyEl.innerHTML = `
      <div class="agy-dive-summary-row">
        <div><span style="color:var(--muted-foreground); font-size:11px;">Шагов:</span> <strong>${diveData.steps}</strong></div>
        <div><span style="color:var(--muted-foreground); font-size:11px;">Токенов:</span> <strong>${formatNumber(diveData.totalTokens)}</strong></div>
        <div><span style="color:var(--muted-foreground); font-size:11px;">Кэш:</span> <strong style="color:#34D399">${formatNumber(diveData.cachedTokens)}</strong></div>
        <div><span style="color:var(--muted-foreground); font-size:11px;">Команд:</span> <strong>${diveData.commandsCount}</strong></div>
        <div><span style="color:var(--muted-foreground); font-size:11px;">Файлов:</span> <strong>${diveData.filesCount}</strong></div>
      </div>

      <div style="font-size:12px; font-weight:500; margin:14px 0 6px 0; color:var(--foreground);">Хронология потребления контекста</div>
      <div class="agy-dive-timeline-box">${timelinePoints}</div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;">
        <div>
          <div style="font-size:12px; font-weight:500; margin-bottom:6px; color:var(--foreground);">Запущенные команды (${diveData.commandsCount})</div>
          <div class="agy-dive-scroll-box">${cmdList || '<div style="color:var(--muted-foreground); font-size:11px;">Нет команд</div>'}</div>
        </div>
        <div>
          <div style="font-size:12px; font-weight:500; margin-bottom:6px; color:var(--foreground);">Затронутые файлы (${diveData.filesCount})</div>
          <div class="agy-dive-scroll-box">${fileList || '<div style="color:var(--muted-foreground); font-size:11px;">Нет файлов</div>'}</div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button class="agy-mods-btn" id="agy-dive-export-json">Экспорт JSON</button>
        <button class="agy-mods-btn agy-mods-btn-primary" id="agy-dive-export-md">Экспорт Markdown</button>
      </div>
    `;

    bodyEl.querySelector('#agy-dive-export-json').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(diveData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${convoId}-audit.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    bodyEl.querySelector('#agy-dive-export-md').addEventListener('click', () => {
      let md = `# Аудит сессии: ${convoId}\n\n`;
      md += `- **Шагов**: ${diveData.steps}\n`;
      md += `- **Всего токенов**: ${diveData.totalTokens} (Кэш: ${diveData.cachedTokens})\n`;
      md += `- **Выполнено команд**: ${diveData.commandsCount}\n`;
      md += `- **Файлов затронуто**: ${diveData.filesCount}\n\n`;
      md += `## Команды терминала\n\n`;
      (diveData.commands || []).forEach(c => {
        md += `### ${c.summary || 'Command'} (${c.time})\n\`\`\`powershell\n${c.cmd}\n\`\`\`\n\n`;
      });
      md += `## Файлы\n\n`;
      (diveData.files || []).forEach(f => {
        md += `- \`${f}\`\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${convoId}-audit.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function openScreen() {
    const screen = createScreen();
    screen.style.display = 'flex';
    renderContent();
    screen.classList.add('open');

    const tab = document.getElementById('agy-mods-sidebar-tab');
    if (tab) setSidebarActive(tab, true);
  }

  function closeScreen() {
    if (screenEl) {
      screenEl.classList.remove('open');
      screenEl.style.display = 'none';
    }
    const tab = document.getElementById('agy-mods-sidebar-tab');
    if (tab) setSidebarActive(tab, false);
  }

  function setSidebarActive(el, active) {
    if (active) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  }

  function injectSidebarItem() {
    if (document.getElementById('agy-mods-sidebar-tab')) return;

    // Direct search: by href / text / class
    let currentRow = document.querySelector('a[href*="/customizations"], div[data-testid*="customization"]');

    if (!currentRow) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const val = (node.nodeValue || '').trim().toLowerCase();
        if (val === 'customizations' || val === 'пользовательские настройки' || val === 'настройки') {
          // Verify it is in the left sidebar
          let parent = node.parentElement;
          while (parent && parent !== document.body) {
            const txt = parent.textContent || '';
            if (txt.includes('Automations') || txt.includes('Автоматизации') || txt.includes('Conversation') || txt.includes('Диалог')) {
              currentRow = node.parentElement;
              break;
            }
            parent = parent.parentElement;
          }
          if (currentRow) break;
        }
      }
    }

    if (!currentRow) return;

    let listParent = null;
    let p = currentRow.parentElement;
    while (p && p !== document.body) {
      if (p.children.length >= 2) {
        listParent = p;
        break;
      }
      currentRow = p;
      p = p.parentElement;
    }

    if (!currentRow || !listParent) return;

    const modRow = /** @type {HTMLElement} */ (currentRow.cloneNode(true));
    modRow.id = 'agy-mods-sidebar-tab';

    // Remove active styles from the cloned row
    modRow.classList.remove('active', 'bg-secondary', 'text-foreground');
    modRow.removeAttribute('aria-current');

    const cloneWalker = document.createTreeWalker(modRow, NodeFilter.SHOW_TEXT);
    let cNode;
    while ((cNode = cloneWalker.nextNode())) {
      const v = (cNode.nodeValue || '').trim().toLowerCase();
      if (v === 'customizations' || v === 'пользовательские настройки' || v === 'настройки') {
        cNode.nodeValue = 'Mods';
        break;
      }
    }

    const svg = modRow.querySelector('svg');
    if (svg) {
      svg.outerHTML = ICONS.puzzle;
    }

    modRow.style.cursor = 'pointer';
    modRow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openScreen();
    });

    if (currentRow.nextSibling) {
      listParent.insertBefore(modRow, currentRow.nextSibling);
    } else {
      listParent.appendChild(modRow);
    }

    console.log('[Core Mod Manager] Injected independent Mods button.');
  }

  function init() {
    createScreen();
    injectSidebarItem();

    const fastCheck = setInterval(() => {
      if (!document.getElementById('agy-mods-sidebar-tab')) {
        injectSidebarItem();
      } else {
        clearInterval(fastCheck);
      }
    }, 150);

    document.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const tab = document.getElementById('agy-mods-sidebar-tab');
      if (tab && !tab.contains(target) && screenEl && screenEl.classList.contains('open')) {
        const isOutsideScreen = !screenEl.contains(target);
        if (isOutsideScreen) {
          closeScreen();
        }
      }
    }, true);

    // Слушатель фонового уведомления о новой версии от main process
    try {
      const electron = window.require ? window.require('electron') : null;
      if (electron && electron.ipcRenderer) {
        electron.ipcRenderer.on('modloader:update-available', (event, data) => {
          showUpdateNotification(data);
        });
      }
    } catch (_) {}
  }

  function showUpdateNotification(data) {
    if (!data || document.getElementById('agy-update-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'agy-update-modal';
    modal.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 100000;
      width: 360px;
      background: #090D14;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:8px; height:8px; border-radius:50%; background:#38BDF8; box-shadow:0 0 10px #38BDF8;"></span>
          <span style="font-size:13px; font-weight:600; color:#FFFFFF;">Доступно обновление</span>
        </div>
        <span style="font-size:11px; font-weight:600; color:#38BDF8; background:rgba(56,189,248,0.1); padding:2px 7px; border-radius:4px;">v\${data.latestVer}</span>
      </div>
      <div style="font-size:12px; color:#94A3B8; line-height:1.4;">
        Вышла новая версия <b>v\${data.latestVer}</b> (текущая: v\${data.currentVer}). Хотите обновить компоненты модлоадера?
      </div>
      <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:4px;">
        <button id="agy-update-ignore" style="background:transparent; border:none; color:#64748B; font-size:11.5px; cursor:pointer; padding:6px 10px; border-radius:6px; transition:color 0.15s;">Не показывать больше</button>
        <button id="agy-update-now" style="background:linear-gradient(180deg, #0284C7 0%, #0369A1 100%); border:1px solid rgba(255,255,255,0.15); color:#FFFFFF; font-size:12px; font-weight:500; cursor:pointer; padding:6px 14px; border-radius:7px; box-shadow:0 2px 8px rgba(2,132,199,0.4);">Обновить</button>
      </div>
    `;

    document.body.appendChild(modal);

    const btnNow = modal.querySelector('#agy-update-now');
    const btnIgnore = modal.querySelector('#agy-update-ignore');

    if (btnNow) {
      btnNow.addEventListener('click', async () => {
        // @ts-ignore
        btnNow.textContent = 'Обновление...';
        // @ts-ignore
        btnNow.style.pointerEvents = 'none';
        try {
          const electron = window.require ? window.require('electron') : null;
          if (electron && electron.ipcRenderer) {
            const res = await electron.ipcRenderer.invoke('modloader:apply-update', {
              downloadUrl: data.downloadUrl,
              targetVer: data.latestVer
            });
            if (res && res.success) {
              // @ts-ignore
              btnNow.textContent = 'Готово! (Перезапустите IDE)';
              setTimeout(() => modal.remove(), 2500);
            } else {
              // @ts-ignore
              btnNow.textContent = 'Ошибка';
            }
          }
        } catch (_) {}
      });
    }

    if (btnIgnore) {
      btnIgnore.addEventListener('click', async () => {
        try {
          const electron = window.require ? window.require('electron') : null;
          if (electron && electron.ipcRenderer) {
            await electron.ipcRenderer.invoke('modloader:ignore-version', data.latestVer);
          }
        } catch (_) {}
        modal.remove();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
