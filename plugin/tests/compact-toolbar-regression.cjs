'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = rel => fs.readFileSync(path.join(root,rel),'utf8');

test('compact toolbar uses existing node actions and retains standalone layout',()=>{
 const vue=source('web/src/pages/Edit/components/Toolbar.vue');
 for(const token of [
  'v-if="isSiyuanEmbedded"', 'v-if="!isSiyuanEmbedded"',
  'compactPrimaryList', 'siyuan-compact-tools',
  'compactFileOpen', 'openDirectory()', 'createNewLocalFile()',
  'openLocalFile()', 'saveLocalFile()', "'showImport'", "'showExport'",
  'compactFormatOpen', 'siyuan-format-host',
  'minimizeToolbar', 'restoreToolbar', 'toolbarMinimized',
  'siyuan-compact-toggle', 'siyuan-toolbar-restore' 
 ]) assert.ok(vue.includes(token), 'missing: '+token);
 assert.match(vue,/height: 46px/);
 assert.match(vue,/height: 30px/);
 assert.match(vue,/@mousedown\.prevent @click\.stop="minimizeToolbar"/);
 assert.match(vue,/@mousedown\.prevent @click\.stop="restoreToolbar"/);
 assert.doesNotMatch(vue,/@click="embeddedToolbarAction\(/);
 assert.match(vue,/v-show="!toolbarMinimized"/);
 assert.match(vue,/v-show="toolbarMinimized"/);
 assert.match(vue,/flex-wrap: nowrap !important/);
 for(const command of ['INSERT_NODE','INSERT_CHILD_NODE','REMOVE_NODE','BACK','FORWARD'])
  assert.ok(source('web/src/pages/Edit/components/ToolbarNodeBtnList.vue').includes(command));
 assert.match(source('integration/editor/format-toolbar.js'),/window.siyuanDockRichTextToolbar/);
 const before=fs.readdirSync(path.join(root,'engine/src'));
 assert.ok(before.length>0);
});

test('all six previously hidden commands are on the embedded toolbar and file/format touch',()=>{
 const vue=source('web/src/pages/Edit/components/Toolbar.vue');
 const compact=vue.slice(vue.indexOf('<!-- SiYuan only:'),vue.indexOf('<!-- Toolbar-only minimized state:'));
 const compute=vue.slice(vue.indexOf('computeToolbarShow() {'),vue.indexOf('const windowWidth = window.innerWidth - 40'));
 const icons=source('web/src/pages/Edit/components/ToolbarNodeBtnList.vue');
 assert.match(compact, /<ToolbarNodeBtnList :list="compactPrimaryList"/);
 assert.doesNotMatch(compact, /compactOverflowList|compactMoreOpen|更多节点功能/);
 assert.match(compute, /this\.compactPrimaryList = ordered\.filter\(item => item !== 'annotation'\)/);
 for (const id of ['tag','summary','associativeLine','formula','outerFrame','ai'])
   assert.match(icons,new RegExp("item === '"+id+"'"));
 assert.match(vue,/overflow-x: auto;/);
 assert.match(vue, /class="siyuan-compact-secondary"/);
 assert.match(vue, /\.siyuan-compact-secondary > \* \{/);
 assert.match(vue, /class="siyuan-compact-file-control"/);
 assert.match(vue, /\.siyuan-compact-file-control \/deep\/ \.el-popover__reference-wrapper/);
 assert.match(vue,/gap: 0;\s*margin: 0;\s*padding: 5px 8px;/);
 assert.match(compact, /compactFileOpen[\s\S]*compactFormatOpen/);
});

test('iframe toolbar sends only permitted actions after editor initialization',()=>{
 const handlers={}; const sent=[]; const emitted=[];
 const parent={postMessage:(message,origin)=>sent.push({message,origin})};
 const window={parent,location:{origin:'https://siyuan.test'},
  addEventListener:(key,fn)=>handlers[key]=fn,
  dispatchEvent:event=>emitted.push(event),
  $bus:{$on:(name,fn)=>{if(name==='app_inited')fn({resize(){},richText:{}})}},
  initApp(){}
 };
 const context={window,location:{search:'?session=session-test',origin:'https://siyuan.test'},URLSearchParams,console,
  CustomEvent:class{constructor(type,params){this.type=type;this.detail=params.detail}},
  setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(source('integration/editor/bridge.js'),context);
 window.siyuanEmbeddedToolbarAction('collapse');
 assert.ok(!sent.some(x=>x.message.type==='toolbar-action'));
 handlers.message({source:parent,origin:'https://siyuan.test',data:{
  channel:'siyuan-mindmap-inline',session:'session-test',type:'init',
  document:{mindMapData:{root:{data:{text:'中心主题'}}}}
 }});
 window.siyuanEmbeddedToolbarAction('collapse');
 window.siyuanEmbeddedToolbarAction('toggle-expanded');
 window.siyuanEmbeddedToolbarAction('unknown');
 assert.deepEqual(sent.filter(x=>x.message.type==='toolbar-action').map(x=>x.message.action),['collapse','toggle-expanded']);
 handlers.message({source:parent,origin:'https://siyuan.test',data:{
  channel:'siyuan-mindmap-inline',session:'session-test',type:'toolbar-state',
  expanded:true,collapsed:false
 }});
 assert.equal(emitted.at(-1).type,'siyuan-mindmap-view-state');
 assert.equal(emitted.at(-1).detail.expanded,true);
});

test('toolbar-only collapse and restore keep the editor and iframe untouched',()=>{
 const vue=source('web/src/pages/Edit/components/Toolbar.vue');
 const min=vue.match(/minimizeToolbar\(\) \{([\s\S]*?)\n    \},\n    restoreToolbar/);
 const restore=vue.match(/restoreToolbar\(\) \{([\s\S]*?)\n    \},\n    \/\/ 计算/);
 assert.ok(min && restore,'toolbar toggle method missing');
 let recalc=0;
 const context={compactFileOpen:true,compactFormatOpen:true,toolbarMinimized:false,
   $nextTick:cb=>cb(),computeToolbarShow:()=>{recalc++}};
 new Function(min[1]).call(context);
 assert.equal(context.toolbarMinimized,true);
 assert.equal(context.compactFileOpen,false);
 assert.equal(context.compactFormatOpen,false);
 new Function(restore[1]).call(context);
 assert.equal(context.toolbarMinimized,false);
 assert.equal(recalc,1);
 // No changes to iframe size, block collapse or bridge save state.
 assert.doesNotMatch(min[1]+restore[1],/postMessage|collapse|save|iframe|\.frame/);
});


test('dev.17 file/format share a zero-gap 38px group and toolbar toggle is icon-only', () => {
 const vue=source('web/src/pages/Edit/components/Toolbar.vue');
 const template=vue.split('<script>')[0];
 const group=template.slice(template.indexOf('class="siyuan-compact-secondary"'),template.indexOf('<!-- Icon-only button:'));
 assert.match(group,/class="siyuan-compact-file-control"/);
 assert.match(group,/class="toolbarBtn siyuan-compact-action"/);
 const toggle=template.match(/<button type="button" class="siyuan-compact-toggle"[\s\S]*?<\/button>/)[0];
 assert.match(toggle,/aria-label="最小化功能栏"/);
 assert.doesNotMatch(toggle,/<span>最小化功能栏<\/span>/);
 assert.match(vue,/\.siyuan-compact-secondary > \* \{[\s\S]*?flex: 0 0 38px !important;/);
 assert.match(vue,/\.siyuan-compact-file-control \/deep\/ \.el-popover__reference-wrapper/);
 assert.match(vue,/\.siyuan-compact-toggle,\s*[\s\S]*?width: 30px;[\s\S]*?height: 30px;/);
});
