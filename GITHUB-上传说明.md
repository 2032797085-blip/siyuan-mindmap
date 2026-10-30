# SiYuan MindMap v0.5.0-dev.19 · GitHub 上传说明

此 ZIP 包含完整项目源码，不是增量补丁或已编译的插件包。

## Windows：使用 GitHub Desktop

1. 将 ZIP 解压到一个空目录。进入该目录时应直接看到 `package.json`、`README.md`、`plugin/`、`engine/` 和 `web/`，不要把 ZIP 文件作为单个文件上传。
2. 安装并登录 [GitHub Desktop](https://desktop.github.com/)。选择 File → Add local repository，选中源码目录；如果提示不是 Git 仓库，点击 Create a Repository Here。
3. 仓库名称建议 `siyuan-mindmap`。创建后确认没有上传本地 `node_modules/`、`build/`、私人配置，然后提交（Commit to main）。
4. 点击 Publish repository。首次建议勾选 Private，确认代码、素材及许可证适合公开后，再按需要更改为 Public。

## 使用 git 命令行

先在 GitHub 网站创建**空仓库**，然后在已解压的源码根目录打开 PowerShell：

```powershell
git init
git add .
git commit -m "Publish v0.5.0-dev.19 full source"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

请将 URL 替换成实际仓库地址。如果仓库已有内容，先确认后再推送，避免覆盖冲突。

## 发布前检查

- 顶层 `package.json` 与 `plugin/plugin.json` 版本是 `0.5.0-dev.19`。
- `.gitignore` 保护后续生成的 `node_modules/`、构建产物、部署备份和本地配置不会误提交。上传前仍需检查实际 Git 变更。
- 已保留 SimpleMindMap 和思源模板相关许可证。公开仓库前，请自行确认第三方源码和图片素材（尤其 `web/src/assets/`、`reference/`）的许可及隐私问题。
- 上传源码不等于已通过 Windows 思源客户端的真实功能验收。GitHub Actions 仍需在仓库中执行验证。
