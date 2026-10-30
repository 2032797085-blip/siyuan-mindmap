'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const realLoad = Module._load;
Module._load = function (id, parent, isMain) {
    if (id === 'siyuan') return {Plugin: class {}, showMessage() {}, Setting: class {}};
    return realLoad.apply(this, arguments);
};
const mod = require('../src/index.js');
Module._load = realLoad;
const guard = mod.__test.shouldProtectAdjacentMapBackspace;

class Element {
    constructor(attrs = {}) {
        this.nodeType = 1;
        this.attributes = attrs;
        this.parentElement = null;
        this.previousElementSibling = null;
        this.childNodes = [];
        this.isConnected = true;
    }
    getAttribute(attr) {return this.attributes[attr] || null;}
    hasAttribute(attr) {return attr in this.attributes;}
    matches(selector) {
        return selector.split(',').some(part => {
            const trimmed = part.trim();
            if (trimmed.startsWith('.')) return (this.attributes.class || '').split(/\s+/).includes(trimmed.slice(1));
            if (trimmed.startsWith('[')) {
                const match = /^\[([^=]+)(?:="([^"]*)")?\]$/.exec(trimmed);
                return !!match && (match[2] == null ? this.hasAttribute(match[1]) : this.getAttribute(match[1]) === match[2]);
            }
            return trimmed === (this.attributes.tag || 'div');
        });
    }
    closest(selector) {for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null;}
    contains(node) {for (let n = node; n; n = n.parentElement) if (n === this) return true; return false;}
    querySelector(selector) {
        const visit = parent => {
            for (const child of parent.childNodes) {
                if (child.nodeType === 1) {
                    if (child.matches(selector)) return child;
                    const nested = visit(child);
                    if (nested) return nested;
                }
            }
            return null;
        };
        return visit(this);
    }
    append(el) {el.parentElement = this; el.previousElementSibling = this.childNodes.filter(c => c.nodeType === 1).at(-1) || null; this.childNodes.push(el);}
}
class TextNode {
    constructor(parent, value) {this.nodeType = 3; this.parentElement = parent; this.textContent = value; parent.childNodes.push(this);}
}
function fixture({text = '内容', offset = 0, selected = false, mapBefore = true, textInput = false} = {}) {
    const editor = new Element({class: 'protyle'});
    const wysiwyg = new Element({class: 'protyle-wysiwyg', contenteditable: 'true'});
    editor.append(wysiwyg);
    const map = new Element({'data-node-id': 'map-id', 'data-type': 'NodeCustomBlock'});
    const slot = new Element({class: 'smm-inline-slot'});
    map.append(slot);
    const ordinary = new Element({'data-node-id': 'normal-id', 'data-type': 'NodeParagraph'});
    const paragraph = new Element({'data-node-id': 'paragraph-id', 'data-type': 'NodeParagraph'});
    const editable = new Element({contenteditable: 'true'});
    paragraph.append(editable);
    if (mapBefore) {wysiwyg.append(map); wysiwyg.append(paragraph);} else {wysiwyg.append(paragraph); wysiwyg.append(map);}
    const textNode = new TextNode(editable, text);
    const range = {
        startContainer: textNode, startOffset: offset, collapsed: true,
        cloneRange() {
            return {
                collapsed: false,
                selectNodeContents() {},
                setEnd(node, position) {this.collapsed = position === 0; this.position = position;},
                toString() {return text.slice(0, this.position);},
                cloneContents() {return {querySelector() {return null;}};},
            };
        },
    };
    const selection = {rangeCount: 1, isCollapsed: true, getRangeAt() {return range;}};
    const target = textInput ? new Element({tag: 'input'}) : editable;
    if (textInput) editable.append(target);
    const records = new Map([['s', {anchor: slot, disposed: false}]]);
    if (selected) map.attributes.class = 'protyle-wysiwyg--select';
    const event = {key: 'Backspace', target, defaultPrevented: false, isComposing: false};
    return {event, records, selection, map, paragraph, editor, wysiwyg, editable, textNode, range, slot};
}

test('unselected mind-map immediately before caret is protected at paragraph start', () => {
    const x = fixture();
    assert.equal(guard(x.event, x.records, x.selection), true);
});
test('selected map remains deletable with Backspace', () => {
    const x = fixture({selected: true});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('ordinary text Backspace still works in the paragraph after map', () => {
    const x = fixture({text: 'hello', offset: 2});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('ordinary whitespace before caret can be deleted', () => {
    const x = fixture({text: ' hello', offset: 1});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('SiYuan invisible zero-width caret markers are protected at map boundary', () => {
    const x = fixture({text: '\u200b内容', offset: 1});
    assert.equal(guard(x.event, x.records, x.selection), true);
});
test('a paragraph before a map is not protected', () => {
    const x = fixture({mapBefore: false});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('only Backspace is intercepted: Delete, F2, Tab, Enter and arrows retain original behavior', () => {
    const x = fixture();
    for (const key of ['Delete', 'F2', 'Enter', 'Tab', 'ArrowDown', 'a']) {
        x.event.key = key;
        assert.equal(guard(x.event, x.records, x.selection), false, key);
    }
});
test('modifiers, IME composition and already-processed events retain native behavior', () => {
    const x = fixture();
    for (const key of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
        x.event[key] = true;
        assert.equal(guard(x.event, x.records, x.selection), false, key);
        x.event[key] = false;
    }
    x.event.keyCode = 229;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('text inputs and dialog controls are never intercepted', () => {
    const x = fixture({textInput: true});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('unrelated editors and unmounted maps are not protected', () => {
    const x = fixture();
    x.records.get('s').disposed = true;
    assert.equal(guard(x.event, x.records, x.selection), false);
    x.records.get('s').disposed = false;
    x.map.isConnected = false;
    assert.equal(guard(x.event, x.records, x.selection), false);
    x.map.isConnected = true;
    x.event.target = new Element({class: 'protyle'});
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('selections crossing text or multiple blocks are never intercepted', () => {
    const x = fixture();
    x.selection.isCollapsed = false;
    assert.equal(guard(x.event, x.records, x.selection), false);
    x.selection.isCollapsed = true;
    x.range.collapsed = false;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('Backspace on map shell is not intercepted (SiYuan handles block selection)', () => {
    const x = fixture();
    x.event.target = x.slot;
    x.range.startContainer = x.slot;
    x.range.startOffset = 0;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('selected map remains deletable even if Range points inside the map shell', () => {
    const x = fixture({selected: true});
    x.event.target = x.slot;
    x.range.startContainer = x.slot;
    x.range.startOffset = 0;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('editor-level caret at map boundary is not intercepted', () => {
    const x = fixture();
    x.event.target = x.wysiwyg;
    x.range.startContainer = x.wysiwyg;
    x.range.startOffset = 1;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('does not suppress text at start if an unrelated block separates map and caret', () => {
    const x = fixture();
    const other = new Element({'data-node-id': 'other', 'data-type': 'NodeParagraph'});
    other.previousElementSibling = x.map;
    x.paragraph.previousElementSibling = other;
    assert.equal(guard(x.event, x.records, x.selection), false);
});
test('capturing handler registers and is removed on unload; selected block deletion passes through', async () => {
    const listeners = [];
    const priorDocument = global.document, priorWindow = global.window;
    global.document = {
        createElement: () => ({className: '', value: '', append() {}, addEventListener() {}, style: {}}),
        addEventListener: (name, callback, capture) => listeners.push({name, callback, capture}),
        removeEventListener: (name, callback, capture) => listeners.push({name: 'removed-' + name, callback, capture}),
    };
    const x = fixture();
    global.window = {location: {origin: 'http://localhost:6806'}, getSelection: () => x.selection,
        addEventListener() {}, removeEventListener() {}};
    const instance = new mod.default();
    instance.name = 'siyuan-mindmap'; instance.customBlockRenders = {};
    instance.loadData = async () => null;
    instance.configureSettings = () => {};
    instance.addIcons = () => {};
    instance.addToolbarItem = () => {};
    instance.addBreadcrumbButton = () => {};
    try {
        await instance.onload();
        const listener = listeners.find(e => e.name === 'keydown');
        assert.ok(listener); assert.equal(listener.capture, true);
        instance.sessions.set('t', [...x.records.values()][0]);
        let prevented = 0, stopped = 0;
        x.event.preventDefault = () => prevented++;
        x.event.stopImmediatePropagation = () => stopped++;
        listener.callback(x.event);
        assert.equal(prevented, 1); assert.equal(stopped, 1);
        x.map.attributes.class = 'protyle-wysiwyg--select';
        listener.callback(x.event);
        assert.equal(prevented, 1, 'Explicit selection can be deleted by SiYuan');
        x.map.attributes.class = '';
        x.event.key = 'Delete'; listener.callback(x.event);
        assert.equal(prevented, 1, 'Delete stays unchanged');
        instance.sessions.clear(); instance.onunload();
        const removed = listeners.find(e => e.name === 'removed-keydown');
        assert.equal(removed.callback, listener.callback); assert.equal(removed.capture, true);
    } finally {global.document = priorDocument; global.window = priorWindow;}
});
