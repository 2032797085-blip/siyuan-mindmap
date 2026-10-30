# v0.5.0-dev.6 - 导图相邻光标 Backspace 防误删

本版基于 v0.5.0-dev.5，只调整思源宿主页面的 Backspace 拦截条件。不改 SimpleMindMap 引擎、iframe 通信、保存和最小化。

## 目标

- **允许**：显式选中整张导图块后，按 Backspace 删除（恢复思源本来的块级删除行为）。
- **保护**：没有选中块，光标位于紧邻导图的段落起点或导图自身的非编辑壳上时，拦截可能导致整张导图消失的 Backspace。
- **保留**：Delete、节点内部的 Backspace、文字输入、F2、方向键、Enter/Tab、块菜单操作。

## 检测前提

监听仅在思源文档宿主中运行，不在 iframe 编辑器内运行。

1. 只响应无修饰键、非输入法组合状态的 Backspace。
2. 必须位于同一个 Protyle 编辑器内，且通过现有已挂载的 map 记录确认目标确实是本插件的导图块。
3. 存在显式块选择 `.protyle-wysiwyg--select` 时**放行**，由思源执行正常块删除。
4. 必须是折叠（collapsed）的单一 DOM 光标，且刚好处于导图后方段落的开头，或导图自身的非编辑壳/宿主容器边界。
5. 文字输入、普通段落、非相邻块、编辑窗口/对话框内的按键**放行**。

## 风险和局限

思源内核版本和文档结构存在差异。这里通过宿主 DOM 的真实 Range 和块邻接关系进行局部保护，而不是拦截任何位置的 Backspace。若思源删除整张导图的路径并非由可取消的 keydown 事件发起（例如其他命令或异常的输入事件），本拦截不能保证覆盖，且不应误称为绝对保护。

首次请使用**测试导图**验证：

1. 光标在导图紧邻段落的最前端，按 Backspace：导图应保留。
2. 明确选中整个导图块按 Backspace：仍应可以删除；请在单独的测试导图上测试。
3. 在相邻段落中间按 Backspace：应能正常删除文字。
4. 在导图 iframe 内选中节点按 Backspace、在文字编辑内按 Backspace：行为与前版一致。
5. Delete、F2、方向键、最小化、中心标题、保存和重新打开均正常。

## 验证

`node scripts/test.mjs`：40 项源码测试。
`python plugin/tests/adjacent_backspace_browser.py`：9 项 Chromium DOM 交互测试（依赖 Playwright 和 Chromium）。
`node scripts/validate.mjs`：源码结构校验。

浏览器 DOM 测试只是思源环境的近似测试，不是 Windows 思源客户端的实机测试。
