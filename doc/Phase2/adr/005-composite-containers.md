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

## 验证与后续接入

本准备提交不加入具体 box 包。ContainerConstraints 验证构造、单父与跨父写入、批量替换和失败历史保护；PresentationHooks 验证自定义树标题与反馈；PublicPrimitives 验证公开模型可独立使用。CLI 301 项测试与类型检查通过，metrics 快照对应本提交的 116 个源码文件。

后续配置接入和代码装配分别提交，各自在对应源码树上重新采集指标并运行完整测试。准备提交不引用尚未加入的 box 测试脚本。
