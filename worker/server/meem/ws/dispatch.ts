import type { ToolEndpointKind } from './frames';

interface Pending {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * 工具端调度引擎 —— "发出去 → 挂起等 → 收回来按 id 配对"。
 * 这就是 ai 层 callToolEndpoint 的本体;ai/functions 只是 await 它的返回值。
 */
export class ToolDispatch {
  private pending = new Map<string, Pending>();

  constructor(
    private getSocket: (kind: ToolEndpointKind) => WebSocket | null,
    private timeoutMs = 60_000,
  ) {}

  /** 发 tool.call,返回一个等 tool.result 的 Promise */
  call(kind: ToolEndpointKind, name: string, args: unknown): Promise<string> {
    const conn = this.getSocket(kind);
    if (!conn) return Promise.reject(new Error(`${kind} 未连接`));

    const id = crypto.randomUUID();
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${name} 超时`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        conn.send(JSON.stringify({ type: 'tool.call', id, name, args }));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e as Error);
      }
    });
  }

  /** 收到 tool.result / tool.error 时,按 id 唤醒对应的 await */
  settle(id: string, ok: boolean, payload: unknown): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (ok) p.resolve(typeof payload === 'string' ? payload : JSON.stringify(payload));
    else p.reject(new Error(String(payload || 'tool error')));
  }
}
