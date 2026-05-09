import http from 'http';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import os from 'os';
import { HTTP_HOST, HTTP_PORT } from '../core/env.js';
import fsRoute from '../routes/fs.js';
import screenRoute from '../routes/screen.js';
import docsRoute from '../routes/docs.js';
import homeRoute from '../routes/home.js';
import memoryRoute from '../routes/memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gui build 输出在 ../../gui/dist
const GUI_DIST = path.resolve(__dirname, '../../gui/dist');
const PUBLIC_DIR = path.join(os.homedir(), '.meem', 'public');

function createApp() {
    const app = express();
    app.use(express.json({ limit: '4mb' }));

    // /api/* 路由
    app.use('/api/fs', fsRoute);
    app.use('/api/screen', screenRoute);
    app.use('/api/docs', docsRoute);
    app.use('/api/home', homeRoute);
    app.use('/api/memory', memoryRoute);

    app.use('/public', express.static(PUBLIC_DIR));

    // 本地开发频繁重建, 不缓存静态资源, 避免旧入口引用已删除的 chunk.
    app.use(express.static(GUI_DIST, {
        setHeaders(res) {
            res.setHeader('Cache-Control', 'no-store');
        },
    }));

    // SPA fallback: 非 /api、非 /ws 的 GET 请求都返回 index.html
    app.get(/^\/(?!api\/|ws$).*/, (req, res) => {
        res.sendFile(path.join(GUI_DIST, 'index.html'), (err) => {
            if (err) res.status(404).end();
        });
    });

    return app;
}

function createServer() {
    const app = createApp();
    const server = http.createServer(app);
    return { app, server };
}

function listen(server) {
    return new Promise((resolve) => {
        server.listen(HTTP_PORT, HTTP_HOST, () => {
            console.log('');
            console.log('✅ Meem 已启动');
            console.log(`🔗 本地访问入口: http://${HTTP_HOST}:${HTTP_PORT}`);
            console.log('💡 远程访问请用 ngrok / cloudflared 反代该端口');
            console.log('');
            resolve();
        });
    });
}

export { createServer, listen, GUI_DIST };
export default { createServer, listen, GUI_DIST };
