# Meem Extension

这是 `meem/extension` 内的插件版数字分身产品。主 `meem/worker` 是 Codex 版，不在这里改；这里的 Worker、前端、运行态数据都独立演进。

## 产品边界

- 核心交互是“事项流”：用户输入、外部来信、分身处理、回复草稿、记忆变化都进入同一个流。
- Web 端和 Chrome 插件使用同一套产品体验；插件只是多了浏览器能力和本地执行桥。
- 智能执行层使用用户在插件/网页里配置的大模型，不依赖 Codex。
- `worker/` 是本产品自己的 Cloudflare Worker。后续如需要 D1，也单独绑定本产品的 D1，不复用主 meem。

## 工程边界

- 不修改仓库根部的 `worker/`、`worker/gui/`、`server/`。
- 不兼容旧 `browser-use/`，不要把旧 MCP bridge 逻辑搬进来。
- 不提交 API key、token、真实 `wrangler.jsonc`、运行态数据、`node_modules`、`dist`。
- Chrome 工具定义在 `src/ai/tools.js`，执行函数在 `src/ai/functions.js`，新增工具时两边保持一致。
- Worker 公开接口、插件 WebSocket、前端状态命名必须统一，避免“消息/事项/会话”概念混用。

## 命令

```bash
npm install
npm run check
npm run build

npm --prefix worker install
npm run worker:check
npm run worker:dev
npm run worker:deploy
```
