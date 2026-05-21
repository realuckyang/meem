import type { Env } from '../types';
import type { Ctx } from './helpers';
import { json } from './helpers';

export async function handleMe(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  if (ctx.method === 'GET') {
    const user = await env.DB.prepare('SELECT id, handle, name, bio, cover FROM users WHERE id = ?').bind(ctx.me.id).first();
    const settings = await env.DB.prepare('SELECT * FROM settings WHERE uid = ?').bind(ctx.me.id).first();
    return json({ ...(user ?? { id: ctx.me.id, handle: ctx.me.handle, name: ctx.me.name }), settings });
  }
  if (ctx.method === 'PATCH') {
    const body = await request.json<any>();
    const fields: string[] = ['updated = unixepoch()'];
    const vals: unknown[] = [];
    if (body.name  !== undefined) { fields.push('name = ?');  vals.push(body.name); }
    if (body.bio   !== undefined) { fields.push('bio = ?');   vals.push(body.bio); }
    if (body.cover !== undefined) { fields.push('cover = ?'); vals.push(body.cover); }
    if (fields.length > 1) {
      vals.push(ctx.me.id);
      await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    }
    return json({ ok: true });
  }
  return new Response('method not allowed', { status: 405 });
}
