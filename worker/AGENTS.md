# Meem Worker

`worker/` 是 Meem 插件产品自己的 Cloudflare Worker。

## 边界

- 负责模型代理、后端 API、配置和记录保存、协作通信、D1 schema/migrations、Durable Object 与部署。
- 不接管插件侧完整 runner；完整聊天历史处理、模型完整返回处理和浏览器工具执行在 `../gui/`。
- 不放 Chrome 插件 manifest/background；插件壳放在 `../extension/`。
- 不恢复旧 Codex Worker、旧桌面客户端或旧 `browser-use` bridge。

## 结构

- `src/`：Worker 入口和后端模块。
- `schema.sql`：当前 D1 schema。
- `migrations/`：D1 迁移文件。
- `wrangler.example.jsonc`：公开示例配置。
- `wrangler.jsonc`：真实部署配置，不提交。

## 命令

```bash
npm --prefix worker run typecheck
npm --prefix worker run dev
npm --prefix worker run deploy
```

