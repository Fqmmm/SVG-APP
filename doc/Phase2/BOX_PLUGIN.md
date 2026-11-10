# box 图形插件

`box` 把矩形与标题作为一个可嵌套的容器接入 CLI。它提供图形创建与 SVG 读回、`fill`/`label` 属性处理以及 `(box)` 类型标签。`modified-star` 留在下一个节点。

## 运行

在仓库根目录执行 `npm run build`，再选择一种装配方式：

```powershell
# A：代码装配
node dist/src/main.js

# B：配置装配
node dist/src/main.js --config plugins.config.json
```

两种方式按相同顺序加载 stats、dir、box，共用现有 PluginLoader 的暂存注册、清单校验和失败回滚。A 只在 [codePlugins.ts](../../src/composition/codePlugins.ts) 增加一个 `loadCode` 项；B 在 [plugins.config.json](../../plugins.config.json) 增加 `./src/plugins/box`。配置方式不会执行代码装配列表。

插件的 [package.json](../../src/plugins/box/package.json) 声明 `shapes: ["box"]`、`attributes: ["box-attributes"]`、`decorators: ["box-type-label"]`。main 指向本仓库的 dist 构建产物；目前与宿主一起构建和部署。

可输入：

```text
init 800 600
create box n1 120 100 160 60 "开始"
create box n2 520 100 160 60 "处理数据"
create line arrow1 280 130 520 130 black
group flowchart n1 n2 arrow1
move n2 0 100
undo
set n2 fill #f5a623
set n2 label "处理数据 v2"
undo
tree
save flowchart-box.svg
```

这是 Phase 1 §6.1 版本 B 的命令序列。树中的 `g#n1 (box)` 下有 `rect#n1-rect` 和 `text#n1-label`；保存结果有 8 个元素。完整证据包括[命令输入](../transcript/box.txt)、[预期 stdout](../transcript/box.expected.json)和[预期 SVG](../transcript/box.expected.svg)。stdout 的 JSON 保留末尾提示符空格。

## 结构和属性

[Box](../../src/plugins/box/Box.ts) 继承 Group，通过公开领域模型 Rect、Text 组成子树。插件只从公开 SDK 导入宿主能力，不导入其他插件或装配模块。`BoxId` 统一派生 `<id>-rect` 与 `<id>-label`。

创建时矩形填充为 `#4a90d9`，标题坐标为 `(x + 20, y + h / 2 + 5)`。这是创建模板；后续移动、缩放和对子部件的直接编辑都保留实际几何值，不重新布局。支持 `in`、嵌套 box 和额外子图形。

`set boxId fill value` 只修改框体矩形的 fill，撤销时反馈 fill restored to；`label` 修改内部 Text 的 text。没有匹配处理器时仍使用原属性白名单，例如 stroke 修改容器本身，未知属性报错。每次 set 由原 ShapeEditCommand 快照整个目标子树，构成一个 undo 单元；处理器部分修改后抛错，恢复所有子部件并保留 redo，不回退默认处理。多个处理器同时命中时，在执行前报冲突。

必需的两个组件必须始终是 box 的直接子节点，且分别是 Rect 和 Text。删除或移出它们，以及用 group 将它们包进新容器，都会被拒绝。允许在当前父节点内调整顺序，额外子节点可以正常移出或删除。删除整个 box、移动整个 box 和撤销恢复均保留完整子树。`ungroup` 报 `cannot ungroup composite shape: <id>`。

序列化使用 `<g id="..." data-kind="box">`，子图形按实际顺序写出。已安装插件时，缺失、类型错误或不在直接子级的必要部件使整个 read 失败；原文档、路径和历史保持不变。重复 ID 始终使整个 read 失败。禁用插件后，GroupProvider 给出降级警告，按普通 g 保留子树；再保存会失去 box 标记，不自动恢复领域语义。

设计取舍及框架契约见 [ADR 005](adr/005-composite-containers.md)。

## 框架准备与接入边界

上一个节点缺少容器结构约束接口，也没有创建与属性操作的领域反馈接口。本轮先完成通用准备，再接入 box：

| 准备项 | 文件与作用 |
|---|---|
| 容器约束 | Group.validateChildren、TreeValidator.collect、SvgDocument 的结构写入；先验证最终列表再修改 |
| 拆组反馈 | Group.assertUngroupable 与 UngroupCommand；默认行为保持原 canUngroup 约定 |
| 展示反馈 | ShapeProvider/ShapePresentation 增加 describeEdit/treeLabel；ShapeViews 与内置 ShapeCommands 消费通用契约 |
| 共享基础模型 | Rect/Text 实现移到 domain/primitives，经 SDK 导出；旧路径及内置模型路径保留转导出，模型身份不变 |
| 准备项测试 | ContainerConstraints、PresentationHooks、PublicPrimitives，6 项测试 |

接入按以下三个提交顺序完成，每一步只包含当时可运行的源码、测试、文档和指标：

| 提交 | 归属 |
|---|---|
| `1af7bae refactor: prepare composite container extension contracts` | 上表通用准备；domain/primitives；ContainerConstraints、PresentationHooks、PublicPrimitives；通用契约文档；116 文件指标，301 项测试 |
| `9559e0c feat: add box shape plugin through configuration` | 新增 src/plugins/box；plugins.config.json；BoxPlugin、BoxIntegration、BoxConfigAssembly；box 会话 golden、npm test:box、文档；122 文件指标，317 项测试 |
| `feat: enable box in default code assembly` | 仅修改 codePlugins.ts 这个既有运行文件；新增 BoxAssembly；CommandAssembly 的集合与 help golden；test:box 列表、文档和重新采集的指标；318 项测试 |

方式 B 的独立证据位于第二个提交。BoxConfigAssembly 只通过 `--config` 对照版本 B 会话的 stdout 和 SVG，不依赖代码装配新增 box。第三个提交才启用方式 A，并增加 A/B 同目录逐字节比较。每一步在采集当前源码指标后运行 npm test、typecheck、check:boundaries 和 metrics:check，避免把最终快照放进准备提交。

复核提交边界：

```powershell
$boxConfigCommit = git log --format=%H --grep='^feat: add box shape plugin through configuration$' -1
$boxCodeCommit = git log --format=%H --grep='^feat: enable box in default code assembly$' -1

# B：既有运行源码的差异应为空
git diff "$boxConfigCommit^" $boxConfigCommit -- src ':(exclude)src/plugins/box'

# A：src 下只应出现 codePlugins.ts
git diff --name-only "$boxCodeCommit^" $boxCodeCommit -- src

# 从准备提交到 A 完成，内核、加载器与既有插件差异应为空
git diff "$boxConfigCommit^" $boxCodeCommit -- src/domain src/application src/cli src/extensions src/infrastructure src/plugins/builtin src/plugins/stats src/plugins/dir src/plugins/examples src/composition/plugins src/main.ts
```

可在第二个提交的独立工作树重新安装依赖，运行 npm test、npm run typecheck 和 npm run test:box，复核配置方式在代码装配未接入 box 时独立成立。原先的 box-preparation.json 工作区摘要已移除；Git 差异是提交边界的证据，metrics 校验各提交自身的源码与产物一致性。

## 验证

```powershell
# 运行 box 全部专项测试，包括集成与实际 CLI 装配
npm run test:box

# 仅运行独立插件测试，无需激活任何内置插件
node --test dist/tests/plugins/BoxPlugin.test.js
npm test
npm run typecheck
npm run check:boundaries
npm run metrics:check
```

box 相关 17 项测试：独立插件 7 项、命令与读写集成 7 项、配置装配与禁用 2 项、代码/配置一致性 1 项。CLI 全部 318 项通过，VSCode 扩展 10 项单元测试与类型检查通过；本轮未重新启动扩展宿主测试。

[BoxAssembly.test.ts](../../tests/composition/BoxAssembly.test.ts) 在同一个临时工作目录运行 A/B，使用相同插件顺序、输入和初始状态，比较 stdout 与 SVG；第二次运行前删除第一次的输出文件并确认不存在，验证配置方式重新保存。配置方式的独立会话与读回检查见 [BoxConfigAssembly.test.ts](../../tests/composition/BoxConfigAssembly.test.ts)。独立测试还覆盖派生 ID 冲突、一次多部件修改失败的回滚以及处理器冲突。


审查意见的采纳与保留理由见 [BOX_REVIEW_RESOLUTION.md](BOX_REVIEW_RESOLUTION.md)。
