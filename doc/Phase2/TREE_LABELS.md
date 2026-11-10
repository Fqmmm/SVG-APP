# 标签配置接入

modified-star 已通过根 plugins.config.json 接入，不修改既有运行源码。默认代码装配尚不包含该标签，下一提交再接入。

```powershell
npm run build
node dist/src/main.js --config plugins.config.json
```

也可使用 [独立标签配置](plugins.labels.config.json)。标签按当前内容与最近成功读取或保存的内容比较；新建未保存文档及节点立即标星，且无需构造快照。保存后编辑再 undo 回到保存内容时星号消失，redo 重现。子节点修改向祖先传播；同父重排只标容器和祖先。默认注册顺序显示 g#n (box) *，反向注册显示 g#n * (box)，两个插件互不依赖。

完整语义见 [ADR 006](adr/006-content-checkpoints.md)。独立测试覆盖状态机、实例隔离、删除前重建干净基线；快照测试在跨父移动前另取快照，避免已有重排状态掩盖旧父级检测。通知失败不反转已成功的 I/O，并继续通知健康标签。

配置阶段使用根配置运行 [labels 会话](../transcript/labels.txt)，stdout 和 SVG 分别对照 [JSON](../transcript/labels.expected.json) 与 [SVG](../transcript/labels.expected.svg)。旧 box 双装配测试暂使用 tests/fixtures/plugins.box-only.config.json，两侧均不启用星号，保留旧 golden。默认代码装配阶段再恢复 box 测试使用根配置，并同步星号 golden。

```powershell
npm test
npm run typecheck
npm run test:labels
npm run check:boundaries
npm run metrics:check
```

本阶段 344 项 CLI 测试通过；标签专项为独立 7 + 集成 6 + 配置 3，共 16 项。没有引用尚未加入的双装配测试文件。指标对应 126 个源码文件，按当前阶段单独采集。

以本配置接入提交为 C，git diff C^ C -- src ':(exclude)src/plugins/modified-star' 应为空。本次框架准备本身修改过渲染器和契约，分步提交只证明准备后接入的零改动，不能称为首次新增标签时严格零改动。
