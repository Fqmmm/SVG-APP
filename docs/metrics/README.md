# CLI metrics

本目录保存框架、命令插件、box 与标签节点的 CLI 采集结果。基线为 `final`，当前端为工作区源码。`inventory.json` 记录基线 commit、当前 HEAD、每个源文件及采集脚本的 SHA-256，并记录其余产物的摘要。当前 HEAD 表示这份工作区所基于的提交。

在仓库根目录运行：

```powershell
npm run metrics
npm run metrics:check
npm run check:boundaries
```

指定其他基线或输出目录：

```powershell
node scripts/collect-metrics.mjs final docs/metrics/framework
```

[framework](framework) 中包含：

- [inventory.json](framework/inventory.json)：逐文件职责、分类、函数复杂度、内部依赖及源码摘要。
- [files.csv](framework/files.csv)：行数、函数数、复杂度和扇入/扇出。
- [summary.json](framework/summary.json)：总量及按职责划分的文件数、行数。
- [before.puml](framework/before.puml)、[after.puml](framework/after.puml)：具名模块的 PlantUML 依赖图，公开 SDK 单列。

## 复核后的数据

| 指标 | final | 当前工作区 |
|---|---:|---:|
| TypeScript 源文件 | 48 | 107 |
| 内核文件 | 47 | 62 |
| 装配文件 | 1 | 22 |
| 插件文件 | 0 | 23 |
| 内核行数 | 2549 | 2646 |
| 装配行数 | 9 | 557 |
| 插件行数 | 0 | 931 |
| 总行数 | 2558 | 4134 |
| 总复杂度 | 643 | 1003 |
| 单函数最大复杂度 | 26 | 21 |
| 内部依赖边 | 179 | 302 |

文件和总行数增加，内核行数减少 35。注册协议、独立插件和兼容转导出都计入总量，因此这些数据需要结合职责迁移解读。

## 统计与检查口径

统计仅针对根项目 `src/**/*.ts`，排除 VSCode 扩展、测试、脚本和生成文件。基线把 `main.ts` 视为装配；当前把 `main.ts` 与 `composition` 视为装配，`plugins` 视为插件，其余源码视为内核。旧路径转发文件已移除，默认构造位于 `composition/defaults`。

复杂度由 TypeScript AST 计算：有实现的函数从 1 起算，if、循环、case、catch、条件表达式及 `&&`、`||`、`??` 各加 1。嵌套函数单独统计，声明签名不计；这是统一口径的语法指标。

扇出统计去重后的内部源文件依赖，扇入统计引用该文件的源文件数。import 和转导出均计入，包含类型依赖。模块图按目录与职责聚合，边上的数值表示跨模块文件依赖数；插件访问内核的边明确指向 `src/extensions/index.ts`。

`npm run metrics:check` 校验源码集合、源码内容、生成器和产物摘要。更改 CLI 源码或采集脚本后须重新运行 `npm run metrics`，这项守卫也包含在 `npm test` 中。依赖检查有正常路径和违规反例测试，指标校验另有过期摘要反例。
