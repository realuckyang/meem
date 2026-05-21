# Meem Extension

这是 `meem` 仓库当前的主产品。仓库已经转向插件版数字分身，不再以 Codex 版 Worker、桌面客户端或本机 bridge 作为主线。

## 目录边界

- `gui/`：产品前端，包含对话 UI、AI/LLM runner、浏览器工具适配、Vite/TypeScript 配置与前端依赖。
- `extension/`：Chrome 插件壳，包含 `manifest`、`background` 和插件构建产物；不放产品业务源码。
- `worker/`：本产品自己的 Cloudflare Worker，包含 API、D1 schema/migrations、Durable Object 与部署配置。
- `dev/`：参考素材和历史资料，默认忽略，不视为产品结构。
- 根目录除 `gui/`、`extension/`、`worker/`、`dev/` 外，只放仓库说明、忽略规则和协作文件，不直接放产品源码。

## 产品边界

- 核心交互是“事项流”：用户输入、外部来信、分身处理、回复草稿、记忆变化都进入同一个流。
- Web 端和 Chrome 插件使用同一套产品体验；插件负责浏览器能力和侧栏入口。
- 智能执行层使用用户在插件/网页里配置的大模型，不依赖 Codex。
- `worker/` 是本产品自己的 Cloudflare Worker。

## 工程边界

- 不恢复旧 `client/`、`server/`、`browser-use/`、旧 Codex Worker 或桌面客户端主线。
- 不兼容旧 `browser-use/`，不要把旧 MCP bridge 逻辑搬进来。
- 不提交 API key、token、真实 `wrangler.jsonc`、运行态数据、`node_modules`、`dist`。
- Chrome 工具定义在 `gui/src/ai/tools.js`，执行函数在 `gui/src/ai/functions.js`，新增工具时两边保持一致。
- Worker 公开接口、插件 WebSocket、前端状态命名必须统一，避免“消息/事项/会话”概念混用。

## 命令

```bash
npm --prefix gui install
npm --prefix gui run check
npm --prefix gui run build
npm --prefix gui run build:extension

npm --prefix worker install
npm --prefix worker run typecheck
npm --prefix worker run dev
npm --prefix worker run deploy
```
