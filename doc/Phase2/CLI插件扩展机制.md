# CLI 框架扩展机制

CLI 提供图形、命令、树标签和属性处理四类扩展点，通过注册表连接内核与插件。插件用法和加载配置见 [插件使用说明](插件使用说明.md)，开发中的检查与修正见 [AI 协作记录](开发检查与修正记录.md)。

## 模块边界

插件通过 `src/extensions/index.ts` 使用框架公开的类型和方法。主要职责分工如下：

- `domain`：保存文档、图形和父子结构，检查图形与结构是否合法。Rect、Circle、Ellipse、Line、Text 是共享基础模型；ShapeState 保存可恢复的图形状态。遍历接口 ShapeVisitor 使用统一的 `visitShape(shape)`，新增图形类型无需为它增加专用方法。
- `application`：组织编辑操作。session 管理当前文档和撤销历史；commands 实现可撤销的编辑；shapes 根据定义创建图形；documents 定义文档读写接口。
- `cli`：拆分命令行输入、查找命令、输出结构树和反馈文字。
- `infrastructure`：把 SVG 文件转换为文档对象，再把文档对象保存为 SVG。
- `plugins`：实现具体命令、图形 Provider、属性处理器和树标签。内置命令和图形位于 `plugins/builtin`。
- `composition`：在启动时创建对象、注册插件，并把会话、命令分发和文件读写连接起来。

[createDefaultFramework](../../src/composition/createDefaultFramework.ts) 注册内置图形和命令。[createEditor](../../src/composition/createEditor.ts) 将同一套注册表提供给图形工厂、命令和 SVG 读写；文件仓库中的解析器与序列化器共用这个图形工厂。

`composition/defaults` 提供已经配置好内置能力的便捷入口。其他调用方可以直接引用实际实现。

## 扩展点清单

每个 Framework 实例都有独立的注册表。注册时，同一类别的名称不能重复，也不能是空白；分别报告 `duplicate registration: <category>/<name>` 和 `invalid registration name: <category>`。`all()` 返回一份只读列表副本。

`new Framework()` 只创建空注册表。`createDefaultFramework()` 在此基础上注册原有命令和六种图形，不注册可选的属性处理器和树标签。正常 CLI 启动还会按代码或配置加载 stats、dir、box 和 modified-star。下面分别说明四种扩展点。

### ShapeProvider

- 接口名称和职责：[ShapeProvider.ts](../../src/extensions/ShapeProvider.ts) 定义 ShapeProvider，负责告诉框架怎样创建、读回和显示一种图形。Provider 提供参数定义、帮助文字、SVG 标签映射，以及可选的文本读取和显示方法。

- 内核调用位置：

  - [RegisteredShapeFactory.ts](../../src/application/shapes/RegisteredShapeFactory.ts) 的 `create`、`fromInput` 根据参数定义创建图形，`forSvg` 根据 SVG 标签和 data-kind 选择 Provider。


    - [RegisteredSvgParser.ts](../../src/infrastructure/svg/RegisteredSvgParser.ts) 的 `readShape` 读入图形；


    - [RegisteredSvgSerializer.ts](../../src/infrastructure/svg/RegisteredSvgSerializer.ts) 的 `element` 将图形写成 SVG。


    - [ShapeViews.ts](../../src/extensions/ShapeViews.ts) 的 `present` 和 `describeEdit` 调用显示方法。内置插件的 [ShapeCommands.ts](../../src/plugins/builtin/commands/ShapeCommands.ts) 在 create、set 时使用这些编辑反馈。



- 已有实现：[内置图形 Provider](../../src/plugins/builtin/shapes/providers.ts) 和 [BoxProvider](../../src/plugins/box/BoxProvider.ts)。

- 禁用可选插件后的行为：

  - 禁用 box 后，基础图形仍可使用；

  - 创建 box 报未知类型，已有 box 文件由普通分组 Provider 警告降级读入；

  - 空注册表无法创建任何图形类型。

- 插件违反契约时如何报错：

  - 文本声明与读取方法不匹配，报告 `invalid shape text contract`；
  - 返回图形的类型或 ID 与请求不符，报告 `invalid shape provider result`；
  - 读回时丢弃、替换或打乱传入的子图形，报告 `invalid shape provider children`；
  - 多个 Provider 匹配同一个 SVG 标签及 kind，报告 `ambiguous SVG shape provider`。


### Command

- 接口名称和职责：[Command.ts](../../src/extensions/Command.ts) 定义 Command。每条命令提供名称、帮助文字、是否需要文档，以及 `execute` 方法。

- 内核调用位置：

  - [RegisteredCommandDispatcher.ts](../../src/cli/RegisteredCommandDispatcher.ts) 的 `dispatch` 拆分输入后，按名称查找命令。
  - 如果命令声明需要文档，先检查当前会话是否已有文档，再调用命令的 `execute`。

- 已有实现：

  - [内置命令](../../src/plugins/builtin/commands/index.ts) 中的 BoundCommand 和 HelpCommand。HelpCommand 从注册表生成帮助文字。
  - [StatsCommand](../../src/plugins/stats/StatsCommand.ts) 提供图形统计命令。
  - [DirCommand](../../src/plugins/dir/DirCommand.ts) 提供目录查看命令。

- 禁用可选插件后的行为：

  - 禁用 stats 或 dir 后，help 不再列出对应命令。
  - 执行未加载的命令时，报告 `unknown command: <name>`。
  - 原有内置命令仍可用。

- 插件违反契约时如何报错：

  - 名称非法或重名，按本节开头的注册规则报错。
  - 缺少文档时，在检查该命令的参数之前报告原有文档错误。
  - 执行中抛出的异常由 [RegisteredRepl.ts](../../src/cli/RegisteredRepl.ts) 转成以 `error:` 开头的终端输出。

### TreeDecorator

- 接口名称和职责：[TreeDecorator.ts](../../src/extensions/TreeDecorator.ts) 定义 TreeDecorator，负责为结构树的一行返回附加文字。例如 box 返回 `(box)`，modified-star 在有未保存变化时返回 `*`。

- 内核调用位置：

  - [RegisteredTreeFormatter.ts](../../src/cli/RegisteredTreeFormatter.ts) 的 `labels` 对每行调用 `decorate`，按注册顺序用一个空格连接结果。返回空字符串或 undefined 时不追加内容。
  - 画布行没有对应图形，传入的 `shape` 为 undefined。标签可以读取当前文档，以及按需生成的内容快照。
  - 需要保存点通知的标签可实现 `checkpoint`。宿主的 [CheckpointRepository.ts](../../src/composition/CheckpointRepository.ts) 在 `publish` 中于成功读写后调用它，具体过程见“内容检查点”。

- 已有实现：

  - [BoxTypeDecorator](../../src/plugins/box/BoxTypeDecorator.ts) 提供 `(box)` 标签。
  - [ModifiedStarDecorator](../../src/plugins/modified-star/ModifiedStarDecorator.ts) 提供未保存变化的 `*` 标签。
  - [ShapeTypeDecorator](../../src/plugins/examples/ShapeTypeDecorator.ts) 是默认关闭的教学示例。

- 禁用可选插件后的行为：禁用全部标签后，tree 保持 Phase 1 的原始输出。

- 插件违反契约时如何报错：

  - 名称非法或重名，按本节开头的注册规则报错。
  - 标签包含换行时，报告 `tree decorator must return a single line`。
  - decorate 抛错时，由 REPL 输出错误。
  - checkpoint 抛错时，宿主报告 `error: checkpoint failed: <name>`，继续通知其他标签，已完成的 I/O 保持成功。

### AttributeHandler

- 接口名称和职责：[AttributeHandler.ts](../../src/extensions/AttributeHandler.ts) 定义 AttributeHandler，用于规定某种图形的属性应该怎样修改。例如 box 的 fill 修改内部矩形，label 修改内部文字。

- 内核调用位置：

  - [SetCommand.ts](../../src/application/commands/shapes/SetCommand.ts) 的 `changeShape` 调用 [AttributeRouter.ts](../../src/extensions/AttributeRouter.ts) 的 `apply`。
  - AttributeRouter.apply 先调用各处理器的 `handles`，找到唯一适用的处理器后调用它的 `apply`。handles 只负责判断，不应修改文档。
  - [ShapeEditCommand.ts](../../src/application/commands/shapes/ShapeEditCommand.ts) 的 `executeEdit` 记录修改前后的状态。成功的一次 set 对应一个撤销单元，即使它修改了多个子部件。

- 已有实现：

  - [BoxAttributes](../../src/plugins/box/BoxAttributes.ts) 处理 box 的 fill 和 label。
  - [StyleAttributeHandler](../../src/plugins/examples/StyleAttributeHandler.ts) 是默认关闭的教学示例。

- 禁用可选插件后的行为：

  - 没有处理器匹配时，调用图形原有的 `set` 方法。
  - 允许的属性照常修改，未定义属性报告 `unknown attribute: <attr>`。
  - 普通矩形原有的 fill 等属性不受影响。

- 插件违反契约时如何报错：

  - 名称非法或重名，按本节开头的注册规则报错。
  - 多个处理器同时匹配时，报告 `ambiguous attribute handler`，不执行任何处理器。
  - 执行失败后不再尝试默认规则；ShapeEditCommand.executeEdit 恢复目标子树的修改前状态，undo/redo 历史保持不变。
  - 处理器支持的事务范围见 [ADR 002](adr/002-attribute-transactions.md)。

## 文本与 SVG 读写

### 图形的文字存在哪里

`ShapeDefinition.schema.hasText` 表示创建参数中包含文字。文字有两种存储方式：

- 普通文字图形把内容写进 SVG 元素正文。Provider 必须实现 `text(shape): string`，让序列化器读取文字。
- box 这类容器把标题放在内部 Text 子图形中。Provider 声明 `svg.text: "children"`，并通过 `fromSvg` 恢复子图形，不再提供读取容器正文的方法。

[ShapeRegistry.ts](../../src/extensions/ShapeRegistry.ts) 的 `register` 检查文本声明与读取方法是否对应。没有声明元素正文的 Provider 不能提供 text 方法。输出正文时，还会检查返回值确实为字符串，随后通过 [XmlText.ts](../../src/infrastructure/xml/XmlText.ts) 转义 XML 特殊字符。

容器使用默认元素正文策略时，报告 `unsupported SVG text for container`；叶子误用子图形文本策略时，报告 `SVG child text requires a container`。

### 终端显示与保存内容分开

`present(shape)` 提供 tree、show 使用的摘要、位置、属性显示值和可选的 treeLabel。它不负责提供保存到 SVG 的文字，保存正文统一通过 text 方法读取。

如果旧插件仍从 `present()` 返回 content，显示时报告 `invalid shape presentation`。即使插件没有自定义显示方法，只要文本方法正确，仍能保存和读回文字。相关回归覆盖自定义 caption、Unicode 和 XML 转义。

### 怎样选择 SVG 标签

Provider 的 `svg: { tag, kind }` 决定文件中的表示方式。例如 panel 可以保存为 `<g data-kind="test-panel">`。

读入时，工厂根据标签和 data-kind 查找 Provider。找不到精确 kind 时，再尝试该标签的基础 Provider，由它决定接受、警告降级或拒绝。普通 g 和未安装插件时 box 的降级由 GroupProvider 处理。

### 读入一个节点的步骤

[RegisteredSvgParser.readShape](../../src/infrastructure/svg/RegisteredSvgParser.ts) 按以下顺序处理：

1. 读取 ID、普通属性、data-kind 和直接位于该元素内的文字。
2. 执行默认读取逻辑或 Provider 的 validateSvg，检查当前节点的文字、属性和 kind。
3. 递归读取子图形。内置叶子在递归前就拒绝子元素，避免把结构错误报成未知子类型。
4. 将读好的子图形交给自定义 fromSvg，或使用默认方式得到的图形对象。自定义返回结果同样要接受叶子结构检查。
5. 检查返回图形的类型、ID、子图形及输入属性，再由文档登记 ID 和父子关系。

父节点的错误先报告。例如 `<g>oops<foo/></g>` 先报 g 不允许包含正文，不会先报 foo 类型未知；无法处理的 kind 也在递归子图形前检查。

### 自定义读取不能丢失输入内容

fromSvg 收到的子图形必须原样保留，包括对象身份和顺序。文件中的普通属性值和元素正文也必须在返回对象中保留。数值几何属性按默认路径相同的 px 和数值规则转换后比较；属性或正文不一致时，报告 `SVG input not preserved: <id>/<field>`。

[SvgInputValidator.ts](../../src/infrastructure/svg/SvgInputValidator.ts) 在构造前检查正文和 kind，在构造后检查属性和文字。validateSvg 是可选的提前检查；即使插件省略它，内核仍会检查上述结果。普通 g 的旧 box 警告降级使用同一套检查。

容器自身还要保证必要子部件完整。候选子列表由 validateChildren 检查；解组时 assertUngroupable 默认检查 canUngroup，具体容器可提供自己的报错。结构约束见 [ADR 005](adr/005-composite-containers.md)，新增图形的遍历接口见 [ADR 003](adr/003-open-shapes.md)。

## 验证与指标

修改 CLI 源码或采集脚本后，在仓库根目录运行：

```powershell
npm run metrics
npm test
npm run typecheck
npm run check:boundaries
npm run metrics:check
```

CLI 已有 345 项测试通过的记录，包含原有功能回归、公开 SDK 创建 tile、自定义文字和容器、默认关闭的示例插件、属性失败回滚、导入错误优先级、注册冲突及保存点比较。测试还检查违规依赖和过期指标；修改后应以重新执行的结果为准。

依赖检查扫描 CLI TypeScript 中的静态导入和转导出：插件通过公开 SDK 使用内核能力，不能引用装配代码或私有内核模块；内核不能引用插件和装配实现。指标口径、生成方法及模块依赖图见 [CLI metrics](../../docs/metrics/README.md)。

## 内容检查点

内容检查点记录最近一次成功 read/save 的文档内容，供 modified-star 判断哪些地方尚未保存。它包括图形属性、持久化文字、父级关系和子节点顺序，存为不可变的 DocumentSnapshot。

保存点通知按以下过程执行：

1. `composition/CheckpointRepository` 包装原文件仓库。save 在写入前准备快照，文件写入成功后通知标签；read 在解析成功后准备快照并通知。
2. 只有实现 checkpoint 的标签接收通知。回调更新标签实例自己的状态，不能修改文档或执行 I/O；回调或诊断输出抛错时，宿主隔离异常，其他标签继续收到通知。
3. modified-star 用实例内的 WeakMap 保存各文档的检查点，按文档对象区分，避免不同文档中相同 ID 相互影响。

`ShapeViews.snapshot` 从 Provider 的 text 方法取得持久化文字，标签无需识别 text、box 等具体类型。tree 使用的快照按需生成，同次查询共享；没有 checkpoint 监听者时，读写不额外生成快照。

默认 CLI 先注册 box 标签，再注册 modified-star，因此行尾顺序为 `(box) *`。只调用 createDefaultFramework 时，两者都未注册。接口准备、状态比较规则及接入边界见 [ADR 006](adr/006-content-checkpoints.md)。
