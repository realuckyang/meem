// 工具实现层。
// 浏览器系：通过 DO /dispatch 转发给已连接的扩展执行。
// 记忆系：服务端直接查/写 D1。

import type { Env } from '../types';

export interface ToolContext {
  env: Env;
  uid: string;
  handle: string;
}

// ── 转发到扩展 ─────────────────────────────────────────────────────────────

async function dispatchToExtension(env: Env, handle: string, name: string, args: any): Promise<any> {
  const stub = env.AVATAR.get(env.AVATAR.idFromName(handle));
  const res = await stub.fetch('https://room/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tool.call', name, args }),
  });
  const body = await res.json<{ ok: boolean; data?: any; error?: string }>();
  if (!body.ok) throw new Error(body.error ?? 'dispatch failed');
  return body.data;
}

export const browser_status        = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_status',        args ?? {});
export const browser_open_tab      = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_open_tab',      args ?? {});
export const browser_tabs          = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_tabs',          args ?? {});
export const browser_activate_tab  = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_activate_tab',  args ?? {});
export const browser_close_tab     = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_close_tab',     args ?? {});
export const browser_navigate      = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_navigate',      args ?? {});
export const browser_evaluate      = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_evaluate',      args ?? {});
// 截图：扩展自己抓 + 自己 POST /api/media/upload，回 WS 时就只剩 URL 了
export const browser_screenshot    = (args: any, ctx: ToolContext) => dispatchToExtension(ctx.env, ctx.handle, 'browser_screenshot',    args ?? {});

// ── 记忆工具：服务端直查 D1 ────────────────────────────────────────────────

export async function memory_search(args: { query?: string }, ctx: ToolContext) {
  const q = `%${args?.query ?? ''}%`;
  const rows = await ctx.env.DB.prepare(
    'SELECT id, title, summary, content, priority FROM memories WHERE uid = ? AND (title LIKE ? OR content LIKE ? OR summary LIKE ?) ORDER BY priority ASC, updated DESC LIMIT 20'
  ).bind(ctx.uid, q, q, q).all();
  return rows.results;
}

export async function memory_list(args: { priority?: 'must' | 'starred' | 'stored' }, ctx: ToolContext) {
  if (args?.priority) {
    const rows = await ctx.env.DB.prepare(
      'SELECT id, title, summary, priority FROM memories WHERE uid = ? AND priority = ? ORDER BY updated DESC LIMIT 50'
    ).bind(ctx.uid, args.priority).all();
    return rows.results;
  }
  const rows = await ctx.env.DB.prepare(
    'SELECT id, title, summary, priority FROM memories WHERE uid = ? ORDER BY priority ASC, updated DESC LIMIT 50'
  ).bind(ctx.uid).all();
  return rows.results;
}

export async function memory_add(args: { title?: string; content?: string; summary?: string; priority?: 'must' | 'starred' | 'stored' }, ctx: ToolContext) {
  const title = String(args?.title ?? '').trim();
  if (!title) throw new Error('title required');
  const id = crypto.randomUUID();
  const priority = args?.priority ?? 'stored';
  if (!['must', 'starred', 'stored'].includes(priority)) throw new Error('invalid priority');
  await ctx.env.DB.prepare(
    'INSERT INTO memories (id, uid, title, summary, content, priority) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, ctx.uid, title, args?.summary ?? '', args?.content ?? '', priority).run();
  return { id, ok: true };
}

export async function memory_edit(args: { id?: string; title?: string; summary?: string; content?: string; priority?: 'must' | 'starred' | 'stored' }, ctx: ToolContext) {
  const id = String(args?.id ?? '');
  if (!id) throw new Error('id required');
  const fields: string[] = ['updated = unixepoch()'];
  const vals: unknown[] = [];
  if (args.title !== undefined)    { fields.push('title = ?');    vals.push(args.title); }
  if (args.summary !== undefined)  { fields.push('summary = ?');  vals.push(args.summary); }
  if (args.content !== undefined)  { fields.push('content = ?');  vals.push(args.content); }
  if (args.priority !== undefined) {
    if (!['must', 'starred', 'stored'].includes(args.priority)) throw new Error('invalid priority');
    fields.push('priority = ?'); vals.push(args.priority);
  }
  vals.push(id, ctx.uid);
  const res = await ctx.env.DB.prepare(
    `UPDATE memories SET ${fields.join(',')} WHERE id = ? AND uid = ?`
  ).bind(...vals).run();
  return { ok: true, changes: res.meta?.changes ?? 0 };
}

export async function memory_delete(args: { id?: string }, ctx: ToolContext) {
  const id = String(args?.id ?? '');
  if (!id) throw new Error('id required');
  const res = await ctx.env.DB.prepare('DELETE FROM memories WHERE id = ? AND uid = ?').bind(id, ctx.uid).run();
  return { ok: true, changes: res.meta?.changes ?? 0 };
}
