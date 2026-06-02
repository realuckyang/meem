// Meem client runtime: WebSocket lifecycle and frame dispatch.

import { WebSocket } from 'ws';
import { TOKEN, WS_URL } from '../config.js';
import * as files from '../apps/files/index.js';
import * as status from '../apps/status/index.js';
import * as terminal from '../apps/terminal/index.js';
import * as codex from '../apps/codex/index.js';
import { callTool } from '../apps/computer/index.js';

let ws = null;
let reconnectTimer = null;
let reconnectDelay = 500;
let heartbeatTimer = null;

terminal.setEmit((frame) => send(frame));
files.setEmit((frame) => send(frame));
status.setEmit((frame) => send(frame));
codex.setEmit((frame) => send(frame));

const isTermFrame = (type) => type.startsWith('terminal.') || type.startsWith('data.') || type.startsWith('system.');

export function startClient() {
  validateConfig();
  connect();
}

function validateConfig() {
  if (!TOKEN) {
    console.error('config.js 里 TOKEN 是空的');
    console.error('去 meem 控制台「设备」应用添加一台电脑设备,复制它的连接配置覆盖 config.js');
    process.exit(1);
  }
  if (!WS_URL) {
    console.error('config.js 里 WS_URL 没设');
    process.exit(1);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 1.6, 10_000);
    connect();
  }, reconnectDelay);
}

function connect() {
  const url = `${WS_URL}/meem/ws?client=client&token=${encodeURIComponent(TOKEN)}`;
  console.log(`[client] connecting -> ${WS_URL}/meem/ws?client=client`);

  try { ws = new WebSocket(url); }
  catch (error) { console.error('[client] new WebSocket throw:', error?.message ?? error); scheduleReconnect(); return; }

  ws.on('open', () => {
    console.log('[client] open · 等待 AI 调用');
    reconnectDelay = 500;
    startHeartbeat();
  });

  ws.on('message', async (data) => {
    let frame;
    try { frame = JSON.parse(data.toString()); }
    catch { return; }

    const type = frame?.type || '';

    if (type === 'tool.call' && frame.id) {
      console.log(`[client] tool.call ${frame.name}`);
      try {
        const result = await callTool(frame.name, frame.args || {});
        send({ id: frame.id, type: 'tool.result', result });
      } catch (error) {
        console.error(`[client] tool error ${frame.name}:`, error?.message);
        send({ id: frame.id, type: 'tool.error', error: error?.message || String(error) });
      }
      return;
    }

    if (isTermFrame(type)) { terminal.handle(frame); return; }
    if (type.startsWith('fs.')) { files.handle(frame); return; }
    if (type.startsWith('codex.')) { codex.handle(frame); return; }
    if (type.startsWith('status.') || type.startsWith('screen.')) { status.handle(frame); }
  });

  ws.on('close', () => {
    console.warn('[client] close · 重连中');
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (error) => {
    console.error('[client] error:', error?.message ?? error);
    try { ws?.close(); } catch {}
  });
}

function send(frame) {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(frame));
  return true;
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    send({ type: 'ping' });
  }, 25_000);
}

export function shutdownClient() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  try { terminal.shutdown(); } catch {}
  try { codex.shutdown(); } catch {}
  try { ws?.close(); } catch {}
}
