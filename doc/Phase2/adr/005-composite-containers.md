# ADR 005：复合容器约束与 box 语义

状态：已实现。通用契约与插件接入分别提交。

## 背景

box 的矩形和标题必须是直接子节点。原 Group 允许任意删除和移动子节点，只在 Box.set 或 DeleteCommand 中检查，会漏掉 addto、group 和批量结构替换。

框架还需要显示复合图形的树名称和属性修改反馈，同时让通用命令继续通过接口工作。

## 决策

- Group 提供 `validateChildren(proposedChildren)`，默认不增加约束。校验只能依赖图形 ID 和传入列表，不能修改状态、依赖可变外部状态，或读取构造后才初始化的字段；Group 构造期间也会调用它。
- TreeValidator 检查初始和候选树。SvgDocument 的单父节点写入通过 setChildren 校验；reparent 写入前检查两侧父节点的最终列表，同父重排只检查最终列表。replaceStructure 在写入前检查候选森林和所有替换项，包括从新森林中消失的容器。
- 删除整个子树时保留其内部列表，使完整复合对象仍可撤销恢复。assertUngroupable 默认沿用 canUngroup 和原有错误，复合图形可以覆写报错内容。
- ShapePresentation 的可选 treeLabel 只改变树标题。ShapeProvider 的可选 describeEdit 接收 create/set、applied/undone 和目标对象，由内置命令通过 ShapeViews 调用。回调只负责显示，不修改文档或抛业务异常；返回 undefined 使用原反馈，不参与序列化。
- Rect、Text 是公开 SDK 导出的共享领域模型，内置 Provider 和 box 使用同一组模型。当前五种基础图形已统一放入 domain/primitives，旧路径转发文件已移除。
- box 的必要子节点 ID 固定为 `<id>-rect` 和 `<id>-label`，按直接子级中的 ID 与模型类型识别。允许额外节点、重排和部件的几何与样式编辑，拒绝删除、移走或再包组必要部件。新增子树的 ID 由文档统一检查，冲突时不登记节点，也不改变历史。
- 创建矩形为 `(x,y,w,h)`，fill 为 `#4a90d9`，标题位置为 `(x+20,y+h/2+5)`。这些值用于创建；后续缩放沿用全子树相对原点缩放的规则。fill、label 处理器分别调用 Box.setFill、Box.setLabel，撤销和失败恢复使用已有子树快照，冲突处理沿用 [ADR 002](002-attribute-transactions.md)。
- 保存为 `<g data-kind="box">` 并保留实际子节点。已安装插件时，不完整或类型错误的 box 整体读入失败；未安装时由普通分组 Provider 警告降级。降级对象再次保存会失去 data-kind，重新安装插件不能据此自动恢复 box 语义。
- box 包另行注册只读的 `(box)` 标签，树标题显示 g#id。modified-star 无需识别该标签，多个标签按注册顺序连接。

## 理由

结构约束放在统一写入入口，才能覆盖所有结构命令。检查被移出候选森林的容器，可以防止通过删除原容器绕过必要部件约束。保留整棵删除子树的内部结构，则允许删除完整 box 并正常撤销。

显示名称和编辑反馈由 Provider 提供，通用命令无需识别 box。共享模型让 box 可以直接创建部件，独立测试也无需激活另一个插件。

已安装插件时严格拒绝不完整 box，可以避免生成缺少必要部件的对象。未安装时降级为普通分组，仍能保留其可编辑的子图形。

## 影响

- 通用准备不包含 box 名称分支，其他复合容器可以复用这些接口。
- 容器校验有只读和构造期使用限制，接口注释及通用约束测试明确这些要求。
- 未提供展示回调时，Phase 1 输出保持原样。box 的独立模型测试只依赖自身插件与 SDK；完整 CLI 中叶子的 SVG 读写仍由已注册的内置 Provider 提供。
- [BoxPlugin.test.ts](../../../tests/plugins/BoxPlugin.test.ts) 验证完整子树、属性和历史；[BoxIntegration.test.ts](../../../tests/plugins/BoxIntegration.test.ts) 验证读写、错误导入及实际命令；[BoxAssembly.test.ts](../../../tests/composition/BoxAssembly.test.ts) 比较两种装配的原始 stdout 和 SVG。
- 通用准备与插件接入分别提交，Git 复核方法见 [提交与验收记录](../开发检查与修正记录.md)。
