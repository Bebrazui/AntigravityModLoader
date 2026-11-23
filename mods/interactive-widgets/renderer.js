// @ts-check
(function() {
  console.log('[Interactive Widgets Mod] Initializing listener...');

  // Helper to send text back into chat input
  function sendToChat(text) {
    const editor = document.querySelector('[data-lexical-editor="true"]') || document.querySelector('textarea, div[contenteditable="true"]');
    if (!editor) return;

    if (editor.getAttribute('contenteditable') === 'true') {
      editor.focus();
      // Use document.execCommand to trigger lexical editor state updates
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } else {
      // @ts-ignore
      editor.value = text;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Try to trigger send button after small delay
    setTimeout(() => {
      const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send"], button.send-button');
      if (sendBtn && !sendBtn.hasAttribute('disabled')) {
        // @ts-ignore
        sendBtn.click();
      }
    }, 150);
  }

  // Listen to messages from widget iframes
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'AGY_WIDGET_SUBMIT') {
      const payload = event.data.value || event.data.payload;
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      console.log('[Interactive Widgets Mod] User submitted response from widget:', text);
      sendToChat(text);
    }
  });

  // Watch for custom <agy-widget> or code blocks in rendered messages
  function processMessageBubbles() {
    const embeds = document.querySelectorAll('agent-embed:not([data-agy-handled])');
    embeds.forEach(embed => {
      embed.setAttribute('data-agy-handled', 'true');
      const iframe = embed.querySelector('iframe');
      if (iframe) {
        // Ensure postMessage connectivity
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
      }
    });
  }

  if (window.ModAPI && window.ModAPI.onDOMChange) {
    window.ModAPI.onDOMChange(processMessageBubbles);
  } else {
    const obs = new MutationObserver(processMessageBubbles);
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
