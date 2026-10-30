#!/usr/bin/env node
// Run all source and legacy-plugin regression tests on Linux, Windows and macOS.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suites=['tests','plugin/tests'];
const files=suites.flatMap(dir=>fs.readdirSync(path.join(root,dir))
  .filter(name=>name.endsWith('.test.cjs') || name.endsWith('-regression.cjs'))
  .map(name=>path.join(root,dir,name)));
if(!files.length)throw new Error('没有发现测试文件');
console.log('Testing source and plugin compatibility:', files.length, 'test files');
execFileSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});
