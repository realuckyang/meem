# Meem Page

`worker/ui/meem/` 是 Meem 控制台前端，目标路径是 `/meem`。

## 边界

- `src/apps/` 放所有应用，聊天、终端、文件、状态、截图都属于应用。
- `src/system/` 放全局系统层，包括顶栏、应用面板、路由、共享连接和 API client。
- 每个应用可以声明自己的顶栏左侧区域；唯一共同入口是右上角应用面板。
- 目标路径统一是 `/meem/apps/:appname`。
- 控制台 API 只访问 `/meem/api/*`，WebSocket 只连接 `/meem/ws`。
- 用户对外网站不放这里；放到 `worker/ui/site/`。
- Chrome 扩展壳逻辑不放这里；放到仓库根的 `extension/`。
- Worker API、D1、Durable Object、R2 不放这里；放到 `worker/server/`。

## 命令

```bash
npm --prefix worker/ui/meem run check
npm --prefix worker/ui/meem run build
```
