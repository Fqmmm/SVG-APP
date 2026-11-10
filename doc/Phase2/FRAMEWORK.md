# CLI 框架扩展机制

本节点完成四个扩展点、默认装配、Phase 1 回归和 CLI metrics 采集。审查后的处理记录见 [REVIEW_RESOLUTION.md](REVIEW_RESOLUTION.md)。命令插件与加载器已完成，见 [COMMAND_PLUGINS.md](COMMAND_PLUGINS.md)；box 已接入，见 [BOX_PLUGIN.md](BOX_PLUGIN.md)；modified-star 已在配置阶段接入，见 [TREE_LABELS.md](TREE_LABELS.md)，默认代码装配随后接入。

## 模块边界

`src/extensions/index.ts` 是插件访问内核的公开入口。`domain` 保存文档、图形基类、容器、共享 Rect/Text 模型和状态快照，`application` 保存编辑事务与会话。`cli/Registered*` 和 `infrastructure/Registered*` 通过注入的依赖工作。

`plugins/builtin` 提供默认图形和命令。每种图形的创建、帮助、展示与文本访问集中在 `providers.ts` 对应的类中；命令由实现 `Command` 的 `BoundCommand` 和 `HelpCommand` 提供。`composition/createDefaultFramework.ts` 注册这些实例，`createEditor.ts` 把同一个注册表接入命令、创建及 SVG 读写。

旧模块路径只做转导出，默认构造逻辑集中在 `composition/compat`。依赖检查以 AST 限制旧入口只能转导出，防止它们重新长出业务逻辑。默认文件仓库的解析器和序列化器共享同一图形工厂。已删除没有运行时用途的 `AttributeFormatter`、`PositionFormatter` 门面，调用方直接使用 `ShapeViews`。

## 扩展点清单

| 扩展点 | 契约与职责 | 内核调用位置 | 已有类实现及缺省行为 | 违规与失败处理 |
|---|---|---|---|---|
| `ShapeProvider` | schema、创建、展示、文本存储策略、SVG 映射与复合图形读回 | `RegisteredShapeFactory.create/fromInput/forSvg`；`ShapeViews.present/describeEdit`（Provider 回调入口）；内置插件 `ShapeCommands.create/set` 调用 ShapeViews.describeEdit；`RegisteredSvgParser.readShape`；`RegisteredSvgSerializer.element` | `plugins/builtin/providers.ts` 的六个 Provider 类及 `plugins/box/BoxProvider.ts`；空注册表不支持任何类型 | schema 与文本访问器不一致报 `invalid shape text contract`；错误类型/id 报 `invalid shape provider result`；遗漏或重排子图形报 `invalid shape provider children`；SVG 映射歧义时报 `ambiguous SVG shape provider` |
| `Command` | 命令名称、帮助、文档前置条件和执行回调 | `RegisteredCommandDispatcher.dispatch` | `plugins/builtin/commands.ts` 的 `BoundCommand`、`HelpCommand`，以及独立 stats/dir 包；未知命令拒绝执行；帮助来自注册结果 | 重名报 `duplicate registration`，空名称报 `invalid registration name`；缺少文档时先报原有文档错误；执行异常由 REPL 转成 `error:` 输出 |
| `TreeDecorator` | 为画布或图形返回单行标签，只读访问上下文 | `RegisteredTreeFormatter.labels` | `plugins/examples/ShapeTypeDecorator.ts`、`plugins/box/BoxTypeDecorator.ts`；只调用 `createDefaultFramework()` 时不注册标签，保持原树输出 | 重名、空名称由注册表拒绝；换行报 `tree decorator must return a single line`；回调异常由 REPL 报错 |
| `AttributeHandler` | 判断目标属性是否适用，通过图形公开方法修改目标子树 | `SetCommand.changeShape` → `AttributeRouter.apply` | `plugins/examples/StyleAttributeHandler.ts`、`plugins/box/BoxAttributes.ts`；只调用 `createDefaultFramework()` 时不注册处理器，回退原有属性白名单 | 多个命中报 `ambiguous attribute handler`，不执行处理器；执行失败恢复目标子树快照，保留 undo/redo 历史；未知属性仍由原白名单报错 |

注册表按实例持有数据，`all()` 返回冻结的列表副本。不同类别可以同名；同类重名拒绝注册。标签按注册顺序用一个空格连接，空字符串和 `undefined` 不增加空格。画布上下文的 `shape` 为 `undefined`。

默认 CLI 还会通过代码装配或配置加载 box 的标签和属性处理器；这与仅构造 `createDefaultFramework()` 不同。

两个 examples 类是可单独注册的交付示例，分别给图形追加类型标签、处理通用样式属性；测试覆盖启用后的回调和撤销。它们默认关闭，box 包已提供正式的 `(box)` 标签与 fill/label 处理器；modified-star 已在配置阶段接入。

## 文本与 SVG 读写

`ShapeDefinition.schema.hasText` 声明文本参数与默认叶子元素正文。默认叶子元素启用它时，提供者必须实现 `text(shape): string`；未启用时不得提供该访问器。`ShapeRegistry.register` 检查这项对应关系，序列化时检查返回值类型，并通过 `XmlText` 转义正文。

`hasText` 也可声明容器的 CLI 文本参数。此时提供者须显式设置 `svg.text: "children"`，把文本保存在子图形中，并通过 `fromSvg` 恢复子图形；不提供父元素正文访问器。默认正文策略用于容器时报 `unsupported SVG text for container`，叶节点误用子图形策略时报 `SVG child text requires a container`。

`present(shape)` 返回摘要、位置、属性显示值及可选 treeLabel，保存路径不调用它。旧 `present().content` 在展示边界报 `invalid shape presentation`。自定义 caption 回归覆盖没有展示回调的文本图形、Unicode、XML 转义及读写往返。

`svg: { tag, kind }` 描述文件表示。测试中的 `panel` 映射为 `<g data-kind="test-panel">`；解析器通过注册描述选择提供者。缺少精确 kind 提供者时尝试基础标签提供者，由它决定降级或拒绝。

解析一个节点时，先读取普通属性与直接文本，调用默认读取逻辑或提供者的 `validateSvg` 检查父节点，再递归解析子图形。复合提供者通过 `fromSvg` 接收完整子图形列表，返回对象必须保留它们的身份和顺序；文档随后统一登记整个子树。普通分组对未安装 box 的降级警告位于 `GroupProvider`。

默认读取路径的叶节点在递归前拒绝子元素，保留 `unsupported child element in <tag>` 的优先级；自定义 `fromSvg` 在构造结果后检查容器能力。父节点文本与 kind 错误也保持原有优先级：`<g>oops<foo/></g>` 先报告父节点文本错误，非法 kind 也先于未知子图形报错。容器的 `assertUngroupable` 默认检查 canUngroup，派生类可提供领域错误；候选子节点列表由 validateChildren 检查，见 [ADR 005](adr/005-composite-containers.md)。

自定义 `fromSvg` 同样受内核输入保真检查约束。导入结果的几何与样式必须保留普通属性的值，几何数值允许与原读取路径一致的 px/数值规范化；元素正文须与解码后的输入一致，否则报 `SVG input not preserved: <id>/<field>`。不支持的直接文本报错。不匹配的 kind 必须拒绝，或由预检返回降级警告；普通分组的旧 box 降级属于后一种情况。`validateSvg` 仍是可选的预检，空实现无法绕过这些检查。

`ShapeVisitor` 使用公共 `visitShape(shape)`。相关回归既检查类型/id，也检查六类图形的具体几何值及文本，见 [ADR 003](adr/003-open-shapes.md)。属性事务与副作用范围见 [ADR 002](adr/002-attribute-transactions.md)。

## 验证与指标

修改 CLI 源码或采集脚本后，在仓库根目录运行：

```powershell
npm run metrics
npm test
npm run typecheck
npm run check:boundaries
npm run metrics:check
```

测试包含原有回归、仅导入 SDK 的 tile、文本往返、复合图形、类插件示例、事务回滚、错误优先级、注册冲突、帮助文本比较、违规依赖反例和 metrics 过期反例。检查点接口准备后，CLI 共 344 项测试通过。

依赖检查允许插件导入其他插件或公开 SDK，拒绝它们导入装配层和私有内核模块；内核只依赖内核。该检查针对 CLI TypeScript 源文件中的静态 import 与转导出。指标及模块依赖图见 [CLI metrics](../../docs/metrics/README.md)。


## 内容检查点准备

DocumentSnapshot 比较几何、样式、注册 Provider 的文本、父级与子顺序。ShapeViews 负责从 Provider 投影内容；TreeNodeContext 提供同次查询共享的懒快照。

TreeDecorator 可选的 checkpoint 由装配层 CheckpointRepository 在成功读取或保存后通知。回调异常逐个报告并隔离，健康回调继续执行；成功 I/O 的路径与屏障记账不受影响。无监听者时不构建额外快照。createEditor 接收报告出口，CLI 传入自身输出通道。

此准备提交不含 modified-star 包、标签配置或标签测试入口。它确实补改了渲染器与接口，不能称为首次需求下的零改动；后续插件接入以此为基线。见 [ADR 006](adr/006-content-checkpoints.md)。


modified-star 已通过根配置接入，默认代码装配仍待下一提交。它使用上述检查点接口，实例 WeakMap 隔离各文档基线；与 (box) 标签独立并存。运行及配置阶段测试边界见 [TREE_LABELS.md](TREE_LABELS.md)。
