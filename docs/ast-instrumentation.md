# AST 注入设计说明

## 背景

旧实现通过虚拟模块在运行时劫持 `console.log/info/warn/error`。
这种方式会让浏览器 DevTools 将日志调用位置指向虚拟模块（例如 `__x00__virtual:unplugin-console`），不利于调试。

## 目标

1. 保持终端日志转发能力。
2. 保持浏览器侧日志调用位置指向用户源码文件。
3. 避免修改全局 `console` 方法。

## 新架构

### 1）编译期调用点注入

在插件 `transform` 阶段，解析 JavaScript/TypeScript 模块，并重写 `console.log/info/warn/error(...)` 调用。

每个匹配到的调用会被替换为一个表达式，执行流程如下：

1. 将参数只捕获一次到数组中。
2. 执行原始 `console.<level>` 调用。
3. 若存在 `globalThis.__UNPLUGIN_CONSOLE_REPORT__`，则调用它上报日志。
4. 返回原始 `console` 调用结果。

这样可以尽量保持原始执行语义，同时保证上报副作用发生在浏览器日志输出之后。

### 2）运行时辅助模块

`virtual:unplugin-console` 不再覆盖 `console`。
它现在只注册一个全局上报函数：

- 名称：`__UNPLUGIN_CONSOLE_REPORT__`
- 职责：
  - 参数序列化（`Error`、`Date`、`RegExp`、循环引用、截断）
  - 按日志级别可选采集堆栈
  - 分发传输

### 3）传输策略

- `vite`：优先使用 `import.meta.hot.send('unplugin-console:log', payload)`。
- 其他框架：回退到 HTTP `POST /__unplugin_console`。

## 为什么这能修复 DevTools 路径问题

因为真正的 `console.*` 调用现在发生在“转换后的用户模块”中，DevTools 会把链接定位到这些源码模块，而不是虚拟运行时模块。

## 兼容性说明

- 仍支持日志级别过滤（`levels` 选项）。
- 仍支持堆栈采集（`captureStack`、`stackTraceDepth`）。
- 会为入口文件和已注入文件自动注入运行时辅助模块导入。
- 默认不对 `node_modules` 做注入。

## 已知限制

1. 只处理直接的 `console.<level>(...)` 成员调用。
2. 动态/间接调用模式（例如解构别名）不会被重写。
3. AST 重写会改变产物代码形态，但常规 `console` 使用语义保持不变。

## 验证清单

1. `pnpm test`
2. `pnpm build`
3. 在 playground 打开浏览器 DevTools，确认日志链接指向源码模块，而不是虚拟模块路径。
