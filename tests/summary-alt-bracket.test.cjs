const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const source = read('web/src/pages/Edit/components/Edit.vue')
const shortcutPanel = read('web/src/pages/Edit/components/ShortcutKey.vue')
const engine = read('engine/src/core/command/KeyCommand.js')
const keyMap = read('engine/src/core/command/keyMap.js')
const summaryRegistration = source.match(/      if \(window\.takeOverApp\) \{\n        this\.mindMap\.keyCommand\.extendKeyMap\('\]', 221\)\n        this\.mindMap\.keyCommand\.addShortcut\('Alt\+\]', \(\) => \{\n          this\.mindMap\.execCommand\('ADD_GENERALIZATION'\)\n        \}\)\n      \}/)?.[0]

function setup(embedded) {
  const calls = []
  const document = { body: { classList: { contains: () => false } } }
  const window = { takeOverApp: embedded, addEventListener() {}, removeEventListener() {} }
  const context = vm.createContext({ window, document })
  const transformed = keyMap.replace(/export const keyMap = map/, 'const keyMap = map')
    .replace(/export const isKey =/, 'const isKey =')
  const cls = engine.replace("import { keyMap } from './keyMap'", '')
    .replace('export default class KeyCommand', 'class KeyCommand')
  const KeyCommand = vm.runInContext(`${transformed}\n${cls}\nKeyCommand`, context)
  const map = {
    opt: {},
    editNodeClassList: [],
    renderer: { activeNodeList: [{}] },
    on() {},
    execCommand(action) { calls.push(action) }
  }
  map.keyCommand = new KeyCommand({ mindMap: map })
  vm.runInContext(`(function() { ${summaryRegistration} }).call(mindMapOwner)`,
    vm.createContext({ window, document, mindMapOwner: { mindMap: map } }))
  const dispatch = (keyCode, { alt = false, ctrl = false, target = document.body } = {}) => {
    const status = { prevented: false }
    map.keyCommand.onKeydown({
      target, keyCode, altKey: alt, ctrlKey: ctrl, metaKey: false, shiftKey: false,
      stopPropagation() {}, preventDefault() { status.prevented = true }
    })
    return status
  }
  return { map, calls, dispatch, document }
}

test('summary Alt+] is added only in embedded editor and does not replace Ctrl+G', () => {
  assert.ok(summaryRegistration, 'expected scoped embedded shortcut registration')
  assert.match(read('engine/src/core/render/Render.js'), /addShortcut\('Control\+g'/)
  const { map, calls, dispatch } = setup(true)
  assert.equal(map.keyCommand.shortcutMap['Alt+]'].length, 1)
  map.keyCommand.addShortcut('Control+g', () => calls.push('original'))
  assert.equal(dispatch(221, { alt: true }).prevented, true)
  assert.deepEqual(calls, ['ADD_GENERALIZATION'])
  dispatch(71, { ctrl: true })
  assert.deepEqual(calls, ['ADD_GENERALIZATION', 'original'])
})

test('Alt+] does not fire from text input or without Alt, and does not intercept other keys', () => {
  const { calls, dispatch } = setup(true)
  assert.equal(dispatch(221, { target: { classList: { contains: () => false } }, alt: true }).prevented, false)
  assert.equal(dispatch(221).prevented, false)
  assert.equal(dispatch(8).prevented, false)
  assert.equal(dispatch(113).prevented, false)
  assert.deepEqual(calls, [])
})

test('regular web editor has no new shortcut, shortcut help is embed-scoped', () => {
  const { map, calls, dispatch } = setup(false)
  assert.equal(map.keyCommand.shortcutMap['Alt+]'], undefined)
  assert.equal(dispatch(221, { alt: true }).prevented, false)
  assert.deepEqual(calls, [])
  assert.match(shortcutPanel, /if \(!window\.takeOverApp\) return list/)
  assert.match(shortcutPanel, /value: `\$\{item\.value\} \| Alt \+ \]`/)
})

test('package and plugin versions match, editor engine was not patched', () => {
  const pkg = JSON.parse(read('package.json'))
  const plugin = JSON.parse(read('plugin/plugin.json'))
  assert.match(pkg.version, /^0\.5\.0-dev\.\d+$/)
  assert.equal(plugin.version, pkg.version)
  assert.doesNotMatch(read('engine/src/core/command/keyMap.js'), /'\]':\s*221/)
})
