const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('source replaces minified modifications and uses local engine',()=>{
 assert.match(read('web/package.json'),/file:\.\.\/engine/);
 assert.match(read('web/vue.config.js'),/simple-mind-map.*resolve/);
 assert.match(read('engine/src/core/render/Render.js'),/requestAnimationFrame/);
 assert.doesNotMatch(read('engine/src/core/render/Render.js'),/debounce\(this\.onNodeTextEditChange, 100/);
 assert.match(read('web/src/pages/Edit/components/RichTextToolbar.vue'),/window\.siyuanDockRichTextToolbar/);
});
test('SiYuan embed has no trial nag or mistaken localStorage quota message',()=>{
 assert.match(read('web/src/pages/Edit/components/Edit.vue'),/webTip\(\) \{\s*if \(window\.takeOverApp\) return/);
 assert.doesNotMatch(read('web/src/api/index.js'),/if \('exceeded'\)/);
 assert.match(read('web/src/api/index.js'),/reportMindMapSaveFailure\(error\)/);
 assert.doesNotMatch(read('web/public/index.html'),/51\.la/);
});
test('existing custom-block data format and settings are unchanged',()=>{
 const p=read('plugin/src/index.js');
 assert.match(p,/const BLOCK_TYPE = 'mindmap'/);
 assert.match(p,/const DEFAULT_THEME = 'simpleBlack'/);
 assert.match(p,/SETTINGS_FILE = 'settings.json'/);
 assert.match(p,/setContent/);
 assert.match(p,/recordsByKey/);
});
test('a full build cannot silently fall back to old bundles',()=>{
 assert.equal(fs.existsSync(path.join(root,'plugin/editor/dist')),false);
 const pipeline=read('scripts/build.mjs');
 assert.match(pipeline,/execFileSync\(bin, \['build'\]/);
 assert.match(pipeline,/Vue CLI 依赖未安装/);
 assert.match(pipeline,/Generated iframe HTML lacks/);
});
