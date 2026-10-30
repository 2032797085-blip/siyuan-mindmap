'use strict';
// Embedded editor starts with both rails folded, with existing controls intact.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const toolbar = read('web/src/pages/Edit/components/Toolbar.vue');
const sidebar = read('web/src/pages/Edit/components/SidebarTrigger.vue');
function getInitialState(source, window) {
  const match = source.match(/\n  data\(\) \{\s*return \{([\s\S]*?)\n    \}\n  \},/);
  assert.ok(match, 'cannot find component initial data');
  return new Function('window', 'isMobile', `return ({${match[1]}\n});`)(window, () => false);
}
test('embedded maps start with both tool areas collapsed and standalone web editor stays unchanged', () => {
  const inside = {takeOverApp: true};
  const outside = {takeOverApp: false};
  assert.equal(getInitialState(toolbar, inside).toolbarMinimized, true);
  assert.equal(getInitialState(sidebar, inside).show, false);
  assert.equal(getInitialState(toolbar, outside).toolbarMinimized, false);
  assert.equal(getInitialState(sidebar, outside).show, true);
});
test('folded toolbars keep their independent reveal controls and never fold the whole map', () => {
  assert.match(toolbar, /v-show="!toolbarMinimized"/);
  assert.match(toolbar, /v-show="toolbarMinimized"/);
  assert.match(toolbar, /@click\.stop="restoreToolbar"/);
  assert.match(toolbar, /@click\.stop="minimizeToolbar"/);
  assert.match(sidebar, /@click="show = !show"/);
  assert.match(sidebar, /:class="\{ hide: !show \}"/);
  assert.match(sidebar, /&\.show \{\s*right: 0;/);
  const toggles = toolbar.slice(toolbar.indexOf('    minimizeToolbar() {'), toolbar.indexOf('    // 计算工具按钮如何显示'));
  assert.doesNotMatch(toggles, /iframe|postMessage|\.save\(|siyuanEmbeddedToolbarAction|collapse/);
});
