# meem extension

独立 Chrome 扩展，目标是浏览器侧栏对话和可扩展浏览器工具。

- 不兼容旧 `browser-use/`，不要把旧 MCP bridge 逻辑搬进来。
- AI 核心参考 `/Users/woodchange/Desktop/AGENT/AGENT/ai` 与 `/Users/woodchange/Desktop/AGENT/AGENT/llm` 的结构，但这里实现为浏览器扩展可运行的 TypeScript。
- 工具必须通过 `src/tools/registry.ts` 注册，保持 schema、执行函数、输出格式一致。
- 不提交 API key、token、运行态数据。

## 命令

```bash
npm run build
npm run check
```
