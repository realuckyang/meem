# meem extension

独立 Chrome side panel 扩展。第一版目标是先跑通浏览器侧栏对话，并保留可扩展工具框架。

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
npm --prefix extension install
npm run extension:check
npm run extension:build
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

## 结构

```text
src/ai/       对话 handler、工具 runner、浏览器工具替换层
src/llm/      provider pipeline、请求器、输入归一化、输出解析
src/lib/      storage、标签页等扩展环境封装
src/App.tsx   side panel 应用
```

新增工具时，同时更新 `src/ai/tools.js` 的 schema 和 `src/ai/functions.js` 的执行函数。
