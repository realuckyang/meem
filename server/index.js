import server from './server/index.js';

import auth from './services/auth/index.js';
import terminal from './services/terminal/index.js';
import agents from './agents/index.js';

async function boot() {
    console.log('🚀 正在启动 Meem...');
    agents.ensureSession();

    auth.bindOnGrant((clientId) => {
        terminal.sendSnapshotTo(clientId);
        agents.sendConfig(`web:${clientId}`);
        agents.sendProviders(`web:${clientId}`);
        agents.sendSessions(`web:${clientId}`);
        agents.sendHistory(`web:${clientId}`);
    });

    server.router.bindOnDevicesChanged(() => {
        // 直连架构下不再需要响应远端 desktop 状态变化
    });

    await terminal.ensureDefault();
    await server.browser.start();

    const { server: httpServer } = server.http.createServer();

    server.ws.attach(httpServer, {
        onOpen: (clientId) => {
            // 新浏览器接入：推送各 feature 的初始快照
            auth.sendAuthMode();
            terminal.sendSnapshotTo(clientId);
            agents.sendConfig(`web:${clientId}`);
            agents.sendProviders(`web:${clientId}`);
            agents.sendSessions(`web:${clientId}`);
            agents.sendHistory(`web:${clientId}`);
        },
        onMessage: (msg) => server.router.dispatch(msg),
    });

    await server.http.listen(httpServer);

    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭 Meem...');
        terminal.shutdown();
        server.ws.close();
        httpServer.close();
        server.browser.stop().finally(() => process.exit(0));
    });
}

boot().catch((err) => {
    server.browser.stop().catch(() => {});
    console.error('❌ Meem 启动失败:', err.message);
    process.exit(1);
});
