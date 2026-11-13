# VSCode 扩展验证记录

验证日期：2026-11-09。

## 自动测试

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 扩展单元测试 | 10 项通过 | npm test，检查启动配置、文件过滤、层级、源码范围、编辑更新和非法 XML |
| VSCode 扩展宿主测试 | 8 项通过 | [host-tests.json](host-tests.json)，包含逐项结果和运行版本 |
| 扩展类型检查 | 通过 | npm run typecheck |
| Phase 1 回归 | 228 项测试与类型检查通过 | 在仓库根运行 npm test 与 npm run typecheck |

宿主测试使用 VSCode 1.145.2 和 Node.js v24.22.1。它实际加载扩展，查询注册后的文档符号，并检查导航时活动编辑器的类型、选区和行列位置。临时 SVG 中的中文、emoji 和 CRLF 用于核对源码偏移。

## 原生 Outline 观察

实现前，先观察了 VSCode 的 Markdown 大纲：标题按层级排列，条目可以展开和选择，并与当前文档对应。SVG 扩展沿用原生 Outline 界面，通过 DocumentSymbolProvider 提供元素树和源码位置。

## 验收中修正的问题

### F5 加载了仓库根目录

第一次启动时，调试器把 SVG-APP 根目录当作扩展目录，读到了 CLI 的 package.json，因而报缺少 engines.vscode。

修正是在仓库根增加 .vscode/launch.json 和 tasks.json，将扩展目录指向 vscode-extension。先补测试复现配置缺失，再检查根目录和子项目两种 F5 配置，都能找到扩展清单和编译入口。

### 大纲导航进入图片预览

大纲已显示层级，但点击 rect#start 后，编辑器又打开了图片预览。示例工作区随后在 examples/.vscode/settings.json 中将 SVG 关联到默认的文本编辑器。

新增宿主测试执行带 selectionRange 的打开操作，确认活动窗口是文本编辑器、选中内容为 rect，并定位到第 3 行。手动验收也确认状态栏显示“行 3，列 6”。单击大纲后焦点仍可留在左侧，此时源码区域没有闪烁光标，切回编辑区即可输入。

## 手动验收

| 项目 | 结果 | 实际表现 | 截图 |
| --- | --- | --- | --- |
| SVG 文件标记 | 通过 | flowchart.svg 有 []，notes.txt 和 folder.svg 目录没有标记 | [文件标记与大纲](images/outline-navigation.png) |
| 层级与源码定位 | 通过 | 根、嵌套分组和叶子齐全；点击 rect#start 后定位到第 3 行、第 6 列 | [源码定位](images/outline-navigation.png) |
| 文本编辑更新 | 通过 | id 改为 newid 后，大纲同步显示 rect#newid | [ID 更新](images/outline-id-update.png) |
| 不完整 XML 恢复 | 通过 | 删除闭合标签后大纲清空，恢复标签后重新显示，编辑器始终可用 | [不完整 XML](images/outline-incomplete-xml.png)、[恢复结果](images/outline-restored.png) |

完整截图和复现步骤见 [扩展说明](../README.md)。

## AI 协作与核查

Codex 先编写解析和文件标记测试，确认实现缺失时测试失败，再完成解析器、文件类型接口和 VSCode 适配类。开发者负责实际操作、反馈问题并截图。

实现时检查了扩展包中指向 CLI 根目录的本地依赖。扩展运行不需要 CLI，因此移除该依赖并更新锁文件。源码位置先与解析库的 token 偏移核对，再由单元测试和真实宿主测试检查。

两次界面问题分别补成启动配置和文本导航回归测试。最终验收同时检查自动测试结果和实际窗口，文件标记、定位、实时更新及异常恢复均通过。
