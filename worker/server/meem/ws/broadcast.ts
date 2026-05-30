import type { OutFrame } from './frames';

/** 管理 Meem 控制台 socket 集合,统一推帧 */
export class Broadcaster {
  private consoles = new Set<WebSocket>();

  add(ws: WebSocket): void { this.consoles.add(ws); }
  remove(ws: WebSocket): void { this.consoles.delete(ws); }

  send(frame: OutFrame): void {
    this.raw(JSON.stringify(frame));
  }

  /** 直接广播原始字符串(穿透转发的工具面板帧) */
  raw(s: string): void {
    for (const ws of this.consoles) {
      try { ws.send(s); } catch { this.consoles.delete(ws); }
    }
  }
}
