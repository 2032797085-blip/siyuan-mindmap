# v0.5.0-dev.10 — 思源内嵌紧凑工具栏（测试版）

开发基线：v0.5.0-dev.9。此次仅修改 UI 呈现及 iframe → 外层现有按钮的连接，不改 SimpleMindMap 引擎、快捷键、文档格式、保存/撤销逻辑、Backspace 保护和 PowerShell 部署脚本。

## 新布局

- 顶部整合为约 46px 高的单行工具栏，取代“两块大面板 + 始终可见的文字格式行”。
- 常用节点操作以图标显示，鼠标悬停提示文字；根据可用宽度自动决定显示数量。
- 其他节点操作放入 **更多**；**目录、新建、打开、另存为、导入、导出** 放入 **文件**。
- **格式** 单击显示 / 收起原有富文本工具组件。只有实际选中文本时，文字格式命令才会启用，保留原来 Quill 控件及绑定。
- **放大/返回** 委托原外层“放大编辑/返回文档”按钮；**最小化** 委托外层原有“保存后最小化”按钮。折叠后原来的块标题栏出现“展开”。两个入口始终共享一套状态和保存流程。
- 普通 Web 版继续使用原布局，只有思源内嵌模式启用紧凑栏。

## 对安全与功能边界的要求

- 现有源工程的 `engine/`、`web/src/api/`、`scripts/`、`build-and-deploy.ps1` 完全不变。
- `plugin/src/index.js` 仅接受来自精确 iframe `event.source`、同源 `event.origin` 及相同 `session` 的 `toolbar-action` 消息，且仅允许 `collapse` 和 `toggle-expanded` 两个固定动作。
- 折叠动作仍调用原有 `collapse.click()`，走既有中文输入法保护、结束编辑、保存、ACK、折叠流程。
- 原本的节点事件（撤销、重做、同级、子节点、删除、备注、链接等）仍由 `ToolbarNodeBtnList.vue` 触发。
- 增加按钮的 title 提示；没有修改它们的 `@click` 逻辑。

## 本环境验证

- `node scripts/validate.mjs` 通过。
- `node scripts/test.mjs` — 45 项通过。
- `python plugin/tests/compact_toolbar_browser.py` — Chromium 多种画布宽度布局测试通过。
- Vue 两个组件 `<script>` JS 语法检查通过；检查了单行布局及文件树 DOM。
- 本环境**未安装项目全部 Node 依赖，未执行 Webpack 全量编译，也未在真实思源客户端验证**。

## 安装与验收

1. 备份工程与思源工作空间，退出思源。
2. 将本补丁 ZIP 按目录结构覆盖到源码根目录（不要放进 `data/plugins`）。
3. 执行：
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1"`
4. 确认日志版本 `0.5.0-dev.10` 且有 `DEPLOY SUCCESS.`。
5. 打开测试用导图，检查常用/更多/文件按钮，选中文字使用“格式”，放大/返回，最小化/展开，节点编辑快捷键与保存重新打开。

如果出现任何核心功能异常，先停止使用新版，按 `build/deploy-backups` 中备份恢复旧插件，同时恢复 v0.5.0-dev.9 源码备份。切勿直接改动引擎补救。

**提示：dev.10 的“放大/最小化”针对整张导图的处理已被 dev.11 修正，不再推荐安装 dev.10。**
