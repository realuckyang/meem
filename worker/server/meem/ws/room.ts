import type { Env, ConnectionStatus } from '../../types';
import { ToolDispatch } from './dispatch';
import { Broadcaster } from './broadcast';
import { DEFAULT_TOOL_TIMEOUT_MS } from './frames';
import type { ClientKind, ToolEndpointKind, InFrame } from './frames';
import { runChat } from '../services/chat';
import * as chatsSvc from '../services/chats';
import * as decisionsSvc from '../services/decisions';
import { makeRepo } from '../repository';

const taskKey = (chat: string | null) => chat || 'main';

/** 内部应用的帧(终端/文件/状态/截图)· 在 Meem 控制台 ↔ client 之间穿透转发 */
const PASSTHROUGH = ['terminal.', 'data.', 'fs.', 'system.', 'screen.', 'status.'];
const isPassthrough = (t: string) => PASSTHROUGH.some((p) => t.startsWith(p));

/** 每用户一个 Room:纯通道 —— WS 收发、client/extension call/result 配对、向 Meem 控制台广播、触发运行 */
export class Room implements DurableObject {
  private env: Env;
  private uid: string | null = null;
  private computer: WebSocket | null = null;
  private browser: WebSocket | null = null;
  private bc = new Broadcaster();
  private dispatch: ToolDispatch;
  private tasks = new Map<string, AbortController>();

  constructor(_state: DurableObjectState, env: Env) {
    this.env = env;
    this.dispatch = new ToolDispatch(
      (k) => (k === 'computer' ? this.computer : this.browser),
      Number(env.LLM_TOOL_TIMEOUT_MS) || DEFAULT_TOOL_TIMEOUT_MS,
    );
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    if (uid && !this.uid) this.uid = uid;

    if (url.pathname.endsWith('/connect')) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected ws', { status: 426 });
      return this.accept((url.searchParams.get('client') || 'meem') as ClientKind);
    }
    return new Response('not found', { status: 404 });
  }

  private accept(client: ClientKind): Response {
    const pair = new WebSocketPair();
    const server = pair[1];
    server.accept();
    if (client === 'client') { try { this.computer?.close(); } catch { /* */ } this.computer = server; }
    else if (client === 'extension') { try { this.browser?.close(); } catch { /* */ } this.browser = server; }
    else this.bc.add(server);

    server.addEventListener('message', (ev) => this.onMessage(client, server, ev));
    server.addEventListener('close', () => this.onClose(client, server));
    server.addEventListener('error', () => this.onClose(client, server));

    try { server.send(JSON.stringify({ type: 'hello', client, connections: this.status() })); } catch { /* */ }
    if (client !== 'meem') this.bc.send({ type: 'connection.status', ...this.status() });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private onClose(client: ClientKind, ws: WebSocket): void {
    this.bc.remove(ws);
    if (client === 'client' && this.computer === ws) { this.computer = null; this.bc.send({ type: 'connection.status', ...this.status() }); }
    if (client === 'extension' && this.browser === ws) { this.browser = null; this.bc.send({ type: 'connection.status', ...this.status() }); }
  }

  private onMessage(client: ClientKind, ws: WebSocket, ev: MessageEvent): void {
    let f: any;
    try { f = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
    const type: string = f?.type || '';

    // agent / client / extension 控制帧
    switch (type) {
      case 'tool.result': this.dispatch.settle(f.id, true, f.result); return;
      case 'tool.error': this.dispatch.settle(f.id, false, f.error); return;
      case 'ping': try { ws.send(JSON.stringify({ type: 'pong' })); } catch { /* */ } return;
      case 'send': void this.handleSend(f.chat ?? null, f.text); return;
      case 'abort': this.tasks.get(taskKey(f.chat ?? null))?.abort(); return;
      case 'chats.list': void this.sendList(ws); return;
      case 'chat.open': void this.sendHistory(ws, f.chat ?? null); return;
      case 'chat.new': void this.handleNew(ws, f.title, f.purpose); return;
      case 'decide': void this.handleDecide(f.chat ?? null, f.chosen); return;
    }

    // 工具面板穿透转发(终端/文件/状态/截图)· terminal.* / data.* / fs.* / system.* / screen.* / status.*
    if (isPassthrough(type)) {
      if (client === 'meem') {
        // 内部应用的操作 → 转给 client 执行
        try { this.computer?.send(JSON.stringify(f)); } catch { /* */ }
      } else {
        // client 的输出/事件 → 广播给所有 Meem 控制台
        this.bc.raw(JSON.stringify(f));
      }
    }
  }

  private status(): ConnectionStatus { return { computer: !!this.computer, browser: !!this.browser }; }

  private async handleSend(chat: string | null, text: string): Promise<void> {
    if (!this.uid || !text.trim()) return;
    const repo = makeRepo(this.env, this.uid);
    await repo.addMessage({ chatId: chat, message: { role: 'user', content: text.trim() } });
    this.bc.send({ type: 'message', chat, role: 'user', content: text.trim() });
    this.ensureRunning(chat);
  }

  /** WS:返回会话列表(只发给请求的控制台) */
  private async sendList(ws: WebSocket): Promise<void> {
    if (!this.uid) return;
    const data = await chatsSvc.board(makeRepo(this.env, this.uid));
    try { ws.send(JSON.stringify({ type: 'chats.list.ok', chats: data.chats, decisions: data.decisions })); } catch { /* */ }
  }

  /** WS:返回某会话完整历史(只发给请求方) */
  private async sendHistory(ws: WebSocket, chat: string | null): Promise<void> {
    if (!this.uid || !chat) return;
    const data = await chatsSvc.detail(makeRepo(this.env, this.uid), chat);
    try { ws.send(JSON.stringify({ type: 'chat.history', chat, messages: data.messages })); } catch { /* */ }
  }

  /** WS:新建会话,回执 id,有 purpose 则立即开跑 */
  private async handleNew(ws: WebSocket, title?: string, purpose?: string): Promise<void> {
    if (!this.uid) return;
    const repo = makeRepo(this.env, this.uid);
    const chat = await chatsSvc.create(repo, { title, purpose });
    try { ws.send(JSON.stringify({ type: 'chat.new.ok', chat })); } catch { /* */ }
    this.bc.send({ type: 'chats.update' });
    if (purpose) this.ensureRunning(chat.id);
  }

  /** WS:对决策拍板 → 落"采纳"消息并继续跑 */
  private async handleDecide(chat: string | null, chosen: unknown): Promise<void> {
    if (!this.uid || !chat) return;
    await decisionsSvc.decide(makeRepo(this.env, this.uid), chat, String(chosen ?? ''));
    this.bc.send({ type: 'message', chat, role: 'user', content: `采纳:${String(chosen ?? '')}` });
    this.ensureRunning(chat);
  }

  private ensureRunning(chat: string | null): void {
    if (!this.uid) return;
    const key = taskKey(chat);
    if (this.tasks.has(key)) return;
    const ctrl = new AbortController();
    this.tasks.set(key, ctrl);
    this.bc.send({ type: 'agent.status', chat, status: 'running' });

    runChat({
      env: this.env,
      uid: this.uid,
      chatId: chat,
      repo: makeRepo(this.env, this.uid),
      connections: this.status(),
      callToolEndpoint: (k: ToolEndpointKind, n: string, a: unknown) => this.dispatch.call(k, n, a),
      onEvent: (fr) => this.bc.send(fr),
      signal: ctrl.signal,
    })
      .then(() => this.bc.send({ type: 'agent.status', chat, status: 'done' }))
      .catch((e: any) => { if (e?.name !== 'AbortError') this.bc.send({ type: 'agent.status', chat, status: 'error', error: String(e?.message ?? e) }); })
      .finally(() => { if (this.tasks.get(key) === ctrl) this.tasks.delete(key); });
  }
}
