'use strict';
// Regression: SiYuan Settings dialog must cover the editor's header and map.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'index.css'), 'utf8');

test('editor breadcrumb and utility bar no longer receive elevated z-index', () => {
  assert.doesNotMatch(css, /\.protyle:has\(> \.smm-inline-portal\) \.protyle-breadcrumb/);
  assert.doesNotMatch(css, /\.protyle:has\(> \.smm-inline-portal\) \.protyle-util/);
});
test('native popup elevation applies only while no dialog is open', () => {
  assert.match(css, /body:not\(:has\(\.b3-dialog--open\)\).*\.protyle-hint/);
  assert.match(css, /body:not\(:has\(\.b3-dialog--open\)\).*\.protyle-toolbar/);
  assert.match(css, /body:not\(:has\(\.b3-dialog--open\)\).*\.b3-menu/);
  assert.match(css, /body:has\(\.b3-dialog--open\) \.smm-inline-expanded\s*\{\s*z-index:\s*1\s*!important/);
});
