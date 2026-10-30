# SiYuan MindMap 0.5.0-dev.3：文档内最小化

## 改动范围

在原 0.5.0-dev.2 的思源自定义块外层增加 **最小化 / 展开** 按钮，折叠成一条约 48px 的工具栏。不同思维导图块各自控制，**不改 `engine/`、`web/` 中的节点编辑、键盘或保存逻辑**；保留同一个 iframe 会话。

- 最小化之前通过同源 `postMessage` 请求 iframe 结束节点文字编辑并同步当前导图快照。
- 主插件收到保存请求、写入思源自定义块成功后才执行折叠。遇到中文输入法尚在组合输入、未初始化、保存失败或编辑器超时，将保持展开并显示原因。
- 折叠时不销毁 iframe，不改变其内部画布高度，只在思源文档占位块中保留 48px 的标题栏。
- 展开时恢复占位高度，并通知原 iframe 调用 `mindMap.resize()`。
- **暂不将折叠状态保存进文档**：关闭并重新打开导图时默认展开。这可避免更改导图数据格式和引入额外数据迁移风险。

## 文件列表

- `plugin/src/index.js`：按钮、折叠状态、保存确认、生命周期与布局。
- `plugin/index.css`：收起后的标题栏、占位高度及隐藏 canvas 的样式。
- `integration/editor/bridge.js`：新增准备折叠与恢复尺寸消息，复用原来的存储接口。
- `package.json`、`plugin/plugin.json`：**一起**更新版本为 `0.5.0-dev.3`。
- `plugin/tests/logic.test.cjs`、`tests/bridge-collapse.test.cjs`、`plugin/tests/collapse_browser.py`：回归测试。

PowerShell 一键部署脚本不需要替换，原有 `build-and-deploy.ps1` 保持不变。

## 安装补丁

请先备份 v0.5.0-dev.2 源码和思源工作空间。将补丁 ZIP 里的同名文件按目录覆盖到：

`D:\思源笔记插件制作程序\siyuan-思维导图`

请不要将源码 ZIP 直接解压到 `data\plugins`。首次建议安装到 **独立测试工作空间**：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1" -TargetPluginDir "D:\思源笔记数据-\DSiYuan-MindMap-Test\data\plugins\siyuan-mindmap"
```

测试工作空间的思源程序必须完全退出，路径须真实存在。确认测试通过后，再完全退出正式工作空间中的思源，执行原来的一键命令：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1"
```

编译应显示 `0.5.0-dev.3`，且最后显示 `DEPLOY SUCCESS.`。

## 测试要点

1. 对有文本的节点双击编辑，修改文字后立即点击最小化，展开后检查文本是否保留，再关闭重开文档验证。
2. 折叠一张图，确认同文档的其他导图不折叠；多次展开／折叠、滚动文档、缩放浏览器。
3. 展开后测试 F2、Delete/Backspace、方向键、Enter/Tab、中文输入法、撤销重做和保存。
4. 中文输入法候选词正在组合时，不应强行折叠；先确认候选词后重试。
5. 切到其他文档再回来、尝试分屏打开同一文档，确认导图块恢复和各会话独立。

## 验证情况

开发环境 `npm test`、`npm run validate` 通过；Chromium 页面布局模拟通过。**尚未在用户的真实 SiYuan 客户端完成全量构建和交互验证**。如有异常，不要覆盖正式插件。PowerShell 自动部署在原有脚本中会备份旧版；也可以从之前保留的 v0.5.0-dev.2 源码归档恢复。
