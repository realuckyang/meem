import type { Env } from '../types';
import type { Ctx } from '../api/helpers';
import { json } from '../api/helpers';

export async function handleStatus(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const stub = env.AVATAR.get(env.AVATAR.idFromName(ctx.me.handle));
  const res = await stub.fetch(new Request('https://room/status'));
  const data = await res.json();
  return json(data);
}

export async function pushToHandle(env: Env, handle: string, frame: unknown): Promise<void> {
  const stub = env.AVATAR.get(env.AVATAR.idFromName(handle));
  await stub.fetch(new Request('https://room/push', {
    method: 'POST',
    body: JSON.stringify(frame),
  })).catch(() => {});
}
