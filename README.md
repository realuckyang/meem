# Meem Extension

插件版数字分身产品。仓库根目录只保留产品三段：`gui/`、`extension/`、`worker/`。

## 功能

- 侧栏对话 UI 和网页 UI 复用同一套 GUI。
- 本地保存模型配置和会话消息。
- AI/LLM 核心完整迁移自 `/Users/woodchange/Desktop/AGENT/AGENT/ai` 与 `/Users/woodchange/Desktop/AGENT/AGENT/llm`。
- `handler`、`runner`、`utils` 与参考核心保持一致。
- `llm/` 的 provider pipeline、normalizer、parser、requester、usage 结构与参考核心保持一致。
- Chrome 插件壳负责侧栏入口和浏览器权限。
- 内置浏览器工具：
  - `get_active_tab`
  - `list_tabs`
  - `navigate_active_tab`
  - `inspect_page`

## 开发

```bash
npm --prefix gui install
npm --prefix worker install
npm --prefix gui run check
npm --prefix gui run build
npm --prefix gui run build:extension
npm --prefix worker run typecheck
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

插件分身不依赖 Codex 本机服务。独立 Worker 位于：

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
npm --prefix gui run build
npm --prefix worker run dev
npm --prefix worker run deploy
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
gui/          产品前端、对话 UI、AI/LLM runner、浏览器工具适配
extension/    Chrome 插件壳、manifest、background、插件构建产物
worker/       独立 Cloudflare Worker、API、D1、DO、网页承载
```

新增工具时，同时更新 `gui/src/ai/tools.js` 的 schema 和 `gui/src/ai/functions.js` 的执行函数。
