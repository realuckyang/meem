# Meem Extension

`extension/` 是 Chrome 插件承载层。

## 边界

- 负责 `manifest`、`background`、Chrome 插件权限和插件构建产物。
- 不放产品核心业务源码；对话、runner、浏览器工具实现放在 `../gui/`。
- 不放 Worker API 或部署配置；后端能力放在 `../worker/`。
- `dist/` 是构建产物，用于 Chrome 扩展加载，不手写业务逻辑。

## 结构

- `public/manifest.json`：Chrome 插件 manifest 源文件。
- `src/background.ts`：插件 background service worker。
- `dist/`：`npm --prefix gui run build:extension` 生成的插件目录。

## 本地加载

Chrome 扩展加载目录：

```text
/Users/woodchange/Desktop/meem/extension/dist
```

