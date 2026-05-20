# Meem Extension

插件版数字分身产品。它现在位于 `meem/extension`，使用独立 Worker 和独立数据，不依赖 Codex 版主项目。

## 功能

- 侧栏对话 UI。
- 本地保存模型配置和会话消息。
- AI/LLM 核心完整迁移自 `/Users/woodchange/Desktop/AGENT/AGENT/ai` 与 `/Users/woodchange/Desktop/AGENT/AGENT/llm`。
- `handler`、`runner`、`utils` 与参考核心保持一致。
- `llm/` 的 provider pipeline、normalizer、parser、requester、usage 结构与参考核心保持一致。
- 浏览器扩展不能运行 Node shell，因此只替换了 `functions.js` 和 `tools.js` 为浏览器工具。
- 内置浏览器工具：
  - `get_active_tab`
  - `list_tabs`
  - `navigate_active_tab`
  - `inspect_page`

## 开发

```bash
npm install
npm --prefix worker install
npm run check
npm run build
npm run worker:check
```

## 加载扩展

1. 打开 `chrome://extensions`。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 选择：

```text
/Users/woodchange/Desktop/meem/extension/dist
```

首次打开侧栏后，在设置里填入 API URL、模型和 API Key。

## 分身服务

插件分身不依赖主 `meem/worker` 和 Codex 本机服务。独立 Worker 位于：

```text
worker/
```

部署配置：

```text
name: meem-extension
domain: meem-extension.chatnext.ai
```

命令：

```bash
npm run worker:dev
npm run worker:deploy
```

外部发消息：

```bash
curl -X POST "https://meem-extension.chatnext.ai/api/avatar/<分身ID>/message?wait=1" \
  -H "Content-Type: application/json" \
  -d '{"senderName":"访客","text":"你好"}'
```

插件开启分身后，会连接独立 Worker，收到消息后用本地模型配置生成回复，再回传给 Worker。

## 结构

```text
src/ai/       对话 handler、工具 runner、浏览器工具替换层
src/llm/      provider pipeline、请求器、输入归一化、输出解析
src/lib/      storage、标签页等扩展环境封装
src/App.tsx   side panel 应用
worker/       独立 Cloudflare Worker
```

新增工具时，同时更新 `src/ai/tools.js` 的 schema 和 `src/ai/functions.js` 的执行函数。
