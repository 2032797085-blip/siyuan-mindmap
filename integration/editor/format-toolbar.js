/*
 * SiYuan-specific presentation for SimpleMindMap rich-text formatting.
 * The upstream Vue controls are reused in-place; only their position changes.
 * A selection only changes enabled state, never creates a floating toolbar.
 */
(function () {
  'use strict';
  const HOST_CLASS = 'siyuan-format-host';
  function attachToToolbar(toolbar) {
    if (!toolbar || !toolbar.isConnected) return false;
    const primary = document.querySelector('.toolbarContainer .toolbar .toolbarBlock');
    if (!primary) return false;
    let host = primary.querySelector('.' + HOST_CLASS);
    if (!host) {
      host = document.createElement('div');
      host.className = HOST_CLASS;
      const label = document.createElement('span');
      label.className = 'siyuan-format-label';
      label.textContent = '文字格式';
      host.appendChild(label);
      primary.appendChild(host);
    }
    if (toolbar.parentElement !== host) host.appendChild(toolbar);
    toolbar.setAttribute('aria-label', '选中文字后可用的文字格式工具');
    if (!toolbar.dataset.siyuanPointerGuard) {
      // Keep Quill's current text range while pressing format buttons.
      // Only prevent focusing the bar; click handlers continue to work.
      toolbar.addEventListener('mousedown', event => {
        if (toolbar.classList.contains('siyuan-format-enabled') &&
            event.target.closest('.btn')) event.preventDefault();
      }, true);
      toolbar.dataset.siyuanPointerGuard = '1';
    }
    return true;
  }
  window.siyuanDockRichTextToolbar = function (toolbar) {
    if (!toolbar) return;
    // The original component mounts before the document's toolbar in some Vue
    // render orders. Preserve its element while waiting for the toolbar.
    if (!toolbar.isConnected) document.body.appendChild(toolbar);
    if (attachToToolbar(toolbar)) return;
    const observer = new MutationObserver(() => {
      if (attachToToolbar(toolbar)) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  };
})();
