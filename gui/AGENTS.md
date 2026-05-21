# Meem GUI

`gui/` 是 Meem 的共享产品前端。

## 边界

- 负责对话 UI、事项流界面、模型配置界面、AI/LLM runner、浏览器工具适配和前端状态。
- Web 端和 Chrome 插件侧栏共用这里的产品体验。
- Chrome 插件专属壳逻辑不放这里；放到 `../extension/`。
- Cloudflare Worker API、数据表、部署配置不放这里；放到 `../worker/`。

## 结构

- `src/ai/`：AI runner、工具定义、工具执行和请求处理。
- `src/llm/`：模型请求、输入输出适配、provider 处理。
- `src/lib/`：浏览器/存储等前端侧通用能力。
- `vite.config.ts`：同时产出 Web 构建和插件构建。

## 命令

```bash
npm --prefix gui run check
npm --prefix gui run build
npm --prefix gui run build:extension
```

