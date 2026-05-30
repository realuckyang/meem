import { getToken } from './api';

export interface ConnStatus { computer: boolean; browser: boolean; }

type Frame = any;
let ws: WebSocket | null = null;
const subs = new Set<(f: Frame) => void>();
export const connStatus: ConnStatus = { computer: false, browser: false };

function connect() {
  if (ws && ws.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const token = encodeURIComponent(getToken());
  if (!token) return;
  ws = new WebSocket(`${proto}://${location.host}/meem/ws?client=meem&token=${token}`);
  ws.onmessage = (e) => {
    let f: Frame; try { f = JSON.parse(e.data); } catch { return; }
    if (f.type === 'connection.status') { connStatus.computer = !!f.computer; connStatus.browser = !!f.browser; }
    if (f.type === 'hello' && f.connections) { connStatus.computer = !!f.connections.computer; connStatus.browser = !!f.connections.browser; }
    subs.forEach((s) => s(f));
  };
  ws.onclose = () => { ws = null; setTimeout(connect, 2000); };
  ws.onerror = () => { try { ws?.close(); } catch { /* */ } };
}

export function onFrame(cb: (f: Frame) => void): () => void {
  subs.add(cb); connect();
  return () => subs.delete(cb);
}
export function sendWs(f: Frame): void { if (ws && ws.readyState === 1) ws.send(JSON.stringify(f)); }
