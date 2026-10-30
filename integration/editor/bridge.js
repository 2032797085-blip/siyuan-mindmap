/* SimpleMindMap iframe integration with the SiYuan custom block renderer. */
(function () {
    'use strict';
    const session = new URLSearchParams(location.search).get('session');
    const ORIGIN = location.origin;
    const CHANNEL = 'siyuan-mindmap-inline';
    let initialized = false;
    let state = null;
    let readonly = false;
    let appReady = false;
    let liveMindMap = null;
    const send = (type, extra) => {
        if (!session || window.parent === window) return;
        window.parent.postMessage(Object.assign({ channel: CHANNEL, session, type }, extra || {}), ORIGIN);
    };
    // Toolbar buttons inside the iframe delegate to the already-tested parent
    // controls. An iframe may request only these two view actions.
    window.siyuanEmbeddedToolbarAction = function (action) {
        if (!appReady || !['collapse', 'toggle-expanded'].includes(action)) return;
        send('toolbar-action', { action });
    };
        function save(field, value) {
        if (readonly || !state) return;
        state[field] = value;
        send('patch', { patch: { [field]: value } });
    }
    // In embedded mode, editing data belongs to SiYuan, not browser localStorage.
    // The Web editor used to mislabel *all* save errors as quota overflow.
    window.reportMindMapSaveFailure = function (error) {
        const message = error && (error.message || error.name) || String(error || '未知原因');
        send('save-error', { message: String(message).slice(0, 500) });
    };
    window.addEventListener('error', event => send('error', { message: event.message || '运行时错误' }));
    window.addEventListener('unhandledrejection', event => send('error', { message: String(event.reason || '异步错误') }));
    window.addEventListener('message', function (event) {
        if (event.source !== window.parent || event.origin !== ORIGIN) return;
        const message = event.data;
        if (!message || message.channel !== CHANNEL || message.session !== session) return;
        if (message.type === 'toolbar-state') {
            // Read-only presentation state; the parent owns expand/collapse.
            window.dispatchEvent(new CustomEvent('siyuan-mindmap-view-state', {
                detail: { expanded: !!message.expanded, collapsed: !!message.collapsed }
            }));
        } else if (message.type === 'prepare-collapse') {
            const requestId = message.requestId;
            if (typeof requestId !== 'string') return;
            if (!appReady || !liveMindMap) {
                send('collapse-error', { requestId, message: '编辑器尚未初始化' });
                return;
            }
            try {
                // Do not interrupt a Chinese IME composition mid-character.
                if (liveMindMap.richText && liveMindMap.richText.isCompositing) {
                    send('collapse-error', { requestId, message: '请先确认正在输入的文字' });
                    return;
                }
                const textEdit = liveMindMap.renderer && liveMindMap.renderer.textEdit;
                if (textEdit && typeof textEdit.hideEditTextBox === 'function') {
                    textEdit.hideEditTextBox();
                }
                // Capture any final edit immediately; do not wait for the ordinary
                // data_change throttle. Preserve existing document-only fields.
                if (!readonly && state && state.mindMapData) {
                    save('mindMapData', Object.assign({}, state.mindMapData, liveMindMap.getData(true)));
                }
                send('collapse-ready', { requestId });
            } catch (error) {
                send('collapse-error', { requestId, message: String(error.message || error).slice(0, 160) });
            }
        } else if (message.type === 'resume-layout') {
            if (appReady && liveMindMap && typeof liveMindMap.resize === 'function') {
                // The parent restores the iframe dimensions before this message.
                requestAnimationFrame(() => liveMindMap.resize());
            }
        } else if (message.type === 'init' && !initialized) {
            initialized = true;
            state = message.document;
            readonly = !!message.readonly;
            window.takeOverAppMethods = {
                getMindMapData: () => state.mindMapData,
                saveMindMapData: data => save('mindMapData', data),
                getMindMapConfig: () => state.mindMapConfig || {},
                saveMindMapConfig: data => save('mindMapConfig', data),
                getLanguage: () => state.lang || 'zh',
                saveLanguage: data => save('lang', data),
                getLocalConfig: () => state.localConfig || null,
                saveLocalConfig: data => save('localConfig', data),
            };
            try {
                if (typeof window.initApp !== 'function') throw new Error('SimpleMindMap 编辑器脚本未加载');
                // Only report success when the real mind-map canvas has initialized,
                // rather than immediately after calling Vue's mount function.
                if (window.$bus && typeof window.$bus.$on === 'function') {
                    window.$bus.$on('app_inited', function (mindMap) {
                        liveMindMap = mindMap;
                        appReady = true;
                        send('initialized');
                    });
                }
                window.initApp();
                setTimeout(function () {
                    if (!appReady) send('error', {message: '未检测到编辑器画布初始化完成，请检查控制台'});
                }, 16000);
            } catch (e) {
                send('error', { message: String(e.message || e) });
            }
        }
    });
    window.addEventListener('load', () => send('ready'));
    window.addEventListener('pagehide', () => send('flush'));
})();
