// @ts-check
(function() {
  // Никаких колец, никакого неона, никакого JS-перехвата скролла!
  // Только нативные настройки редактора кода, если он открыт:
  if (window.monaco && window.monaco.editor) {
    try {
      const orig = window.monaco.editor.create;
      window.monaco.editor.create = function(el, opts, ...rest) {
        const patched = Object.assign({}, opts, {
          cursorSmoothCaretAnimation: 'on',
          cursorBlinking: 'smooth',
          smoothScrolling: true
        });
        return orig.call(this, el, patched, ...rest);
      };
    } catch (e) {}
  }
})();
