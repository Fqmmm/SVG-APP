# ADR 005：复合容器约束与 box 语义

状态：已实现。通用契约与插件接入分别提交。

## 问题

box 的矩形与标题是必需的直接子节点。原 Group 允许任意删移子节点，仅在 Box.set 或 DeleteCommand 中检查会漏掉 addto、group 与批量结构替换。框架还需要支持复合图形的树名称和属性反馈，而不在命令代码中识别 box。

## 决策

Group 提供纯函数式的 `validateChildren(proposedChildren)`。默认无约束；派生类只能依赖 ID 和传入列表，不能依赖构造后初始化的字段，因为 Group 构造期间也会调用校验。它不得修改状态，也不得根据可变外部状态产生不同结果。

TreeValidator 对初始及候选树调用校验。SvgDocument 的单父节点写入通过 setChildren 校验；直接 reparent 在写入前验证两个父节点的最终列表，同父重排只验证最终列表；replaceStructure 在修改任何列表前校验候选森林和所有替换项，包括从新森林中消失的容器，避免通过删除原容器绕过约束。删除整个子树不清空其内部列表，因此不破坏完整复合对象，也可正常撤销。

`assertUngroupable()` 默认沿用 canUngroup 和原错误信息；复合图形可通过覆写提供明确错误。内核没有具体图形名称分支。

ShapePresentation 增加可选 treeLabel，仅影响树标题；ShapeProvider 增加可选 describeEdit，接收 create/set、applied/undone 和目标对象，由内置命令通过 ShapeViews 调用。回调为只读展示，不修改文档、不抛业务异常；返回 undefined 使用原反馈。它不会参与序列化。未提供这些回调时，Phase 1 的输出保持原样。

Rect 和 Text 是共享领域模型，公开 SDK 导出它们。内置 Provider 和 box 复用同一类，旧导入路径保留转导出。box 的独立测试只依赖自身插件及 SDK，不需要另一个插件激活或注册其叶子类型；完整 CLI 的叶子 SVG 读写仍由内置 Provider 提供。

## box 的选择

- ID 固定派生为 `<id>-rect` 和 `<id>-label`，由文档对整棵新增子树统一检查冲突。冲突时不登记任何节点，不改变历史。
- 必需组件按直接子级中的 ID 与模型类型识别，允许额外节点和子节点重排；禁止删除、移走或再包组。组件可直接接受原有几何与样式编辑。
- 创建矩形为 `(x,y,w,h)`、fill `#4a90d9`，标题位于 `(x+20,y+h/2+5)`。这些值仅用于创建模板，缩放按原有全子树原点缩放语义执行。
- fill 处理器只调用 Box.setFill 修改矩形；label 只调用 Box.setLabel 修改文字。既有子树快照承担撤销与失败回滚；冲突规则沿用 [ADR 002](002-attribute-transactions.md)。
- 写出 `<g data-kind="box">` 并保留实际子节点。安装插件后严格拒绝不完整或类型错误的 box，不修补、不降级；未安装时沿用普通分组 Provider 的警告降级。降级对象再保存失去 data-kind，不承诺再次安装即可恢复。
- `(box)` 是独立的只读 TreeDecorator，由 box 包注册；treeLabel 显示 g#id。后续 modified-star 不需知道这个标签，拼接仍按注册顺序。

## 结果与验证

通用准备不包含 box 分支，可由其他复合容器复用。代价是容器校验存在纯度与构造期使用限制；接口注释和通用约束测试明确此契约。

[BoxPlugin.test.ts](../../../tests/plugins/BoxPlugin.test.ts) 独立验证完整子树、属性和历史；[BoxIntegration.test.ts](../../../tests/plugins/BoxIntegration.test.ts) 验证读写、错误导入及实际命令；[BoxConfigAssembly.test.ts](../../../tests/composition/BoxConfigAssembly.test.ts) 只通过配置方式对照原始 stdout 和 SVG，代码装配另在后续提交接入。提交边界及 Git 复核命令见 [box 节点说明](../BOX_PLUGIN.md)。
