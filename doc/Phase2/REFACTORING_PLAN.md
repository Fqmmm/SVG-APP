# Phase 1 内部重构方案

日期：2026-11-09

状态：代码重构已完成，待审查。

需求依据：[Phase 1 CLI 需求](../Phase1/phase_cli_1.md)。设计采用 solid 技能中的 SOLID、TDD、职责划分与简单设计原则，文字按 anti-defensive-writing 技能组织。

## 1. 目标与范围

本轮整理 Phase 1 现有实现的职责边界，降低命令处理、输入转换和算法阅读的复杂度，保持 CLI 命令、六种图形、输出格式、错误信息及撤销重做语义。

工作范围包括 CLI 命令职责拆分、编辑反馈集中管理、CLI 与 SVG 输入转换分离，以及 SVG 解析和分组算法的步骤整理。Phase 2 的扩展点、插件、加载器、双装配和 VSCode 实践留待后续实施。

## 2. 现有问题与处理方式

| 重构前的问题 | 本轮处理 | 保持的行为 |
| --- | --- | --- |
| CommandDispatcher 同时处理分派、参数、命令构造、查询、帮助与历史反馈 | 按四类命令拆分处理类；分派器保留分词、查找及文档前置检查 | 命令集合、错误优先级与输出 |
| 图形编辑与结构编辑的反馈都保存在分派器内部 | EditFeedback 集中保存执行、撤销与重做反馈，供两类编辑处理器共享 | 一个会话内跨命令类别的撤销顺序与反馈 |
| ShapeDefinition 同时处理 CLI 创建和 SVG 属性转换，SVG 数值转成字符串后再次解析 | 两条输入路径分别生成 ShapeInput，共用 ShapeDefinition 构造领域对象 | 几何校验、样式、缺省值及文本内容 |
| SvgParser.parse 连续执行多种解析步骤 | 提取根元素解析、画布创建和 ID 分配 | 校验顺序、补 ID 规则及警告顺序 |
| GroupCommand.buildEdit 混合目标校验、共同父级、插入位置及结构修改 | 将选择与位置计算提取为私有方法 | 相对顺序、跨父级分组与整体撤销 |

## 3. CLI 职责拆分

| 类 | 职责 | 代码 |
| --- | --- | --- |
| CommandDispatcher | 分词、固定命令名查找、文档前置检查及委派 | [CommandDispatcher.ts](../../src/cli/CommandDispatcher.ts) |
| DocumentCommands | init、read、save、canvas 的参数处理和反馈 | [DocumentCommands.ts](../../src/cli/DocumentCommands.ts) |
| ShapeCommands | create、move、scale、set、delete 的参数处理与编辑命令构造 | [ShapeCommands.ts](../../src/cli/ShapeCommands.ts) |
| StructureCommands | group、ungroup、addto、front、back 的参数处理与反馈 | [StructureCommands.ts](../../src/cli/StructureCommands.ts) |
| QueryCommands | tree、show、help 的参数处理与输出 | [QueryCommands.ts](../../src/cli/QueryCommands.ts) |
| EditFeedback | 执行编辑命令、关联反馈、处理 undo/redo 的反馈 | [EditFeedback.ts](../../src/cli/EditFeedback.ts) |
| CommandArguments | 统一参数数量检查与 usage 错误 | [CommandArguments.ts](../../src/cli/CommandArguments.ts) |

CommandDispatcher 创建一个 EditFeedback，并同时交给 ShapeCommands 和 StructureCommands。undo/redo 使用同一实例，确保图形编辑与结构编辑共享反馈记录。

EditFeedback 委派 EditorSession 执行编辑和历史操作。CommandHistory 继续管理历史栈，领域命令继续保存和恢复状态；反馈对象负责终端表达。

ShapeFormatter.label 统一生成 type#id 标签，供图形摘要和编辑反馈使用。Visitor 继续负责各类图形的终端格式化和 SVG 输出。

## 4. CLI 与 SVG 输入分离

### 4.1 共用的类型定义

[ShapeSchema](../../src/application/ShapeSchema.ts)描述几何字段顺序、可选样式、文本及缺省几何来源。[ShapeInput](../../src/application/ShapeInput.ts)承载已经转换的数值、文本和可选样式。[ShapeDefinition](../../src/application/ShapeDefinition.ts)接收 ShapeInput，调用具体图形构造函数并设置可选样式。

这些输入描述用于连接转换层与领域构造。移动、缩放、属性更新、几何约束和状态恢复仍由图形类完成。

### 4.2 CLI 创建路径

ShapeCommands.create → ShapeFactory.create → CreateArguments → ShapeInput → ShapeDefinition.create → 具体图形 → CreateCommand。

[ShapeFactory](../../src/application/ShapeFactory.ts)保留六种类型的集中查找，根据 schema 检查参数数量并解析数值。CreateArguments 继续处理原有的参数数量与缺少容器 ID 等错误。父容器挂接仍由 CreateCommand 和 SvgDocument 完成。

### 4.3 SVG 导入路径

SvgParser → SvgShapeReader.read → ShapeFactory.definition → ShapeInput → ShapeDefinition.create → 具体图形。

[SvgShapeReader](../../src/infrastructure/SvgShapeReader.ts)负责 SVG 属性转换：处理 px 单位、缺省几何值、椭圆半径回退、文本内容及非几何属性。它直接生成数值输入，避免借用 CLI 字符串参数重新解析。

原有工厂的 createFromAttributes 和类型定义的 fromAttributes 调用迁移到 SvgShapeReader.read；对应测试调整调用位置，保留行为断言。CLI 使用方式保持不变。

## 5. 解析与分组算法整理

### 5.1 SVG 解析

[SvgParser.parse](../../src/infrastructure/SvgParser.ts)按以下顺序组织导入：

1. parseRoot 校验 XML 文本、引用、处理指令、根元素和命名空间。
2. createDocument 校验画布属性及 viewBox，创建新文档。
3. assignIds 先保留所有显式 ID，再为缺失 ID 的元素分配名称并生成警告。
4. appendChildren 创建图形并建立层级。
5. 返回新文档及警告；异常继续包装为 invalid SVG 错误。

EditorSession 仍在完整读入成功后才替换当前文档。读入失败保留正在编辑的文档、路径和历史。

### 5.2 分组

[GroupCommand](../../src/application/GroupCommand.ts)保留原有算法，提取三个计算步骤：

- selectTargets 校验目标并按文档树顺序排列。
- commonParent 确定共同父级。
- insertionIndex 计算新组的插入位置。

buildEdit 使用这些结果构造 StructureEdit。StructureEdit 继续记录受影响列表的前后状态，保证一次 group 是一个撤销单元。

## 6. 保留的模块与依赖方向

本轮沿用现有分层和命名方式：

| 模块 | 依赖方向 | 本轮调整 |
| --- | --- | --- |
| domain | 仅依赖本层 | 保留现有图形、Composite、校验和快照 |
| application | 本层及 domain | 整理 ShapeDefinition、ShapeFactory 和 GroupCommand，增加输入与 schema 类型 |
| cli | 本层、application、domain | 拆分命令处理，集中参数数量校验及历史反馈 |
| infrastructure | 本层、application、domain、XML/文件库 | 增加 SvgShapeReader，整理 SvgParser 步骤 |
| main | 装配 cli、application 和 infrastructure | 保留启动装配 |

CommandHistory、EditorSession、SvgDocument 的索引和结构访问权限、文件仓库接口及原子写入机制继续承担原有职责。

## 7. SOLID 与简单设计取舍

| 原则 | 本轮落实 |
| --- | --- |
| SRP | 分开命令分派、四类命令处理、历史反馈与 SVG 输入转换 |
| OCP | 保留 Phase 1 允许的两处集中分派，本轮通过已有职责接口组织实现 |
| LSP | 保留 Shape 的统一编辑接口，以及 Group 对子节点的递归行为 |
| ISP | 图形构造使用独立的 ShapeInput 和 ShapeSchema 描述，输入转换各自处理协议细节 |
| DIP | 保留 EditorSession 对 DocumentRepository 的接口依赖，以及领域层独立于终端和文件的方向 |
| KISS / YAGNI | 围绕已存在的耦合提取类和私有方法，保持固定命令表及固定图形类型 |

方法长度和字段数量用于辅助检查职责；验收以行为保持、可读性和依赖方向为准。

## 8. 测试与实施记录

实施先补充相关回归测试，再迁移现有实现；已有测试持续保护图形、结构、历史、文件读写和完整 CLI 会话。

| 工作项 | 状态 | 验证依据 |
| --- | --- | --- |
| CLI 命令拆分及共享反馈 | 已完成 | 原有 CLI 测试及跨类别 undo/redo 回归 |
| CLI/SVG 输入分离 | 已完成 | 工厂、SVG 编解码及新增转换测试 |
| 解析步骤整理 | 已完成 | ID 补齐、非法 XML、属性白名单及导入失败测试 |
| 分组步骤整理 | 已完成 | 同父级、跨父级、嵌套、顺序及历史测试 |
| 全量验证 | 已通过 | npm test、npm run typecheck、git diff --check |

新增 4 项回归测试：

- [RefactoringCompatibility.test.ts](../../tests/cli/RefactoringCompatibility.test.ts)：跨命令类别的历史反馈；文档错误优先级及现有命令边界。
- [SvgShapeReader.test.ts](../../tests/infrastructure/SvgShapeReader.test.ts)：CLI/SVG 输入差异；椭圆缺省值、文本空白和属性白名单。

2026-11-09 本轮代码验证结果：原有 224 项测试与新增 4 项测试合计 228 项，包含单元测试和集成测试，全部通过；类型检查及格式检查通过。

## 9. 审查与交付检查

审查按以下顺序进行：

1. 对照 Phase 1 需求，检查命令语法、成功反馈和错误优先级。
2. 检查四类命令处理器是否只组织所属功能，共享反馈是否覆盖整个会话。
3. 检查 CLI 与 SVG 转换是否共用领域构造，并分别保持数值、缺省值和文本规则。
4. 检查解析与分组提取方法是否保持原有顺序、原子性及撤销语义。
5. 执行全部测试、类型检查和 git diff --check，确认修改范围。

工作区中的重构代码与本文等待用户审查。commit、push 和创建 tag 分别遵循仓库的明确授权约定。
