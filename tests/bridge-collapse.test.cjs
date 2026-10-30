'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.resolve(__dirname,'../integration/editor/bridge.js'),'utf8');

function createBridge(readonly=false){
 const events={};const bus={};const posts=[];
 const parent={postMessage:(data,origin)=>posts.push({data,origin})};
 const origin='http://localhost:6806';
 const location={search:'?session=test-session',origin};
 let appMounted=false;
 const window={parent,location,$bus:{$on:(event,cb)=>{bus[event]=cb}},
   addEventListener:(event,fn)=>{events[event]=fn}};
 window.initApp=()=>{appMounted=true};
 const context={window,parent,location,URLSearchParams,console,
   setTimeout:()=>1,requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(code,context,{filename:'bridge.js'});
 const receive=(data,from=parent,fromOrigin=origin)=>events.message({source:from,origin:fromOrigin,data:{channel:'siyuan-mindmap-inline',session:'test-session',...data}});
 const original={root:{data:{text:'旧文字'},children:[]},theme:{template:'simpleBlack',config:{}},layout:'logicalStructure',config:{doNotDelete:true},view:null};
 receive({type:'init',document:{mindMapData:original,mindMapConfig:{},lang:'zh'},readonly});
 assert.equal(appMounted,true);
 return {events,bus,posts,window,receive,origin,original};
}

test('bridge completes current editing and sends latest snapshot before collapse acknowledgement',()=>{
 const bridge=createBridge();
 let edits=0,resize=0;
 const map={renderer:{textEdit:{hideEditTextBox:()=>{edits++}}},richText:{isCompositing:false},getData:()=>({root:{data:{text:'最终文字'},children:[]},layout:'logicalStructure'}),resize:()=>{resize++}};
 bridge.bus.app_inited(map);
 bridge.receive({type:'prepare-collapse',requestId:'r1'});
 assert.equal(edits,1);
 const types=bridge.posts.map(item=>item.data.type);
 assert.deepEqual(types.slice(-2),['patch','collapse-ready']);
 const patch=bridge.posts.at(-2).data.patch.mindMapData;
 assert.equal(patch.root.data.text,'最终文字');
 assert.equal(patch.config.doNotDelete,true,'existing metadata must be preserved');
 assert.equal(bridge.posts.at(-1).data.requestId,'r1');
 bridge.receive({type:'resume-layout'});
 assert.equal(resize,1);
});

test('bridge refuses to collapse during IME composition and never sends a save patch',()=>{
 const bridge=createBridge();
 let edits=0;
 bridge.bus.app_inited({renderer:{textEdit:{hideEditTextBox:()=>{edits++}}},richText:{isCompositing:true}});
 bridge.receive({type:'prepare-collapse',requestId:'ime'});
 assert.equal(edits,0);
 assert.equal(bridge.posts.at(-1).data.type,'collapse-error');
 assert.equal(bridge.posts.filter(p=>p.data.type==='patch').length,0);
});

test('bridge ignores untrusted collapse messages and handles readonly snapshots',()=>{
 const bridge=createBridge(true);
 let edits=0;
 bridge.bus.app_inited({renderer:{textEdit:{hideEditTextBox:()=>edits++}},getData:()=>({root:{}})});
 const before=bridge.posts.length;
 bridge.receive({type:'prepare-collapse',requestId:'evil'}, {},'http://localhost:6806');
 bridge.receive({type:'prepare-collapse',requestId:'evil'},bridge.window.parent,'http://evil.test');
 assert.equal(bridge.posts.length,before);
 bridge.receive({type:'prepare-collapse',requestId:'safe'});
 assert.equal(edits,1);
 assert.equal(bridge.posts.at(-1).data.type,'collapse-ready');
 assert.equal(bridge.posts.filter(p=>p.data.type==='patch').length,0);
});
