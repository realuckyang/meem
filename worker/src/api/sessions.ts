import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json, newId } from './helpers';

export async function handleSessionList(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const kind = ctx.url.searchParams.get('kind');
  const trigger = ctx.url.searchParams.get('trigger');

  const conds: string[] = ['uid = ?'];
  const args: unknown[] = [ctx.me.id];
  if (kind)    { conds.push('kind = ?');    args.push(kind); }
  if (trigger) { conds.push('trigger = ?'); args.push(trigger); }

  const rows = await env.DB.prepare(
    `SELECT * FROM sessions WHERE ${conds.join(' AND ')} ORDER BY updated DESC LIMIT 50`
  ).bind(...args).all();
  return json(rows.results);
}

export async function handleSessionCreate(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { title = '新对话', kind = 'direct', trigger } = await request.json<any>();
  const id = newId();
  // 新建时不在跑 LLM，显式置为 done；status='thinking' 只在 ws/session.ts 真正发起 LLM 调用时设置
  await env.DB.prepare('INSERT INTO sessions (id,uid,kind,status,title,trigger) VALUES (?,?,?,?,?,?)')
    .bind(id, ctx.me.id, kind, 'done', title, trigger ?? null).run();
  return json({ id, uid: ctx.me.id, kind, status: 'done', title, trigger: trigger ?? null }, { status: 201 });
}

export async function handleSession(request: Request, env: Env, ctx: Ctx, sid: string): Promise<Response> {
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND uid = ?')
    .bind(sid, ctx.me.id).first();
  if (!session) return err('not found', 404);
  if (ctx.method === 'GET') return json(session);
  if (ctx.method === 'PATCH') {
    const { status, title } = await request.json<any>();
    const fields: string[] = ['updated = unixepoch()'];
    const vals: unknown[] = [];
    if (status) { fields.push('status = ?'); vals.push(status); }
    if (title) { fields.push('title = ?'); vals.push(title); }
    if (status === 'done' || status === 'cancelled' || status === 'error') {
      fields.push('finished = unixepoch()');
    }
    vals.push(sid, ctx.me.id);
    await env.DB.prepare(`UPDATE sessions SET ${fields.join(',')} WHERE id = ? AND uid = ?`)
      .bind(...vals).run();
    return json({ ok: true });
  }
  return new Response('method not allowed', { status: 405 });
}

export async function handleEvents(_request: Request, env: Env, ctx: Ctx, sid: string): Promise<Response> {
  const session = await env.DB.prepare('SELECT id FROM sessions WHERE id = ? AND uid = ?')
    .bind(sid, ctx.me.id).first();
  if (!session) return err('not found', 404);

  if (ctx.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id, sid, message, meta, created FROM events WHERE sid = ? ORDER BY id ASC'
    ).bind(sid).all<{ id: number; sid: string; message: string; meta: string | null; created: number }>();
    const out = rows.results.map((r) => ({
      id: r.id,
      sid: r.sid,
      message: safeParse(r.message),
      meta: r.meta ? safeParse(r.meta) : null,
      created: r.created,
    }));
    return json(out);
  }

  return new Response('method not allowed', { status: 405 });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
