# Meem

> 文档更新时间：2026-06-02

Meem 是建立在本地电脑、浏览器和 Cloudflare 生态上的个人 AI 工作站。它提供一个 Worker 入口、一个内部控制台、一套本地/浏览器能力端，以及可由 AI 驱动生成和部署的内部应用。不对外提供公开网站。

## 核心路径

- `/`：Meem 控制台。负责 AI、会话、工具状态、设置、应用管理和部署管理。需所有者账号登录。
- `/apps/:appname`：Meem 内应用。面向登录后的内部使用场景。

## 目录边界

- `worker/`：Cloudflare Worker。负责 REST API、WebSocket、Durable Object、D1/R2、静态资源和路由分发；D1 结构以 `schema.sql` 为唯一真相。
- `worker/server/meem/`：Meem 后端。负责控制台 API、agent、工具 schema、Room DO、Meem repository。
- `worker/gui/meem/`：Meem 控制台前端（React + Vite + TS），对应根路径 `/`。
- `worker/gui/meem/src/apps/`：Meem 内应用，聊天、终端、文件、状态、截图都在这里，对应 `/apps/:appname`。
- `worker/gui/meem/src/system/`：Meem 前端系统层，负责全局顶栏、应用面板、路由和共享 client。
- `client/`：电脑端 Node CLI（`meem-client`），经 WebSocket 接入 `Room`，提供终端、文件、截图、系统状态和电脑操作能力。
  - `client/system/`：电脑端系统层，负责 WebSocket 生命周期、配置校验、共享工具函数。
  - `client/apps/`：电脑端应用能力，终端、文件、状态/截图、电脑工具都在这里。
- `extension/`：Chrome MV3 浏览器扩展，经 WebSocket 接入 `Room`，提供 CDP 浏览器工具。
- `dev/`：参考素材和历史资料，默认忽略，不视为产品结构。

## 产品边界

- Meem 不是单纯聊天工具；它是 AI 驱动的个人内部应用框架，只服务所有者自己。
- Agent 可以通过 `client/` 驱动 shell、文件和本机环境写代码、运行检查、构建并部署。
- Agent 可以通过 `extension/` 驱动浏览器完成登录态网页操作、调试和资料获取。
- Worker 是 Cloudflare 承载层和控制台入口：控制台落在根路径 `/`，`/api/*` 走 REST、`/ws` 走实时通道,其余路径回退到 SPA / 静态资源；不对外提供公开网站。

## 工程边界

- 不恢复旧 `server/`、旧 Roam Worker 或旧 Vue 前端主线。
- 数据库结构以 `schema.sql` 为唯一真相，它必须是**干净的纯建表脚本**(只含 `CREATE TABLE`/`CREATE INDEX` + 必要初始种子)，**禁止出现 `DROP`/`ALTER`/任何迁移语句**——开源新用户据此一次性建出干净的库。
- 对线上库的任何结构或数据变更**必须直接通过 wrangler 非破坏性执行**(`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` 等)，并同步更新 `schema.sql`;**严禁**对已有数据的库跑 `schema.sql` 或 `db:apply`(会 DROP 所有表、清空线上数据)。
- **工具 schema 集中在 `worker/server/meem/ai/tools.ts`**，执行端分布：
  - Worker 端工具（会话编排）→ `worker/server/meem/ai/functions.ts`
  - 浏览器工具 → `extension/src/tools/`
  - 电脑工具 → `client/apps/computer/index.js`
  新增工具时 schema 与执行端保持一致；client/extension 是否连上由 `toolsFor` 控制工具暴露。
- 不提交 API key、token、真实 `wrangler.jsonc`、运行态数据、`node_modules`、`dist`。
- Worker 接口、WebSocket 帧、前端状态命名保持统一，不混用旧 Roam / connector 命名。

## 命令

```bash
# Frontend
npm --prefix worker/gui/meem install
npm --prefix worker/gui/meem run check
npm --prefix worker run build:gui

# Worker
npm --prefix worker install
npm --prefix worker run typecheck
npm --prefix worker run dev
npm --prefix worker run deploy
```

### 数据库变更

`schema.sql` 是**干净的初始建表脚本**(开源新用户用它一次性建库)，**不含** `DROP`/`ALTER`/迁移语句，因此**不能**拿它去改已有数据的线上库。

对线上库做任何结构/数据变更,**直接通过 wrangler 非破坏性执行**,同时把对应的建表语句补进 `schema.sql` 保持同步:

```bash
# 新增表
npx wrangler d1 execute meem --remote --command "CREATE TABLE IF NOT EXISTS meem_xxx (...);"
# 新增字段
npx wrangler d1 execute meem --remote --command "ALTER TABLE meem_xxx ADD COLUMN yyy INTEGER NOT NULL DEFAULT 0;"
```

- **严禁**对已有数据的库跑 `schema.sql`(`db:apply`) —— 它会 DROP 所有表、清空线上数据。
- 删除/清理数据等破坏性操作由人工执行,Agent 不擅自跑。
- 全新的本地库可一次性建：`npm --prefix worker run db:apply-local`。
