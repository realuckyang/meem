// GET /api/presence?handles=a,b,c
// 批量查询若干用户的在线 / 扩展连接状态，由调用方按需轮询。

import type { Env } from '../types';
import type { Ctx } from './helpers';
import { json } from './helpers';

interface UserStatus {
  online: boolean;
  extension: boolean;
  web: boolean;
  extensionBg?: boolean;
}

const OFFLINE: UserStatus = { online: false, extension: false, web: false };

export async function handlePresence(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const raw = ctx.url.searchParams.get('handles') ?? '';
  const handles = Array.from(new Set(raw.split(',').map((h) => h.trim()).filter(Boolean))).slice(0, 50);
  if (handles.length === 0) return json({});

  const entries = await Promise.all(handles.map(async (h) => {
    try {
      const stub = env.AVATAR.get(env.AVATAR.idFromName(h));
      const res = await stub.fetch('https://room/status');
      const data = await res.json<UserStatus>();
      return [h, data] as const;
    } catch {
      return [h, OFFLINE] as const;
    }
  }));

  return json(Object.fromEntries(entries));
}
