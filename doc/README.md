# SVG 编辑器 Phase 1 设计与验证

本项目按[实验要求](Phase1/phase_cli_1.md)实现 TypeScript 命令行 SVG 编辑器，支持 rect、circle、ellipse、line、text 和 g，以及编辑、分组、撤销重做和 SVG 读写。

## 架构方案

### 模块划分

| 模块 | 职责 | 主要实现 |
| --- | --- | --- |
| src/domain | 图形几何与样式、组合结构、状态恢复、文档索引和校验 | Shape、五种叶子图形、Group、SvgDocument、ShapeState |
| src/application | 编辑命令、历史、文档生命周期、图形创建；定义文件访问接口 | EditCommand、CommandHistory、EditorSession、ShapeFactory、DocumentRepository |
| src/cli | 分词、按命令名分发、REPL、反馈与查询格式化 | Tokenizer、CommandDispatcher、Repl、各 Formatter |
| src/infrastructure | XML/SVG 与领域对象转换、磁盘读写 | SvgParser、SvgSerializer、FileDocumentRepository、XmlText、XmlReferences |
| src/main.ts | 创建对象并注入具体文件仓库，启动 REPL | 装配入口 |
| tests | 单元测试与集成测试 | 按层组织测试，tests/integration 回放真实 CLI |
| examples | 会话脚本、导入样例和生成的 SVG | 实验会话、拒绝输入和视觉对照样例 |

源码按一类一文件组织，类名与文件名对应。图形字段由类管理，几何、样式和子节点通过只读副本查询。

下图展示了各模块之间的依赖关系：

![Phase 1 模块依赖](diagram/architecture.svg)

<img src="diagram/packages.png" alt="Phase 1 UML 包图" style="zoom:67%;" />

### 设计模式及落地

#### Command：把编辑操作封装成可撤销的命令

编辑命令继承 EditCommand，通过 execute 和 undo 操作文档。CommandHistory 保存这些命令对象，统一管理执行、撤销和重做；具体如何修改图形、恢复状态，由各命令负责。

- **执行移动：`move r1 10 20`。** CommandDispatcher 解析参数后创建 MoveCommand，再交给 EditorSession 和 CommandHistory 执行。MoveCommand 通过 ShapeEditCommand 保存操作前的 ShapeState，调用目标图形的 move 方法，成功后保存操作后的状态并进入撤销栈。scale 和 set 使用同一套状态保存与恢复流程。
- **撤销：`undo`。** CommandHistory 取出撤销栈顶的命令，调用它的 undo 方法。例如，撤销移动会恢复移动前的坐标；撤销 set 会恢复原属性，包括“原来没有设置这个属性”的情况。撤销成功后，该命令才从撤销栈移到重做栈。撤销直接恢复快照中保存的原值。
- **重做：`redo`。** CommandHistory 取出重做栈顶的同一个命令对象，再调用 execute。对于 move、scale 和 set，ShapeEditCommand 会恢复首次执行后保存的状态，重做使用命令中已保存的执行结果。重做成功后，命令移回撤销栈；撤销之后执行新的编辑命令，则清空重做栈。
- **删除及其撤销：`delete flow`。** DeleteCommand 保存目标对象、父容器、原位置和图形状态，再由 SvgDocument 删除目标及其整棵子树。撤销时，将原对象放回原父容器的原位置，并恢复状态。group、ungroup、addto、front 和 back 涉及树结构变化，由 StructureCommand 保存 StructureEdit，记录受影响列表的前后状态，以便恢复父级与顺序。

执行、撤销或重做失败时，历史栈保持不变。init、read、save 和修改尺寸的 canvas 由 EditorSession 处理，不进入编辑历史；成功后清空历史并建立屏障，直到下一次成功编辑才开始新的历史。

#### Composite：用统一接口操作叶子图形和组合图形

Rect、Circle 等叶子图形与 Group 都继承 Shape。Group 的子节点也是 Shape，因此一个组既可以包含普通图形，也可以包含另一个组。调用方通过同一套接口操作它们，具体行为由对象自身实现。

- **移动组合图形：`move flow 10 20`。** MoveCommand 查找 flow 后直接调用它的 move 方法。若目标是 Rect，就修改矩形坐标；若目标是 Group，Group 就逐个调用子节点的 move，子组继续向下递归。具体行为由目标对象的方法决定，嵌套组中的每个叶子图形都会移动一次。
- **缩放组合图形：`scale flow 2`。** ScaleCommand 同样只调用 Shape 的 scale。Group 将缩放操作传给子节点，各叶子类按自身几何含义修改坐标和尺寸。整个组是一次编辑，撤销时通过组的递归状态快照一起恢复。
- **设置组合样式：`set flow fill blue`。** Group 沿用 Shape 的公共样式接口，将 fill 设置在组自身。子图形没有显式 fill 时，渲染时继承组的颜色；已有显式颜色的子图形保留自己的设置。ungroup 移除组后，子图形按新的父级关系继承样式。

#### 简单工厂与集中分派：统一命令入口和图形创建入口

CommandDispatcher 用一个 Map 将命令名映射到处理方法；ShapeFactory 用另一个 Map 将图形类型名映射到 ShapeDefinition。命令查找与对象创建集中在这两个入口，其余代码通过对象接口完成操作。

- **创建图形：`create rect r1 30 70 120 60`。** CommandDispatcher 先找到 create 的处理方法，再把类型 rect、id 和参数交给 ShapeFactory。工厂通过对应的 ShapeDefinition 解析参数并构造 Rect，随后由 CreateCommand 将对象加入文档。参数转换集中在创建入口，几何约束仍由图形类校验。
- **从文件创建图形：`read demo.svg`。** SvgParser 读取 XML 元素和属性后，调用同一个 ShapeFactory 的 createFromAttributes 创建图形。CLI 输入与 SVG 导入共用类型定义、几何属性顺序和缺省规则。整份文件解析成功后，EditorSession 才替换当前文档。

当前实现采用简单工厂。按实验要求，这两处 Map 查找保留为集中分派的待重构点；以后增加图形类型时，除了实现图形类，还需要补充工厂定义和访问者方法。

#### Visitor：将输出格式与图形行为分开

ShapeVisitor 为每种图形声明访问方法，图形的 accept 方法调用与自身类型对应的方法。终端输出和 SVG 输出各自实现访问者，图形类提供数据与行为，输出格式由访问者负责。

- **查看图形：`show r1`。** ShapeFormatter 将自身作为访问者传给目标图形。Rect.accept 调用 visitRect，Circle.accept 调用 visitCircle，各访问方法读取对应的几何信息并生成文本。增加一种输出格式时，可以新增一个访问者。
- **查看文档树：`tree`。** TreeFormatter 通过统一的 children 接口递归遍历节点，再调用 ShapeFormatter 生成每个节点的摘要。遍历负责树的层次和顺序，访问者负责不同图形的显示内容。
- **保存 SVG：`save demo.svg`。** SvgSerializer 实现 ShapeVisitor，从文档根节点按当前顺序调用 accept。普通图形生成对应的 XML 元素；visitGroup 生成 g 元素，并继续访问子节点。序列化完成后，FileDocumentRepository 写入文件。终端显示与 SVG 序列化分别通过访问者处理各自的格式细节。

### 依赖方向规则

| 模块 | 可以依赖 | 原因 |
| --- | --- | --- |
| domain | 本层模块 | 图形行为独立于终端、文件和 XML，便于直接测试 |
| application | 本层、domain | 编排编辑与恢复，通过自己定义的 DocumentRepository 接口访问文件 |
| cli | 本层、application、domain 的查询与校验接口 | 处理输入与反馈，文件读写交给 application 的接口 |
| infrastructure | 本层、application、domain，以及 Node 文件接口和 XML 库 | 实现文件接口，完成格式转换 |
| main | 各层 | 负责创建对象、注入依赖并启动程序 |

### 变化点假设

| 可能变化 | 已保留的接口或分工 | 本阶段的实现选择 |
| --- | --- | --- |
| 增加 GUI 或 agent 入口 | 编辑命令和 EditorSession 可供多个入口复用 | 当前只要求 CLI，先验证同一套编辑与历史行为 |
| 增加图形或 box 插件 | Shape 多态、集中工厂和命令入口 | 后续插件注册需要扩展 Map 分派及 Visitor 接口 |
| 扩大 SVG 支持范围 | XML 转换集中在 infrastructure，支持与拒绝输入都有测试 | 本阶段按实验白名单读写 SVG，对 transform 和额外字体属性报错 |
| 改用其他存储方式 | DocumentRepository 接口，EditorSession 只处理成功或失败结果 | 当前采用同步的本地文件读写 |
| 调整撤销策略 | 历史管理独立，属性状态和结构状态分别恢复 | 当前历史保存在内存中，属性编辑保存状态快照，结构编辑恢复列表并重建索引 |

## 过程记录

确定架构和测试驱动开发方案后，开发按以下九个阶段推进：

| 阶段 | 主要工作 |
| --- | --- |
| 1. 工程骨架 | 配置 TypeScript、构建和测试工具，实现 REPL 启动、逐行输入与 EOF 退出 |
| 2. 图形模型 | 实现六种图形、Group 组合行为、状态快照，以及 SvgDocument 的树结构和索引 |
| 3. 命令与历史 | 实现创建、移动、删除命令，建立撤销栈、重做栈和历史屏障 |
| 4. CLI 接入 | 实现分词、命令分发、基本编辑及查询命令，统一反馈和错误处理 |
| 5. 缩放与属性编辑 | 接入 scale 和 set，检查属性白名单、参数校验与状态恢复 |
| 6. 结构编辑 | 实现 group、ungroup、addto、front 和 back，支持父级与顺序的撤销重做 |
| 7. SVG 读写 | 实现 SVG 解析、序列化和文件访问，接入 read、save 与 canvas 尺寸修改 |
| 8. 会话验收 | 回放实验会话和边界脚本，检查 SVG 往返、覆盖顺序及样式继承 |
| 9. 文档与交付整理 | 整理使用说明、设计文档和架构图，核对实验要求与干净副本的运行结果 |

本项目由我与 Codex 协作完成。Codex 主要承担代码、测试和文档初稿的编写，我负责提出要求、审核阶段结果和决定修改范围。遇到自己暂时看不懂的 TypeScript 实现时，我会请另一个 agent 独立审查，再把报告交给 Codex 核对。下面记录几次对最终实现影响较大的讨论。

### 先确定开发方式，再开始写代码

开始时，我考虑过参考类似的开源项目，讨论后发现并不合适基于它们进行开发。因此决定围绕实验要求的类层次、多态和设计模式从零实现，并让 Codex 先给出多阶段方案。我又明确要求采用测试驱动开发来完成本次 PJ，每个阶段完成后先留给我审核，不要立即提交。

### 明确 front/back 的顺序语义

阅读实验说明时，我对 front/back 的“前”和“后”产生了疑问：是把节点放到列表前面，还是让图形显示在其他图形上面？我连续追问了 front 的移动方向和 z-order 的含义，也指出这类表述容易产生歧义。

讨论后明确，SVG 按节点顺序绘制，后绘制的图形覆盖先绘制的图形。因此 front 应把目标移到同一父容器子列表的末尾，back 则移到开头。实现和测试都按这个规则处理。最终验收还用重叠图形检查了视觉结果：执行 front 后目标显示在上层，执行 back 后重新被遮挡。

类似地，我在开始开发前询问了椭圆的 rx、ry、ungroup 的含义，以及“公共数据袋加自由函数”的写法为什么不符合要求。这些讨论帮助我理解方案里的 Shape、Group 和命令对象分别承担什么职责。

### 独立审查通过后，仍然处理封装风险

图形模型阶段完成后，因为我还不熟悉 TypeScript，我让 Codex 写了一份审查 prompt，请另一个 agent 检查实现。报告指出 TreeAccess 导出的符号能被外层导入，从而绕过 SvgDocument 替换 Group 的子列表，使文档树与 id、父级索引脱节。

我把报告交回 Codex，先询问哪些意见值得采纳，再决定处理这项风险和测试缺口。修正采用了独占的结构访问句柄：附着在文档上的 Group 由文档持有句柄，外部不能再次取得；节点移除后才释放。测试同时补查重排后移动节点和其他兄弟的 indexOf，并将只读性检查改为验证外部取得的列表不能影响内部树。

后续分组、删除和撤销都依赖文档索引。我要求在进入下一阶段前收紧结构修改入口，补齐回归测试，审核后提交。

### 取舍审查意见，修正 SVG 读入边界

后续阶段仍采用“实现、独立审查、核对意见、修正”的顺序。我先请 Codex 区分实际问题与后续优化，再决定修改范围。例如，阶段 5 我选择修复空字符串样式在终端中的显示，测试运行日志则不作为提交内容，并要求删除后再提交。

SVG 读写阶段的审查指出了两个具体边界：XML 库对某些裸 & 不报警；使用 image/svg+xml 模式时，还可能替未声明命名空间的输入补上默认 SVG 命名空间。这与项目要求的严格读入不一致。我同意采纳相应修正并补上边界测试，由 Codex 先写测试确认问题，再增加 XmlReferences 检查引用语法、改用 application/xml 解析并核对真实的命名空间。

测试除了检查非法文件被拒绝，还检查读入失败后原文档和 redo 保持不变。文件先完整解析成新文档，成功后再替换当前会话；失败时保留正在编辑的内容。这里的问题由审查 agent 发现，代码和回归测试由 Codex 完成，我负责确认修改范围和审核后提交。

## 一致性自查

### 模块划分核对

四个业务目录和 main 与原方案一致。校验类、状态快照、结构访问句柄及 XML 引用检查分别留在所属职责层；tests/integration 承担完整会话验收。

src 共 48 个 TypeScript 文件：43 个类文件、3 个接口文件、1 个结构访问符号文件和 main 入口。类名与文件名对应，每个类文件只有一个导出类。图形行为由类实现，字段按 TypeScript 的 private/protected 封装；几何、样式和子列表通过冻结副本查询。

### 依赖方向核对

扫描全部 import 后，实际依赖符合规则：domain 只引用本层；application 只引用本层和 domain；cli 与 infrastructure 分别按方案引用 application/domain。main 实际只导入 cli、application 和 infrastructure。初稿画出的 main→domain 直连已按实际代码删除。

命令名和图形类型名查找集中在 CommandDispatcher、ShapeFactory 两处；格式化和 SVG 输出通过 Visitor。

## 质量保证手段

### 单元测试

单元测试使用 Node 自带的 node:test 和 assert，按 domain、application、cli、infrastructure 分目录组织，通过公开接口检查对象状态和操作结果。

- **图形与组合行为**：检查各类图形的移动、缩放、属性设置和参数校验，以及嵌套 Group 的递归操作。溢出测试将会失败的节点放在组内后部，检查前面已经修改的节点是否一起恢复。
- **结构与历史**：检查 id 唯一性、父级和索引，核对分组、解组、跨容器移动及前后重排的结果；执行撤销和重做后，再次检查几何、样式、父级及顺序。历史测试覆盖失败时保留栈、新编辑清空 redo，以及文档操作建立历史屏障。
- **输入与文件处理**：检查引号、反斜杠、中文、空字符串样式和错误反馈；SVG 测试覆盖缺失 id 的补全、命名空间、实体引用、特殊字符和重复读写。文件测试检查读写失败后的文档、默认路径及目标文件内容。

开发各功能时先编写测试，再实现相应行为；审查发现的问题补充为回归用例。通过 npm test 构建并运行全部测试，当前单元测试与集成测试合计 224 项，全部通过。

### 集成测试

集成测试通过 SessionReplay 启动编译后的 main，将会话脚本送入真实 CLI 的标准输入，在独立临时目录中执行文件读写。测试逐条比较终端反馈，并读取保存的 SVG，核对图形属性、树结构、父级和节点顺序。

- [实验第 6 节会话](../examples/phase8-session.cli)：覆盖创建、分组、移动、撤销重做、文字修改、删除恢复、保存和读入，比较完整反馈及两次文档树输出。
- [第 6.1 节中文流程图](../examples/phase8-flowchart.cli)：检查组合节点移动后的撤销结果、中文文字修改和保存后的几何信息。
- [混合边界会话](../examples/phase8-edges.cli)：连续执行编辑、结构调整和非法导入，检查错误反馈以及后续编辑、保存的结果。
- [视觉对照会话](../examples/phase8-visual.cli)：检查 front/back 对保存顺序的影响，以及分组、解组和撤销后的样式结构。

此外，集成测试比较 SVG 连续解析与序列化后的文本，检查重复读写结果的一致性。五项完整会话验收测试均通过。

### 独立 agent 审查

各阶段完成后，由另一个 agent 阅读代码和测试，检查实验要求、设计模式、字段封装、依赖方向和边界行为。审查 prompt 明确本阶段的功能范围和检查重点，审查报告交回 Codex 核对，由我决定采纳范围，修改后执行相关测试。

图形模型阶段的审查发现，导出的结构修改符号可以绕过文档校验。修正后由 SvgDocument 持有 Group 的独占访问句柄，并补上结构权限、重排索引和只读查询的测试。SVG 读写阶段的审查发现 XML 库对裸 & 和缺失命名空间的处理与严格读入规则不一致，随后补充引用检查、调整解析模式，并测试读入失败后原会话和 redo 的保留情况。

这两次修改都形成了对应的回归用例。审查意见、代码修改和测试结果共同用于判断该阶段是否可以提交。

### 静态检查

TypeScript 开启严格检查，通过 npm run typecheck 检查类型，通过 npm test 中的构建步骤检查源码编译。两项检查均通过。验证环境为 Windows、Node.js 22.20.0 和 npm 10.9.3。

### 架构核对

架构核对逐项对照实验要求：检查类名与文件名、一类一文件、图形字段封装，以及各模块的 import。实际依赖符合方案，domain 只引用本层，application 引用本层和 domain，cli 与 infrastructure 按各自职责引用 application/domain，main 负责装配。

同时检查类型分派的位置：命令名查找集中在 CommandDispatcher，图形类型名查找集中在 ShapeFactory；图形编辑通过多态方法，终端格式化和 SVG 输出通过 Visitor。架构图中的依赖箭头也按实际导入关系核对，删除了初稿中多画的 main→domain 连线。

### 浏览器视觉验证

将生成的 SVG 交给本机 Chrome 无界面模式渲染，查看截图，核对图形布局、中文文字、重叠顺序和样式继承。检查对象包括[典型会话输出](../examples/phase8-demo.svg)、[中文流程图](../examples/phase8-flowchart.svg)，以及视觉对照会话生成的各组 SVG。

重叠图形在执行 front 后显示在上层，执行 back 后恢复原覆盖关系；组合样式示例中，未显式设置 fill 的矩形在组内显示为蓝色，解组后显示为黑色，撤销解组后恢复蓝色。浏览器呈现与保存的节点顺序、父级关系和样式一致。

# Phase 2

## VSCode 扩展实践

按[第二阶段要求](Phase2/phase_cli_2.md)，第一部分完成了独立的 VSCode 扩展 SVG App Tools：Explorer 中的 SVG 文件显示 [] 标记，原生 Outline 展示元素层级，点击节点定位源码，编辑文本后更新。CLI 插件式重构属于第二部分，后续继续实现。

扩展位于 [vscode-extension](../vscode-extension/README.md)，与 CLI 分开构建和测试。示例文件是 [flowchart.svg](../vscode-extension/examples/flowchart.svg)，完整结果见[验证记录](../vscode-extension/docs/VERIFICATION.md)。

### 安装依赖与启动

在仓库根目录执行：

```powershell
npm --prefix vscode-extension ci
npm --prefix vscode-extension run build
```

在 VSCode 的“运行和调试”中选择 Run SVG App Tools，按 F5 打开扩展开发窗口。也可以单独打开 vscode-extension 文件夹后使用同名配置。调试器加载子项目的扩展清单，示例工作区指向 examples。

环境要求为 VSCode 1.95 及以上、Node.js 22 和 npm。本次采用本地开发模式加载扩展。examples 的工作区配置将 SVG 默认关联到文本编辑器，保证打开文件和点击大纲都进入源码视图；图片预览仍可通过“重新打开编辑器的方式”切换。

### 职责划分与调用过程

| 实现 | 职责 |
| --- | --- |
| extension.ts | 创建对象，注册两个 Provider，登记文件监听与资源释放 |
| SvgFileBadge / FileProbe | 判断 SVG 后缀和普通文件条件，文件类型查询可替换为测试实现 |
| VsCodeFileProbe | 将 workspace.fs.stat 的类型结果转换为 FileProbe 接口 |
| SvgFileDecorationProvider | 返回 [] 文件装饰，并通知 VSCode 文件变化 |
| SvgOutlineParser / OutlineParser | 从 XML 文本生成带名称、子节点和源码范围的只读元素树 |
| SvgDocumentSymbolProvider | 将元素树转换为 DocumentSymbol 和编辑器 Range |

VSCode 管理 Explorer、大纲和编辑器文档，插件负责提供标记和符号数据。扩展在 onStartupFinished 时激活，通过 registerFileDecorationProvider 和 registerDocumentSymbolProvider 注册功能。之后由 VSCode 在绘制文件条目或请求大纲时调用 Provider。

大纲 Provider 每次读取当前编辑器文本，使用解析结果的 UTF-16 偏移调用 document.positionAt，得到源码行列。DocumentSymbol.children 保存层级，range 覆盖整个元素，selectionRange 指向开始标签名。XML 不完整或起止标签不匹配时返回空大纲，文本修复后重新生成。

### 文件装饰与设计模式

文件标记给已有文件条目附加 badge 和 tooltip，文件名与内容保持原样。这与 Decorator 为对象附加职责的目的相近，但对象关系不同：经典装饰器持有被包装对象，实现同一接口并转发操作；本扩展注册独立的 FileDecorationProvider，由 VSCode 查询并合并显示结果，没有直接包装 Explorer 的文件对象。

FileProbe 与 VsCodeFileProbe 则对应 Adapter 模式。FileProbe 是目标接口，VsCodeFileProbe 是适配器，workspace.fs.stat 是被适配 API，SvgFileBadge 是调用方。适配器处理 URI 和 FileType，调用方只需要知道文件是否为普通文件。

SvgDocumentSymbolProvider 依赖 OutlineParser 接口，将元素树转换成 VSCode 文档符号。XML 解析器可以在普通 Node 进程中测试，编辑器位置转换留在 Provider 中。

### Phase 1 代码复用评估

| Phase 1 模块 | 评估结果 |
| --- | --- |
| SvgParser / SvgShapeReader | 用于导入领域文档，包含类型白名单、几何缺省值及属性校验，且没有完整元素起止范围；大纲另用能提供 token 偏移的 XML 解析库 |
| Shape / Group / SvgDocument | 用于图形编辑和唯一 ID 管理；大纲展示源码，允许缺失或重复 id，也需要显示 CLI 未支持的元素，因此采用独立的只读元素树 |
| TreeFormatter | 生成终端字符树；原生 Outline 接收 DocumentSymbol 和 Range，输出结构不同 |
| 递归遍历方式 | 沿用按子节点顺序递归的组织方式，节点结构根据源码范围需求重新定义 |

本次选用 @xml-tools/parser@1.0.12，保留命名空间前缀，并处理 id 中的标准及数值 XML 字符引用。解析测试覆盖注释、CDATA、引号中的大于号，以及中文、emoji、CRLF 和同一行的多个元素。

### 运行演示

文件标记和源码定位见下图：flowchart.svg 右侧有 []，notes.txt 和 folder.svg 目录没有标记。Outline 显示根、嵌套分组和叶子，无 id 的 text、circle 使用标签名。点击 rect#start 后，编辑器定位到第 3 行、第 6 列。

![SVG 文件标记、大纲层级和第 3 行源码定位](../vscode-extension/docs/images/outline-navigation.png)

把矩形 id 从 start 改为 newid 后，大纲及面包屑同步显示 rect#newid。

![修改 ID 后大纲同步更新](../vscode-extension/docs/images/outline-id-update.png)

删除末尾的 SVG 闭合标签后，大纲清空，编辑器仍可继续使用。

![XML 不完整时大纲清空](../vscode-extension/docs/images/outline-incomplete-xml.png)

恢复闭合标签后，大纲重新显示完整层级，并保留 rect#newid。

![恢复闭合标签后大纲重新显示](../vscode-extension/docs/images/outline-restored.png)

### 测试与验收

在 vscode-extension 目录运行：

```powershell
npm test
npm run typecheck
npm run test:host
```

10 项单元测试检查文件过滤、启动配置、元素层级、源码范围和异常输入。8 项真实扩展宿主测试加载注册后的 Provider，检查文件类型、符号查询、取消请求、编辑更新和导航选区。宿主测试使用本机已安装的 VSCode，以及隔离的临时用户配置；逐项结果保存在 [host-tests.json](../vscode-extension/docs/host-tests.json)。

本次宿主环境为 VSCode 1.145.2、Node.js v24.22.1，18 项扩展测试全部通过。CLI 的 228 项单元与集成测试、根项目和扩展的类型检查也通过。手动验收确认了文件标记、鼠标定位、ID 更新和不完整 XML 的恢复，四张截图已保存在仓库中。

### 协作过程与问题修正

这一部分仍由我和 Codex 协作：Codex 编写实现、测试和文档，我在扩展开发窗口中操作并核对结果。实现前先观察 VSCode 已有 Markdown 大纲的层级、展开与选择方式，再接入原生 Outline。

第一次启动遇到的错误是缺少 engines.vscode。检查后发现调试器加载了仓库根目录的 CLI 清单，于是在根目录补上调试配置，将路径指向 vscode-extension，并增加两种启动方式的回归测试。

随后，大纲能显示，但点击节点会进入 SVG 图片预览。我们在 examples 工作区配置默认文本编辑器，并补测打开后的活动编辑器、选区和第 3 行位置。我重新运行后确认定位正确；单击大纲时焦点仍在左侧，切回编辑区后即可继续输入。

最后，我将矩形 id 改为 newid，确认大纲更新；删除并恢复闭合标签，确认大纲先清空再恢复。自动测试与这些实际操作的结果一起记录在扩展验证文档中。

### CLI 框架可扩展节点

四个扩展点已接入内核：`ShapeProvider`、`Command`、`TreeDecorator` 和 `AttributeHandler`。原有图形与命令放在 `src/plugins/builtin`，默认装配集中在 `src/composition`；命令、创建和 SVG 读写共享注册表。

[框架说明](Phase2/FRAMEWORK.md)列出接口职责、调用位置、缺省行为、冲突和失败处理。[首次 CLI metrics](../docs/metrics/README.md)提供与 `final` 的文件、复杂度及依赖对比，包含分类清单、采集脚本和 PlantUML 依赖图。三个 ADR 分别记录[扩展与装配边界](Phase2/adr/001-extension-boundaries.md)、[属性事务](Phase2/adr/002-attribute-transactions.md)和[开放图形协议](Phase2/adr/003-open-shapes.md)。

框架节点当时先验证扩展能力，使用测试插件且不加入默认 CLI。命令与加载器、box 已在后续节点完成，见下文；modified-star 在后续标签节点完成，见下文。

框架节点的[审查处理记录](Phase2/REVIEW_RESOLUTION.md)说明各条意见的取舍。文本持久化改用独立访问器；插件边界增加反例检查；四个扩展点均有类实现，其中标签与属性示例默认关闭。metrics 已补充分类行数、具名模块图及过期校验。

### 命令插件完成

`stats` 与 `dir` 已由独立插件包接入。stats 按深度优先顺序统计叶子类型与容器；dir 通过目录访问接口和 Node 适配器列出进程工作目录，支持隐藏项、稳定排序和读取失败后继续交互。两者都不写文档或修改撤销历史。

代码装配与 `--config` 配置装配共用清单校验和暂存发布路径。双装配测试逐字比较帮助、目录、统计结果和保存的 SVG；每个命令也可单独启用或禁用。命令插件节点当时通过 295 项 CLI 测试，该节点未改动内核与既有插件源码。

启动步骤、适配器角色、配置格式和验收会话见[命令插件说明](Phase2/COMMAND_PLUGINS.md)，加载取舍见 [ADR 004](Phase2/adr/004-plugin-loading.md)。

### box 接入

box 已通过图形、属性和树标签扩展点接入，支持整体编辑、嵌套、撤销及带 `data-kind="box"` 的 SVG 读写。必需子部件不能删除或移走；未安装插件时按普通分组警告降级。Phase 1 版本 B 会话在两种装配方式下的 stdout 和保存文件逐字节一致。

[box 节点说明](Phase2/BOX_PLUGIN.md)记录运行方法、17 项专项测试及框架准备与插件接入的提交边界；[ADR 005](Phase2/adr/005-composite-containers.md)说明结构约束、派生 ID、导入策略和共享模型。box 节点当时通过 318 项 CLI 测试。通用准备、配置接入与代码装配分别提交，每一步都有对应指标和测试；验证命令见节点说明。

### 标签完成

modified-star 与 `(box)` 标签已能同时显示。星号按当前内容与最近成功读写的内容比较，子节点修改向祖先传播；新建未保存节点立即标星，undo 回到保存内容后星号消失。两个插件互不依赖，默认按注册顺序显示 `(box) *`，禁用标签时 Phase 1 的树输出保持原样。

[标签节点说明](Phase2/TREE_LABELS.md)提供运行方法、A/B 会话证据、17 项专项测试和通用准备的提交边界；[ADR 006](Phase2/adr/006-content-checkpoints.md)记录保存点、祖先传播和标签顺序。CLI 当前 345 项测试通过。本轮按通用准备、根配置接入和代码装配分别提交，三个源码/测试组合已在临时工作树分别验证；分步提交只能证明准备后接入的零改动，不能把本次推动的渲染器改动视为符合严格的首次零改动判据。
