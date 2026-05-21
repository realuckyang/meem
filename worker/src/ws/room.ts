// AvatarRoom —— 每个用户一个 Durable Object。
//
// 信道协议层职责：
//   - WS 升级 / 广播 / 状态
//   - /dispatch：Worker → 扩展 的 RPC（tool call request/response 用）
//   - 收到 tool.result / tool.error 帧时匹配 pending 解决 promise
//   - 其他帧丢给 dispatch() 路由到 domain 模块

import type { Env } from '../types';
import { dispatch } from './dispatch';

type ClientKind = 'web' | 'extension' | 'extension-bg';

interface Attachment {
  uid: string;
  handle: string;
  kind: ClientKind;
}

interface Pending {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DISPATCH_TIMEOUT_MS = 30_000;

export class AvatarRoom implements DurableObject {
  private sockets = new Set<WebSocket>();
  private pending = new Map<string, Pending>();

  constructor(private state: DurableObjectState, private env: Env) {
    for (const ws of this.state.getWebSockets()) this.sockets.add(ws);
  }

  // ── 入站 HTTP ───────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ws')       return this.acceptWebSocket(url);
    if (url.pathname === '/push')     return this.handlePush(request);
    if (url.pathname === '/status')   return this.handleStatusQuery();
    if (url.pathname === '/dispatch') return this.handleDispatch(request);
    return new Response('not found', { status: 404 });
  }

  private acceptWebSocket(url: URL): Response {
    const c = url.searchParams.get('client') ?? '';
    const kind: ClientKind = c === 'extension-bg' ? 'extension-bg' : (c === 'extension' ? 'extension' : 'web');
    const uid = url.searchParams.get('uid') ?? '';
    const handle = url.searchParams.get('handle') ?? '';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ uid, handle, kind } satisfies Attachment);
    this.sockets.add(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handlePush(request: Request): Promise<Response> {
    const body = await request.json();
    this.broadcast(body);
    return new Response(JSON.stringify({ delivered: this.sockets.size }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private handleStatusQuery(): Response {
    let extension = false;
    let web = false;
    let extensionBg = false;
    for (const ws of this.sockets) {
      const att = (ws.deserializeAttachment() as Attachment | null) ?? null;
      if (att?.kind === 'extension-bg') extensionBg = true;
      else if (att?.kind === 'extension') extension = true;
      else if (att?.kind === 'web') web = true;
    }
    // 对外把 bg / panel 统一展示为「extension」连接状态
    return new Response(JSON.stringify({
      online: this.sockets.size > 0,
      extension: extension || extensionBg,
      extensionBg,
      web,
      connections: this.sockets.size,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ── RPC：Worker → 扩展 ─────────────────────────────────────────────────

  private async handleDispatch(request: Request): Promise<Response> {
    const body = await request.json<{ type: string; name?: string; args?: any; timeoutMs?: number }>();

    // 优先派给 background（常驻），其次 side panel，否则报扩展离线
    let extBg: WebSocket | null = null;
    let extPanel: WebSocket | null = null;
    for (const ws of this.sockets) {
      const att = (ws.deserializeAttachment() as Attachment | null) ?? null;
      if (att?.kind === 'extension-bg') { extBg = ws; break; }
      if (att?.kind === 'extension')    extPanel = ws;
    }
    const extWs = extBg ?? extPanel;
    if (!extWs) {
      return new Response(JSON.stringify({ ok: false, error: 'extension_offline' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    const timeoutMs = Math.max(1_000, Math.min(120_000, body.timeoutMs ?? DISPATCH_TIMEOUT_MS));

    const result = await new Promise<{ ok: true; data: unknown } | { ok: false; error: string }>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'dispatch_timeout' });
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (data) => resolve({ ok: true, data }),
        reject:  (err)  => resolve({ ok: false, error: err.message }),
        timer,
      });
      try {
        extWs!.send(JSON.stringify({ id, type: body.type, name: body.name, args: body.args }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ ok: false, error: 'send_failed' });
      }
    });

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── WebSocket 生命周期 ─────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = (ws.deserializeAttachment() as Attachment | null) ?? null;
    if (!att?.uid) return;

    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    let frame: any;
    try { frame = JSON.parse(text); } catch { return; }

    // tool RPC 回执
    if (frame?.id && (frame.type === 'tool.result' || frame.type === 'tool.error')) {
      const p = this.pending.get(frame.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(frame.id);
        if (frame.type === 'tool.result') p.resolve(frame.data);
        else                              p.reject(new Error(frame.message ?? 'tool error'));
      }
      return;
    }

    await dispatch(
      { env: this.env, uid: att.uid, handle: att.handle, ws, broadcast: (f) => this.broadcast(f) },
      frame,
    );
  }

  async webSocketClose(ws: WebSocket): Promise<void> { this.sockets.delete(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { this.sockets.delete(ws); }

  private broadcast(frame: unknown): void {
    const data = JSON.stringify(frame);
    for (const ws of this.sockets) {
      try { ws.send(data); } catch { this.sockets.delete(ws); }
    }
  }
}
