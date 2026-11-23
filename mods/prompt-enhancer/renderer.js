// @ts-check
(function() {
  console.log('[Prompt Enhancer Mod] Initializing quick pills...');

  const PRESETS = [
    { label: '⚡ Optimize', prompt: 'Оптимизируй этот код по производительности и читаемости' },
    { label: '🔍 Explain', prompt: 'Объясни подробно, как работает этот фрагмент' },
    { label: '🧪 Write Tests', prompt: 'Напиши юнит-тесты с граничными случаями' },
    { label: '🛡️ Fix Bugs', prompt: 'Проверь код на скрытые баги и уязвимости безопасности' }
  ];

  function injectPills() {
    if (document.getElementById('agy-prompt-pills-bar')) return;

    // Find message input box or textarea
    const textarea = document.querySelector('textarea') || document.querySelector('input[type="text"]');
    if (!textarea) return;

    const container = textarea.closest('form') || textarea.parentElement;
    if (!container) return;

    const bar = document.createElement('div');
    bar.id = 'agy-prompt-pills-bar';
    bar.className = 'agy-pills-bar';

    PRESETS.forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'agy-pill';
      pill.textContent = p.label;
      pill.addEventListener('click', () => {
        textarea.value = p.prompt + ': ' + textarea.value;
        textarea.focus();
        // Trigger React / input events
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      bar.appendChild(pill);
    });

    container.insertBefore(bar, container.firstChild);
    console.log('[Prompt Enhancer Mod] Pills mounted successfully.');
  }

  setInterval(injectPills, 1500);
})();
