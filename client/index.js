#!/usr/bin/env node
// Meem client
//   · 维持到 meem worker 的 WebSocket(client=client)
//   · 收到 tool.call → 调本机 callTool → 回 tool.result / tool.error
//
// 配置在 config.js · 直接从 meem 网页下载

import { WebSocket } from 'ws';
import { callTool } from './src/tools.js';
import * as terminal from './src/terminal.js';
import * as files from './src/files.js';
import * as system from './src/system.js';
import { WS_URL, TOKEN } from './config.js';

// 终端/文件/状态/截图应用输出帧 · 经 client ws 发出 → DO 穿透转发给 Meem 控制台
terminal.setEmit((frame) => send(frame));
files.setEmit((frame) => send(frame));
system.setEmit((frame) => send(frame));

const isTermFrame = (t) => t.startsWith('terminal.') || t.startsWith('data.') || t.startsWith('system.');

if (!TOKEN) {
  console.error('config.js 里 TOKEN 是空的');
  console.error('去 meem 网页下载新的 config.js 覆盖');
  process.exit(1);
}
if (!WS_URL) {
  console.error('config.js 里 WS_URL 没设 · 去 meem 网页下载完整 config.js');
  process.exit(1);
}

let ws = null;
let reconnectTimer = null;
let reconnectDelay = 500;
let heartbeatTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 1.6, 10_000);
    connect();
  }, reconnectDelay);
}

function connect() {
  const url = `${WS_URL}/meem/ws?token=${encodeURIComponent(TOKEN)}&client=client`;
  console.log(`[client] connecting → ${WS_URL}/meem/ws?...&client=client`);

  try { ws = new WebSocket(url); }
  catch (e) { console.error('[bridge] new WebSocket throw:', e?.message ?? e); scheduleReconnect(); return; }

  ws.on('open', () => {
    console.log('[client] open · 等待 AI 调用');
    reconnectDelay = 500;
    startHeartbeat();
  });

  ws.on('message', async (data) => {
    let frame;
    try { frame = JSON.parse(data.toString()); }
    catch { return; }

    const ft = frame?.type || '';

    // agent 工具调用(电脑/截图等)· 一 call 一 result
    if (ft === 'tool.call' && frame.id) {
      console.log(`[client] tool.call ${frame.name}`);
      try {
        const result = await callTool(frame.name, frame.args || {});
        send({ id: frame.id, type: 'tool.result', result });
      } catch (e) {
        console.error(`[client] tool error ${frame.name}:`, e?.message);
        send({ id: frame.id, type: 'tool.error', error: e?.message || String(e) });
      }
      return;
    }

    // 终端面板帧(流式)
    if (isTermFrame(ft)) { terminal.handle(frame); return; }
    // 文件面板帧(请求/应答)
    if (ft.startsWith('fs.')) { files.handle(frame); return; }
    // 状态 / 截图 面板
    if (ft.startsWith('status.') || ft.startsWith('screen.')) { system.handle(frame); return; }
  });

  ws.on('close', () => {
    console.warn('[client] close · 重连中');
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (e) => {
    console.error('[client] error:', e?.message ?? e);
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

process.on('SIGINT', () => {
  console.log('\n[client] shutting down');
  try { terminal.shutdown(); } catch {}
  try { ws?.close(); } catch {}
  process.exit(0);
});

connect();
