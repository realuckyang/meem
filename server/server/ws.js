import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { SESSION_PASSWORD, DEBUG } from '../core/env.js';

// 直连 WebSocket Server。浏览器端通过 ws://host:port/ws 直连，
// 不再需要 Cloudflare Worker 中转。
//
// 协议保留与原版兼容的 to 字段语义：
//   - to: 'web'         → 广播到所有连接的浏览器
//   - to: 'web:<id>'    → 发到指定浏览器
//   - to: 'server'      → 视为对所有浏览器广播（兼容原 desktop→worker→web 路径）
//
// 浏览器发来的消息一律交给 onMessage(router.dispatch) 处理。

const state = {
    wss: null,
    onMessage: null,
    onOpen: null,
    clients: new Map(), // clientId -> ws
};

function attach(httpServer, { onOpen, onMessage }) {
    state.onOpen = onOpen;
    state.onMessage = onMessage;

    state.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    state.wss.on('connection', (ws, req) => {
        const clientId = randomUUID().slice(0, 8);
        state.clients.set(clientId, ws);

        if (DEBUG) console.log(`[ws] connect clientId=${clientId} url=${req.url}`);

        // 通知前端：连接就绪
        ws.send(JSON.stringify({
            type: 'connection.ready',
            data: {
                clientId,
                authenticated: !SESSION_PASSWORD,
                requiresPassword: Boolean(SESSION_PASSWORD),
            },
        }));

        // 同步设备状态：在新架构里，server 永远在线
        ws.send(JSON.stringify({
            type: 'connection.devices',
            data: { devices: { desktop: 'connected', web: 'connected' } },
        }));

        // 触发 onOpen，让上层推送各 feature 快照
        try {
            state.onOpen?.(clientId);
        } catch (err) {
            console.error('[ws] onOpen 异常:', err);
        }

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch (err) {
                console.error('❌ 消息解析失败:', err);
                return;
            }
            // 把发起方的 clientId 注入 meta，方便业务定位返回目标
            msg.meta = { ...(msg.meta || {}), clientId };
            if (DEBUG) console.log(`[ws] recv ${msg.type} from=${clientId}`);
            state.onMessage?.(msg);
        });

        ws.on('close', () => {
            state.clients.delete(clientId);
            if (DEBUG) console.log(`[ws] close clientId=${clientId}`);
        });

        ws.on('error', (err) => {
            console.error(`[ws] error clientId=${clientId}:`, err.message);
        });
    });
}

function _writeRaw(ws, payload) {
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(payload);
    }
}

function send(message) {
    if (!state.wss) return;
    const target = message.to;
    const payload = JSON.stringify(message);

    // 指定 clientId
    if (typeof target === 'string' && target.startsWith('web:')) {
        const id = target.slice(4);
        const ws = state.clients.get(id);
        _writeRaw(ws, payload);
        return;
    }

    // 广播：'web' / 'server' / 未指定 都视为发到所有浏览器
    for (const ws of state.clients.values()) {
        _writeRaw(ws, payload);
    }
}

function sendToClient(clientId, type, data) {
    if (!clientId) return;
    send({ type, to: `web:${clientId}`, data });
}

function broadcast(type, data) {
    send({ type, to: 'web', data });
}

function close() {
    state.wss?.close();
}

export { attach, send, sendToClient, broadcast, close };
export default { attach, send, sendToClient, broadcast, close };
