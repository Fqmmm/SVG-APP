# 源码目录

CLI 分为内核、插件和宿主装配三部分。`main.ts` 是启动入口，VSCode 扩展独立放在仓库根目录的 `vscode-extension`。

```text
src/
├── domain/                   文档、图形模型和结构约束
│   └── primitives/           公开的矩形、圆、椭圆、直线和文字模型
├── application/
│   ├── session/              当前文档、文件路径、撤销重做历史
│   ├── commands/             可撤销编辑操作的共同基类
│   │   ├── shapes/           创建、删除、移动、缩放和属性修改
│   │   └── structure/        分组、解组、调整父节点和排列顺序
│   ├── shapes/               图形工厂、创建参数、图形定义与输入格式
│   └── documents/            文档读写接口和读取结果
├── extensions/               四个扩展点、注册表、插件公开入口 index.ts
├── cli/                      分词、注册表分发、REPL、输出格式化
├── infrastructure/           文件仓库实现
│   ├── svg/                  SVG 解析、序列化、图形读取和输入校验
│   └── xml/                  XML 文本和实体引用处理
├── composition/              宿主：创建对象、连接依赖、决定加载哪些插件
│   ├── defaults/             预先装配内置能力的便捷入口
│   └── plugins/              插件配置、解析、加载、注册校验
├── plugins/                  具体插件实现
│   ├── builtin/
│   │   ├── commands/         内置命令及其注册入口 index.ts
│   │   └── shapes/           内置图形 Provider 及注册入口 index.ts
│   ├── stats/                图形统计命令
│   ├── dir/                  目录命令、目录接口和 Node 文件系统适配器
│   ├── box/                  box 图形、属性处理器和类型标签
│   ├── modified-star/        未保存修改标签
│   └── examples/             扩展点教学示例
└── main.ts
```

## 从哪里开始读

1. `main.ts` → `composition/startCli.ts`：创建框架、加载插件、启动命令行。
2. `composition/createDefaultFramework.ts`：注册内置命令和六种图形。
3. `composition/createEditor.ts`：连接图形工厂、文件仓库、会话和分发器。
4. `cli/RegisteredCommandDispatcher.ts`：从注册表找命令并调用。
5. `plugins/builtin/commands/ShapeCommands.ts` → `application/commands/shapes/MoveCommand.ts` → `domain`：跟踪一次移动。

## 依赖规则

内核包括 `domain`、`application`、`extensions`、`cli` 和 `infrastructure`。这些目录不导入具体插件或宿主装配代码。插件通过 `extensions/index.ts` 使用框架公开能力；宿主同时知道框架与插件，负责把它们连接起来。运行 `npm run check:boundaries` 检查这条规则。

`Registered*` 类使用传入的注册表或相应服务，不主动安装内置插件。`composition/defaults` 中同名但不带此前缀的类，会准备好默认依赖，适合直接调用和测试。正常 CLI 通过 `createEditor` 显式装配。

具体 Command、ShapeProvider、AttributeHandler 和 TreeDecorator 实现在 `plugins`。`domain/primitives` 统一保存 Rect、Circle、Ellipse、Line、Text 五种共享基础模型，通过公开入口导出，可在不激活任何插件时使用；box 复用其中的 Rect 和 Text。将它们接入 CLI 的 Provider 在 `plugins/builtin/shapes/providers.ts`。

旧目录中的纯转发入口已移除，调用方直接引用实际实现。调整只改变源码导入路径，CLI 命令、配置中的插件路径及输出保持不变。

## 两种命令各放在哪里

`plugins/builtin/commands` 负责命令行入口：解释参数、调用编辑能力、生成反馈文字。`application/commands` 负责可撤销的文档编辑操作，不解释用户输入的命令行。

例如输入 `move r1 10 20`，由内置插件的 `ShapeCommands` 解释参数并创建 `MoveCommand`，通过 `EditorSession` 和 `CommandHistory` 执行并记录。`MoveCommand` 调用图形的移动方法并保留修改前后的状态，以支持撤销和重做。未来的图形界面也可以调用同一个编辑操作。

`application/shapes` 与 `commands/shapes` 的区别是：前者负责怎样按定义创建图形对象，后者负责怎样把图形的变化作为一次编辑执行、撤销和重做。

目录按职责分组。`cli`、`extensions`、`domain` 和各个插件目前规模适中，保留现有层级。
