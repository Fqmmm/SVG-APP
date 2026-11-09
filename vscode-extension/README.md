# SVG App Tools：VSCode 扩展

SVG App Tools 为 Explorer 中的 SVG 文件添加 `[]` 标记，并在原生 Outline 中显示元素层级。点击大纲节点可以定位源码，编辑文本后大纲随之更新。这是 Phase 2 第一部分的实现。

## 启动

环境：VSCode 1.95 及以上、Node.js 22、npm。首次启动执行：

```powershell
Set-Location D:\Jimmy\_software_design\SVG-APP\vscode-extension
npm ci
npm run build
code .
```

可以在仓库根目录 `SVG-APP` 启动，也可以单独打开 `vscode-extension`。在“运行和调试”中选择 `Run SVG App Tools`，按 F5 后会先编译，再打开 Extension Development Host，工作区为 `examples`。调试器通过 `--extensionDevelopmentPath` 加载本地扩展。[官方开发流程](https://code.visualstudio.com/api/get-started/your-first-extension)

示例工作区的 `.vscode/settings.json` 将 SVG 关联到 `default` 文本编辑器，打开文件和点击大纲都会进入源码视图。若已有图片预览标签，先关闭它，再重新打开 flowchart.svg，展开左下角的“大纲 / Outline”。这项设置只作用于 examples；其他工作区可通过“重新打开编辑器的方式 / Reopen Editor With…”将文本编辑器设为默认。修改扩展 TypeScript 后重新按 F5，修改 SVG 文本则会直接更新大纲。

若启动时报缺少 `engines.vscode`，且加载路径指向仓库根目录，说明调试器读到了 CLI 的 package.json。关闭报错窗口，在主窗口选择 `Run SVG App Tools` 配置，再按 F5。该配置指向 vscode-extension。

从仓库根也可以直接执行以下命令启动：

```powershell
npm --prefix vscode-extension ci
npm --prefix vscode-extension run build
code --new-window --extensionDevelopmentPath="D:\Jimmy\_software_design\SVG-APP\vscode-extension" "D:\Jimmy\_software_design\SVG-APP\vscode-extension\examples"
```

## 功能

| 场景 | 结果 |
| --- | --- |
| Explorer 中的 `.svg` / `.SVG` 普通文件 | 文件右侧显示 `[]`，悬停提示 SVG file |
| 普通文本文件、目录，包括 `folder.svg` 目录 | 不添加标记 |
| 打开 SVG 文本 | Outline 展示根元素、嵌套容器及叶子，保持源码顺序 |
| 元素有非空 id | 名称为 `标签名#id` |
| 元素缺少 id | 名称为标签名，不补写 id |
| 点击大纲元素 | 使用对应开始标签名称的范围定位 |
| 未保存的文本编辑 | 根据编辑器当前文本重新计算大纲 |
| XML 不完整或起止标签不匹配 | 返回空大纲；修复文本后恢复 |
| 文件暂时不存在或无法读取类型 | 不添加标记，其他功能继续工作 |

文件标记只查询文件类型，大纲只读取当前编辑器文本，两项功能都不会改动文件名或文件内容。

## 运行效果

### 文件标记、大纲层级与源码定位

flowchart.svg 右侧显示 `[]`，notes.txt 和 folder.svg 目录没有标记。大纲保留源码中的顺序和嵌套关系，无 id 的 text、circle 显示标签名。选中 rect#start 后，第 3 行高亮，状态栏显示“行 3，列 6”。

![SVG 文件标记、原生大纲层级及 rect 标签的源码定位](docs/images/outline-navigation.png)

### 编辑 ID 后同步更新

把矩形的 id 从 start 改成 newid，大纲和编辑器面包屑随即显示 rect#newid。

![矩形 ID 改为 newid 后大纲同步更新](docs/images/outline-id-update.png)

### 不完整 XML 清空大纲

删除文档末尾的闭合标签后，大纲显示“找不到符号”。此时仍可继续编辑文本。

![删除 SVG 闭合标签后原生大纲清空](docs/images/outline-incomplete-xml.png)

### 恢复 XML 后重新显示

恢复闭合标签后，大纲重新显示完整层级，矩形名称仍为 rect#newid。

![恢复 SVG 闭合标签后大纲重新显示完整层级](docs/images/outline-restored.png)

## 模块与职责

| 模块 | 职责 |
| --- | --- |
| [extension.ts](src/extension.ts) | 组合根：创建对象、注册 Provider、登记释放资源和文件事件 |
| [SvgFileBadge](src/decoration/SvgFileBadge.ts) | 判断扩展名与普通文件条件，生成标记 |
| [FileProbe](src/decoration/FileProbe.ts) | 查询文件类型的窄接口，支持测试替身 |
| [VsCodeFileProbe](src/vscode/VsCodeFileProbe.ts) | 将 workspace.fs.stat 适配为 FileProbe |
| [SvgFileDecorationProvider](src/vscode/SvgFileDecorationProvider.ts) | 将标记结果转换为 VSCode 文件装饰，转发变更通知 |
| [OutlineParser](src/outline/OutlineParser.ts) | 文本到只读元素树的接口 |
| [SvgOutlineParser](src/outline/SvgOutlineParser.ts) | XML 语法树到元素名称、层级与偏移的转换 |
| [SvgDocumentSymbolProvider](src/vscode/SvgDocumentSymbolProvider.ts) | 将偏移映射为 VSCode DocumentSymbol 与子符号 |

对象在 extension.ts 中装配，依赖方向为 `extension → Provider → 纯逻辑接口`。XML 解析使用 `@xml-tools/parser`，文件类型查询通过适配器调用 VSCode API。解析和标记规则可在普通 Node 进程中测试。

`OutlineNode` 保存元素名称、源码范围和子节点，供解析器与 Provider 传递结果。扩展和 CLI 分别构建、分别测试；图形编辑由 CLI 负责，扩展运行时不依赖根项目。

## VSCode 与扩展的调用关系

VSCode 负责 Explorer、大纲和文档管理。扩展激活时注册两个 Provider：VSCode 显示文件条目时向文件装饰 Provider 查询标记，需要大纲时向文档符号 Provider 请求节点。注册返回的 Disposable、文件监听器和事件订阅都放入 context.subscriptions，随扩展释放。

文件标记通过 `registerFileDecorationProvider` 注册，大纲通过 `registerDocumentSymbolProvider` 注册，文档选择器匹配本地 SVG 路径。返回的符号用 children 保存层级，range 覆盖整个元素，selectionRange 指向开始标签名。[官方 Provider API](https://code.visualstudio.com/api/references/vscode-api)

扩展在 `onStartupFinished` 时激活，因此浏览 Explorer 时就能看到标记。文本变化后，VSCode 重新请求文档符号。Provider 每次读取当前缓冲区，同步解析，并检查取消请求。[激活事件说明](https://code.visualstudio.com/api/references/activation-events#onStartupFinished)

## Decorator 与 Adapter 模式分析

文件装饰与经典 Decorator 的共同点，是给已有对象附加显示信息，文件本身仍保持原样。两者的对象关系有所不同：经典 Decorator 持有被包装对象，实现同一接口并转发操作；这里注册的是 FileDecorationProvider，VSCode 查询它后合并 badge 和 tooltip。插件没有直接包装 Explorer 的文件对象。

FileProbe 与 VsCodeFileProbe 对应 Adapter 模式。前者提供“是否为普通文件”的接口，后者把 workspace.fs.stat 的 FileType 结果转换为布尔值，供 SvgFileBadge 使用。URI 构造和文件类型位标记都留在适配器中。

SvgDocumentSymbolProvider 则把 OutlineParser 返回的元素树转换为 DocumentSymbol/Range，将 XML 解析结果接入编辑器。解析器只处理文本和偏移。

## XML 解析与源码范围

解析器使用 `@xml-tools/parser@1.0.12` 提供的具体语法树和 token 偏移。遇到词法或语法错误时返回空大纲，并核对起止标签名称，防止解析库的错误恢复结果形成错误层级。[解析库接口](https://github.com/SAP/xml-tools/tree/master/packages/parser)

源码范围使用 JavaScript UTF-16 偏移，按半开区间 `[start, end)` 记录；Provider 通过 document.positionAt 转为编辑器行列。测试检查了 CRLF、中文、emoji、同一行多个元素，以及引号中的大于号、注释和 CDATA。元素整体范围供大纲使用，点击时定位到开始标签名。

大纲保留元素的命名空间前缀，并解码 id 中的标准、数值 XML 字符引用。它展示源码结构，支持 path 等 CLI 白名单之外的元素，也允许重复 id；几何合法性和完整 SVG 规范校验由其他工具处理。

## Phase 1 复用评估

| Phase 1 内容 | 本次选择与原因 |
| --- | --- |
| SvgParser / SvgShapeReader | 保留在 CLI 中；它们执行导入白名单、默认几何值及领域构造，没有完整元素起止范围 |
| Shape / Group / SvgDocument | 保留在 CLI 中；大纲展示的是源码结构，允许缺少或重复 id，也需要展示任意元素 |
| TreeFormatter | 保留在 CLI 中；它生成终端文本，原生 Outline 需要 DocumentSymbol 和 Range |
| 递归遍历与层级组织方式 | 沿用按子节点顺序递归的方式，数据结构按编辑器需要重新定义 |
| XML 解析依赖 | 为大纲选择能提供 token 偏移的解析库，避免额外扫描源码猜测位置 |

## 测试

扩展单元测试与类型检查：

```powershell
npm test
npm run typecheck
```

真实 VSCode 扩展宿主测试：

```powershell
npm run test:host
```

Windows 测试脚本从 PATH 中的 code.cmd 定位 Code.exe；其他安装方式可设置路径：

```powershell
$env:VSCODE_EXECUTABLE = 'D:\D\Microsoft VS Code\Code.exe'
npm run test:host
```

测试脚本调用本机已安装的 VSCode，通过 `--extensionDevelopmentPath` 与 `--extensionTestsPath` 执行测试。用户配置和扩展目录放在隔离的临时目录中，现有窗口保持原状。[官方宿主测试说明](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

宿主测试使用临时 SVG，检查注册后的查询、导航选区、文本更新、取消请求及文件事件。测试结束后清理临时目录，逐项结果保存在 [host-tests.json](docs/host-tests.json)。

10 项单元测试和 8 项宿主测试均已通过。宿主测试环境为 VSCode 1.145.2、Node.js v24.22.1。文件显示、鼠标定位和编辑恢复也已完成手动验收，步骤如下。

## 手动验收与截图

1. 按启动步骤打开扩展开发窗口，记录 VSCode 版本。
2. 在 Explorer 中同时显示 flowchart.svg、notes.txt 和 folder.svg 目录。确认只有 SVG 文件旁有 `[]`，保存截图。
3. 以文本方式打开 flowchart.svg，展开 Outline 的 svg、g#flow、g#labels。应同时看到 rect#start、无 id 的 text、无 id 的 circle。
4. 点击 rect#start，确认定位到第 3 行的 rect 标签，保存包含大纲与源码的截图。
5. 不保存文件，将 start 改为 edited，确认大纲改为 rect#edited；撤销后恢复。
6. 暂时删除最后的 `</svg>`，确认大纲清空、编辑器保持可用；恢复后重新出现。
7. 检查文件名和保存内容未被装饰或大纲功能改写。测试修改结束后撤销示例编辑。

四张截图由开发者手动截取，保存在 docs/images，记录了源码定位、ID 更新和异常恢复的结果。完整验收记录见 [验证记录](docs/VERIFICATION.md)。
