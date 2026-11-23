// @ts-check
(function() {
  console.log('[Live Context Radar Mod] Initializing...');

  let activeMetrics = {
    totalTokens: 0,
    percentUsed: 0,
    maxTokens: 1048576,
    inputTokens: 0,
    cachedTokens: 0
  };

  // Helper: Detect active conversation ID
  function getActiveConvoId() {
    // 1. Check if model selector says "No Model Selected" -> new empty chat
    const modelTrigger = document.querySelector('button[data-testid="model-selector-trigger"]');
    if (modelTrigger) {
      const txt = (modelTrigger.textContent || '').trim();
      if (txt.includes('No Model Selected')) {
        return null;
      }
    }

    // 2. Check if there are any active conversation message bubbles
    // On a new chat, the conversation thread is empty
    const editor = document.querySelector('[data-lexical-editor="true"]');
    const sendBtn = document.querySelector('button[data-testid="send-button"]');
    const hasMessages = document.querySelector('[data-turn-id], [data-message-id], .prose');
    
    // 3. Check active sidebar item
    const activeSidebar = document.querySelector('[aria-selected="true"][href*="/c/"], [data-active="true"][href*="/c/"], .bg-sidebar-accent[href*="/c/"], .bg-accent[href*="/c/"]');
    if (activeSidebar) {
      const m = (activeSidebar.getAttribute('href') || '').match(/\/c\/([a-f0-9\-]{36})/i);
      if (m && m[1]) return m[1];
    }

    // 4. Check URL pathname/href
    const match = window.location.pathname.match(/\/c\/([a-f0-9\-]{36})/i) || 
                  window.location.href.match(/\/c\/([a-f0-9\-]{36})/i);
    if (match && match[1]) {
      // If URL matches but there are zero messages and send button is disabled and composer is empty:
      // check if it's the new chat screen
      if (!hasMessages && sendBtn && sendBtn.hasAttribute('disabled') && editor && !editor.textContent) {
        // Still verify if it could be a fresh empty chat
        return match[1];
      }
      return match[1];
    }

    return null;
  }

  let lastRequestedConvoId = null;

  // Fetch real context tokens for active conversation
  function updateRealContext() {
    const convoId = getActiveConvoId();
    if (!convoId) {
      lastRequestedConvoId = null;
      activeMetrics = {
        totalTokens: 0,
        percentUsed: 0,
        maxTokens: 1048576,
        inputTokens: 0,
        cachedTokens: 0
      };
      updateUI();
      return;
    }

    if (convoId !== lastRequestedConvoId) {
      lastRequestedConvoId = convoId;
      console.log('__AGY_ACTION__:get-radar-tokens:' + convoId);
    }
  }

  // Hook SPA URL changes
  try {
    const originalPushState = history.pushState;
    history.pushState = function() {
      // @ts-ignore
      const result = originalPushState.apply(this, arguments);
      setTimeout(updateRealContext, 50);
      return result;
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      // @ts-ignore
      const result = originalReplaceState.apply(this, arguments);
      setTimeout(updateRealContext, 50);
      return result;
    };
  } catch (e) {}

  window.addEventListener('agy-radar-data', (e) => {
    if (e.detail && typeof e.detail.totalTokens === 'number') {
      const currentConvoId = getActiveConvoId();
      
      // If we are on a new/empty chat, do not accept tokens
      if (!currentConvoId) {
        activeMetrics = { totalTokens: 0, percentUsed: 0, maxTokens: 1048576, inputTokens: 0, cachedTokens: 0 };
        updateUI();
        return;
      }

      // Accept tokens only if matching current conversation
      if (!e.detail.convoId || e.detail.convoId === currentConvoId) {
        activeMetrics = e.detail;
        updateUI();
      }
    }
  });

  // Build the Circular Radar Widget
  function createRadarElement() {
    const radar = document.createElement('div');
    radar.id = 'agy-context-radar-widget';
    radar.className = 'agy-context-radar';
    radar.title = 'Использование контекстного окна';
    radar.innerHTML = `
      <div class="agy-radar-circle-wrap">
        <svg class="agy-radar-svg" viewBox="0 0 36 36">
          <circle class="agy-radar-bg-circle" cx="18" cy="18" r="14"></circle>
          <circle class="agy-radar-fill-circle" id="agy-radar-circle" cx="18" cy="18" r="14"
            stroke="#10B981"
            stroke-dasharray="88"
            stroke-dashoffset="88"></circle>
        </svg>
      </div>
      <span id="agy-radar-label">0k</span>

      <div class="agy-radar-tooltip">
        <div class="agy-radar-tt-header">
          <span>Контекстное окно</span>
          <span id="agy-tt-percent" style="color: #10B981;">0%</span>
        </div>
        <div class="agy-radar-tt-row">
          <span>Активные токены:</span>
          <span class="agy-radar-tt-val" id="agy-tt-active">0</span>
        </div>
        <div class="agy-radar-tt-row">
          <span>Из кэша (Cache Read):</span>
          <span class="agy-radar-tt-val" id="agy-tt-cached">0</span>
        </div>
        <div class="agy-radar-tt-row">
          <span>Лимит модели:</span>
          <span class="agy-radar-tt-val" id="agy-tt-max">1M</span>
        </div>
      </div>
    `;

    return radar;
  }

  function formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return n.toString();
  }

  function getColor(percent) {
    // Check budget limit alert
    try {
      const budgetLimit = (window.ModAPI && window.ModAPI.getSetting)
        ? Number(window.ModAPI.getSetting('context-radar', 'dailyBudget', 0))
        : 0;
      if (budgetLimit > 0 && window.__AGY_ANALYTICS_DATA__ && window.__AGY_ANALYTICS_DATA__.dailyStats) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayStat = window.__AGY_ANALYTICS_DATA__.dailyStats[todayStr];
        if (todayStat) {
          const todayCost = ((todayStat.input / 1000000) * 0.10) + ((todayStat.cached / 1000000) * 0.025) + ((todayStat.output / 1000000) * 0.40);
          if (todayCost >= budgetLimit) {
            return '#EF4444'; // Budget exceeded -> Red alert!
          } else if (todayCost >= budgetLimit * 0.8) {
            return '#F59E0B'; // Approaching limit -> Amber alert!
          }
        }
      }
    } catch (_) {}

    if (percent > 85) return '#EF4444'; // Red
    if (percent > 60) return '#F59E0B'; // Amber
    if (percent > 30) return '#3B82F6'; // Blue
    return '#10B981'; // Emerald
  }

  function updateUI() {
    const existing = document.getElementById('agy-context-radar-widget');
    const total = activeMetrics.totalTokens || 0;

    // If new chat / 0 tokens: remove widget from DOM completely
    if (total === 0 || !getActiveConvoId()) {
      if (existing) existing.remove();
      return;
    }

    if (!existing) {
      injectRadar();
      return;
    }

    const circle = document.getElementById('agy-radar-circle');
    const label = document.getElementById('agy-radar-label');
    const ttPercent = document.getElementById('agy-tt-percent');
    const ttActive = document.getElementById('agy-tt-active');
    const ttCached = document.getElementById('agy-tt-cached');
    const ttMax = document.getElementById('agy-tt-max');

    if (!circle || !label) return;

    const max = activeMetrics.maxTokens || 1048576;
    const percent = Math.min(100, Math.max(0, (total / max) * 100));

    const circumference = 88;
    const offset = circumference - (percent / 100) * circumference;
    const color = getColor(percent);

    circle.style.strokeDashoffset = offset.toString();
    circle.style.stroke = color;

    // Read optional mod settings
    const displayMode = (window.ModAPI && window.ModAPI.getSetting) 
      ? window.ModAPI.getSetting('context-radar', 'displayMode', 'tokens') 
      : 'tokens';
    const showTooltip = (window.ModAPI && window.ModAPI.getSetting) 
      ? window.ModAPI.getSetting('context-radar', 'showTooltip', true) 
      : true;

    if (displayMode === 'percent') {
      label.textContent = percent.toFixed(0) + '%';
    } else {
      label.textContent = formatTokens(total);
    }

    const tooltipEl = existing.querySelector('.agy-radar-tooltip');
    if (tooltipEl) {
      tooltipEl.style.display = showTooltip ? '' : 'none';
    }

    if (ttPercent) {
      ttPercent.textContent = percent.toFixed(1) + '%';
      ttPercent.style.color = color;
    }
    if (ttActive) ttActive.textContent = total.toLocaleString();
    if (ttCached) ttCached.textContent = (activeMetrics.cachedTokens || 0).toLocaleString();
    if (ttMax) ttMax.textContent = formatTokens(max);
  }

  window.updateRadarUI = function() {
    if (window.__AGY_RADAR_DATA__) {
      const currentConvoId = getActiveConvoId();
      if (!currentConvoId) {
        activeMetrics = { totalTokens: 0, percentUsed: 0, maxTokens: 1048576, inputTokens: 0, cachedTokens: 0 };
        updateUI();
        return;
      }
      if (!window.__AGY_RADAR_DATA__.convoId || window.__AGY_RADAR_DATA__.convoId === currentConvoId) {
        activeMetrics = window.__AGY_RADAR_DATA__;
        updateUI();
      }
    }
  };

  // Inject Strictly right next to the Model Selector Button
  function injectRadar() {
    const existing = document.getElementById('agy-context-radar-widget');

    // On new/empty chat or zero tokens, do not inject!
    const convoId = getActiveConvoId();
    if (!convoId || activeMetrics.totalTokens === 0) {
      if (existing) existing.remove();
      return;
    }

    // Locate the model selector trigger button inside the composer
    const modelButton = document.querySelector('button[data-testid="model-selector-trigger"]');
    if (!modelButton) {
      if (existing) existing.remove();
      return;
    }

    // The wrapper containing the model selector button
    const pillWrapper = modelButton.closest('.no-focus-agent-input') || modelButton.parentElement;
    if (!pillWrapper) return;

    // The horizontal flex toolbar containing attachments and model pill
    const flexBar = pillWrapper.parentElement;
    if (!flexBar) return;

    // If widget is already correctly placed as next sibling of pillWrapper
    if (existing) {
      if (existing.parentElement === flexBar && pillWrapper.nextElementSibling === existing) {
        updateUI();
        return;
      }
      existing.remove();
    }

    const widget = createRadarElement();
    if (pillWrapper.nextElementSibling) {
      flexBar.insertBefore(widget, pillWrapper.nextElementSibling);
    } else {
      flexBar.appendChild(widget);
    }

    updateUI();
  }

  function init() {
    injectRadar();
    updateRealContext();

    setInterval(injectRadar, 1500);
    setInterval(updateRealContext, 2500);

    window.addEventListener('popstate', updateRealContext);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
