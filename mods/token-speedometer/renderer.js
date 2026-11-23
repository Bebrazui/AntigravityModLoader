// @ts-check
// ============================================================================
//  Token Speedometer & Task Telemetry
//  • Скорость генерации токенов (tok/s)
//  • Расход токенов на текущую задачу (Input / Output / Cache)
//  • Количество шагов и время выполнения
// ============================================================================
(function () {
  'use strict';

  console.log('[Token Speedometer] Initializing...');

  let currentTelemetry = {
    taskOutTokens: 0,
    taskInTokens: 0,
    taskCachedTokens: 0,
    taskStepsCount: 0,
    totalDurationSec: 0,
    avgTps: 0,
    lastStepTps: 0,
    isWorking: false
  };

  // Helper: Получение текущего conversation ID
  function getActiveConvoId() {
    const activeSidebar = document.querySelector('[aria-selected="true"][href*="/c/"], [data-active="true"][href*="/c/"], .bg-sidebar-accent[href*="/c/"], .bg-accent[href*="/c/"]');
    if (activeSidebar) {
      const m = (activeSidebar.getAttribute('href') || '').match(/\/c\/([a-f0-9\-]{36})/i);
      if (m && m[1]) return m[1];
    }
    const match = window.location.pathname.match(/\/c\/([a-f0-9\-]{36})/i) ||
                  window.location.href.match(/\/c\/([a-f0-9\-]{36})/i);
    if (match && match[1]) return match[1];
    return null;
  }

  // Запрос свежей телеметрии у главного процесса
  function requestTelemetry() {
    const convoId = getActiveConvoId();
    if (!convoId) {
      // Новый или пустой диалог — сразу сбрасываем счетчик в нули
      currentTelemetry = {
        convoId: null,
        taskOutTokens: 0,
        taskInTokens: 0,
        taskCachedTokens: 0,
        taskStepsCount: 0,
        totalDurationSec: 0,
        avgTps: 0,
        lastStepTps: 0,
        isWorking: false
      };
      renderWidget();
      return;
    }
    console.log('__AGY_ACTION__:get-telemetry-data:' + convoId);
  }

  // Слушаем ответ от main-процесса
  window.addEventListener('agy-telemetry-data', (e) => {
    // @ts-ignore
    if (e.detail && typeof e.detail.taskOutTokens === 'number') {
      const currentConvoId = getActiveConvoId();
      // @ts-ignore
      if (currentConvoId && e.detail.convoId && e.detail.convoId !== currentConvoId) {
        // Данные от другого диалога игнорируем
        return;
      }
      // @ts-ignore
      currentTelemetry = e.detail;
      renderWidget();
    }
  });

  // Если ModLoader уже закешировал данные глобально
  // @ts-ignore
  if (window.__AGY_TELEMETRY_DATA__) {
    // @ts-ignore
    currentTelemetry = window.__AGY_TELEMETRY_DATA__;
  }

  function formatTokens(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  // Создаем компактный виджет
  function createSpeedometerElement() {
    const el = document.createElement('div');
    el.id = 'agy-token-speedometer-widget';
    el.className = 'agy-token-speedometer';
    el.innerHTML = `
      <div class="agy-speedo-badge">
        <span class="agy-speedo-val" id="agy-speedo-tps">0</span>
        <span class="agy-speedo-unit">tok/s</span>
      </div>

      <!-- Всплывающая детальная панель телеметрии задачи -->
      <div class="agy-speedo-popover">
        <div class="agy-speedo-header">
          <span>Телеметрия задачи</span>
          <span class="agy-speedo-status" id="agy-speedo-status">Завершено</span>
        </div>
        <div class="agy-speedo-row">
          <span>Скорость вывода:</span>
          <strong id="agy-speedo-pop-tps">0 tok/s</strong>
        </div>
        <div class="agy-speedo-row">
          <span>Генерация (Output):</span>
          <span id="agy-speedo-pop-out">0 tok</span>
        </div>
        <div class="agy-speedo-row">
          <span>Входной контекст (Input):</span>
          <span id="agy-speedo-pop-in">0 tok</span>
        </div>
        <div class="agy-speedo-row">
          <span>Из кэша (Cached):</span>
          <span id="agy-speedo-pop-cache">0 tok</span>
        </div>
        <div class="agy-speedo-row">
          <span>Шагов в задаче:</span>
          <span id="agy-speedo-pop-steps">0</span>
        </div>
        <div class="agy-speedo-row">
          <span>Время задачи:</span>
          <span id="agy-speedo-pop-time">0 сек</span>
        </div>
      </div>
    `;
    return el;
  }

  function injectWidget() {
    if (document.getElementById('agy-token-speedometer-widget')) return;

    // Вставляем виджет рядом с индикатором контекста или в статус-бар шапки чата
    const radar = document.getElementById('agy-context-radar-widget');
    if (radar && radar.parentNode) {
      const widget = createSpeedometerElement();
      radar.parentNode.insertBefore(widget, radar.nextSibling);
      renderWidget();
      return;
    }

    // Если радар еще не вмонтирован, ищем панель управления моделью внизу или вверху
    const container = document.querySelector('[data-testid="model-selector-trigger"]')?.parentElement ||
                      document.querySelector('footer') ||
                      document.querySelector('header');
    if (container) {
      const widget = createSpeedometerElement();
      container.appendChild(widget);
      renderWidget();
    }
  }

  function renderWidget() {
    const widget = document.getElementById('agy-token-speedometer-widget');
    if (!widget) return;

    const tpsEl = document.getElementById('agy-speedo-tps');
    const popTps = document.getElementById('agy-speedo-pop-tps');
    const popOut = document.getElementById('agy-speedo-pop-out');
    const popIn = document.getElementById('agy-speedo-pop-in');
    const popCache = document.getElementById('agy-speedo-pop-cache');
    const popSteps = document.getElementById('agy-speedo-pop-steps');
    const popTime = document.getElementById('agy-speedo-pop-time');
    const popStatus = document.getElementById('agy-speedo-status');

    const displayTps = currentTelemetry.avgTps || currentTelemetry.lastStepTps || 0;

    if (tpsEl) tpsEl.textContent = displayTps > 0 ? displayTps.toString() : '—';
    if (popTps) popTps.textContent = `${displayTps} tok/s`;
    if (popOut) popOut.textContent = `${currentTelemetry.taskOutTokens.toLocaleString()} tok`;
    if (popIn) popIn.textContent = `${currentTelemetry.taskInTokens.toLocaleString()} tok`;
    if (popCache) popCache.textContent = `${currentTelemetry.taskCachedTokens.toLocaleString()} tok`;
    if (popSteps) popSteps.textContent = currentTelemetry.taskStepsCount.toString();
    if (popTime) popTime.textContent = `${currentTelemetry.totalDurationSec} сек`;

    if (popStatus) {
      if (currentTelemetry.isWorking) {
        popStatus.textContent = 'Генерация...';
        popStatus.style.color = '#f4f4f5';
      } else {
        popStatus.textContent = 'Завершено';
        popStatus.style.color = '#10b981';
      }
    }
  }

  // Добавляем строгие стили без визуального мусора
  function injectStyles() {
    if (document.getElementById('agy-speedometer-styles')) return;
    const style = document.createElement('style');
    style.id = 'agy-speedometer-styles';
    style.textContent = `
      .agy-token-speedometer {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        margin-right: 4px;
        cursor: pointer;
        user-select: none;
        z-index: 90;
      }

      .agy-speedo-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 2px 7px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        color: #e2e8f0;
        transition: background 0.15s, border-color 0.15s;
      }

      .agy-token-speedometer:hover .agy-speedo-badge {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .agy-speedo-val {
        font-weight: 600;
        color: #f4f4f5;
      }

      .agy-speedo-unit {
        color: #94a3b8;
        font-size: 10px;
      }

      .agy-speedo-popover {
        display: none;
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        width: 220px;
        background: #18181b;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        padding: 10px 12px;
        font-size: 11px;
        color: #cbd5e1;
        pointer-events: none;
        z-index: 1000;
      }

      .agy-token-speedometer:hover .agy-speedo-popover {
        display: block;
      }

      .agy-speedo-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        color: #f8fafc;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 6px;
        margin-bottom: 6px;
      }

      .agy-speedo-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        line-height: 1.4;
      }

      .agy-speedo-row span {
        color: #94a3b8;
      }

      .agy-speedo-row strong, .agy-speedo-row span:last-child {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    injectWidget();

    // Первичный опрос
    requestTelemetry();

    // Опрашиваем телеметрию каждые 2.5 сек, если окно активно
    setInterval(() => {
      if (!document.hidden) {
        requestTelemetry();
        injectWidget();
      }
    }, 2500);

    // Поддержка ModAPI DOM Observer
    // @ts-ignore
    if (window.ModAPI && window.ModAPI.onDOMChange) {
      // @ts-ignore
      window.ModAPI.onDOMChange(() => {
        injectWidget();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
