// Meem 扩展后台 service worker。
//
// 职责：
//   1. 持有到 meem.yanglong.yun 的 WebSocket 长连——只要 Chrome 开着，分身就一直在
//   2. 接收服务端 tool.call 帧 → 调 chrome.* → 回 tool.result / tool.error
//   3. 监听 chrome.storage 变化，token 变了就重连
//
// 不渲染任何 UI——UI 在 side panel 里独立运行（也有自己的 WS，但只看消息不执行工具）。

import { runTool } from '../../gui/src/lib/toolHandlers';

const API_HOST = 'meem.yanglong.yun';
const TOKEN_KEY = 'meem_token';

let ws: WebSocket | null = null;
let retry = 0;
let token = '';

// ── side panel 入口 ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
  bootstrap();
});

chrome.runtime.onStartup.addListener(() => { bootstrap(); });

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.windowId === 'number') {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

// ── token 同步 ─────────────────────────────────────────────────────────────

async function loadToken(): Promise<string> {
  const r = await chrome.storage.local.get(TOKEN_KEY);
  const v = r?.[TOKEN_KEY];
  return typeof v === 'string' ? v : '';
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[TOKEN_KEY]) return;
  const next = String(changes[TOKEN_KEY].newValue ?? '');
  if (next === token) return;
  token = next;
  reconnect();
});

// ── WS 连接 ────────────────────────────────────────────────────────────────

function reconnect() {
  try { ws?.close(); } catch {}
  ws = null;
  if (!token) return;
  connect();
}

function connect() {
  if (!token) return;
  const url = `wss://${API_HOST}/api/ws?token=${encodeURIComponent(token)}&client=extension-bg`;
  ws = new WebSocket(url);
  ws.addEventListener('open', () => { retry = 0; });
  ws.addEventListener('close', () => {
    if (!token) return;
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 500 * 2 ** retry);
  });
  ws.addEventListener('error', () => { try { ws?.close(); } catch {} });
  ws.addEventListener('message', (e: MessageEvent) => {
    let frame: any;
    try { frame = JSON.parse(typeof e.data === 'string' ? e.data : ''); } catch { return; }
    if (frame?.type === 'tool.call' && frame.id) {
      handleToolCall(frame);
    }
  });
}

async function handleToolCall(frame: { id: string; name: string; args?: any }) {
  try {
    let data: any = await runTool(frame.name, frame.args ?? {});
    // 截图特殊处理：扩展端直接上传 R2，WS 不经手 base64 数据
    if (frame.name === 'browser_screenshot' && data?.dataUrl) {
      data = await uploadScreenshot(data);
    }
    ws?.send(JSON.stringify({ id: frame.id, type: 'tool.result', data }));
  } catch (e: any) {
    ws?.send(JSON.stringify({ id: frame.id, type: 'tool.error', message: e?.message ?? String(e) }));
  }
}

async function uploadScreenshot(captured: { dataUrl: string; format: string; tabId: number }) {
  const match = captured.dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) throw new Error('invalid_data_url');
  const mime = match[1];
  const b64 = match[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const res = await fetch(`https://${API_HOST}/api/media/upload?ext=${captured.format}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': mime,
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload_failed: ${res.status} ${text}`);
  }
  const { url, bytes: size } = await res.json() as { url: string; bytes: number };
  return {
    url,
    format: captured.format,
    bytes: size,
    tabId: captured.tabId,
  };
}

// ── 启动 ──────────────────────────────────────────────────────────────────

async function bootstrap() {
  token = await loadToken();
  if (token) connect();
}

// 模块加载时立即尝试启动（service worker 启动后第一时间）
bootstrap();
