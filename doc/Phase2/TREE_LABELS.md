# 标签完成节点

modified-star 与 box-type-label 已能同时工作。默认树显示 `g#n (box) *`；保存后星号消失，box 类型标签保留。源码位于 [modified-star](../../src/plugins/modified-star)，语义与接口取舍见 [ADR 006](adr/006-content-checkpoints.md)。

## 使用与效果

```powershell
npm run build
# A：默认代码装配
node dist/src/main.js
# B：相同插件顺序的配置装配
node dist/src/main.js --config doc/Phase2/plugins.labels.config.json
```

输入：

```text
init
create box n 10 20 80 30 "开始"
tree
save labels.svg
set n label "已处理"
tree
undo
tree
```

编辑后的树为：

```text
svg (800x600) *
└── g#n (box) *
    ├── rect#n-rect  x=10 y=20 w=80 h=30 fill=#4a90d9
    └── text#n-label  (30,40) "已处理" *
```

undo 恢复标题后，星号全部消失。新建文档和新节点在首次保存前立即标星；保存和成功读取都会建立基线。dirty 比较真实模型内容，向祖先传播；同父排序只标容器及其祖先。标签不写入 SVG。

[独立状态机测试](../../tests/plugins/ModifiedStar.test.ts)不激活其他插件，只依赖自身与 SDK。[命令集成测试](../../tests/plugins/ModifiedStarIntegration.test.ts)验证真实保存、错误恢复、任意文本 Provider 和两个标签顺序；反向注册会显示 `g#n * (box)`。

## 装配、禁用与证据

插件 [package.json](../../src/plugins/modified-star/package.json) 声明 `decorators: ["modified-star"]`。A 在 codePlugins.ts 增加一个 loadCode 项；B 在根 plugins.config.json 增加 `./src/plugins/modified-star`，也可使用同集合的独立 [plugins.labels.config.json](plugins.labels.config.json)。两者经过相同的 PluginLoader 校验和暂存发布路径。

配置项 `enabled: false` 可禁用星号而保留 `(box)`。只加载 modified-star 时，未装 box 的 SVG 仍由 GroupProvider 警告降级为普通 g，星号照常追踪。使用 [空插件配置](plugins.none.config.json) 可关闭全部可选插件，保持 Phase 1 原生 tree 输出。

可重放证据：

- [labels.txt](../transcript/labels.txt)：只含命令，覆盖创建、保存、再编辑、undo/redo、stats、dir、读取。
- [labels.expected.json](../transcript/labels.expected.json)：原始 stdout，包括最后提示符的空格。
- [labels.expected.svg](../transcript/labels.expected.svg)：最终保存文件。
- [ModifiedStarConfigAssembly.test.ts](../../tests/composition/ModifiedStarConfigAssembly.test.ts)：配置独立对照 golden，并验证禁用和注册顺序。
- [ModifiedStarAssembly.test.ts](../../tests/composition/ModifiedStarAssembly.test.ts)：同一临时工作目录、相同插件顺序及初始内容，先比较代码装配输出，再删除保存文件并确认不存在，执行配置装配并逐字节比较 stdout 与重新保存的 SVG。dir 只看到固定 assets 目录，输出日志留在内存中。

默认启用星号后，原 box 会话 golden 只在 tree 行尾新增星号，SVG golden 未改。Phase 1 的 SessionReplay 和结构命令真实 CLI 回归显式使用空插件配置，其原始预期保持不变。命令插件双装配测试补上相同的 modified-star 配置项，保证两侧插件集合及顺序一致。

## 通用准备与提交边界

本轮按以下三个阶段提交。通用准备确实修改了内核契约和渲染器，不能把整体差异称为零改动：

| 部分 | 文件与验证范围 |
|---|---|
| 通用内容检查点准备 | DocumentSnapshot、CheckpointRepository、TreeDecorator、ShapeViews、SDK、RegisteredTreeFormatter、createEditor、startCli 的报告通道；10 项准备测试；不含任何标签包或 test:labels 脚本 |
| 标签配置接入 | 新增 plugins/modified-star；独立 7 + 集成 6 + 配置 3 项测试；根 plugins.config.json 和独立配置均启用星号，labels 会话以根配置验证；test:labels 仅列三个已存在的文件。旧 box golden 保持无星号，BoxAssembly/BoxConfigAssembly 暂用 tests/fixtures/plugins.box-only.config.json，与尚未启用星号的代码装配比较 |
| 默认代码装配与一致性 | 修改 codePlugins.ts、box.expected.json、CommandAssembly 插件集合，BoxAssembly/BoxConfigAssembly 恢复使用已启用星号的根配置；加入 ModifiedStarAssembly，并把它加入 test:labels。两个 Phase 1 真 CLI 回归在此时改用 tests/fixtures/plugins.none.config.json，原预期不变 |

提交前在每一步的实际源码树重新采集 metrics，验证 npm test、typecheck、check:boundaries、metrics:check；配置与默认装配阶段另外运行当时的 test:labels。现有 box 双装配断言在配置阶段通过无标签配置保持两侧无星号，新增标签会话单独检验根配置；默认装配阶段再让 box 会话两侧一起启用星号，从而避免中间态 golden 冲突。

本轮增加了 [verify-label-stages.mjs](../../scripts/verify-label-stages.mjs)，从 8f3aeb0 建立临时 detached 工作树，按上述文件组增量复制当前改动，复制依赖并逐步运行验证，最后清理工作树。不会创建提交、移动分支或改动主工作区源码。复跑：

```powershell
npm run test:label-stages
```

[机器生成记录](labels-stage-validation.json)包含基线、每阶段文件组、源码摘要、文件数和命令结果：准备 124 个源码文件 / 328 项测试；根配置接入 126 / 344；最终 126 / 345。它证明当前源码/测试分组可运行，不是实际提交差异，也不核验每阶段文档；真实提交另外在各自源码树上重新采集指标并验证，根配置接入提交不修改任何既有运行源码；代码装配提交只改 codePlugins.ts 这一个既有运行文件。

严格按 §5 从本轮原 HEAD 起比较，本次确实修改了渲染器和契约，不能称为零改动。原因是框架节点遗漏了保存点通知和通用内容快照；把它们拆成准备提交只能证明准备后插件接入的零改动，不能消除这一验收限制。

插件接入提交形成后，核验内核与渲染器的命令还应包含 extensions、domain、application、cli、infrastructure；加载器与所有既有插件也应检查。必须先确认路径存在，再比较实际提交，不使用临时工作区摘要代替 Git 证据。

## 验证

```powershell
# 独立状态机，无需激活内置插件
npm run build
node --test dist/tests/plugins/ModifiedStar.test.js

# 标签全部专项：独立 7 + 集成 6 + 配置 3 + 双装配 1
npm run test:labels
npm test
npm run typecheck
npm run check:boundaries
npm run metrics:check
```

CLI 全部 345 项测试、标签专项 17 项通过。通用准备另有 10 项测试。VSCode 扩展沿用独立测试范围，本轮未改其源码。当前标签功能已实现并分阶段提交，严格首次零改动判据的限制见上文；收尾报告与 p2 tag 留待下一节点。

检查点异常由宿主报告为 error: checkpoint failed: <name>，不把成功 I/O 改判为失败；其余监听者仍收到通知。只读标签不实现 checkpoint 时，读写跳过额外投影；树快照也在实际被读取时才生成。审查处理见 [LABEL_REVIEW_RESOLUTION.md](LABEL_REVIEW_RESOLUTION.md)。

## 本轮最终审查处理

删除节点前重新建立干净检查点；跨父级移动前另取快照，分别锁定删除对父容器/画布的影响和移动对旧父级的影响。补充快照投影失败时写入未发生、文档/路径/redo/检查点不变的测试。

新文档没有基线时直接返回星号，不访问懒快照。checkpoint 诊断当前按“error: checkpoint failed: <name>”在命令成功反馈之前输出；这是插件通知失败的诊断，随后 save/read 仍明确给出成功反馈。


## 实际提交核验

通用准备提交为 84c281c，根配置接入提交为 f47e813。配置提交实际新增插件并启用根配置，其余运行源码差异为空；随后的代码装配提交在 src 下只改 codePlugins.ts。两个阶段都单独重采指标并通过完整测试。

```powershell
git diff f47e813^ f47e813 -- src ':(exclude)src/plugins/modified-star'
git diff 84c281c HEAD -- src/domain src/application src/cli src/extensions src/infrastructure src/plugins/builtin src/plugins/box src/plugins/stats src/plugins/dir src/plugins/examples src/composition/plugins src/composition/createEditor.ts src/composition/startCli.ts src/composition/CheckpointRepository.ts src/main.ts
```

两条均应为空。这是准备之后的真实提交边界证据，不能消除本次准备阶段已经改动渲染器与接口的事实。
