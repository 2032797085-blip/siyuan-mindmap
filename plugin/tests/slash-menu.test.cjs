'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const oldLoad = Module._load;
const messages = [];
class FakeElement {
    constructor(tag = 'div') {this.tagName=tag;this.value='';this.textContent='';this.children=[];this.className='';this.attributes={};}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(name,value){this.attributes[name]=value;}
}
const listeners = new Map();
global.document = {
    createElement(tag){return new FakeElement(tag);},
    createElementNS(ns, tag){return new FakeElement(tag);},
    addEventListener(name, fn){listeners.set(name,fn);},
    removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
};
global.window = {
    location:{origin:'http://localhost:6806'},
    siyuan:{config:{readonly:false}},
    addEventListener(name,fn){listeners.set(name,fn);},
    removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},
};
class PluginMock {
    constructor(){this.name='siyuan-mindmap';this.customBlockRenders={};}
    loadData(){return Promise.resolve(null);}
    saveData(){return Promise.resolve();}
    addIcons(){}
    addToolbarItem(item){this.toolbarItem=item;}
    addBreadcrumbButton(item){this.breadcrumbItem=item;}
}
Module._load = function(name, parent, isMain) {
    if (name === 'siyuan') return {
        Plugin:PluginMock,
        showMessage:(...msg)=>messages.push(msg),
        Setting:class {addItem(){}},
    };
    return oldLoad.apply(this,arguments);
};
const mod = require('../src/index.js');
Module._load=oldLoad;
const MindMap=mod.default;
const {decodeMap} = mod.__test;
const extractMarkdown = value => {const match=value.match(/;;;siyuan-mindmap\/mindmap\n([^\n]+)\n;;;/); assert.ok(match,'custom block markdown must be present');return decodeMap(match[1]);};

test('slash menu registers a distinct custom-block entry alongside existing toolbar', async () => {
    const p=new MindMap();await p.onload();
    assert.equal(p.protyleSlash.length,1);
    const item=p.protyleSlash[0];
    assert.equal(item.id,'siyuan-mindmap-insert-block');
    assert.ok(item.filter.includes('思维导图块'));
    assert.ok(item.filter.includes('swdtk'));
    assert.ok(!item.filter.includes('思维导图'), 'do not clash with SiYuan native mindmap list');
    assert.match(item.html,/思维导图块/);
    assert.ok(p.toolbarItem && p.breadcrumbItem, 'previous insertion entries must survive');
    assert.equal(typeof item.callback,'function');
    p.onunload();
});

test('slash insertion reuses the same JSON format and selected default theme',async()=>{
    const p=new MindMap();await p.onload();
    p.defaultTheme='avocado';
    let payload=null;
    let count=0;
    const protyle={protyle:{disabled:false,lute:{Md2BlockDOM:markdown=>{const map=extractMarkdown(markdown);assert.equal(map.mindMapData.root.data.text,'中心主题');assert.equal(map.mindMapData.theme.template,'avocado');return '<custom-block>'+markdown+'</custom-block>'; }}}, insert:(html,isBlock)=>{assert.equal(isBlock,true,'custom block must be inserted at block level');count++;payload=html;}};
    assert.equal(p.protyleSlash[0].callback(protyle),true);
    assert.equal(count,1,'one slash choice creates one map');
    assert.match(payload,/siyuan-mindmap\/mindmap/);
    const map=extractMarkdown(payload);
    assert.deepEqual(map.mindMapData.root.children,[]);
    p.onunload();
});

test('slash action cannot insert in read-only or unsupported editor',async()=>{
    const p=new MindMap();await p.onload();
    let count=0;
    const protyle={protyle:{disabled:true,lute:{Md2BlockDOM:x=>x}},insert:()=>count++};
    assert.equal(p.protyleSlash[0].callback(protyle),false);
    assert.equal(p.protyleSlash[0].callback({}),false);
    assert.equal(count,0);
    assert.ok(messages.some(msg=>msg[0].includes('可编辑')));
    p.onunload();
});

test('existing breadcrumb insertion remains available',async()=>{
    const p=new MindMap();await p.onload();
    let count=0;
    const wrapper={disabled:false,lute:{Md2BlockDOM:x=>x},getInstance:()=>({insert:(html)=>{extractMarkdown(html);count++;}})};
    assert.equal(p.insertAtCaret(wrapper),true);
    assert.equal(count,1);
    p.onunload();
});
