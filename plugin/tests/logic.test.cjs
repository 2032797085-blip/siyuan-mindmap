'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const loader=Module._load;
class FakeElement {
 constructor(tag='div') {this.tagName=tag;this.children=[];this.style={};this.isConnected=true;this.attributes={};this.handlers={};this.parentNode=null;this.textContent='';this.classList={classes:new Set(),add(n){this.classes.add(n)},remove(n){this.classes.delete(n)},contains(n){return this.classes.has(n)},toggle(n,force){if(force===true){this.classes.add(n);return true}if(force===false){this.classes.delete(n);return false}if(this.classes.has(n)){this.classes.delete(n);return false;}this.classes.add(n);return true}};this.contentWindow={postMessage:(data)=>{this.lastPost=data}};}
 append(...list){list.forEach(e=>{this.children.push(e);e.parentNode=this})}
 appendChild(child){this.append(child);return child}
 setAttribute(k,v){this.attributes[k]=v}
 getAttribute(k){return this.attributes[k]}
 addEventListener(k,cb){this.handlers[k]=cb}
 removeChild(e){const i=this.children.indexOf(e);if(i!==-1)this.children.splice(i,1);e.parentNode=null}
 closest(s){if(s==='[data-node-id]')return this.block||this; if(s==='.protyle')return this.scope||null;return null}
 getBoundingClientRect(){return {left:100,top:100,right:700,bottom:700,width:600,height:600}}
}
const events=new Map();
global.document={body:new FakeElement('body'),createElement:t=>new FakeElement(t),createElementNS:(ns,t)=>new FakeElement(t),documentElement:{clientHeight:900,clientWidth:1200}};
global.window={location:{origin:'http://localhost:6806'},innerHeight:900,innerWidth:1200,siyuan:{config:{readonly:false}},addEventListener:(k,f)=>events.set(k,f),removeEventListener:(k,f)=>{if(events.get(k)===f)events.delete(k)},requestAnimationFrame:fn=>setTimeout(fn,0)};
class PluginMock {constructor(){this.name='siyuan-mindmap';this.customBlockRenders={};this.storage={}}async loadData(k){return this.storage[k]}async saveData(k,v){this.storage[k]=v}addIcons(){}addToolbarItem(obj){this.toolbar=obj}addBreadcrumbButton(obj){this.breadcrumb=obj}}
Module._load=function(name,parent,main){if(name==='siyuan')return {Plugin:PluginMock,Setting:class {constructor(args){this.args=args;this.items=[]}addItem(item){this.items.push(item)}},showMessage:()=>{}};return loader.apply(this,arguments)};
const mod=require('../src/index.js');Module._load=loader;
const Plugin=mod.default;
const {blankMap,decodeMap,encodeMap,mindMapMarkdown,CHANNEL,centerTopicTitle}=mod.__test;

test('serialization and custom block insertion',async()=>{
 const doc=blankMap('主题');assert.deepEqual(decodeMap(encodeMap(doc)),doc);
 assert.match(mindMapMarkdown('siyuan-mindmap',doc),/^;;;siyuan-mindmap\/mindmap\n/);
 const p=new Plugin();await p.onload();
 const editor={disabled:false,lute:{Md2BlockDOM:x=>x},getInstance(){return{insert:(x)=>{assert.match(x,/;;;siyuan-mindmap\/mindmap/)}}}};
 assert.equal(p.insertAtCaret(editor),true);p.onunload();
});

test('re-render after a save retains the exact iframe and session',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='block-test';
 const scope=new FakeElement();
 const mount=()=>{const el=new FakeElement();el.block=block;el.scope=scope;return el};
 let cleanup=null;const saved=[];
 let current=encodeMap(blankMap('初始'));
 function render(){const oldCleanup=cleanup;const el=mount();if(oldCleanup)oldCleanup();cleanup=p.renderEmbeddedMap({element:el,content:current,setContent:raw=>{current=raw;saved.push(raw);render();return true;}})}
 render();const first=[...p.sessions.values()][0];
 first.applyPatch({lang:'en'});
 await new Promise(r=>setTimeout(r,1500));
 assert.equal(saved.length,1);
 assert.equal(decodeMap(saved[0]).lang,'en');
 assert.equal(p.sessions.size,1);
 assert.equal([...p.sessions.values()][0],first);
 assert.equal(first.disposed,false);
 assert.equal(first.status.textContent,'已保存到文档');
 cleanup();await new Promise(r=>setTimeout(r,750));
 assert.equal(p.sessions.size,0);
 p.onunload();
});

test('untrusted frame messages cannot change document',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='abc';
 const element=new FakeElement();element.block=block;
 p.renderEmbeddedMap({element,content:encodeMap(blankMap()),setContent:()=>true});
 const record=[...p.sessions.values()][0];
 const send=(origin,source)=>p.handleFrameMessage({origin,source,data:{channel:CHANNEL,type:'patch',session:record.session,patch:{lang:'en'}}});
 send('https://evil.test',record.frame.contentWindow);
 send('http://localhost:6806',{});
 assert.equal(record.map.lang,'zh');
 p.onunload();
});

test('multiple maps and duplicate document views stay independent',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='shared-block';
 const render=(scope,title)=>{
   const element=new FakeElement();element.block=block;element.scope=scope;
   return p.renderEmbeddedMap({element,content:encodeMap(blankMap(title)),setContent:()=>true});
 };
 const cleanup1=render(new FakeElement(),'文档 A');
 const cleanup2=render(new FakeElement(),'文档 B');
 assert.equal(p.sessions.size,2);
 assert.notEqual([...p.sessions.values()][0].frame,[...p.sessions.values()][1].frame);
 cleanup1();cleanup2();p.onunload();
});

test('identical updates skip writes and different rapid updates coalesce',async()=>{
 const p=new Plugin();await p.onload();
 const element=new FakeElement();const block=new FakeElement();block.attributes['data-node-id']='changes';element.block=block;
 const saves=[];
 const cleanup=p.renderEmbeddedMap({element,content:encodeMap(blankMap()),setContent:raw=>{saves.push(raw);return true}});
 const record=[...p.sessions.values()][0];
 record.applyPatch({lang:'zh'});
 assert.equal(record.dirty,false);
 for(let i=0;i<9;i++)record.applyPatch({lang:`zh-${i}`});
 await new Promise(resolve=>setTimeout(resolve,1490));
 assert.equal(saves.length,1);
 assert.equal(decodeMap(saves[0]).lang,'zh-8');
 cleanup();p.onunload();
});

test('default theme settings persist and affect only newly inserted maps', async()=>{
 const p=new Plugin();await p.onload();
 assert.equal(p.defaultTheme,'simpleBlack');
 assert.equal(blankMap().mindMapData.theme.template,'simpleBlack');
 const item=p.setting.items[0];
 assert.equal(item.title,'新建导图的默认主题');
 const picker=item.createActionElement();picker.value='blackGold';
 await p.setting.args.confirmCallback();
 assert.equal(p.storage['settings.json'].defaultTheme,'blackGold');
 assert.equal(p.defaultTheme,'blackGold');
 let inserted='';
 const editor={disabled:false,lute:{Md2BlockDOM:x=>x},getInstance(){return {insert:x=>{inserted=x}}}};
 p.insertAtCaret(editor);
 assert.ok(inserted.includes('"template":"blackGold"'));
 assert.equal(blankMap('保留旧导图','avocado').mindMapData.theme.template,'avocado');
 p.onunload();
});


test('minimize waits for editor commit and preserves live iframe',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='collapse-map';
 const el=new FakeElement();el.block=block;
 const saved=[];
 const cleanup=p.renderEmbeddedMap({element:el,content:encodeMap(blankMap('首页')),setContent:raw=>{saved.push(raw);return true}});
 const record=[...p.sessions.values()][0];
 const frame=record.frame;record.editorReady=true;
 const collapseBtn=record.root.children[0].children.at(-1);
 assert.equal(collapseBtn.textContent,'最小化');
 collapseBtn.handlers.click({stopPropagation(){}});
 assert.equal(record.collapsed,false,'must not hide before editor confirms text commit');
 assert.ok(record.pendingCollapse);
 const requestId=record.pendingCollapse;
 assert.equal(frame.lastPost.type,'prepare-collapse');
 assert.equal(frame.lastPost.requestId,requestId);
 p.handleFrameMessage({origin:window.location.origin,source:frame.contentWindow,data:{channel:CHANNEL,session:record.session,type:'patch',patch:{mindMapData:{...record.map.mindMapData,root:{data:{text:'已写入'},children:[]}}}}});
 p.handleFrameMessage({origin:window.location.origin,source:frame.contentWindow,data:{channel:CHANNEL,session:record.session,type:'collapse-ready',requestId}});
 assert.equal(saved.length,1,'commit must be persisted before minimizing');
 assert.equal(record.collapsed,true);
 assert.equal(record.root.classList.contains('smm-inline-collapsed'),true);
 assert.equal(record.slot.classList.contains('smm-inline-slot-collapsed'),true);
 assert.equal(record.slot.style.height,'48px');
 assert.equal(frame.style.height,'799px','canvas height must be preserved when minimized');
 assert.equal(record.frame,frame);
 collapseBtn.handlers.click({stopPropagation(){}});
 assert.equal(record.collapsed,false);
 assert.equal(record.slot.style.height,'839px');
 assert.equal(frame.style.height,'');
 await new Promise(resolve=>setTimeout(resolve,160));
 assert.equal(frame.lastPost.type,'resume-layout');
 assert.equal(record.frame,frame);
 cleanup();p.onunload();
});

test('failed save or failed editor commit must not minimize',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='collapse-fail';
 const el=new FakeElement();el.block=block;
 p.renderEmbeddedMap({element:el,content:encodeMap(blankMap()),setContent:()=>false});
 const record=[...p.sessions.values()][0];record.editorReady=true;
 const btn=record.root.children[0].children.at(-1);
 btn.handlers.click({stopPropagation(){}});
 const id1=record.pendingCollapse;
 p.handleFrameMessage({origin:window.location.origin,source:record.frame.contentWindow,data:{channel:CHANNEL,session:record.session,type:'collapse-error',requestId:id1,message:'IME active'}});
 assert.equal(record.collapsed,false);
 assert.match(record.status.textContent,/IME active/);
 btn.handlers.click({stopPropagation(){}});
 const id2=record.pendingCollapse;
 record.applyPatch({lang:'en'});
 p.handleFrameMessage({origin:window.location.origin,source:record.frame.contentWindow,data:{channel:CHANNEL,session:record.session,type:'collapse-ready',requestId:id1}});
 assert.equal(record.pendingCollapse,id2,'stale acknowledgement must be ignored');
 p.handleFrameMessage({origin:window.location.origin,source:record.frame.contentWindow,data:{channel:CHANNEL,session:record.session,type:'collapse-ready',requestId:id2}});
 assert.equal(record.collapsed,false,'save failure must keep editor open');
 assert.match(record.status.textContent,/保存失败/);
 p.onunload();
});

test('minimized block survives SiYuan remount and other blocks remain independent',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='remount';
 const scope=new FakeElement();
 const old=new FakeElement();old.block=block;old.scope=scope;
 const data=encodeMap(blankMap());
 const cleanup1=p.renderEmbeddedMap({element:old,content:data,setContent:()=>true});
 const record=[...p.sessions.values()][0];
 record.setCollapsed(true);
 const newEl=new FakeElement();newEl.block=block;newEl.scope=scope;
 const cleanup2=p.renderEmbeddedMap({element:newEl,content:data,setContent:()=>true});
 assert.equal(p.sessions.size,1);
 assert.equal([...p.sessions.values()][0],record);
 assert.equal(record.slot.classList.contains('smm-inline-slot-collapsed'),true);
 assert.equal(record.slot.style.height,'48px');
 const second=new FakeElement();const secondBlock=new FakeElement();secondBlock.attributes['data-node-id']='other';second.block=secondBlock;second.scope=scope;
 p.renderEmbeddedMap({element:second,content:data,setContent:()=>true});
 const other=[...p.sessions.values()].find(r=>r!==record);
 assert.equal(other.collapsed,false);
 assert.notEqual(other.frame,record.frame);
 cleanup1();cleanup2();p.onunload();
});


test('collapsed title uses center node without interpreting HTML or changing stored data', async()=>{
 assert.equal(centerTopicTitle(blankMap('高等数学')), '高等数学');
 const rich=blankMap('<p><strong>数学 &amp; 物理</strong><br>一级主题</p>');
 const original=encodeMap(rich);
 assert.equal(centerTopicTitle(rich), '数学 & 物理 一级主题');
 assert.equal(centerTopicTitle(blankMap('<p>第一行</p><p>第二行</p>')), '第一行 第二行');
 assert.equal(encodeMap(rich), original, 'reading the title may not mutate the map');
 assert.equal(centerTopicTitle(blankMap(' &nbsp; ')), '未命名思维导图');
 assert.equal(centerTopicTitle(blankMap('')), '未命名思维导图');
 assert.equal(centerTopicTitle(blankMap('&#x6570;&#23398;')), '数学');
 assert.equal(centerTopicTitle({mindMapData:{root:{data:{}}}}), '未命名思维导图');
 assert.equal(centerTopicTitle(blankMap('<img src=x onerror=alert(1)>安全')), '安全');
});

test('only minimized toolbar displays center topic, updates after editing, and restores the original toolbar label',async()=>{
 const p=new Plugin(); await p.onload();
 const el=new FakeElement(); const block=new FakeElement(); block.attributes['data-node-id']='topic-title'; el.block=block;
 const saved=[];
 const cleanup=p.renderEmbeddedMap({element:el,content:encodeMap(blankMap('初始中心主题')),setContent:raw=>{saved.push(raw);return true}});
 const rec=[...p.sessions.values()][0];
 const caption=rec.root.children[0].children[0];
 const frame=rec.frame;
 assert.equal(caption.textContent, '思维导图');
 rec.setCollapsed(true);
 assert.equal(caption.textContent,'初始中心主题');
 assert.equal(caption.title,'初始中心主题');
 assert.equal(rec.frame,frame);
 assert.equal(saved.length,0,'displaying a title must not write data');
 const newMap=JSON.parse(JSON.stringify(rec.map.mindMapData));
 newMap.root.data.text='<p>新名称 &amp; 标签</p>';
 rec.applyPatch({mindMapData:newMap});
 assert.equal(caption.textContent,'新名称 & 标签');
 assert.equal(caption.title,'新名称 & 标签');
 assert.equal(rec.map.mindMapData.root.data.text,'<p>新名称 &amp; 标签</p>','rich text must not be modified by caption');
 rec.setCollapsed(false);
 assert.equal(caption.textContent,'思维导图');
 assert.equal(caption.title,'思维导图');
 rec.setCollapsed(true);
 assert.equal(caption.textContent,'新名称 & 标签');
 assert.equal(rec.frame,frame,'minimize/expand must not replace iframe');
 cleanup();p.onunload();
});

test('collapse acknowledgment displays the latest committed center topic and separate blocks have independent titles',async()=>{
 const p=new Plugin(); await p.onload();
 const create=(blockID,topic)=>{
   const el=new FakeElement();const block=new FakeElement();block.attributes['data-node-id']=blockID;el.block=block;
   p.renderEmbeddedMap({element:el,content:encodeMap(blankMap(topic)),setContent:()=>true});
   return [...p.sessions.values()].find(r=>r.key?.endsWith(':'+blockID));
 };
 const a=create('topic-one','原中心主题');const b=create('topic-two','另一个主题');
 a.editorReady=true;
 const btn=a.root.children[0].children.at(-1);
 btn.handlers.click({stopPropagation(){}});
 const req=a.pendingCollapse;
 p.handleFrameMessage({origin:window.location.origin,source:a.frame.contentWindow,data:{channel:CHANNEL,session:a.session,type:'patch',patch:{mindMapData:{...a.map.mindMapData,root:{data:{text:'最终确认的中心主题'},children:[]}}}}});
 p.handleFrameMessage({origin:window.location.origin,source:a.frame.contentWindow,data:{channel:CHANNEL,session:a.session,type:'collapse-ready',requestId:req}});
 assert.equal(a.collapsed,true);
 assert.equal(a.root.children[0].children[0].textContent,'最终确认的中心主题');
 assert.equal(b.root.children[0].children[0].textContent,'思维导图');
 b.setCollapsed(true);
 assert.equal(b.root.children[0].children[0].textContent,'另一个主题');
 assert.equal(a.root.children[0].children[0].textContent,'最终确认的中心主题');
 p.onunload();
});

// A size-only regression: default outer height 839 px; width remains responsive.
test('default map block height is 839px and resize controls remain reversible',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='height839';
 const element=new FakeElement();element.block=block;
 const cleanup=p.renderEmbeddedMap({element,content:encodeMap(blankMap('尺寸测试')),setContent:()=>true});
 const record=[...p.sessions.values()][0];
 assert.equal(record.height,799,'canvas height excludes toolbar');
 assert.equal(record.toolbarHeight,40);
 assert.equal(record.slot.style.height,'839px','initial whole block should be exactly 839px');
 assert.equal(record.slot.style.width,undefined,'width stays responsive to SiYuan document');
 record.resize(110);
 assert.equal(record.slot.style.height,'949px','增高 still works');
 record.resize(-110);
 assert.equal(record.slot.style.height,'839px','缩小 restores default height');
 record.setCollapsed(true);
 assert.equal(record.slot.style.height,'48px','collapse height unchanged');
 record.setCollapsed(false);
 assert.equal(record.slot.style.height,'839px','expand restores 839px default');
 cleanup();p.onunload();
});

test('compact toolbar controls call the existing SiYuan expand and collapse actions only',async()=>{
 const p=new Plugin();await p.onload();
 const block=new FakeElement();block.attributes['data-node-id']='toolbar-actions';
 const el=new FakeElement();el.block=block;
 p.renderEmbeddedMap({element:el,content:encodeMap(blankMap()),setContent:()=>true});
 const record=[...p.sessions.values()][0];
 record.editorReady=true;
 const actions=[];
 record.toolbarActions={collapse:()=>actions.push('collapse'),expand:()=>actions.push('expand')};
 const send=(action,source=record.frame.contentWindow,origin='http://localhost:6806')=>
   p.handleFrameMessage({origin,source,data:{channel:CHANNEL,session:record.session,type:'toolbar-action',action}});
 send('toggle-expanded');send('collapse');send('unknown');
 send('collapse',{},'http://localhost:6806');send('collapse',record.frame.contentWindow,'https://untrusted.test');
 assert.deepEqual(actions,['expand','collapse']);
 record.collapsed=true;
 send('collapse');send('toggle-expanded');
 assert.deepEqual(actions,['expand','collapse']);
 record.collapsed=false;record.editorReady=false;
 send('collapse');
 assert.deepEqual(actions,['expand','collapse']);
 record.editorReady=true;
 record.sendViewState();
 assert.equal(record.frame.lastPost.type,'toolbar-state');
 assert.equal(record.frame.lastPost.expanded,false);
 p.onunload();
});
