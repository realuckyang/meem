import type { Env } from '../types';
import type { Ctx } from '../api/helpers';

export async function handleUpgrade(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const client = ctx.url.searchParams.get('client') === 'extension' ? 'extension' : 'web';
  const stub = env.AVATAR.get(env.AVATAR.idFromName(ctx.me.handle));
  return stub.fetch(new Request(
    `https://room/ws?client=${client}&uid=${encodeURIComponent(ctx.me.id)}&handle=${encodeURIComponent(ctx.me.handle)}`,
    { headers: request.headers }
  ));
}
