# meem

当前 `realuckyang/meem` 工作区，已由新版 meem 取代旧 `meem-old`，远端仓库已设为私有。

- origin: `https://github.com/realuckyang/meem.git`

## 结构

- `browser-use/`：浏览器操控 / MCP 能力。
- `client/`：本地客户端相关代码。
- `server/`：本机服务和桥接层。
- `worker/`：Cloudflare Worker 与前端界面。

## 命令

```bash
npm run server
npm run worker:dev
npm run worker:deploy
npm run gui:dev
npm run gui:build
npm run browser:mcp
npm run browser:check
```

## 规则

- 仓库已是私有，但仍不要提交 token、密钥、本机账号配置或运行态数据。
- 不提交 `node_modules`、`dist`、`.wrangler`、`client/tauri/target`、`client/tauri/binaries`、`server/token.json`。
- 本地客户端、Worker、MCP 三条链路改动要保持概念命名一致。
- 提交前核对 `git remote -v` 和 `git status`。
