/**
 * Add a regular, extendable summary node below exactly one selected normal node.
 * This intentionally does not alter SimpleMindMap's special generalization node:
 * it is not a parent node and cannot safely accept children.
 *
 * Using INSERT_CHILD_NODE keeps history, saving and the existing layout pipeline.
 * openEdit=false selects the new node without opening the rich-text editor.
 */
export const insertExtendableSummary = mindMap => {
  if (!mindMap || !mindMap.renderer) return false
  const nodes = mindMap.renderer.activeNodeList
  if (!Array.isArray(nodes) || nodes.length !== 1) return false
  const node = nodes[0]
  if (!node || node.isGeneralization || !node.nodeData) return false

  mindMap.execCommand('INSERT_CHILD_NODE', false, [node], {
    text: '总结'
  })
  return true
}
