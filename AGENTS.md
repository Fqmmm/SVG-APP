# 开发约定

本文件适用于整个仓库。修改代码时沿用现有模块分层和命名方式。

## 代码风格

以下规则适用于 src 和 tests 中的 TypeScript 代码：

- 使用两个空格缩进。
- 函数和方法体使用多行形式，包括构造函数、getter、setter 和带花括号的回调函数。空函数体也展开为多行。
- if 和 else 分支使用花括号，分支内容另起一行；else if 可以连写。
- 函数、方法、构造函数和访问器之间保留一个空行。
- 格式调整保持原有行为，字符串内容和测试预期按功能要求处理。

示例：

```typescript
visitGroup(_shape: Group): undefined {
  return undefined;
}

format(shape: Shape): string | undefined {
  if (shape === undefined) {
    return undefined;
  }

  return shape.accept(this);
}
```

## 实现与验证

- 新增功能或修复问题时，先编写或调整相关测试，再实现代码。
- 修改代码后运行 npm test 和 npm run typecheck。npm test 包含全部单元测试与集成测试。
- 提交前运行 git diff --check，检查修改范围和格式。
- 纯文档修改检查内容、格式与链接；涉及功能说明时核对实际实现。

## Git 操作

- commit、push 和创建 tag 分别需要用户明确授权。
- 提交仅包含本次授权范围内的文件，其他工作区修改保留原状。
- 提交信息沿用现有前缀，例如 feat:、fix:、style: 和 docs:，描述本次实际变更。
