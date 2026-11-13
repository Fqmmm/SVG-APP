# SVG CLI 编辑器

一个使用 TypeScript 编写的命令行 SVG 编辑器。通过命令创建和编辑图形、组织分组、撤销和重做操作，并将结果保存为 SVG 文件。仓库还包含一个提供 SVG 文件标记和大纲导航的 VSCode 扩展。

## 功能

- 创建矩形、圆、椭圆、直线、文本，以及带标题的 box 组合图形。
- 使用嵌套分组组织图形，整体移动或缩放。
- 设置图形的几何属性、文字和样式，调整父容器与覆盖顺序。
- 撤销和重做编辑操作。
- 读写 SVG，自动补全缺失的 id。
- 统计图形数量、查看工作目录，并在结构树中标记未保存的变化。
- 交互式输入命令，或通过脚本批量执行。

## 快速开始

### 环境要求

Node.js 22.20.0 或更高的 22.x 版本，以及 npm。项目已在 Windows、Node.js 22.20.0、npm 10.9.3 环境下验证。

### 安装与启动

```powershell
git clone https://github.com/Fqmmm/SVG-APP.git
cd SVG-APP
npm ci
npm run cli
```

启动后会显示：

```text
svg-editor 0.1 — type 'help' for commands
svg>
```

在提示符后输入命令，使用 `help` 查看语法，按 `Ctrl+C` 退出。脚本输入在 EOF 时结束。

### 创建第一个 SVG

依次输入以下命令：

```text
init 400 200
create g flow
create rect start 30 70 120 60 #4a90d9 in flow
create line edge 150 100 250 100 black in flow
create rect end 250 70 120 60 #f5a623 in flow
create text label 65 105 "开始" in flow
set label fill white
move flow 10 0
undo
tree
save diagram.svg
```

`diagram.svg` 保存在当前工作目录，可以用浏览器打开。上例创建一个包含四个子节点的组，移动后通过 undo 恢复原位置。

## 可选插件

默认启动会加载 box、stats、dir 和未保存修改标记。也可以指定配置文件：

```powershell
npm run build
node dist/src/main.js --config plugins.config.json
```

在 `plugins.config.json` 中删除相应项或设置 `"enabled": false`，可以停用对应插件。基础图形和原有编辑命令仍可使用。各插件的用法见 [插件使用说明](doc/Phase2/插件使用说明.md)。

## 使用说明

### 文档与查询

| 命令 | 作用 |
| --- | --- |
| `init [w] [h]` | 新建画布，默认 800×600；省略 h 时取 600 |
| `read <file.svg>` | 读入文档，补全缺失 id 并输出警告 |
| `save [file.svg]` | 保存文档，省略路径时使用最近一次成功 read/save 的路径 |
| `canvas [w] [h]` | 无参数查询尺寸；修改时同时给出宽和高，图形几何保持原值 |
| `tree [id]` | 显示文档树或指定子树 |
| `show <id>` | 显示图形类型、父级、几何和显式样式 |
| `stats` | 统计各类型的叶子图形数量和容器数量 |
| `dir` | 列出当前工作目录的直接子项，无需先创建文档 |
| `help` | 显示当前可用命令的语法 |

init 清除默认文件路径；首次保存时提供路径。文件读写失败时保留当前文档、默认路径和历史。save 会创建或覆盖目标文件。

### 创建图形

| 类型 | 命令 |
| --- | --- |
| 矩形 | `create rect <id> <x> <y> <w> <h> [fill]` |
| 圆 | `create circle <id> <cx> <cy> <r> [fill]` |
| 椭圆 | `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` |
| 直线 | `create line <id> <x1> <y1> <x2> <y2> [stroke]` |
| 文字 | `create text <id> <x> <y> "content"` |
| 组合容器 | `create g <id>` |
| 带标题的框体 | `create box <id> <x> <y> <w> <h> "title"` |

box 需要启用对应插件；默认启动已启用。它包含一个矩形和一段文字，可以整体移动、缩放和嵌套。

每条 create 命令都可以追加 `in <containerId>`，将图形放入已有组；省略时放在 svg 根下。id 使用非空且无空白的字符串，在文档中唯一，大小写敏感。

坐标原点在左上角，x 向右、y 向下。CLI 数值使用无单位的有限十进制或科学计数法；坐标允许负数，尺寸和半径为非负数。省略 fill/stroke 时，按 SVG 默认值或父容器样式渲染。

### 编辑与结构调整

| 命令 | 作用 |
| --- | --- |
| `move <id> <dx> <dy>` | 平移，组递归作用于全部子孙 |
| `scale <id> <factor>` | 缩放位置和尺寸，因子大于零，stroke-width 保持原值 |
| `set <id> <attr> <value>` | 设置图形属性 |
| `delete <id>` | 删除图形或整棵子树 |
| `group <gid> <id1> [id2] ...` | 将已有图形收编为新组，内部顺序按原树顺序 |
| `ungroup <gid>` | 将子节点提升到组所在位置，目标组须位于另一个组内 |
| `addto <gid> <id>` | 将图形或子树移到指定组末尾 |
| `front <id>` / `back <id>` | 同级置顶 / 置底，对应子列表末尾 / 开头 |

set 的公共样式为 fill、stroke、stroke-width；几何属性使用 SVG 名称，如矩形的 x、y、width、height。修改文字内容使用 `set label text "新内容"`。g 设置自身的公共样式，子节点保留各自的显式颜色。

对 box 设置 `fill` 会修改内部矩形，设置 `label` 会修改标题。必要子部件不能被单独删除或移出，也不能对 box 执行 ungroup。

分组、移入容器和解组会改变父级关系与节点顺序，渲染时按新的结构计算继承样式与覆盖关系。

### 撤销与重做

使用 `undo` 撤销最近一次编辑，使用 `redo` 重做。每条成功编辑占一个撤销单元，包括已在边界的 front/back；新编辑清空 redo，失败编辑保留历史。

成功执行 init、read、save 或修改画布尺寸后，旧历史清空并建立撤销屏障。此时 undo/redo 报告 `undo not allowed after io command`，下一次成功编辑开始新的历史。tree、show、help、stats、dir 和 canvas 查询不改变历史状态。

### 引号与 Windows 路径

带空格的参数用双引号包住。引号内使用 `\"` 表示双引号，使用 `\\` 表示一个反斜杠。Windows 路径可使用正斜杠，也可以将每个反斜杠写成两个：

```text
read "D:/My Files/demo.svg"
read "D:\\My Files\\demo.svg"
save "D:\\My Files\\result.svg"
```

前两条命令指向同一个文件。文字内容使用相同的转义规则：

```text
create text path 20 40 "C:\\temp"
create text quote 20 80 "输入 \"help\" 查看命令"
```

文字内容分别为 `C:\temp` 和 `输入 "help" 查看命令`。

注释使用以 # 开头的独立行，颜色中的 # 作为参数内容解析。create 通过结尾的 `in <containerId>` 指定父容器；可选颜色位置的独立 in 会按容器语法解析，text 内容和容器 id 可以使用 in。

### SVG 格式支持

编辑器读写 UTF-8 SVG，支持六种内置元素、嵌套 g、图形属性、公共样式、文字和 CDATA。元素使用 SVG 命名空间。缺失 id 按树顺序补成类型名加序号，并避开已有 id；重复的显式 id 会报错。

viewBox 使用 `0 0 width height`，尺寸与画布一致。导入的几何数值允许 px；缺省几何属性一般取 0，椭圆提供单侧半径时另一侧取相同值。stroke-width 使用无单位的非负数。

transform、style/class、font-size、text-anchor、tspan、path、defs、title/desc/metadata、外部命名空间等未支持内容会报错。启用 box 插件时，带 `data-kind="box"` 的分组按 box 读回；停用插件时按普通分组导入并提示降级，再次保存会移除 box 标记。

解析器检查 XML 引用、DOCTYPE、自定义实体和样式表处理指令，保存时检查 XML 字符是否合法。文件先写入同目录临时文件，再通过重命名替换目标文件。

## 示例

| 示例脚本 | 内容 | 输出 |
| --- | --- | --- |
| [典型会话](examples/phase8-session.cli) | 创建、分组、移动、撤销、删除、保存和读取 | [SVG](examples/phase8-demo.svg) |
| [中文流程图](examples/phase8-flowchart.cli) | 嵌套组、移动撤销和文字修改 | [SVG](examples/phase8-flowchart.svg) |
| [混合边界会话](examples/phase8-edges.cli) | 非法参数、失败读入和历史恢复 | [SVG](examples/phase8-edges.svg) |
| [视觉对照](examples/phase8-visual.cli) | front/back 覆盖顺序和组样式继承 | 多份对照 SVG |

在项目根目录用 PowerShell 回放脚本：

```powershell
Get-Content -Encoding utf8 examples/phase8-session.cli | npm run cli
```

替换脚本文件名即可运行其他示例。回放会覆盖对应的示例 SVG。典型会话和混合边界脚本包含预期错误，用于检查失败后的继续执行与状态恢复。

`phase8-other.svg` 是有效导入样例；`phase8-unsupported.svg`、`phase8-no-namespace.svg` 和 `phase8-bad-reference.svg` 用于检查非法输入的错误反馈。

## 开发与测试

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 编译 TypeScript，输出到 dist |
| `npm run typecheck` | 类型检查 |
| `npm test` | 构建并运行全部测试 |
| `npm run cli` | 构建并启动 CLI |

`npm test` 包含单元测试和集成测试，覆盖图形编辑、撤销重做、SVG 读写、插件行为和真实 CLI 会话。

## VSCode 扩展

仓库中的 SVG App Tools 扩展会在 Explorer 中为 SVG 文件添加 `[]` 标记，并在原生 Outline 中显示元素层级。点击节点可跳转到源码，编辑 SVG 后大纲自动更新。

安装和启动方法见 [VSCode 扩展说明](vscode-extension/README.md)。
