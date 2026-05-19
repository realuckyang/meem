# Meem

Meem 是一个基于 Codex 的个人分身节点。它把云端可访问的地址、本机 Codex、浏览器控制能力和一个轻量客户端连在一起，让外部消息可以进入用户自己的工作流，并由本机智能体处理。

当前版本的核心心智是：

```text
外部访问 /u/:handle
  -> Worker 收信
  -> D1 按 user_id 存储
  -> WebSocket 推送到本机 server
  -> server 调用 Codex
  -> Codex 结果回写 Worker
  -> 消息展示消息、inline 建议和过程 sheet
```

## 目录结构

```text
meem/
  worker/        Cloudflare Worker、D1、Durable Object、前端静态资源
  server/        本机桥接服务，连接 Worker 和 Codex app-server
  client/        Tauri 薄壳，加载线上 Meem 并把 JWT 写给本机 server
  browser-use/   Chrome 扩展和 MCP 服务，让 Codex 使用用户浏览器
```

## 产品模块

### 智能体

用户和自己的 Codex 分身直接对话。云端页面创建会话，本机 server 按需拉起 Codex app-server，并把过程事件和最终回复回写到 Worker。

### 消息

每个用户都有公开地址：

```text
https://meem.chatnext.ai/u/:handle
```

外部用户可以通过这个地址发消息。消息内部展示：

- 原始消息。
- 消息下方的 inline Codex 块。
- 处理中状态、建议回复、复制回复。
- 点击后打开底部 sheet，查看完整过程并继续和 Codex 讨论。

主消息输入只用于回复对方；Codex 追问在 inline/sheet 里完成。

### 通讯录

通讯录分为两组：

- `联系人`：当前用户自己的 `contacts`，按 `user_id` 隔离。
- `本网域`：本 Worker 内 `users` 表里的用户。

暂时不做群聊，也不改变现有消息信道。

## 数据模型

身份根是 `users.id`。所有用户私有数据都带 `user_id`：

```text
users
  settings.user_id
  contacts.user_id
  conversations.user_id
  messages.user_id
  sessions.user_id
  events.user_id
```

这让一个 Worker 可以承载多个本地用户，同时每个用户拥有独立的公开地址、通讯录、消息和智能体会话。

当前 DDL 在：

```text
worker/schema.sql
```

开发阶段 schema 是破坏式的，执行会清空现有 D1 数据。

## 鉴权

账号保存在 `users` 表中。

- 空库首次登录会创建第一个用户。
- 已初始化后可以登录已有用户。
- `/api/auth/register` 用于创建新用户。
- JWT 的 `sub` 是 `users.id`。
- Worker 通过 JWT 解析当前用户，并让所有私有 API 按 `user_id` 查询。

本机 server 的 token 保存在：

```text
server/token.json
```

这个文件不应提交。

## 本地开发

安装依赖：

```bash
npm install
npm --prefix worker install
npm --prefix worker/gui install
npm --prefix server install
npm --prefix client install
npm --prefix browser-use install
```

初始化本地 D1：

```bash
npm --prefix worker run db:migrate:local
```

启动 Worker：

```bash
npm --prefix worker run dev
```

启动本机 server：

```bash
MEEM_BASE_URL=http://127.0.0.1:8787 npm --prefix server start
```

常用检查：

```bash
npm --prefix worker run typecheck
npm --prefix worker/gui run build
npm --prefix server run check
npm run browser:check
```

## 部署

Cloudflare 配置在：

```text
worker/wrangler.jsonc
```

当前线上域名：

```text
https://meem.chatnext.ai
```

创建 D1 后，把 `worker/wrangler.jsonc` 中的 `database_id` 替换成真实值。

远端重建 D1：

```bash
npm --prefix worker exec -- wrangler d1 execute meem --remote --file=./schema.sql
```

部署 Worker 和前端静态资源：

```bash
npm --prefix worker/gui run build
npm --prefix worker run deploy
```

部署后打开页面，首次输入账号密码会创建用户。当前开发环境的默认测试账号是：

```text
woodchange / 123456
```

## 本机 Server

server 负责：

- 读取 `server/token.json`。
- 连接 Worker WebSocket。
- 上报本机 Codex 状态。
- 接收 `agent-task`。
- 调用 Codex app-server。
- 将 session events、状态和最终回复回写 Worker。

启动：

```bash
npm --prefix server start
```

查看状态：

```bash
curl http://127.0.0.1:9509/api/status
```

如果需要把登录 token 写入本机 server，可以由 Tauri client 自动完成，也可以手动写入 `server/token.json`。

## Browser Use

`browser-use/` 提供 Chrome 扩展和 MCP 服务。Codex 可以通过它控制用户当前 Chrome：

- 打开页面。
- 管理标签页。
- 执行页面 JavaScript。
- 截图并返回本地文件路径。

注册 MCP：

```bash
codex mcp add meem-browser-bridge -- node /Users/woodchange/Desktop/meem/browser-use/mcp/server.js
```

Chrome 扩展目录：

```text
browser-use/extension
```

更完整说明见：

```text
browser-use/README.md
```

## 开发约束

- 当前处于开发阶段，不做历史数据兼容。
- D1 schema 允许破坏式重建。
- 不改变消息信道时，不要把通讯录、网域用户和群聊逻辑混在一起。
- 公开地址、消息、会话、事件必须始终按 `user_id` 隔离。
- 本机 token、Cloudflare 凭据、用户密码不要提交。
