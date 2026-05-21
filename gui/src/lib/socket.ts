type FrameHandler = (frame: unknown) => void;

let ws: WebSocket | null = null;
let retries = 0;
let alive = false;
const handlers = new Set<FrameHandler>();

import { API_BASE, isExtension } from './env';

function getWsUrl() {
  const baseUrl = API_BASE || `${window.location.protocol}//${window.location.host}`;
  const parsed = new URL(baseUrl);
  const proto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = localStorage.getItem('meem_token') ?? '';
  const client = isExtension ? 'extension' : 'web';
  return `${proto}//${parsed.host}/api/ws?token=${token}&client=${client}`;
}

function connect() {
  if (!alive) return;
  ws = new WebSocket(getWsUrl());
  ws.onopen = () => { retries = 0; notify({ type: 'ws:open' }); };
  ws.onmessage = (e) => { try { notify(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    notify({ type: 'ws:close' });
    if (!alive) return;
    retries = Math.min(retries + 1, 6);
    setTimeout(connect, 500 * 2 ** retries);
  };
  ws.onerror = () => { try { ws?.close(); } catch {} };
}

function notify(frame: unknown) {
  for (const h of handlers) h(frame);
}

export function startSocket() {
  alive = true;
  connect();
}

export function stopSocket() {
  alive = false;
  try { ws?.close(); } catch {}
}

export function onFrame(handler: FrameHandler) {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}

export function sendFrame(frame: unknown): boolean {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(frame));
    return true;
  } catch {
    return false;
  }
}

export function isOpen(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}
