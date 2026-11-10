# box 图形插件

`box` 把矩形与标题作为一个可嵌套的容器接入 CLI。它提供图形创建与 SVG 读回、`fill`/`label` 属性处理以及 `(box)` 类型标签。`modified-star` 留在下一个节点。

## 运行

本提交仅通过配置接入 box，既有运行源码保持不变。在仓库根目录执行：

```powershell
npm run build
node dist/src/main.js --config plugins.config.json
```

配置按相同顺序加载 stats、dir、box，共用现有 PluginLoader 的暂存注册、清单校验和失败回滚。默认代码装配仍只包含 stats、dir，方式 A 在下一提交加入。

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

接入分步提交，并在每一步重新采集指标、运行 npm test、typecheck、check:boundaries 和 metrics:check：

| 提交 | 归属 |
|---|---|
| `1af7bae refactor: prepare composite container extension contracts` | 通用契约、公开 primitives、3 个准备测试及文档；116 文件指标，301 项测试 |
| `feat: add box shape plugin through configuration` | 新增 src/plugins/box；配置、BoxPlugin/BoxIntegration/BoxConfigAssembly；会话 golden、test:box 及文档；122 文件指标，317 项测试 |

本提交的 BoxConfigAssembly 仅通过 --config 对照版本 B 会话的 stdout 和 SVG，不依赖默认代码装配。后续再单独修改 codePlugins.ts，新增 BoxAssembly 与 A/B 一致性检查，并按当时源码重采指标；相关测试和 test:box 列表届时一起加入。

当前 B 提交形成后，设其为 C，检查所有既有运行代码：

```powershell
git diff C^ C -- src ':(exclude)src/plugins/box'
```

差异应为空。原先的 box-preparation.json 工作区摘要已移除；实际 Git 差异检查包含内核、加载器、主入口和既有插件。指标只证明对应提交的源码与产物一致性。

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

box 相关 16 项测试：独立插件 7 项、命令与读写集成 7 项、配置装配与禁用 2 项。CLI 全部 317 项通过，VSCode 扩展 10 项单元测试与类型检查通过；本轮未重新启动扩展宿主测试。

[BoxConfigAssembly.test.ts](../../tests/composition/BoxConfigAssembly.test.ts) 使用临时工作目录、固定输入和初始状态，通过 --config 运行真实 CLI，逐字节比较 stdout 和保存 SVG，再读回检查统计与标题撤销。独立测试还覆盖派生 ID 冲突、多部件修改失败回滚和处理器冲突。
