import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json, newId } from './helpers';

export async function handleMemoryList(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT * FROM memories WHERE uid = ? ORDER BY priority ASC, updated DESC'
  ).bind(ctx.me.id).all();
  return json(rows.results);
}

export async function handleMemoryCreate(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { title, summary = '', content = '', priority = 'stored' } = await request.json<any>();
  if (!title) return err('title required');
  const id = newId();
  await env.DB.prepare('INSERT INTO memories (id,uid,title,summary,content,priority) VALUES (?,?,?,?,?,?)')
    .bind(id, ctx.me.id, title, summary, content, priority).run();
  return json({ id }, { status: 201 });
}

export async function handleMemory(request: Request, env: Env, ctx: Ctx, mid: string): Promise<Response> {
  if (ctx.method === 'PATCH') {
    const { title, summary, content, priority } = await request.json<any>();
    const fields: string[] = ['updated = unixepoch()'];
    const vals: unknown[] = [];
    if (title !== undefined) { fields.push('title = ?'); vals.push(title); }
    if (summary !== undefined) { fields.push('summary = ?'); vals.push(summary); }
    if (content !== undefined) { fields.push('content = ?'); vals.push(content); }
    if (priority !== undefined) { fields.push('priority = ?'); vals.push(priority); }
    vals.push(mid, ctx.me.id);
    await env.DB.prepare(`UPDATE memories SET ${fields.join(',')} WHERE id = ? AND uid = ?`)
      .bind(...vals).run();
    return json({ ok: true });
  }
  if (ctx.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM memories WHERE id = ? AND uid = ?').bind(mid, ctx.me.id).run();
    return json({ ok: true });
  }
  return new Response('method not allowed', { status: 405 });
}
