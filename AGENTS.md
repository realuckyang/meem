# Meem

> 文档更新时间：2026-05-30

Meem 是建立在本地电脑、浏览器和 Cloudflare 生态上的 AI 应用框架。它提供一个公网 Worker、一个内部控制台、一套本地/浏览器能力端，以及可由 AI 驱动生成和部署的网站与内部应用。

## 核心路径

- `/`：用户对外网站。默认由 Worker 承载，面向公开访问者。
- `/meem`：Meem 控制台。负责 AI、会话、工具状态、设置、应用管理和部署管理。
- `/meem/apps/:appname`：Meem 内应用。面向登录后的内部使用场景。

## 目录边界

- `worker/`：Cloudflare Worker。负责 REST API、WebSocket、Durable Object、D1/R2、静态资源和路由分发；D1 结构以 `schema.sql` 为唯一真相。
- `worker/server/meem/`：Meem 后端。负责控制台 API、agent、工具 schema、Room DO、Meem repository。
- `worker/server/site/`：Site 后端。负责对外网站请求、公开表单和访客交互。
- `worker/gui/meem/`：Meem 控制台前端（React + Vite + TS），对应 `/meem`。
- `worker/gui/meem/src/apps/`：Meem 内应用，聊天、终端、文件、状态、截图都在这里，对应 `/meem/apps/:appname`。
- `worker/gui/meem/src/system/`：Meem 前端系统层，负责全局顶栏、应用面板、路由和共享 client。
- `worker/gui/site/`：用户对外网站源码，对应 `/`。
- `client/`：电脑端 Node CLI（`meem-client`），经 WebSocket 接入 `Room`，提供终端、文件、截图、系统状态和电脑操作能力。
  - `client/system/`：电脑端系统层，负责 WebSocket 生命周期、配置校验、共享工具函数。
  - `client/apps/`：电脑端应用能力，终端、文件、状态/截图、电脑工具都在这里。
- `extension/`：Chrome MV3 浏览器扩展，经 WebSocket 接入 `Room`，提供 CDP 浏览器工具。
- `dev/`：参考素材和历史资料，默认忽略，不视为产品结构。

## 产品边界

- Meem 不是单纯聊天工具；它是 AI 驱动的网站和内部应用框架。
- Agent 可以通过 `client/` 驱动 shell、文件和本机环境写代码、运行检查、构建并部署。
- Agent 可以通过 `extension/` 驱动浏览器完成登录态网页操作、调试和资料获取。
- Worker 是公网入口和 Cloudflare 承载层，路径设计必须同时服务公开网站和内部控制台。

## 工程边界

- 不恢复旧 `server/`、旧 Roam Worker 或旧 Vue 前端主线。
- 开发阶段数据库直接推翻重建，不维护 migrations 目录，不做向后迁移。
- **工具 schema 集中在 `worker/server/meem/ai/tools.ts`**，执行端分布：
  - Worker 端工具（会话编排）→ `worker/server/meem/ai/functions.ts`
  - 浏览器工具 → `extension/src/tools/`
  - 电脑工具 → `client/apps/computer/index.js`
  新增工具时 schema 与执行端保持一致；client/extension 是否连上由 `toolsFor` 控制工具暴露。
- 不提交 API key、token、真实 `wrangler.jsonc`、运行态数据、`node_modules`、`dist`。
- Worker 接口、WebSocket 帧、前端状态命名保持统一，不混用旧 Roam / connector 命名。

## 命令

```bash
npm --prefix worker/gui/meem install
npm --prefix worker/gui/meem run check
npm --prefix worker run build:gui

npm --prefix worker install
npm --prefix worker run typecheck
npm --prefix worker run dev
npm --prefix worker run deploy
npm --prefix worker run db:apply
```
