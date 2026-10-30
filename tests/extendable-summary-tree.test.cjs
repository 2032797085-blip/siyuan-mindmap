const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const base = path.resolve(__dirname, '..')
const read = name => fs.readFileSync(path.join(base, name), 'utf8')
const renderSource = read('engine/src/core/render/Render.js')
const start = renderSource.indexOf('  insertChildNode(\n')
const stop = renderSource.indexOf('\n  // 插入多个子节点', start)
assert.ok(start !== -1 && stop > start, 'must locate original insertChildNode implementation')
const method = renderSource.slice(start, stop)
const helperSource = read('web/src/pages/Edit/components/insertExtendableSummary.js')

function fixture() {
  let id = 0
  const ctx = {
    formatDataToArray: nodes => Array.isArray(nodes) ? nodes : [nodes],
    addDataToAppointNodes: children => children,
    createUidForAppointNodes: children => children,
    createUid: () => 'id-' + (++id),
    simpleDeepClone: value => JSON.parse(JSON.stringify(value))
  }
  const insertChildNode = vm.runInNewContext(`({${method}}).insertChildNode`, ctx)
  const addSummary = vm.runInNewContext(helperSource.replace('export const insertExtendableSummary =', 'const insertExtendableSummary =') + '\ninsertExtendableSummary')
  const rootNodeData = { data: { text: '中心主题', uid: 'root' }, children: [] }
  const selected = {
    nodeData: rootNodeData, isRoot: true, isGeneralization: false,
    setData(patch) { Object.assign(this.nodeData.data, patch) }
  }
  const state = {
    renderer: {
      activeNodeList: [selected],
      textEdit: { hideEditTextBox() {} },
      hasRichTextPlugin: () => false,
      getNewNodeBehavior: (openEdit) => ({focusNewNode: !openEdit, inserting: openEdit}),
      clearActiveNodeList() { state.renderer.activeNodeList = [] },
      insertChildNode
    },
    opt: { defaultInsertSecondLevelNodeText: '二级节点', defaultInsertBelowSecondLevelNodeText: '分支' },
    render() {},
    execCommand(name, ...args) {
      assert.equal(name, 'INSERT_CHILD_NODE')
      state.renderer.insertChildNode(...args)
    }
  }
  state.renderer.mindMap = state
  return {state, selected, rootNodeData, addSummary}
}

test('real original Render.insertChildNode creates a serializable normal 总结 child', () => {
  const {state, rootNodeData, addSummary} = fixture()
  assert.equal(addSummary(state), true)
  assert.equal(rootNodeData.children.length, 1)
  const sum = rootNodeData.children[0]
  assert.equal(sum.data.text, '总结')
  assert.equal(sum.data.isActive, true)
  assert.equal(sum.inserting, false)
  assert.equal(sum.data.expand, true)
  assert.deepEqual(JSON.parse(JSON.stringify(sum)).children, [])
  assert.equal(sum.data.generalization, undefined)
})

test('normal summary supports INSERT_CHILD_NODE again, persistence and restoration', () => {
  const {state, rootNodeData, addSummary} = fixture()
  addSummary(state)
  const summaryNodeData = rootNodeData.children[0]
  const summarySelected = {
    nodeData: summaryNodeData, isRoot: false, isGeneralization: false,
    setData(patch) { Object.assign(this.nodeData.data, patch) }
  }
  state.renderer.activeNodeList = [summarySelected]
  state.execCommand('INSERT_CHILD_NODE', false, [summarySelected], {text: '后续节点'})
  assert.equal(summaryNodeData.children.length, 1)
  assert.equal(summaryNodeData.children[0].data.text, '后续节点')
  const persisted = JSON.parse(JSON.stringify(rootNodeData))
  assert.equal(persisted.children[0].data.text, '总结')
  assert.equal(persisted.children[0].children[0].data.text, '后续节点')
})
