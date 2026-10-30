'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const plugin=fs.readFileSync(path.join(root,'src/index.js'),'utf8');
const css=fs.readFileSync(path.join(root,'index.css'),'utf8');
test('startup in-flow SVG preview replaces text-only waiting placeholder',()=>{
  assert.ok(plugin.includes('appendMindMapPreview(slot, record && !record.disposed ? record.map : documentData)'));
  assert.ok(plugin.includes("wrap.className = 'smm-inline-preview'"));
  assert.ok(plugin.includes("document.createElementNS(PREVIEW_SVG_NS, 'svg')"));
  assert.ok(css.includes('.smm-inline-slot:not(.smm-inline-slot-pending) .smm-inline-preview {display:none;}'));
  assert.ok(!css.includes('正在准备思维导图'));
});
test('existing title collision guard and iframe reuse are retained',()=>{
  assert.ok(plugin.includes('const overlapsTitle = titleIsVisible &&'));
  assert.ok(plugin.includes("record.root.style.visibility = 'hidden'"));
  assert.ok(plugin.includes('record.root.style.visibility = \'visible\';'));
  assert.ok(plugin.includes('this.recordsByKey.get(key)'));
  assert.ok(plugin.includes('record.anchor = slot'));
});
test('preview never executes user-provided markup or overwrites stored JSON',()=>{
  assert.ok(plugin.includes('label.textContent = clipped'));
  assert.ok(!plugin.includes('label.innerHTML ='));
  assert.ok(plugin.includes('const PREVIEW_MAX_NODES = 72'));
  assert.ok(plugin.includes("record.setContent(raw)"));
});
