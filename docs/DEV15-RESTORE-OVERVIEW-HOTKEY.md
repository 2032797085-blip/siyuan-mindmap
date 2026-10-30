# v0.5.0-dev.15：恢复原生概要快捷键

目标：从 dev.14 回退不实用的「总结」普通子节点绑定，仅恢复 Alt + ] 触发 SimpleMindMap 原生概要。

- Alt + ] → ADD_GENERALIZATION（仅在思源内嵌编辑器注册）
- Ctrl + G → 原引擎内置 ADD_GENERALIZATION（未更改）
- 原生概要可选择多个普通节点创建，仍按原引擎规则工作。
- 不再通过 Alt + ] 调用 insertExtendableSummary。
- 没有修改 Backspace、F2、Tab、Enter、Delete、方向键及保存机制。

### 验收建议
选中一组可以创建原生概要的节点，按 Alt + ]，检查出现括号式概要；Ctrl + G 也应可用。保存、重新打开、Ctrl+Z 撤销后检查布局和节点。观察是否还有被快捷键创建的普通「总结」节点（不应再新增）。

如果 Windows 使用中文输入法，请使用键盘的右中括号按键（键位通常为 P 右侧的 ]，无需先输入中文「】」字符）。
