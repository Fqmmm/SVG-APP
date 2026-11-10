# 命令插件：stats 与 dir

本节点接入两个独立命令包，完成目录适配器、独立测试和双装配验证。内核及 `plugins/builtin`、`plugins/examples` 源码保持不变，启动入口转交装配层选择插件。

## 启动与启用方式

在仓库根目录运行：

```powershell
npm run build
node dist/src/main.js
node dist/src/main.js --config plugins.config.json
```

不带 `--config` 时使用代码装配：[codePlugins.ts](../../src/composition/codePlugins.ts) 显式选择并启用 stats、dir。带 `--config` 时，只启用配置数组中的可选插件；配置模式不会导入代码装配文件。

[plugins.config.json](../../plugins.config.json) 是启用两个命令的示例：

```json
{
  "plugins": [
    { "module": "./src/plugins/stats" },
    { "module": "./src/plugins/dir" }
  ]
}
```

从配置中删除一项，或设置 `"enabled": false`，即可单独禁用它。内置命令和六种图形始终保留。使用空配置可检查 Phase 1 基线：

```powershell
node dist/src/main.js --config doc/Phase2/plugins.none.config.json
```

两个插件各有自己的 `package.json`，声明包名、编译入口和 `contributes.commands`。它们通过公开 SDK 实现 `Command`，没有进入内置命令表。禁用后，命令从帮助中消失，执行时报告 `error: unknown command: <name>`。

## stats

[StatsCommand](../../src/plugins/stats/StatsCommand.ts) 要求已有文档，不接收参数。从画布子节点按当前顺序深度优先遍历，通过 `asContainer()` 判断容器，按首次遇到的叶子类型排列统计结果：

```text
rect: 1  text: 1  (total 2, containers 1)
```

根 SVG 不计数；所有容器只计入 containers，其子图形继续遍历。因此新容器类型可直接参与统计。空文档输出 `(total 0, containers 0)`。

该命令只读取公共模型，不调用编辑、保存或历史屏障。测试覆盖嵌套容器、未知于插件的 tile 类型、类型首次出现顺序，以及执行前后的 undo/redo。

## dir 与适配器

[DirCommand](../../src/plugins/dir/DirCommand.ts) 不要求文档，不接收参数。它查询 CLI 进程当前工作目录，只列出直接子项，包含隐藏项，排除 `.` 和 `..`。`read`、`save` 不改变这个目录。

| 模块 | 职责 | 适配器模式角色 |
|---|---|---|
| [DirectoryAccess](../../src/plugins/dir/DirectoryAccess.ts) | 提供当前目录和目录条目，返回名称与类型 | Target |
| `DirCommand` | 校验参数、稳定排序、格式化输出与目录错误 | Client |
| [NodeDirectoryAccess](../../src/plugins/dir/NodeDirectoryAccess.ts) | 将 Node 目录条目转换为公共 DTO | Adapter |
| `node:fs.readdirSync`、`process.cwd()` | 提供真实文件系统和进程目录信息 | Adaptee |

目录在前，普通文件随后，各组按 JavaScript 字符串顺序升序排列，不依赖系统区域设置。符号链接用 `[LINK]` 标记，其他特殊项用 `[OTHER]`，两者排在普通文件之后；适配器不遍历链接目标。未知 kind 视为适配器契约错误，明确报告 `invalid directory entry kind`。所有标记后都有两个空格。

空目录输出 `(empty directory)`。当前目录查询与条目读取处于同一错误边界；无法取得目录路径时使用稳定标识 `<cwd unavailable>`。读取失败抛出 `cannot read directory: <path>`，由 REPL 输出 `error:` 前缀，随后继续接收命令。成功和失败路径都不写文档、不改变当前文件路径，也不修改 undo/redo 历史。

## 两种装配共用的加载路径

[PluginLoader](../../src/composition/plugins/PluginLoader.ts) 位于装配层。代码方式通过 `loadCode` 提供类型检查过的加载函数，返回插件实例；配置方式通过模块名动态导入默认实例。两者最终都调用 `activate`，执行同一清单校验和暂存发布流程。

配置相对路径以配置文件目录为基准。包名使用固定版本 `import-meta-resolve` 按 ESM import 条件解析，再使用动态 `import` 加载；包根清单由 Node `findPackageJSON` 获取，避免嵌套构建清单覆盖根声明；相对目录读取自己的 `package.json.main`。两个本地插件的入口指向仓库构建后的 `dist`，因此需要先执行 `npm run build`。当前插件与宿主按仓库布局一起构建和部署；独立发布时需将产物与 SDK 依赖组织到包内。代码装配通过向上查找项目 package.json 定位仓库，支持仓库内不同构建层级。

`options` 原样传给 `activate(context, options)`。stats、dir 当前没有可配置参数；测试使用独立插件验证 options 透传。配置按数组顺序加载，`enabled: false` 在解析模块、读取其清单和求值之前跳过。

框架先让插件在独立注册上下文中激活，再比较四类名称集合、复核注册契约并检查宿主重名，全部通过后才发布。激活结束后的复核还能捕获注册后被改写的形状契约。注册冲突与清单不匹配使用专用错误类型；插件自行抛出的相似文案仍按激活异常报告。失败时丢弃当前插件的暂存注册，保留先前插件并继续后续加载，详见 [ADR 004](adr/004-plugin-loading.md)。

| 失败 | 输出 |
|---|---|
| 模块解析失败 | `error: plugin not found: <module>` |
| 没有默认导出 | `error: plugin has no default export: <module>` |
| 清单与实际注册不符 | `error: plugin manifest mismatch: <name> (declared: …, registered: …)` |
| 求值、依赖或激活失败 | `error: plugin failed to activate: <name> (<reason>)` |
| 重复注册 | `error: duplicate registration: <category>/<name>` |
| 配置无法读取或结构非法 | `error: invalid plugin config`，随后启动内置编辑器 |

加载器没有 stats、dir 的名称映射或专用分支。今后代码装配在 `codePlugins.ts` 增加一项，配置装配在配置中增加一项，加载器保持通用。

## 验证证据

```powershell
npm run test:stats
npm run test:dir
npm run test:loader
npm test
npm run typecheck
npm run check:boundaries
npm run metrics:check
```

stats 独立测试 3 项；dir 的测试替身与真实适配器测试共 8 项；加载器与真实 CLI 双装配测试共 19 项。CLI 总计 295 项测试通过。

[CommandAssembly.test.ts](../../tests/composition/CommandAssembly.test.ts) 使用固定临时工作目录，直接条目为 assets、.hidden、a.txt；输入 SVG 与保存文件都放在 assets 内。配置使用以配置目录为基准的相对插件路径。配置装配运行前删除代码装配生成的 SVG，验证它确实重新写出文件。两种方式运行相同会话，输出保存在内存中，不往被列出的目录写日志。测试逐字比较 stdout 和 SVG，同时验证 read/save 后的三次目录列表相同。

会话证据分别保存为：

- [输入命令](../transcript/command-plugins.txt)，只含命令。
- [输入 SVG](../transcript/command-plugins-input.svg)。
- [预期 stdout](../transcript/command-plugins.expected.json)，JSON 精确保留换行与末尾提示符空格。
- [预期保存 SVG](../transcript/command-plugins.expected.svg)。

本节点建立了首次加载装配基础。后续 box 与标签节点将使用它验证新增插件的差异边界；本节点的内核和既有插件差异为零。
