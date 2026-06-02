import type { Env, DeviceInfo } from '../../types';
import { ToolDispatch } from './dispatch';
import { Broadcaster } from './broadcast';
import { DEFAULT_TOOL_TIMEOUT_MS } from './frames';
import type { ClientKind } from './frames';
import { runChat } from '../services/chat';
import * as chatsSvc from '../services/chats';
import * as decisionsSvc from '../services/decisions';
import { makeRepo } from '../repository/repo';

const taskKey = (chat: string | null) => chat || 'main';

/** 内部应用的帧(终端/文件/状态/截图)· 在 Meem 控制台 ↔ client 之间穿透转发 */
const PASSTHROUGH = ['terminal.', 'data.', 'fs.', 'system.', 'screen.', 'status.', 'codex.'];
const isPassthrough = (t: string) => PASSTHROUGH.some((p) => t.startsWith(p));

/** 每用户一个 Room:纯通道 —— WS 收发、client/extension call/result 配对、向 Meem 控制台广播、触发运行 */
export class Room implements DurableObject {
  private env: Env;
  private uid: string | null = null;
  // 在线设备:device id → { ws, kind }(可多台电脑/多个浏览器同时在线)
  private devices = new Map<string, { ws: WebSocket; kind: string }>();
  private bc = new Broadcaster();
  private dispatch: ToolDispatch;
  private tasks = new Map<string, AbortController>();

  constructor(_state: DurableObjectState, env: Env) {
    this.env = env;
    this.dispatch = new ToolDispatch(
      (deviceId) => this.devices.get(deviceId) ?? null,
      Number(env.LLM_TOOL_TIMEOUT_MS) || DEFAULT_TOOL_TIMEOUT_MS,
    );
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');
    if (uid && !this.uid) this.uid = uid;

    if (url.pathname.endsWith('/connect')) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected ws', { status: 426 });
      const client = (url.searchParams.get('client') || 'meem') as ClientKind;
      return this.accept(client, url.searchParams.get('device') || '', url.searchParams.get('kind') || 'computer');
    }
    return new Response('not found', { status: 404 });
  }

  private accept(client: ClientKind, deviceId: string, kind: string): Response {
    const pair = new WebSocketPair();
    const server = pair[1];
    server.accept();
    if (client === 'meem') this.bc.add(server);
    else if (deviceId) {
      try { this.devices.get(deviceId)?.ws.close(); } catch { /* 旧连接,忽略 */ }
      this.devices.set(deviceId, { ws: server, kind });
    }

    server.addEventListener('message', (ev) => this.onMessage(client, deviceId, server, ev));
    server.addEventListener('close', () => this.onClose(client, deviceId, server));
    server.addEventListener('error', () => this.onClose(client, deviceId, server));

    try { server.send(JSON.stringify({ type: 'hello', client, online: this.onlineDevices() })); } catch { /* 忽略 */ }
    if (client !== 'meem') this.broadcastStatus();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private onClose(client: ClientKind, deviceId: string, ws: WebSocket): void {
    this.bc.remove(ws);
    if (deviceId && this.devices.get(deviceId)?.ws === ws) { this.devices.delete(deviceId); this.broadcastStatus(); }
  }

  /** 在线设备清单(实时)· 推给控制台 / 注入 agent 用 */
  private onlineDevices(): { id: string; kind: string }[] {
    return [...this.devices.entries()].map(([id, d]) => ({ id, kind: d.kind }));
  }
  private broadcastStatus(): void {
    this.bc.send({ type: 'connection.status', online: this.onlineDevices() } as any);
  }
  /** 合并 DB 设备 + 实时在线态,注入 agent */
  private async deviceList(): Promise<DeviceInfo[]> {
    if (!this.uid) return [];
    const rows = await makeRepo(this.env, this.uid).listDevices();
    return rows.map((d) => ({ id: d.id, kind: d.kind, name: d.name, description: d.description, online: this.devices.has(d.id) }));
  }
  /** 穿透转发目标:必须由帧里的 device 指定(面板应用都已带上目标设备 id) */
  private passthroughTarget(frame: any): WebSocket | null {
    const id = frame?.device || frame?.data?.device;
    return id ? (this.devices.get(String(id))?.ws ?? null) : null;
  }

  private onMessage(client: ClientKind, _deviceId: string, ws: WebSocket, ev: MessageEvent): void {
    let f: any;
    try { f = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
    const type: string = f?.type || '';

    // agent / client / extension 控制帧
    switch (type) {
      case 'tool.result': this.dispatch.settle(f.id, true, f.result); return;
      case 'tool.error': this.dispatch.settle(f.id, false, f.error); return;
      case 'ping': try { ws.send(JSON.stringify({ type: 'pong' })); } catch { /* 连接可能已关闭,尽力而为,忽略失败 */ } return;
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
        // 内部应用的操作 → 转给目标设备(帧里带 device,否则第一台在线电脑)
        try { this.passthroughTarget(f)?.send(JSON.stringify(f)); } catch { /* 连接可能已关闭,尽力而为,忽略失败 */ }
      } else {
        // client 的输出/事件 → 广播给所有 Meem 控制台
        this.bc.raw(JSON.stringify(f));
        // Codex:把归一化后的 final 事件落库,供历史回看(按 codex thread_id 归档)
        if (type === 'codex.event' && f.data?.phase === 'final' && f.data?.threadId && f.data?.item && this.uid) {
          const it = f.data.item;
          void makeRepo(this.env, this.uid)
            .addCodexEvent({ threadId: String(f.data.threadId), kind: it.kind || 'agent_message', payload: { text: it.text ?? '', meta: it.meta ?? null } })
            .catch(() => { /* 落库失败不影响实时流 */ });
        }
      }
    }
  }

  private async handleSend(chat: string | null, text: string): Promise<void> {
    if (!this.uid || !text.trim()) return;
    const repo = makeRepo(this.env, this.uid);
    const t = text.trim();
    const r = await repo.addMessage({ chatId: chat, message: { role: 'user', content: t } });
    this.bc.send({ type: 'message', chat, role: 'user', content: t, message: { role: 'user', content: t }, id: r.id, created: r.created, meta: null });
    this.ensureRunning(chat);
  }

  /** WS:返回会话列表(只发给请求的控制台) */
  private async sendList(ws: WebSocket): Promise<void> {
    if (!this.uid) return;
    const data = await chatsSvc.board(makeRepo(this.env, this.uid));
    // 标注每条会话此刻是否在运行(实时状态来自内存 tasks,DB 的 status 不可靠)
    const chats = data.chats.map((c: any) => ({ ...c, running: this.tasks.has(taskKey(c.id)) }));
    try { ws.send(JSON.stringify({ type: 'chats.list.ok', chats, decisions: data.decisions })); } catch { /* 连接可能已关闭,尽力而为,忽略失败 */ }
  }

  /** WS:返回某会话完整历史(只发给请求方) */
  private async sendHistory(ws: WebSocket, chat: string | null): Promise<void> {
    if (!this.uid || !chat) return;
    const data = await chatsSvc.detail(makeRepo(this.env, this.uid), chat);
    try {
      ws.send(JSON.stringify({ type: 'chat.history', chat, messages: data.messages }));
      // 该会话此刻仍在运行 → 补发运行态,刷新/切回后前端恢复"进行中"
      if (this.tasks.has(taskKey(chat))) ws.send(JSON.stringify({ type: 'agent.status', chat, status: 'running' }));
    } catch { /* 连接可能已关闭,尽力而为,忽略失败 */ }
  }

  /** WS:新建会话,回执 id,有 purpose 则立即开跑 */
  private async handleNew(ws: WebSocket, title?: string, purpose?: string): Promise<void> {
    if (!this.uid) return;
    const repo = makeRepo(this.env, this.uid);
    const chat = await chatsSvc.create(repo, { title, purpose });
    try { ws.send(JSON.stringify({ type: 'chat.new.ok', chat })); } catch { /* 连接可能已关闭,尽力而为,忽略失败 */ }
    this.bc.send({ type: 'chats.update' });
    if (purpose) this.ensureRunning(chat.id);
  }

  /** WS:对决策拍板 → 落"采纳"消息并继续跑 */
  private async handleDecide(chat: string | null, chosen: unknown): Promise<void> {
    if (!this.uid || !chat) return;
    const r = await decisionsSvc.decide(makeRepo(this.env, this.uid), chat, String(chosen ?? ''));
    this.bc.send({ type: 'message', chat, role: 'user', content: r.text, message: { role: 'user', content: r.text }, id: r.id, created: r.created, meta: { kind: 'decision_made' } });
    this.ensureRunning(chat);
  }

  private ensureRunning(chat: string | null): void {
    if (!this.uid) return;
    const key = taskKey(chat);
    if (this.tasks.has(key)) return;
    const ctrl = new AbortController();
    this.tasks.set(key, ctrl);
    this.bc.send({ type: 'agent.status', chat, status: 'running' });

    this.deviceList().then((devices) => runChat({
      env: this.env,
      uid: this.uid!,
      chatId: chat,
      repo: makeRepo(this.env, this.uid!),
      devices,
      callToolEndpoint: (deviceId: string, n: string, a: unknown) => this.dispatch.call(deviceId, n, a),
      onEvent: (fr) => this.bc.send(fr),
      signal: ctrl.signal,
    }))
      .then(() => this.bc.send({ type: 'agent.status', chat, status: 'done' }))
      .catch((e: any) => {
        // 用户中止:照样发 done 让前端解除 running;真错误才发 error
        if (e?.name === 'AbortError') this.bc.send({ type: 'agent.status', chat, status: 'done' });
        else this.bc.send({ type: 'agent.status', chat, status: 'error', error: String(e?.message ?? e) });
      })
      .finally(() => { if (this.tasks.get(key) === ctrl) this.tasks.delete(key); });
  }
}
