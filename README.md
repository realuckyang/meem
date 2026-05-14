# meem

个人知识库 · 想法 · 笔记 · 助理 · 待办 · 搜索 · 设置。

UI/交互沿用 mindbase 的视觉与组件;架构按 AIOS 的双进程模式组织(`server/main` 内核 + `server/apps` 用户应用)。

## 启动

```bash
npm install
npm run dev      # 三进程:main(9507) + apps(9508) + vite(5173)
```

打开 http://localhost:5173,首次访问会引导你创建账户。

## 一键安装到服务器

在 Ubuntu / Debian 服务器上执行:

```bash
curl -fsSL https://raw.githubusercontent.com/realuckyang/meem/main/install-linux.sh | sudo bash
```

脚本会自动安装 `git`、Node.js 22、nginx,把代码部署到 `/opt/meem`,构建前端,写入 `meem.service`,并把 nginx 反代到 meem。安装后访问服务器 IP 即可打开。

可选环境变量:

```bash
curl -fsSL https://raw.githubusercontent.com/realuckyang/meem/main/install-linux.sh \
  | sudo env MEEM_SERVER_NAME=example.com MEEM_DIR=/opt/meem bash
```

## 生产

```bash
npm run build    # 打包前端到 gui/dist
npm run start    # main(9507,顺带 serve gui/dist) + apps(9508)
```

## 目录

```
meem/
├── server/
│   ├── main/                 # 内核进程 (9602)
│   │   ├── api/{auth,settings,chat,search,tokens}
│   │   ├── service/auth/
│   │   ├── repository/       # better-sqlite3 + settings/messages/tokens
│   │   ├── ai/               # agent loop(sql_query 工具)
│   │   └── llm/              # provider 适配 + 流式
│   ├── apps/                 # 应用进程 (9603)
│   │   ├── index.js          # dispatcher
│   │   ├── registry.js       # 应用注册
│   │   ├── memos/            # 想法
│   │   ├── todos/            # 待办
│   │   └── notes/            # 笔记本+笔记
│   └── shared/http/          # 通用 http 工具
├── apps/<name>/APP.md        # 给 AI 看的应用清单
├── gui/                      # Vite + Vue 3 + Tailwind v4
│   └── src/                  # 视图、组件、API client(沿用 mindbase)
├── database/meem.db          # 单文件 SQLite,运行态,gitignored
└── scripts/{dev,start}.mjs
```

## 端口

- 9507 main(对外入口;`/api/*` 自处,`/apps/*` 反代 9508,需鉴权)
- 9508 apps(只接收来自 9507 的内部转发)
- 5173 vite(仅 dev)

## 配置助理

进设置 → 模型,填 Base URL / API Key / Model(OpenAI 兼容)。
