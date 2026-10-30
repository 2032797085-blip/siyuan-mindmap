# v0.5.0-dev.7 默认导图高度试用版

**变更范围：仅调整外层默认尺寸，不更改引擎、快捷键、编辑或保存行为。**

- 新打开的导图块默认总高度 **600 px**，其中画布高度 **560 px**，预留工具栏 **40 px**。
- 宽度继续 `100%` 随思源文档宽度自适应，不强制固定为截图测量的 1447 px。
- `缩小`、`增高` 按钮每次仍增减 110 px，最小 300 px、最大 1200 px（画布高度）。
- 最小化仍为 48 px；展开恢复折叠前尺寸；放大编辑继续沿用原有样式。
- **此版本不持久化手动调整的高度**。已打开的编辑窗口不会即时重置高度，请完全退出并重新打开思源后查看默认高度。
- 如果用户截图显示 ~839 px 高，可能是此前点击增高（两次约 +220 px）后留下的本次会话高度；源码旧默认实际上是 550+40=590 px。本补丁将默认明确设为 600 px。

## 回归测试

执行 `node scripts/test.mjs`。在可用 Chromium + Playwright 的环境可运行 `python plugin/tests/collapse_browser.py`，确认初始高度为 600 px、最小化 48 px、展开恢复 600 px。

## 安装

基于 **v0.5.0-dev.6** 源码，备份后将补丁内 `package.json`、`plugin/plugin.json`、`plugin/src/index.js`、`plugin/tests/...`、`docs/...` 按原结构覆盖。

完全退出思源后在 PowerShell 运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1"
```

先检查版本号 `0.5.0-dev.7`，最后检查 `DEPLOY SUCCESS.`；未出现即未能确认已安装。部署前请备份思源工作空间和插件源码。
