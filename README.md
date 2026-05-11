# Meem

把本机能力通过浏览器带到任意设备上 —— **纯本机服务版**。

不依赖 Cloudflare Worker。本机起一个 Node 服务,提供终端、文件、截图、Agent、文档、Todo 等能力,远程访问通过 ngrok / cloudflared / Tailscale 等隧道暴露。

## 项目结构

```text
meem/
├─ server/    # Node 后端：HTTP + WebSocket，apps + 服务 + LLM
├─ gui/       # Vue 3 + Vite 前端,build 后由 server 直接 serve
└─ browser/
   ├─ extension/   # Chrome 扩展,连接本机浏览器 bridge
   └─ skill/       # 给 Agent 使用浏览器插件的 SKILL.md
```

## 通信设计

```
浏览器 ──HTTP──> server  (CRUD / 查表 / 文档 / Todo / 文件 / 截图)
浏览器 ──WS────> server  (终端流 / Agent 流 / 浏览器 bridge 事件)
```

CRUD 类功能默认走 HTTP,只有真需要流式推送(终端 stdout、Agent token-by-token)才走 WS。

## 内置能力

- **Todo** — 简单任务列表
- **对话** — 多 Agent 对话,支持子 Agent 消息追踪
- **文档** — 文件夹无限嵌套 + 文档,自动保存
- **终端** — 多会话 PTY
- **文件** — 浏览 / 读 / 上传 / 重命名 / 删除
- **屏幕** — 本机桌面截图查看
- **当前浏览器控制** — 通过 Chrome 扩展接管你当前的浏览器标签页
- **Playwright** — 启动独立受控浏览器

数据全部存在 `~/.meem/meem.db`(SQLite)。

## 启动

```bash
git clone https://github.com/valueriver/meem
cd meem
npm install --prefix server
npm install --prefix gui
npm run build --prefix gui

cp server/config.example.js server/config.js
# 编辑 server/config.js（HTTP 端口、可选密码等）

npm start --prefix server
```

启动后:

```
http://127.0.0.1:9505
```

要从手机或其他机器访问,在另一个终端起隧道:

```bash
ngrok http 9505
# 或
cloudflared tunnel --url http://localhost:9505
```

## 配置

`server/config.js`:

```js
export default {
    HTTP_HOST: '127.0.0.1',     // 服务监听地址
    HTTP_PORT: '9505',          // 服务监听端口
    SESSION_PASSWORD: '',       // 留空则不需要密码;非空则首次进入要输密码
    PLAYWRIGHT_BROWSER_CHANNEL: 'chrome',
    BROWSER_EXTENSION_HOST: '127.0.0.1',
    BROWSER_EXTENSION_PORT: '17373',
    DEBUG: '0',
};
```

环境变量优先于 `config.js`,`server/.env` 也支持。

## Chrome 扩展

```
1. chrome://extensions
2. 开启开发者模式
3. Load unpacked → 选择 browser/extension/
4. 扩展弹窗里的 host/port 与 server/config.js 的 BROWSER_EXTENSION_* 一致
5. 点连接
```

之后 Agent 的 `browser` 子 Agent 就能接管你当前浏览器的当前标签页,登录态全部复用。

## Agent 模型配置

打开 web UI → "对话" → 右上角设置,填:

- Provider
- API URL
- API Key
- Model

存在 `~/.meem/meem.db`,不会上传任何地方。

## 安全边界

- server 默认绑 `127.0.0.1`,本机不开任何外网端口
- 所有数据在本机 SQLite
- `SESSION_PASSWORD` 用于隧道暴露后的访问校验
- 不要把 `server/config.js`、`server/.env` 提交到仓库

## 历史

老版本(基于 Cloudflare Worker 中继)已搬到 [valueriver/roam](https://github.com/valueriver/roam) 归档。当前 `meem` 仓库就是纯本机版,不再用 Worker。

## License

MIT
