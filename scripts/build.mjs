#!/usr/bin/env node
// v0.5 build: source -> Vue CLI compiler -> SiYuan installation archive.
// No shipped minified Web editor assets are used as a fallback.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(project, 'web');
const generated = path.join(project, 'dist');
const output = path.join(project, 'build', 'siyuan-mindmap');
const bin = path.join(web, 'node_modules', '.bin', process.platform === 'win32' ? 'vue-cli-service.cmd' : 'vue-cli-service');
const fail = msg => {console.error('构建失败:', msg); process.exit(1)};
if (!fs.existsSync(bin)) fail('Vue CLI 依赖未安装。先在 web/ 中执行 npm install。不得将旧编译文件冒充新构建。');
execFileSync(process.execPath, [path.join(project,'scripts','validate.mjs')], {stdio:'inherit',cwd:project});
fs.rmSync(generated, {recursive:true,force:true});
console.log('Building editable Vue + local SimpleMindMap engine from source ...');
execFileSync(bin, ['build'], {cwd:web, stdio:'inherit', shell:process.platform==='win32', env:{...process.env,NODE_OPTIONS:[process.env.NODE_OPTIONS||'','--openssl-legacy-provider'].join(' ').trim()}});
const page = path.join(generated, 'index.html');
if (!fs.existsSync(page)) fail('Vue CLI did not generate index.html');
const html = fs.readFileSync(page,'utf8');
if (!/window\.takeOverApp\s*=\s*true/.test(html) || !html.includes('./bridge.js')) fail('Generated iframe HTML lacks the SiYuan takeover bridge');
if (html.includes('sdk.51.la') || html.includes('LA_COLLECT')) fail('Unexpected third-party tracking script in generated HTML');
if (!/dist\/js\/app\.js/.test(html)) fail('Missing Vue app entry in generated HTML');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(path.join(output,'editor','dist'),{recursive:true});
const copy=(from,to)=>fs.cpSync(from,to,{recursive:true,force:true});
const pkg = path.join(project,'plugin');
for (const item of fs.readdirSync(pkg)) {
 if (['src','tests','README.md'].includes(item)) continue;
 copy(path.join(pkg,item),path.join(output,item));
}
copy(path.join(pkg,'src','index.js'),path.join(output,'index.js'));
copy(path.join(project,'README.md'),path.join(output,'README.md'));
// Generated index is the iframe HTML; compiled asset folder is under /editor/dist/.
copy(page,path.join(output,'editor','index.html'));
for(const item of fs.readdirSync(generated)) {
 if (item==='index.html') continue;
 copy(path.join(generated,item),path.join(output,'editor','dist',item));
}
for(const item of fs.readdirSync(path.join(project,'integration','editor'))) {
 copy(path.join(project,'integration','editor',item),path.join(output,'editor',item));
}
const required=['plugin.json','index.js','index.css','editor/index.html','editor/bridge.js','editor/format-toolbar.js','editor/format-toolbar.css','editor/dist/js/app.js','editor/dist/js/chunk-vendors.js'];
for (const f of required) if(!fs.existsSync(path.join(output,f))) fail('Missing release asset: '+f);
// Enforce real output assets and forbid copying precompiled old Web builds.
const compiledJs=fs.readFileSync(path.join(output,'editor','dist','js','app.js'),'utf8');
if (!compiledJs.length || compiledJs.length < 2000) fail('Compiled Vue entry appears empty or invalid');
if (!fs.existsSync(path.join(output,'editor','format-toolbar.js'))) fail('Embedded toolbar integration is missing');
const manifest=JSON.parse(fs.readFileSync(path.join(output,'plugin.json'),'utf8'));
if(manifest.name!=='siyuan-mindmap') fail('Package plugin ID has changed');
console.log('Compiled output verified at:', output);
const releaseVersion=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8')).version;
if (manifest.version!==releaseVersion) fail('Plugin and source project versions differ');
const packArgs=[path.join(project,'scripts','pack.py'),output,path.join(project,'build',`siyuan-mindmap-v${releaseVersion}.zip`)];
execFileSync(process.platform==='win32'?'py':'python3', process.platform==='win32'?['-3',...packArgs]:packArgs, {cwd:project,stdio:'inherit'});
