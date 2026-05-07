import http from 'http';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { HTTP_HOST, HTTP_PORT } from '../core/env.js';
import todosRoute from '../routes/todos.js';
import fsRoute from '../routes/fs.js';
import screenRoute from '../routes/screen.js';
import docsRoute from '../routes/docs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gui build 输出在 ../../gui/dist
const GUI_DIST = path.resolve(__dirname, '../../gui/dist');

function createApp() {
    const app = express();
    app.use(express.json({ limit: '4mb' }));

    // /api/* 路由
    app.use('/api/todos', todosRoute);
    app.use('/api/fs', fsRoute);
    app.use('/api/screen', screenRoute);
    app.use('/api/docs', docsRoute);

    // 前端静态资源
    app.use(express.static(GUI_DIST));

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
