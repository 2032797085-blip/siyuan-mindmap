# v0.5.0-dev.8 — 恢复用户截图尺寸

本版基于 v0.5.0-dev.7，只调整默认外层显示尺寸，**不改变节点编辑、键盘快捷键、数据保存、相邻 Backspace 保护、最小化和 PowerShell 部署脚本**。

- 在 1920 × 1040 的截图环境下，目标导图块大小约为 **1447 × 839 px**（整块，含工具栏）。
- 默认记录画布高度由 560 改为 **799 px**，加上工具栏预留的 40 px，总高度为 **839 px**。
- 导图宽度按当前文档可用宽度取值，上限 **1447 px**；小窗口自动缩窄，避免横向溢出。
- 保留「增高」「缩小」每次 ±110 px、最小化 48 px、放大编辑和恢复展开行为。
- 这调整的是默认值；在旧窗口中已手动增高/缩小的会话要重新打开文档或思源才能看到默认尺寸。

## 安装

以 v0.5.0-dev.7 源码为基础，备份后把补丁按相对路径覆盖到：

`D:\思源笔记插件制作程序\siyuan-思维导图`

完全退出思源、备份工作空间，然后用原来成功运行的一键 PowerShell 命令：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\思源笔记插件制作程序\siyuan-思维导图\build-and-deploy.ps1"
```

部署日志需同时包含版本 `0.5.0-dev.8` 和 `DEPLOY SUCCESS.`。

## 本环境校验

`node scripts/validate.mjs`；`node scripts/test.mjs`；`python plugin/tests/collapse_browser.py`。Chromium 布局测试包含 1447 px 宽度上限、窄窗口自适应、839 px 展开、48 px 最小化及恢复。真正思源 Windows 客户端仍需用户实测。
