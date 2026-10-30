'use strict';
// Inspect the packaged JS using a browser-like DOM. No network or SiYuan installation required.
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../index.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../index.css'),'utf8');
test('portal is inside the stable editor, not document.body',()=>{
 assert.ok(source.includes('const portalParent = stableEditor || document.body'));
 assert.ok(source.includes('portalParent.append(root)'));
 assert.ok(!source.includes('document.body.append(root)'));
 assert.match(css,/\.smm-inline-portal\s*\{position:fixed;z-index:1;/);
});
test('native popup layers and document title move are observed',()=>{
 assert.ok(css.includes('.protyle-hint'));
 assert.ok(css.includes('.protyle-toolbar'));
 assert.ok(source.includes("window.addEventListener('input', this.repositionAll, true)"));
 assert.ok(source.includes('record.titleObserver.observe(protyleTitle'));
 assert.ok(source.includes('record.observer.observe(stableEditor)'));
 assert.ok(source.includes('attributeFilter: [\'style\', \'class\']'));
});
test('autosave still retains the live iframe',()=>{
 assert.ok(source.includes('this.recordsByKey.get(key)'));
 assert.ok(source.includes('record.anchor = slot'));
 assert.ok(source.includes('frame.src = `/plugins/'));
});
