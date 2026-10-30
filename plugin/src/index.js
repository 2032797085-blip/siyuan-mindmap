'use strict';

const { Plugin, showMessage, Setting } = require('siyuan');
const BLOCK_TYPE = 'mindmap';
const CHANNEL = 'siyuan-mindmap-inline';
const SAVE_DELAY_MS = 1300;
const MIN_HEIGHT = 300;
// Screenshot-size default: 799px canvas + 40px header = 839px outer height.
// The block width caps at 1447px but shrinks with narrower SiYuan documents.
const DEFAULT_HEIGHT = 799;
const COLLAPSED_HEIGHT = 48;
const MAX_HEIGHT = 1200;
// Never paint a newly opened document's map above its title while SiYuan is
// still laying out the editor. All times here concern display only, not saves.
const FIRST_SHOW_QUIET_MS = 240;
const TITLE_ABSENT_GRACE_MS = 650;
const TITLE_GAP_PX = 4;
const SETTINGS_FILE = 'settings.json';
const DEFAULT_THEME = 'simpleBlack';
const THEME_OPTIONS = [
    {value: 'simpleBlack', label: '简约黑（默认）'},
    {value: 'avocado', label: '牛油果'},
    {value: 'courseGreen', label: '课程绿'},
    {value: 'classicBlue', label: '经典蓝'},
    {value: 'blackGold', label: '黑金'},
    {value: 'oreo', label: '奥利奥'},
    {value: 'rose', label: '玫瑰'},
];
const THEME_IDS = new Set(THEME_OPTIONS.map(item => item.value));
const safeTheme = value => THEME_IDS.has(value) ? value : DEFAULT_THEME;

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankMap = (title = '中心主题', theme = DEFAULT_THEME) => ({
    mindMapData: {
        root: { data: { text: title }, children: [] },
        theme: { template: safeTheme(theme), config: {} },
        layout: 'logicalStructure',
        config: {},
        view: null,
    },
    mindMapConfig: {}, lang: 'zh', localConfig: null,
});
function decodeMap(raw) {
    if (!raw || !raw.trim()) return blankMap();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.mindMapData || !data.mindMapData.root) {
        throw new Error('导图块数据格式错误');
    }
    return data;
}
function encodeMap(map) {
    const raw = JSON.stringify(map);
    if (/^\s*;;;\s*$/m.test(raw)) throw new Error('内容包含保留的结束标记');
    return raw;
}
function mindMapMarkdown(pluginName, doc) {
    return `;;;${encodeURIComponent(pluginName)}/${encodeURIComponent(BLOCK_TYPE)}\n${encodeMap(doc)}\n;;;`;
}

// The iframe can take time to initialize, but the saved block JSON is already
// available synchronously. Render a read-only SVG snapshot immediately inside
// the normal document flow, and hide it only when the real editor is safe to
// show. The snapshot never creates a new save path or executes user HTML.
const PREVIEW_SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_MAX_NODES = 72;
const PREVIEW_MAX_DEPTH = 5;
function previewText(raw) {
    const source = raw == null ? '' : String(raw);
    return source.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, value => ({
        '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    })[value] || value).replace(/\s+/g, ' ').trim() || '未命名节点';
}
// A collapsed block is identified by its root node. Read the same live map
// snapshot used for saving; never interpret root text as HTML in the toolbar.
function centerTopicTitle(doc) {
    const root = doc && doc.mindMapData && doc.mindMapData.root;
    const raw = root && root.data && root.data.text;
    if (typeof raw !== 'string' && typeof raw !== 'number') return '未命名思维导图';
    const plain = String(raw)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, entity => ({
            '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
            '&quot;': '"', '&apos;': "'", '&#39;': "'",
        })[entity.toLowerCase()] || entity)
        .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (whole, hex, dec) => {
            const code = parseInt(hex || dec, hex ? 16 : 10);
            return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
                ? String.fromCodePoint(code) : whole;
        })
        .replace(/\s+/g, ' ').trim();
    return plain || '未命名思维导图';
}
function previewNodeTree(raw, depth, state) {
    if (!raw || state.count >= PREVIEW_MAX_NODES || depth > PREVIEW_MAX_DEPTH) return null;
    state.count += 1;
    const text = previewText(raw.data && raw.data.text);
    const children = [];
    const isFolded = raw.data && raw.data.expand === false;
    if (!isFolded && Array.isArray(raw.children)) {
        for (const child of raw.children) {
            const node = previewNodeTree(child, depth + 1, state);
            if (node) children.push(node);
            if (state.count >= PREVIEW_MAX_NODES) break;
        }
    }
    return { text, depth, children, y: 0, x: depth * 215,
        width: Math.max(depth === 0 ? 90 : 68,
            Math.min(205, 26 + Array.from(text).slice(0, 18).reduce((n, letter) => n + (letter.charCodeAt(0) > 255 ? 16 : 9), 0))) };
}
function appendMindMapPreview(slot, doc) {
    if (!slot || !doc || !doc.mindMapData || !doc.mindMapData.root) return;
    const root = previewNodeTree(doc.mindMapData.root, 0, { count: 0 });
    if (!root) return;
    const wrap = document.createElement('div');
    wrap.className = 'smm-inline-preview';
    wrap.setAttribute('aria-label', '已保存的思维导图预览，编辑器载入后可编辑');
    const svg = document.createElementNS(PREVIEW_SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1060 490');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '思维导图：' + root.text.slice(0, 90));
    let leaf = 0;
    const nodes = [];
    const links = [];
    const measure = node => {
        nodes.push(node);
        if (!node.children.length) node.y = (leaf++ * 64);
        else {
            for (const child of node.children) { measure(child); links.push([node, child]); }
            node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
        }
    };
    measure(root);
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    const minY = Math.min(...nodes.map(n => n.y - 24));
    const maxY = Math.max(...nodes.map(n => n.y + 24));
    const scale = Math.min(1.15, 990 / Math.max(1, maxX - minX), 425 / Math.max(1, maxY - minY));
    const group = document.createElementNS(PREVIEW_SVG_NS, 'g');
    group.setAttribute('transform', `translate(${(530 - (minX + maxX) * scale / 2).toFixed(2)} ${(245 - (minY + maxY) * scale / 2).toFixed(2)}) scale(${scale.toFixed(4)})`);
    const template = doc.mindMapData.theme && doc.mindMapData.theme.template;
    const green = template === 'avocado' || template === 'courseGreen';
    const color = green ? '#95c83d' : '#262626';
    const connectColor = green ? '#aacd63' : '#3a3a3a';
    const add = (kind, attrs, parent) => {
        const el = document.createElementNS(PREVIEW_SVG_NS, kind);
        for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, String(value));
        parent.appendChild(el);
        return el;
    };
    for (const [a, b] of links) {
        const startX = a.x + a.width, endX = b.x;
        add('path', {
            d: `M ${startX} ${a.y} C ${startX + 42} ${a.y}, ${endX - 38} ${b.y}, ${endX} ${b.y}`,
            fill: 'none', stroke: connectColor, 'stroke-width': 2.5,
        }, group);
    }
    for (const node of nodes) {
        add('rect', {
            x: node.x, y: node.y - 22, width: node.width, height: 44, rx: 5, ry: 5,
            fill: node.depth === 0 && green ? '#95c83d' : '#fff',
            stroke: color, 'stroke-width': node.depth === 0 ? 2.8 : 2,
        }, group);
        const original = Array.from(node.text);
        const clipped = original.length > 18 ? original.slice(0, 17).join('') + '…' : node.text;
        const label = add('text', {
            x: node.x + node.width / 2, y: node.y + 1,
            'dominant-baseline': 'middle', 'text-anchor': 'middle',
            fill: node.depth === 0 && green ? '#fff' : '#262626',
            'font-size': node.depth === 0 ? 21 : 17,
            'font-weight': node.depth === 0 ? 700 : 450,
        }, group);
        label.textContent = clipped;
    }
    svg.appendChild(group);
    wrap.appendChild(svg);
    slot.appendChild(wrap);
}

// Protect a map only against an accidental paragraph-boundary Backspace
// in the host SiYuan document. An explicitly selected block is always left to SiYuan's
// normal deletion commands. This never runs inside the iframe mind-map editor.
//
// Important: the cursor position (DOM Selection) is authoritative, not the
// mouse position or the last selected mind-map. A document-wide key handler
// must never disable editing arbitrary prose or unrelated blocks.
function shouldProtectAdjacentMapBackspace(event, records, selection) {
    if (!event || event.key !== 'Backspace' || event.defaultPrevented ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.isComposing || event.keyCode === 229) return false;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return false;
    if (target.closest('input, textarea, select, [role="textbox"], .b3-dialog, .b3-menu')) return false;
    const editor = target.closest('.protyle');
    if (!editor || typeof editor.querySelector !== 'function') return false;
    const wysiwyg = editor.querySelector('.protyle-wysiwyg');
    if (!wysiwyg || !wysiwyg.contains || !wysiwyg.contains(target)) return false;
    // Explicitly selected blocks (including multi-selection) remain deletable.
    if (wysiwyg.querySelector('.protyle-wysiwyg--select')) return false;
    if (!selection || selection.rangeCount !== 1 || !selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    if (!range || !range.collapsed) return false;
    const start = range.startContainer;
    const startElement = start.nodeType === 1 ? start : start.parentElement;
    if (!startElement || !wysiwyg.contains(startElement)) return false;
    // Only map blocks mounted in this exact editor are protected.
    const mapBlocks = new Set();
    for (const record of records.values()) {
        if (!record || record.disposed || !record.anchor ||
            typeof record.anchor.closest !== 'function') continue;
        const block = record.anchor.closest('[data-node-id]');
        if (block && block.isConnected && wysiwyg.contains(block)) mapBlocks.add(block);
    }
    if (!mapBlocks.size) return false;
    const currentBlock = startElement.closest && startElement.closest('[data-node-id]');
    // Do not intercept a Backspace originating from the map shell or the
    // editor-level block boundary. SiYuan may keep DOM focus/Range there while
    // the user explicitly selects a custom block through its gutter. Those
    // states are ambiguous: blocking them broke deliberate block deletion.
    // Only a caret in an ordinary paragraph immediately after this map is
    // unambiguously protected below. Let SiYuan handle all other cases.
    if (currentBlock && mapBlocks.has(currentBlock)) return false;
    if (start === wysiwyg) return false;
    // Preserve normal text editing. The only dangerous text boundary is the
    // *beginning* of a paragraph immediately following the mind-map block.
    if (!currentBlock || currentBlock.getAttribute('data-type') !== 'NodeParagraph') return false;
    if (!mapBlocks.has(currentBlock.previousElementSibling)) return false;
    const editable = startElement.closest('[contenteditable="true"], [contenteditable=""]');
    if (!editable || !currentBlock.contains(editable)) return false;
    // The selection must really be inside the same editable field.
    if (!editable.contains(start)) return false;
    try {
        const beforeCaret = range.cloneRange();
        beforeCaret.selectNodeContents(editable);
        beforeCaret.setEnd(start, range.startOffset);
        if (beforeCaret.collapsed) return true;
        // SiYuan inserts zero-width caret placeholders at block boundaries.
        // Allow those, but not spaces, visible text, or real inline objects.
        const prefix = beforeCaret.toString().replace(/[\u200B\uFEFF]/g, '');
        if (prefix.length !== 0) return false;
        const fragment = beforeCaret.cloneContents();
        return !fragment.querySelector('img, svg, iframe, .img, .emoji, [data-type*="inline-math"], [data-type*="img"]');
    } catch (_) {
        // Unexpected DOM/range shape: fail open so ordinary editing is never
        // disabled by a guessed caret position.
        return false;
    }
}

class SiYuanMindMapInline extends Plugin {
    async onload() {
        this.defaultTheme = DEFAULT_THEME;
        try {
            const saved = await this.loadData(SETTINGS_FILE);
            this.defaultTheme = safeTheme(saved && saved.defaultTheme);
        } catch (error) {
            console.warn('[siyuan-mindmap] Could not read plugin theme settings:', error);
        }
        this.configureSettings();
        this.sessions = new Map();
        this.recordsByKey = new Map();
        this.scopeIDs = new WeakMap();
        this.onFrameMessage = this.handleFrameMessage.bind(this);
        this.repositionAll = this.schedulePositions.bind(this);
        this.onAdjacentMapBackspace = event => {
            const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
            if (!shouldProtectAdjacentMapBackspace(event, this.sessions, selection)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        // Capture before SiYuan's normal block-delete handler; unregister on unload.
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('keydown', this.onAdjacentMapBackspace, true);
        }
        window.addEventListener('message', this.onFrameMessage);
        window.addEventListener('scroll', this.repositionAll, true);
        window.addEventListener('resize', this.repositionAll);
        // Title edits and other same-size layout changes don't always trigger ResizeObserver.
        window.addEventListener('input', this.repositionAll, true);
        window.addEventListener('transitionend', this.repositionAll, true);
        this.addIcons('<symbol id="iconSiYuanMindMap" viewBox="0 0 32 32"><path d="M16 3a5 5 0 0 1 4.8 3.7l4.3 2.1a4.5 4.5 0 1 1 1.1 9.1l-4.7 2.7a5.5 5.5 0 0 1-10.6 1.2l-4-1.6a4.5 4.5 0 1 1 0-8.5l4.3-2.3A5 5 0 0 1 16 3zm0 3a2 2 0 0 0-1.6 3.2l-5.6 3A4.5 4.5 0 0 1 9 16l4 1.6a5.4 5.4 0 0 1 6.7-.2l5-2.8a1.5 1.5 0 1 0-1.1-2.8l-5.3-2.6A2 2 0 0 0 16 6zm0 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></symbol>');
        this.customBlockRenders[BLOCK_TYPE] = {
            render: context => this.renderEmbeddedMap(context),
        };
        // Native SiYuan slash-menu extension. This reuses our existing custom
        // block Markdown and deliberately does not listen for '/' key presses.
        // The built-in '思维导图' entry is a separate SiYuan list view, so give
        // our embedded editor an unambiguous name.
        this.protyleSlash = [{
            id: 'siyuan-mindmap-insert-block',
            filter: ['思维导图块', '插入思维导图块', '导图块', 'swdtk', 'mindmap block'],
            html: '<div class="b3-list-item__first">' +
                '<svg class="b3-list-item__graphic"><use xlink:href="#iconSiYuanMindMap"></use></svg>' +
                '<span class="b3-list-item__text">思维导图块</span>' +
                '<span class="b3-list-item__meta">插件</span></div>',
            callback: protyle => this.insertFromSlash(protyle),
        }];
        this.addToolbarItem({
            name: 'siyuan-mindmap-insert', icon: 'iconSiYuanMindMap',
            hotkey: '', tipPosition: 'n', click: protyle => this.insertAtCaret(protyle),
        });
        this.addBreadcrumbButton({
            id: 'siyuan-mindmap-insert', icon: 'iconSiYuanMindMap',
            title: '在文档中插入思维导图',
            callback: (event, protyle) => {
                if (event && event.preventDefault) event.preventDefault();
                this.insertAtCaret(protyle);
            },
        });
    }

    configureSettings() {
        const themeSelect = document.createElement('select');
        themeSelect.className = 'b3-select fn__block';
        for (const item of THEME_OPTIONS) {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            themeSelect.append(option);
        }
        themeSelect.value = this.defaultTheme;
        this.setting = new Setting({
            confirmCallback: async () => {
                const next = safeTheme(themeSelect.value);
                try {
                    await this.saveData(SETTINGS_FILE, {defaultTheme: next});
                    this.defaultTheme = next;
                    showMessage('默认主题已保存，新建思维导图将使用该主题');
                } catch (error) {
                    console.error('[siyuan-mindmap] Saving default theme failed:', error);
                    showMessage('保存默认主题失败，请检查控制台', 5000, 'error');
                }
            },
        });
        this.setting.addItem({
            title: '新建导图的默认主题',
            direction: 'row',
            description: '新插入的导图使用此主题。已有导图保留各自的主题，不会被批量修改。',
            createActionElement: () => {
                // Re-open settings should reflect the value last committed.
                themeSelect.value = this.defaultTheme;
                return themeSelect;
            },
        });
    }

    // Plugin data notifications must not silently reload a live editor instance.
    onDataChanged() {}

    // The slash callback receives a real Protyle instance (unlike the
    // breadcrumb callback, which receives an IProtyle wrapper). Keep the
    // original insertion entry unchanged to avoid affecting other buttons.
    insertFromSlash(protyle) {
        try {
            // SiYuan's slash callback receives the Protyle class instance;
            // editable state and Lute are stored on its .protyle field.
            const state = protyle && protyle.protyle;
            if (!state || state.disabled || typeof protyle.insert !== 'function' ||
                !state.lute || typeof state.lute.Md2BlockDOM !== 'function') {
                showMessage('请先在可编辑的思源文档中放置光标', 3500, 'error');
                return false;
            }
            const markdown = mindMapMarkdown(this.name, blankMap('中心主题', this.defaultTheme));
            // SiYuan owns slash-key cleanup and caret placement. Inserting via
            // its public Protyle API avoids DOM surgery and duplicate blocks.
            protyle.insert(state.lute.Md2BlockDOM(markdown), true);
            return true;
        } catch (error) {
            console.error('[siyuan-mindmap] Slash insertion failed', error);
            showMessage(`插入思维导图失败：${error.message || error}`, 5000, 'error');
            return false;
        }
    }

    insertAtCaret(protyle) {
        try {
            if (!protyle || protyle.disabled || !protyle.getInstance || !protyle.lute) {
                showMessage('请先在可编辑的思源文档中放置光标', 3500, 'error');
                return false;
            }
            const markdown = mindMapMarkdown(this.name, blankMap('中心主题', this.defaultTheme));
            protyle.getInstance().insert(protyle.lute.Md2BlockDOM(markdown), true);
            return true;
        } catch (error) {
            console.error('[siyuan-mindmap] Insert failed', error);
            showMessage(`插入思维导图失败：${error.message || error}`, 5000, 'error');
            return false;
        }
    }

    blockKey(element) {
        // Stable node id + owning Protyle instance: avoids accidentally sharing one
        // iframe between two visible views of the same document.
        const block = element.closest && element.closest('[data-node-id]');
        const scope = element.closest && element.closest('.protyle');
        if (!block || !block.getAttribute) return null;
        const id = block.getAttribute('data-node-id');
        if (!id) return null;
        let scopeID = 'main';
        if (scope) {
            scopeID = this.scopeIDs.get(scope);
            if (!scopeID) { scopeID = uid(); this.scopeIDs.set(scope, scopeID); }
        }
        return scopeID + ':' + id;
    }

    renderEmbeddedMap({ element, content, setContent }) {
        let documentData;
        try { documentData = decodeMap(content); }
        catch (error) {
            element.textContent = '思维导图数据无法读取：' + String(error.message || error);
            return () => {};
        }
        const key = this.blockKey(element);
        let record = key && this.recordsByKey.get(key);
        const mountToken = uid();
        const slot = document.createElement('div');
        slot.className = 'smm-inline-slot smm-inline-slot-pending';
        element.classList.add('smm-inline-host');
        element.append(slot);
        appendMindMapPreview(slot, record && !record.disposed ? record.map : documentData);
        if (record && record.disposed) record = null;
        if (record) {
            // setContent() may cause SiYuan to destroy and recreate the mount.
            // Reconcile with the SAME live editor rather than creating an iframe.
            clearTimeout(record.teardownTimer);
            record.teardownTimer = null;
            record.anchor = slot;
            record.setContent = setContent;
            record.token = mountToken;
            record.slot = slot;
            // A remounted block keeps its preview until the stable live iframe is positioned.
            // The custom block may be remounted while the iframe is kept alive;
            // its new placeholder must be positioned before any old overlay is painted.
            if (record.root && record.root.style) {
                const current = slot.getBoundingClientRect && slot.getBoundingClientRect();
                const previous = record.lastAnchorRect;
                if (!current || !previous || Math.abs(current.top - previous.top) > 3 ||
                    Math.abs(current.left - previous.left) > 3) {
                    record.root.style.visibility = 'hidden';
                }
            }
            if (record.collapsed) {
                slot.classList.add('smm-inline-slot-collapsed');
            }
            slot.style.height = `${record.collapsed ? COLLAPSED_HEIGHT : record.height + record.toolbarHeight}px`;
            if (content !== record.lastSubmitted && content !== record.lastPersisted && !record.dirty) {
                // A genuine external change (e.g. undo) should be applied on a fresh editor.
                this.dispose(record, false);
                record = null;
            } else {
                this.schedulePositions();
            }
        }
        if (!record) {
            record = this.createRecord({key, slot, content, documentData, setContent, mountToken});
        }
        const liveRecord = record;
        return () => {
            if (liveRecord.disposed || liveRecord.token !== mountToken) return;
            if (liveRecord.dirty && !liveRecord.saving) liveRecord.save();
            // SiYuan usually calls the new render immediately after cleanup.
            // A delayed release makes it possible to reuse the mounted iframe.
            clearTimeout(liveRecord.teardownTimer);
            liveRecord.teardownTimer = setTimeout(() => {
                if (liveRecord.token === mountToken) this.dispose(liveRecord, false);
            }, 700);
        };
    }

    createRecord({ key, slot, content, documentData, setContent, mountToken }) {
        const session = uid();
        const readonly = !!(window.siyuan && (window.siyuan.isPublish ||
            window.siyuan.config && window.siyuan.config.readonly));
        const root = document.createElement('div');
        root.className = 'smm-inline smm-inline-portal';
        root.style.visibility = 'hidden';
        const toolbar = document.createElement('div');
        toolbar.className = 'smm-inline-toolbar';
        const caption = document.createElement('strong');
        caption.className = 'smm-inline-caption';
        caption.textContent = '思维导图';
        const status = document.createElement('span');
        status.className = 'smm-inline-status';
        status.textContent = '正在加载编辑器…';
        const record = {
            key, session, frame: null, root, status, anchor: slot, slot,
            setContent, token: mountToken, map: documentData, readonly,
            height: DEFAULT_HEIGHT, toolbarHeight: 40, collapsed: false,
            pendingCollapse: null, collapseTimeout: null, resumeTimer: null,
            dirty: false, saving: false,
            disposed: false, saveTimer: null, teardownTimer: null, loadingTimer: null,
            lastPersisted: content, lastSubmitted: null, lastEncoded: encodeMap(documentData),
            observer: null, layoutObserver: null, resize: null, save: null, applyPatch: null,
            portalParent: null, titleObserver: null,
            editorReady: false, visibleOnce: false,
            createdAt: Date.now(), layoutSignature: '', stableSince: 0,
            lastAnchorRect: null, layoutRetryTimer: null,
        };
        // Only the toolbar label changes; this does not touch the map engine,
        // selection, keyboard shortcuts, or the existing persistence path.
        record.updateCaption = () => {
            const title = record.collapsed ? centerTopicTitle(record.map) : '思维导图';
            if (caption.textContent !== title) caption.textContent = title;
            caption.title = title; // full text on hover when CSS ellipsizes it
        };
        const smaller = this.makeButton('缩小', () => resize(-110));
        const larger = this.makeButton('增高', () => resize(+110));
        const expanded = this.makeButton('放大编辑', () => {
            root.classList.toggle('smm-inline-expanded');
            expanded.textContent = root.classList.contains('smm-inline-expanded') ? '返回文档' : '放大编辑';
            this.schedulePositions();
            if (record.sendViewState) record.sendViewState();
        });
        const save = this.makeButton('保存', () => record.save());
        save.disabled = readonly;
        const collapse = this.makeButton('最小化', () => {
            if (record.collapsed) {
                record.setCollapsed(false);
                return;
            }
            if (record.pendingCollapse) return;
            if (!record.editorReady) {
                status.textContent = '编辑器尚未加载完成，请稍后再最小化';
                return;
            }
            // Commit the currently edited text *inside the iframe* before hiding it.
            // Waiting for its acknowledgement also keeps the saving path unchanged.
            const requestId = uid();
            record.pendingCollapse = requestId;
            collapse.disabled = true;
            status.textContent = '正在保存并最小化…';
            record.collapseTimeout = setTimeout(() => {
                if (record.disposed || record.pendingCollapse !== requestId) return;
                record.pendingCollapse = null;
                collapse.disabled = false;
                status.textContent = '最小化未完成：编辑器未响应，请重试';
            }, 4000);
            frame.contentWindow.postMessage({
                channel: CHANNEL, session, type: 'prepare-collapse', requestId,
            }, window.location.origin);
        });
        collapse.classList.add('smm-inline-collapse-button');
        collapse.setAttribute('aria-expanded', 'true');
        collapse.title = '折叠当前思维导图块';
        const frame = document.createElement('iframe');
        frame.className = 'smm-inline-iframe';
        frame.title = '思源文档内的思维导图编辑器';
        frame.setAttribute('allow', 'clipboard-read; clipboard-write');
        frame.setAttribute('loading', 'eager');
        // Keep one source of truth for the two view buttons: the iframe toolbar
        // triggers these existing parent controls, including the safe save-then-collapse.
        record.toolbarActions = { collapse: () => collapse.click(), expand: () => expanded.click() };
        record.sendViewState = () => {
            if (!record.editorReady || record.disposed) return;
            frame.contentWindow.postMessage({
                channel: CHANNEL, session, type: 'toolbar-state',
                expanded: root.classList.contains('smm-inline-expanded'),
                collapsed: record.collapsed,
            }, window.location.origin);
        };
        toolbar.append(caption, status, smaller, larger, expanded, save, collapse);
        root.append(toolbar, frame);
        // Keep the live iframe in a stable SiYuan editor container. The old
        // document.body portal (z-index:8) sat above native slash menus and titles.
        // We never move this frame during a block re-render, so autosave stays seamless.
        const stableEditor = slot.closest && slot.closest('.protyle');
        const portalParent = stableEditor || document.body;
        portalParent.append(root);
        record.portalParent = portalParent;
        record.frame = frame;
        record.setCollapsed = isCollapsed => {
            if (record.disposed || record.collapsed === isCollapsed) return;
            record.collapsed = isCollapsed;
            root.classList.toggle('smm-inline-collapsed', isCollapsed);
            // Keep the canvas at its original height while clipped by the small
            // outer shell. A zero-height iframe can disrupt rendering and view data.
            frame.style.height = isCollapsed ? `${record.height}px` : '';
            if (record.slot) {
                record.slot.classList.toggle('smm-inline-slot-collapsed', isCollapsed);
                record.slot.style.height = `${isCollapsed ? COLLAPSED_HEIGHT : record.height + record.toolbarHeight}px`;
            }
            if (isCollapsed && root.classList.contains('smm-inline-expanded')) {
                root.classList.remove('smm-inline-expanded');
                expanded.textContent = '放大编辑';
            }
            collapse.textContent = isCollapsed ? '展开' : '最小化';
            collapse.title = isCollapsed ? '展开当前思维导图块' : '折叠当前思维导图块';
            collapse.setAttribute('aria-expanded', String(!isCollapsed));
            record.updateCaption();
            record.sendViewState();
            if (isCollapsed) {
                status.textContent = record.readonly ? '已最小化 · 只读' : '已最小化 · 已保存';
                clearTimeout(record.resumeTimer);
                record.resumeTimer = null;
            } else {
                status.textContent = record.readonly ? '只读模式' : '可编辑 · 自动保存';
                // The iframe remains mounted; its canvas must measure the new bounds.
                clearTimeout(record.resumeTimer);
                record.resumeTimer = setTimeout(() => {
                    record.resumeTimer = null;
                    if (record.disposed || record.collapsed) return;
                    frame.contentWindow.postMessage({
                        channel: CHANNEL, session, type: 'resume-layout',
                    }, window.location.origin);
                }, 110);
            }
            this.schedulePositions();
        };
        record.completeCollapse = (requestId, error) => {
            if (!record.pendingCollapse || record.pendingCollapse !== requestId || record.disposed) return;
            clearTimeout(record.collapseTimeout);
            record.collapseTimeout = null;
            record.pendingCollapse = null;
            collapse.disabled = false;
            if (error) {
                status.textContent = '最小化失败：' + String(error).slice(0, 80);
                return;
            }
            if (!record.save()) {
                status.textContent = '保存失败，已取消最小化';
                return;
            }
            record.setCollapsed(true);
        };
        this.sessions.set(session, record);
        if (key) this.recordsByKey.set(key, record);
        function resize(delta) {
            record.height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, record.height + delta));
            if (record.slot) record.slot.style.height = `${record.height + record.toolbarHeight}px`;
        }
        record.resize = resize;
        record.save = () => {
            if (record.disposed || record.readonly || !record.dirty || record.saving) return !record.dirty;
            clearTimeout(record.saveTimer);
            record.saveTimer = null;
            let raw;
            try { raw = encodeMap(record.map); }
            catch (error) {
                status.textContent = '序列化失败';
                console.error('[siyuan-mindmap] Encoding error:', error);
                return false;
            }
            if (raw === record.lastPersisted) {
                record.dirty = false;
                status.textContent = '已保存到文档';
                return true;
            }
            record.saving = true;
            record.lastSubmitted = raw;
            try {
                const result = record.setContent(raw);
                if (result === false) {
                    record.lastSubmitted = null;
                    status.textContent = '保存失败：文档只读或内容不支持';
                    return false;
                }
                record.lastPersisted = raw;
                record.dirty = false;
                status.textContent = '已保存到文档';
                return true;
            } catch (error) {
                record.lastSubmitted = null;
                status.textContent = '保存失败，请检查开发者控制台';
                console.error('[siyuan-mindmap] setContent failed:', error);
                return false;
            } finally { record.saving = false; }
        };
        record.applyPatch = patch => {
            if (record.disposed || readonly || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
            const accepted = ['mindMapData', 'mindMapConfig', 'lang', 'localConfig'];
            let changed = false;
            for (const field of accepted) {
                if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
                record.map[field] = patch[field];
                changed = true;
            }
            if (!changed) return;
            // Filter out identical autosaves, e.g. redundant view-state notifications.
            const encoded = encodeMap(record.map);
            if (encoded === record.lastEncoded) return;
            record.lastEncoded = encoded;
            record.dirty = true;
            if (Object.prototype.hasOwnProperty.call(patch, 'mindMapData')) record.updateCaption();
            status.textContent = '有未保存的更改…';
            clearTimeout(record.saveTimer);
            record.saveTimer = setTimeout(() => record.save(), SAVE_DELAY_MS);
        };
        slot.style.height = `${record.height + record.toolbarHeight}px`;
        if (typeof ResizeObserver !== 'undefined') {
            record.observer = new ResizeObserver(() => this.schedulePositions());
            record.observer.observe(slot);
            if (stableEditor) record.observer.observe(stableEditor);
        }
        // The title can grow without a ResizeObserver notification from our
        // fixed-size placeholder. Track text and style changes on the editor,
        // excluding our portal (a sibling of .protyle-content) to avoid loops.
        const protyleContent = slot.closest && slot.closest('.protyle-content');
        if (protyleContent && typeof MutationObserver !== 'undefined') {
            record.layoutObserver = new MutationObserver(() => this.schedulePositions());
            record.layoutObserver.observe(protyleContent, {
                childList: true, subtree: true, characterData: true,
                attributes: true, attributeFilter: ['style', 'class']
            });
        }
        const protyleTitle = stableEditor && stableEditor.querySelector && stableEditor.querySelector('.protyle-title');
        if (protyleTitle && typeof ResizeObserver !== 'undefined') record.observer.observe(protyleTitle);
        if (protyleTitle && typeof MutationObserver !== 'undefined') {
            record.titleObserver = new MutationObserver(() => this.schedulePositions());
            record.titleObserver.observe(protyleTitle, {
                childList: true, subtree: true, characterData: true, attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        record.loadingTimer = setTimeout(() => {
            if (!record.disposed && status.textContent.includes('正在加载')) {
                status.textContent = '加载超时，请检查编辑器资源';
            }
        }, 15000);
        frame.src = `/plugins/${encodeURIComponent(this.name)}/editor/index.html?session=${encodeURIComponent(session)}`;
        this.schedulePositions();
        return record;
    }

    makeButton(label, callback) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'b3-button b3-button--outline smm-inline-button';
        button.textContent = label;
        button.addEventListener('mousedown', event => event.stopPropagation());
        button.addEventListener('click', event => { event.stopPropagation(); callback(); });
        return button;
    }

    retryPosition(record, delay = 65) {
        if (record.disposed || record.layoutRetryTimer) return;
        record.layoutRetryTimer = setTimeout(() => {
            record.layoutRetryTimer = null;
            if (!record.disposed) this.schedulePositions();
        }, delay);
    }

    schedulePositions() {
        if (this.positionsQueued) return;
        this.positionsQueued = true;
        const schedule = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
        schedule(() => { this.positionsQueued = false; this.positionAll(); });
    }

    positionAll() {
        for (const record of this.sessions.values()) {
            if (record.disposed || !record.root || !record.anchor) continue;
            if (record.root.classList.contains('smm-inline-expanded')) {
                record.root.style.visibility = 'visible';
                continue;
            }
            const anchor = record.anchor;
            if (!anchor.isConnected || !anchor.getBoundingClientRect) {
                record.root.style.visibility = 'hidden';
                continue;
            }
            const rect = anchor.getBoundingClientRect();
            // Read the actual document title separately: SiYuan may render it
            // after the map custom block has already been mounted.
            const scope = record.portalParent && record.portalParent !== document.body
                ? record.portalParent : (anchor.closest && anchor.closest('.protyle'));
            const title = scope && scope.querySelector && scope.querySelector('.protyle-title');
            const titleRect = title && title.getBoundingClientRect ? title.getBoundingClientRect() : null;
            const titleIsVisible = titleRect && titleRect.height > 0 && titleRect.width > 0;
            const overlapsTitle = titleIsVisible &&
                rect.top < titleRect.bottom + TITLE_GAP_PX &&
                rect.right > titleRect.left && rect.left < titleRect.right;

            let top = 0, bottom = window.innerHeight || document.documentElement.clientHeight;
            let left = 0, right = window.innerWidth || document.documentElement.clientWidth;
            const editor = anchor.closest && anchor.closest('.protyle-content');
            if (editor && editor.getBoundingClientRect) {
                const clip = editor.getBoundingClientRect();
                top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
                left = Math.max(left, clip.left); right = Math.min(right, clip.right);
            }
            const x = Math.max(rect.left, left);
            const y = Math.max(rect.top, top);
            const width = Math.max(0, Math.min(rect.right, right) - x);
            const height = Math.max(0, Math.min(rect.bottom, bottom) - y);
            if (width < 30 || height < 24) {
                record.root.style.visibility = 'hidden';
                continue;
            }
            // IMPORTANT: even while invisible, the iframe MUST have the real
            // bounds. Otherwise its canvas initializes at zero size and can
            // later require a costly rebuild.
            let posX = x, posY = y;
            if (record.portalParent && record.portalParent !== document.body && window.getComputedStyle) {
                const style = window.getComputedStyle(record.portalParent);
                if ((style.transform && style.transform !== 'none') ||
                    (style.perspective && style.perspective !== 'none') ||
                    (style.filter && style.filter !== 'none')) {
                    const parentRect = record.portalParent.getBoundingClientRect();
                    posX -= parentRect.left;
                    posY -= parentRect.top;
                }
            }
            const bounds = {left: `${posX}px`, top: `${posY}px`,
                width: `${width}px`, height: `${height}px`};
            for (const [name, value] of Object.entries(bounds)) {
                if (record.root.style[name] !== value) record.root.style[name] = value;
            }
            record.lastAnchorRect = {top: rect.top, left: rect.left};
            if (overlapsTitle) {
                record.root.style.visibility = 'hidden';
                if (!record.visibleOnce) {record.layoutSignature = ''; record.stableSince = 0;}
                this.retryPosition(record, 120);
                continue;
            }
            if (!record.editorReady) {
                record.root.style.visibility = 'hidden';
                continue;
            }
            if (!record.visibleOnce) {
                const now = Date.now();
                const signature = [x, y, width, height,
                    titleIsVisible ? Math.round(titleRect.bottom) : 'no-title']
                    .map(v => typeof v === 'number' ? Math.round(v) : v).join(':');
                if (signature !== record.layoutSignature) {
                    record.layoutSignature = signature;
                    record.stableSince = now;
                }
                if (now - record.stableSince < FIRST_SHOW_QUIET_MS ||
                    (!titleIsVisible && now - record.createdAt < TITLE_ABSENT_GRACE_MS)) {
                    record.root.style.visibility = 'hidden';
                    this.retryPosition(record);
                    continue;
                }
            }
            record.root.style.visibility = 'visible';
            record.visibleOnce = true;
            record.slot && record.slot.classList && record.slot.classList.remove('smm-inline-slot-pending');
        }
    }

    handleFrameMessage(event) {
        const data = event.data;
        if (!data || data.channel !== CHANNEL || typeof data.session !== 'string') return;
        if (event.origin !== window.location.origin) return;
        const record = this.sessions.get(data.session);
        if (!record || record.disposed || event.source !== record.frame.contentWindow) return;
        if (data.type === 'ready') {
            clearTimeout(record.loadingTimer);
            record.status.textContent = '初始化思维导图…';
            record.frame.contentWindow.postMessage({
                channel: CHANNEL, type: 'init', session: data.session,
                document: record.map, readonly: record.readonly,
            }, window.location.origin);
        } else if (data.type === 'initialized') {
            record.editorReady = true;
            // The first visible position is intentionally deferred until
            // title and block geometry have settled.
            this.schedulePositions();
            record.status.textContent = record.readonly ? '只读模式' : '可编辑 · 自动保存';
            record.sendViewState();
        } else if (data.type === 'toolbar-action') {
            // The request is already checked against the exact iframe source,
            // origin and session above. The parent executes the original buttons.
            if (!record.editorReady || record.collapsed || !record.toolbarActions) return;
            if (data.action === 'collapse') record.toolbarActions.collapse();
            if (data.action === 'toggle-expanded') record.toolbarActions.expand();
        } else if (data.type === 'patch') {
            record.applyPatch(data.patch);
        } else if (data.type === 'collapse-ready' || data.type === 'collapse-error') {
            if (record.completeCollapse) {
                record.completeCollapse(data.requestId, data.type === 'collapse-error'
                    ? (data.message || '无法结束文字编辑') : null);
            }
        } else if (data.type === 'flush') {
            record.save();
        } else if (data.type === 'error') {
            record.status.textContent = '编辑器错误：' + String(data.message || '未知错误').slice(0, 160);
            console.error('[siyuan-mindmap] Embedded editor error:', data.message);
        }
    }

    dispose(record, flush = true) {
        if (record.disposed) return;
        if (flush) record.save();
        record.disposed = true;
        clearTimeout(record.saveTimer);
        clearTimeout(record.collapseTimeout);
        clearTimeout(record.resumeTimer);
        record.pendingCollapse = null;
        clearTimeout(record.loadingTimer);
        clearTimeout(record.layoutRetryTimer);
        clearTimeout(record.teardownTimer);
        if (record.observer) record.observer.disconnect();
        if (record.layoutObserver) record.layoutObserver.disconnect();
        if (record.titleObserver) record.titleObserver.disconnect();
        if (record.root && record.root.parentNode) record.root.parentNode.removeChild(record.root);
        this.sessions.delete(record.session);
        if (record.key && this.recordsByKey.get(record.key) === record) this.recordsByKey.delete(record.key);
    }

    onunload() {
        for (const record of Array.from(this.sessions.values())) this.dispose(record, true);
        if (typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener('keydown', this.onAdjacentMapBackspace, true);
        }
        window.removeEventListener('message', this.onFrameMessage);
        window.removeEventListener('scroll', this.repositionAll, true);
        window.removeEventListener('resize', this.repositionAll);
        window.removeEventListener('input', this.repositionAll, true);
        window.removeEventListener('transitionend', this.repositionAll, true);
    }
}

exports.default = SiYuanMindMapInline;
exports.__test = { blankMap, decodeMap, encodeMap, mindMapMarkdown, BLOCK_TYPE, CHANNEL, safeTheme, DEFAULT_THEME, THEME_OPTIONS, previewNodeTree, previewText, appendMindMapPreview, centerTopicTitle, shouldProtectAdjacentMapBackspace };
