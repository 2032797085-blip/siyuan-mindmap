> 当前试验版：**v0.5.0-dev.19**。思源内嵌导图打开时，顶部工具栏和右侧功能面板默认收起；仍可独立手动展开。其余说明沿用此前版本。

# SiYuan MindMap v0.5.0-dev.2 · 源码重构工作区

这是**已经完成源码迁移与构建脚本整理的开发工程**，不等于已完成实际编译、客户端测试或可替换使用的稳定插件。

## 结构

- `engine/`：随原始 ZIP 提供的 SimpleMindMap 引擎源码。输入逐帧重绘已经直接移到 `src/core/render/Render.js`。
- `web/`：Vue2 Web 前端源码，使用 `file:../engine` + Webpack 别名指向**本地引擎**。
- `plugin/src/index.js`：v0.4.6 的思源文档内嵌、自定义块、保存、浮层兼容代码（保持旧 JSON 格式）。
- `integration/editor/`：iframe 双向消息、固定格式工具栏以及对应 CSS，全部是可编辑源代码。
- `scripts/`：只从上述源码产生 Web 构建结果，并将真实构建产物制作成思源安装 ZIP。
- `tests/`：静态源码迁移、数据格式和构建约束验证。
- `reference/`：思源官方插件模板仅供开发参考，不参与构建。

## 完整编译与发布（需可访问 npm registry 的构建环境）

推荐 Node 18 LTS（Vue CLI 4 / webpack 4 较老）；在 Node 22 需要 `--openssl-legacy-provider`，构建脚本已添加。

```bash
cd web
npm install --legacy-peer-deps --no-audit --no-fund
cd ..
npm test
npm run validate
npm run build
```

成功后生成 `build/siyuan-mindmap-v0.5.0-dev.2.zip`，其中 ZIP 根目录直接是 `plugin.json`、`index.js` 和 `editor/`。

**禁止仅凭通过静态测试就发布安装包。** 构建脚本在缺失依赖、Vue 构建失败、iframe HTML 缺少通信代码或构建结果缺文件时将直接失败，不会复制旧预编译资源作为备用结果。

## 已从旧补丁迁入源码

- RAF 输入响应 → `engine/src/core/render/Render.js`
- 顶部固定文字工具栏 → `web/src/pages/Edit/components/RichTextToolbar.vue` + `integration/editor/format-toolbar.*`
- 嵌入模式不显示试用提示 → `web/src/pages/Edit/components/Edit.vue`
- 真实保存错误上报、避免误报存储不足 → `web/src/api/index.js`
- 始终由插件而非浏览器本地存储持久化嵌入导图 → `integration/editor/bridge.js` + `plugin/src/index.js`
- 默认 `simpleBlack`、设置持久化、保存后 iframe 复用及遮挡修复 → `plugin/src/index.js`, `plugin/index.css`

## 兼容性和限制

原有 `;;;siyuan-mindmap/mindmap` 自定义块 JSON 格式与插件 ID 保持不变。真实思源桌面客户端的功能回归仍需逐项验证，重点是 IME 输入、自动保存/重新打开、菜单遮挡、默认主题、选中文字的格式设置。详见 `docs/COMPATIBILITY.md`。

**用户当前正在使用的 v0.4.6 不要被这个源码工程覆盖。**

Windows 用户需要安装 Node.js 和 Python 3（`py -3`）；Linux/macOS 使用 `python3`。旧版 Vue CLI/webpack 对新 Node 版本可能有依赖兼容问题，因此优先使用 Node 18 LTS。


## 本次整理（dev.2）

- 同步确认 `plugin/src/index.js` 与目前 v0.4.8 插件的源代码完全一致，现有用户文档无需迁移。
- 修复由于预览 SVG 组件新增后，旧 Node.js 测试环境缺少 `createElementNS` 而造成的虚假失败。
- 统一 `npm test`，现在同时执行源码测试与旧插件回归测试，避免只测源码目录却遗漏保存和预览测试。
- 新增 `.github/workflows/build.yml`：在**能够访问 npm** 的 CI 环境中从源码安装依赖、执行测试、编译并上传安装包，构建失败即停止。
- 保持本地引擎依赖与“绝不拿旧预编译文件冒充新构建”的约束。

**当前沙盒无法解析 `registry.npmjs.org`，因此尚未从 Vue 源码实际生成新版安装包。** 本源码包供继续开发，不应覆盖正在使用的插件。用户不必自己运行上面的命令。

## v0.5.0-dev.10 补充说明

针对思源内嵌编辑器增加单行紧凑工具栏，已有视图按钮共享“放大/返回”和“最小化/展开”流程。请参见 `docs/DEV10-COMPACT-TOOLBAR.md`。不修改 SimpleMindMap 引擎、原快捷键及既有 Backspace 处理。

## v0.5.0-dev.11 · 功能栏独立最小化

更正 dev.10 的误解：顶部功能栏最小化仅收起功能按钮，留“展开功能栏”；不折叠整张导图。导图块已有的“最小化”继续独立运作。详见 `docs/DEV11-TOOLBAR-ONLY-MINIMIZE.md`。

## v0.5.0-dev.19 · 默认收起顶部和右侧工具区

仅思源内嵌导图：初始顶部工具栏和右侧功能面板默认收起；点击原有按钮可分别展开/收起，不影响整图折叠、节点、保存和快捷键。独立 Web 版保持默认展开。参见 `v0.5.0-dev.19-安装说明.txt`。
