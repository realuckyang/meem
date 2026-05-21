// 帧分发器：按 frame.type 前缀路由到对应 domain 模块。
// 自己不做任何业务，每个 domain 自己在文件里 switch 子类型。
//
// 新增一个 domain（例如 conversation / tool / presence）就在这里加一行 case。

import type { Env } from '../types';
import * as session from './session';

export interface FrameContext {
  env: Env;
  uid: string;
  handle: string;
  ws: WebSocket;
  broadcast: (frame: unknown) => void;
}

export async function dispatch(ctx: FrameContext, frame: unknown): Promise<void> {
  if (!frame || typeof frame !== 'object') return;
  const type = (frame as any).type;
  if (typeof type !== 'string') return;

  // 内置心跳，不归任何 domain
  if (type === 'ping') {
    try { ctx.ws.send(JSON.stringify({ type: 'pong' })); } catch {}
    return;
  }

  const [domain] = type.split('.');
  switch (domain) {
    case 'session':      return session.handle(ctx, frame as any);
    // case 'conversation': return conversation.handle(ctx, frame);
    // case 'tool':         return tool.handle(ctx, frame);
    // case 'presence':     return presence.handle(ctx, frame);
    default: return;
  }
}
