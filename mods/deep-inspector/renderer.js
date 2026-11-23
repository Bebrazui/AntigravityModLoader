// @ts-check
(function() {
  console.log('[DeepInspector] Initializing Prompt & Stream Lens...');

  let activeData = null;
  let currentTab = 'all'; // 'all', 'system', 'model', 'tools'
  let selectedIndex = 0;
  let modalEl = null;

  const ICONS = {
    eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    refresh: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`,
    copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };

  // 1. Inject Floating Button (Always Accessible in bottom right or header)
  function injectTriggerButton() {
    if (document.getElementById('agy-inspector-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'agy-inspector-btn';
    btn.innerHTML = `${ICONS.eye} <span>INSPECTOR</span>`;
    btn.title = 'Открыть полный рентген сессии (Ctrl+Alt+P / Ctrl+Shift+D)';

    btn.style.position = 'fixed';
    btn.style.bottom = '12px';
    btn.style.right = '240px';
    btn.style.zIndex = '99998';

    btn.addEventListener('click', () => {
      openModal();
    });

    document.body.appendChild(btn);
  }

  // 2. Build Modal Window
  function createModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'agy-insp-overlay';
    modalEl.innerHTML = `
      <div class="agy-insp-window">
        <div class="agy-insp-header">
          <div class="agy-insp-title-wrap">
            <div class="agy-insp-title">
              ${ICONS.eye} Deep Prompt & Model Inspector
            </div>
            <span class="agy-insp-badge" id="agy-insp-convo-badge">SESSION</span>
          </div>

          <div class="agy-insp-nav">
            <button class="agy-insp-tab active" data-tab="all">Все шаги</button>
            <button class="agy-insp-tab" data-tab="system">Системные правила</button>
            <button class="agy-insp-tab" data-tab="model">Ответы Модели</button>
            <button class="agy-insp-tab" data-tab="tools">Инструменты (Tools)</button>
          </div>

          <div class="agy-insp-actions">
            <button class="agy-insp-icon-btn" id="agy-insp-copy" title="Копировать в буфер">
              ${ICONS.copy}
            </button>
            <button class="agy-insp-icon-btn" id="agy-insp-refresh" title="Обновить лог">
              ${ICONS.refresh}
            </button>
            <button class="agy-insp-icon-btn" id="agy-insp-close" title="Закрыть">
              ${ICONS.close}
            </button>
          </div>
        </div>

        <div class="agy-insp-body">
          <div class="agy-insp-sidebar">
            <div class="agy-insp-search">
              <input type="text" id="agy-insp-filter-input" placeholder="Поиск по тексту или инструменту...">
            </div>
            <div class="agy-insp-list" id="agy-insp-steps-list">
              <div style="padding: 20px; color: #71717A; font-size: 11px; text-align: center;">Загрузка данных...</div>
            </div>
          </div>

          <div class="agy-insp-content">
            <div class="agy-insp-detail-header" id="agy-insp-detail-header">
              <div class="agy-insp-meta" id="agy-insp-detail-meta">
                <span>Выберите шаг для инспекции</span>
              </div>
            </div>
            <div class="agy-insp-raw-view" id="agy-insp-raw-view">
              // Сырой вывод появится здесь
            </div>
          </div>
        </div>

        <div class="agy-insp-footer">
          <span id="agy-insp-footer-left">0 шагов загружено</span>
          <span>Antigravity Deep Inspector v1.0.0</span>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.querySelector('#agy-insp-close').addEventListener('click', closeModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });

    modalEl.querySelector('#agy-insp-refresh').addEventListener('click', () => {
      fetchData();
    });

    modalEl.querySelector('#agy-insp-copy').addEventListener('click', () => {
      const view = document.getElementById('agy-insp-raw-view');
      if (view && view.textContent) {
        navigator.clipboard.writeText(view.textContent);
        const copyBtn = modalEl.querySelector('#agy-insp-copy');
        copyBtn.style.color = '#38BDF8';
        setTimeout(() => { copyBtn.style.color = ''; }, 1000);
      }
    });

    const tabs = modalEl.querySelectorAll('.agy-insp-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.getAttribute('data-tab');
        renderSidebarList();
      });
    });

    const filterInput = modalEl.querySelector('#agy-insp-filter-input');
    filterInput.addEventListener('input', () => {
      renderSidebarList();
    });

    return modalEl;
  }

  function openModal() {
    createModal();
    modalEl.classList.add('open');
    fetchData();
  }

  function closeModal() {
    if (modalEl) modalEl.classList.remove('open');
  }

  // Dual data fetcher: window.__AGY_INSPECTOR_DATA__ + IPC invoke + Cache fallback
  async function fetchData() {
    // 0. Check directly injected cache
    if (window.__AGY_INSPECTOR_DATA__ && window.__AGY_INSPECTOR_DATA__.steps && window.__AGY_INSPECTOR_DATA__.steps.length > 0) {
      activeData = window.__AGY_INSPECTOR_DATA__;
      renderAll();
    }

    // 1. Try IPC channel directly
    if (window.ModAPI && window.ModAPI.invokeMain) {
      try {
        const res = await window.ModAPI.invokeMain('inspector:read-cache');
        if (res && res.steps && res.steps.length > 0) {
          activeData = res;
          renderAll();
          return;
        }
      } catch (e) {}

      // Trigger fresh dump from main process
      window.ModAPI.invokeMain('inspector:get-data');
    }

    // 2. Poll for cache update or response
    setTimeout(async () => {
      if (window.ModAPI && window.ModAPI.invokeMain) {
        try {
          const res = await window.ModAPI.invokeMain('inspector:read-cache');
          if (res) {
            activeData = res;
            renderAll();
          }
        } catch (e) {}
      }
    }, 300);
  }

  // Listen for push notifications from main injector
  window.addEventListener('agy-inspector-updated', () => {
    fetchData();
  });

  window.addEventListener('agy-inspector-data', (e) => {
    // @ts-ignore
    activeData = e.detail;
    renderAll();
  });

  function renderAll() {
    if (!activeData) return;

    const badge = document.getElementById('agy-insp-convo-badge');
    if (badge) badge.textContent = activeData.convoId ? activeData.convoId.substring(0, 8) : 'SESSION';

    const footer = document.getElementById('agy-insp-footer-left');
    if (footer) footer.textContent = `${activeData.totalSteps || 0} шагов, ${activeData.rules?.length || 0} правил, ${activeData.skills?.length || 0} навыков`;

    renderSidebarList();
  }

  function getFilteredItems() {
    if (!activeData) return [];

    const search = (document.getElementById('agy-insp-filter-input')?.value || '').toLowerCase();
    let items = [];

    if (currentTab === 'system') {
      (activeData.rules || []).forEach((r, idx) => {
        items.push({
          type: 'SYSTEM_RULE',
          label: r.name,
          source: 'SYSTEM',
          content: r.content,
          _raw: r,
          _idx: `rule-${idx}`
        });
      });

      (activeData.skills || []).forEach((s, idx) => {
        items.push({
          type: 'SKILL',
          label: `Skill: ${s.id}`,
          source: 'SYSTEM',
          content: s.content,
          _raw: s,
          _idx: `skill-${idx}`
        });
      });
    } else {
      const steps = activeData.steps || [];
      steps.forEach((s, idx) => {
        const isModel = s.source === 'MODEL';
        const isUser = s.source === 'USER_EXPLICIT';
        const hasTools = !!(s.tool_calls && s.tool_calls.length);

        if (currentTab === 'model' && !isModel) return;
        if (currentTab === 'tools' && !hasTools) return;

        let displayLabel = '';
        if (hasTools) {
          const callNames = s.tool_calls.map(tc => tc.tool_name || tc.name || 'tool').join(', ');
          displayLabel = `⚡ ${callNames}`;
        } else if (s.content) {
          displayLabel = s.content.trim().substring(0, 50).replace(/\n/g, ' ');
        } else {
          displayLabel = s.type || s.source || 'Step';
        }

        items.push({
          type: hasTools ? 'TOOL_CALL' : (s.type || s.source),
          label: displayLabel,
          source: s.source,
          content: s.content || '',
          _raw: s,
          _idx: idx
        });
      });
    }

    if (search) {
      items = items.filter(it => {
        const text = (it.label + ' ' + (it.content || '') + ' ' + it.type).toLowerCase();
        return text.includes(search);
      });
    }

    return items;
  }

  function renderSidebarList() {
    const list = document.getElementById('agy-insp-steps-list');
    if (!list) return;

    const items = getFilteredItems();
    list.innerHTML = '';

    if (items.length === 0) {
      list.innerHTML = `<div style="padding: 24px; color: #71717A; font-size: 11px; text-align: center;">Ничего не найдено (попробуйте нажать кнопку 🔄 Обновить)</div>`;
      return;
    }

    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'agy-insp-item' + (index === selectedIndex ? ' selected' : '');

      let typeClass = 'agy-type-model';
      if (item.source === 'USER_EXPLICIT' || item.type === 'USER_INPUT') typeClass = 'agy-type-user';
      else if (item.type === 'TOOL_CALL') typeClass = 'agy-type-tool';
      else if (item.source === 'SYSTEM' || item.type.includes('SYSTEM')) typeClass = 'agy-type-system';

      el.innerHTML = `
        <div class="agy-item-header">
          <span class="agy-item-type ${typeClass}">${item.type}</span>
          <span class="agy-item-time">#${item._raw?.step_index !== undefined ? item._raw.step_index : index}</span>
        </div>
        <div class="agy-item-preview">${escapeHtml(item.label || item.content || '')}</div>
      `;

      el.addEventListener('click', () => {
        selectedIndex = index;
        list.querySelectorAll('.agy-insp-item').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        renderDetail(item);
      });

      list.appendChild(el);
    });

    if (items[selectedIndex]) {
      renderDetail(items[selectedIndex]);
    } else if (items[0]) {
      selectedIndex = 0;
      renderDetail(items[0]);
    }
  }

  function renderDetail(item) {
    const metaEl = document.getElementById('agy-insp-detail-meta');
    const rawView = document.getElementById('agy-insp-raw-view');
    if (!rawView || !item) return;

    const raw = item._raw;

    let metaHtml = `<span>Тип: <b>${item.type}</b></span>`;
    if (raw.source) metaHtml += `<span>Источник: <b>${raw.source}</b></span>`;
    if (raw.input_tokens) metaHtml += `<span>Tokens In: <b>${raw.input_tokens}</b></span>`;
    if (raw.cache_read_tokens) metaHtml += `<span>Cache Read: <b>${raw.cache_read_tokens}</b></span>`;
    if (raw.output_tokens) metaHtml += `<span>Tokens Out: <b>${raw.output_tokens}</b></span>`;
    if (raw.created_at) metaHtml += `<span>Время: <b>${new Date(raw.created_at).toLocaleTimeString()}</b></span>`;

    if (metaEl) metaEl.innerHTML = metaHtml;

    let contentToDisplay = '';
    if (item.content) {
      contentToDisplay = item.content;
    }

    if (raw.tool_calls && raw.tool_calls.length) {
      contentToDisplay += '\n\n================ TOOL CALLS ================\n' + JSON.stringify(raw.tool_calls, null, 2);
    }

    contentToDisplay += '\n\n================ RAW JSON OBJECT ================\n' + JSON.stringify(raw, null, 2);

    rawView.textContent = contentToDisplay;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Hotkey: Ctrl+Alt+P or Ctrl+Shift+D
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd')) {
      e.preventDefault();
      if (modalEl && modalEl.classList.contains('open')) {
        closeModal();
      } else {
        openModal();
      }
    }
  });

  setTimeout(injectTriggerButton, 1000);
})();
