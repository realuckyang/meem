// 工具实现层。
// 浏览器系：通过 DO /dispatch 转发给已连接的扩展执行。
// 记忆系：服务端直接查/写 D1。

import type { Env } from '../types';

export interface ToolContext {
  env: Env;
  uid: string;
  handle: string;
  // 仅 auto-reply 触发的 session 才会塞这两个字段；其他场景为空，conversation_reply 工具会拒绝执行
  replyCid?: string;
  replyPeer?: string;
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

// ── 广播 / 社区 ─────────────────────────────────────────────────────────────
// 直接走 D1，跟记忆系一样

function safeJsonArr(s: string): string[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; }
  catch { return []; }
}

function ftsQuote(q: string): string {
  return '"' + q.replace(/"/g, '""') + '"';
}

interface FeedPostRow { id: string; author: string; body: string; images: string; likes: number; replies: number; created: number; updated: number; }
interface FeedCommentRow { id: string; post: string; parent: string | null; author: string; body: string; likes: number; created: number; }

function shapeFeedPost(r: FeedPostRow) {
  return { id: r.id, author: r.author, body: r.body, images: safeJsonArr(r.images), likes: r.likes, replies: r.replies, created: r.created };
}

export async function feed_list(args: { limit?: number; cursor?: number; author?: string }, ctx: ToolContext) {
  const limit = Math.min(args?.limit ?? 20, 50);
  const conds: string[] = [];
  const vals: unknown[] = [];
  if (args?.cursor) { conds.push('created < ?'); vals.push(args.cursor); }
  if (args?.author) { conds.push('author = ?'); vals.push(args.author); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await ctx.env.DB.prepare(
    `SELECT * FROM posts ${where} ORDER BY created DESC LIMIT ?`
  ).bind(...vals, limit).all<FeedPostRow>();
  return rows.results.map(shapeFeedPost);
}

export async function feed_search(args: { q?: string; limit?: number }, ctx: ToolContext) {
  const q = String(args?.q ?? '').trim();
  if (!q) return [];
  const limit = Math.min(args?.limit ?? 20, 50);
  const rows = await ctx.env.DB.prepare(
    `SELECT posts.* FROM posts_fts JOIN posts ON posts.rowid = posts_fts.rowid
     WHERE posts_fts MATCH ? ORDER BY posts.created DESC LIMIT ?`
  ).bind(ftsQuote(q), limit).all<FeedPostRow>();
  return rows.results.map(shapeFeedPost);
}

export async function feed_read(args: { id?: string }, ctx: ToolContext) {
  const id = String(args?.id ?? '');
  if (!id) throw new Error('id required');
  const post = await ctx.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<FeedPostRow>();
  if (!post) throw new Error('帖子不存在');
  const comments = await ctx.env.DB.prepare(
    'SELECT * FROM comments WHERE post = ? ORDER BY created ASC LIMIT 300'
  ).bind(id).all<FeedCommentRow>();
  return {
    post: shapeFeedPost(post),
    comments: comments.results.map((c) => ({
      id: c.id, parent: c.parent, author: c.author, body: c.body, likes: c.likes, created: c.created,
    })),
  };
}

export async function feed_post(args: { body?: string; images?: string[] }, ctx: ToolContext) {
  const body = String(args?.body ?? '').trim();
  const images = Array.isArray(args?.images) ? args!.images!.filter((x) => typeof x === 'string').slice(0, 9) : [];
  if (!body && !images.length) throw new Error('body 或 images 至少一个');
  if (body.length > 4000) throw new Error('body 超过 4000 字');
  const id = crypto.randomUUID();
  await ctx.env.DB.prepare('INSERT INTO posts (id, author, body, images) VALUES (?, ?, ?, ?)')
    .bind(id, ctx.handle, body, JSON.stringify(images)).run();
  return { ok: true, id };
}

export async function feed_comment(args: { post?: string; body?: string; parent?: string }, ctx: ToolContext) {
  const post = String(args?.post ?? '');
  const body = String(args?.body ?? '').trim();
  if (!post || !body) throw new Error('post 和 body 必填');
  if (body.length > 1000) throw new Error('评论过长');
  const exists = await ctx.env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(post).first();
  if (!exists) throw new Error('帖子不存在');
  if (args?.parent) {
    const p = await ctx.env.DB.prepare('SELECT id FROM comments WHERE id = ? AND post = ?').bind(args.parent, post).first();
    if (!p) throw new Error('父评论不存在');
  }
  const id = crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('INSERT INTO comments (id, post, parent, author, body) VALUES (?, ?, ?, ?, ?)')
      .bind(id, post, args?.parent ?? null, ctx.handle, body),
    ctx.env.DB.prepare('UPDATE posts SET replies = replies + 1, updated = unixepoch() WHERE id = ?').bind(post),
  ]);
  return { ok: true, id };
}

export async function feed_like(args: { target_kind?: string; target?: string }, ctx: ToolContext) {
  const kind = args?.target_kind;
  const target = String(args?.target ?? '');
  if (kind !== 'post' && kind !== 'comment') throw new Error('target_kind 必须是 post 或 comment');
  if (!target) throw new Error('target 必填');
  const table = kind === 'post' ? 'posts' : 'comments';
  const has = await ctx.env.DB.prepare(
    'SELECT 1 as v FROM reactions WHERE uid = ? AND target_kind = ? AND target = ?'
  ).bind(ctx.uid, kind, target).first();
  if (has) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('DELETE FROM reactions WHERE uid = ? AND target_kind = ? AND target = ?')
        .bind(ctx.uid, kind, target),
      ctx.env.DB.prepare(`UPDATE ${table} SET likes = MAX(likes - 1, 0) WHERE id = ?`).bind(target),
    ]);
    return { liked: false };
  } else {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('INSERT INTO reactions (uid, target_kind, target) VALUES (?, ?, ?)')
        .bind(ctx.uid, kind, target),
      ctx.env.DB.prepare(`UPDATE ${table} SET likes = likes + 1 WHERE id = ?`).bind(target),
    ]);
    return { liked: true };
  }
}

// ── 代用户发消息：仅在 auto 模式触发的 session 里可用 ──────────────────────

export async function conversation_reply(args: { text?: string }, ctx: ToolContext) {
  const text = String(args?.text ?? '').trim();
  if (!text) throw new Error('text required');
  if (!ctx.replyCid) throw new Error('conversation_reply 仅在自动回复模式下可用，当前 session 无目标会话');

  // 校验用户仍是这条会话的成员
  const member = await ctx.env.DB.prepare(
    'SELECT handle FROM members WHERE cid = ? AND handle = ?'
  ).bind(ctx.replyCid, ctx.handle).first();
  if (!member) throw new Error('not a member of this conversation');

  const id = crypto.randomUUID();
  const created = Math.floor(Date.now() / 1000);
  await ctx.env.DB.prepare('INSERT INTO messages (id,cid,sender,body,created) VALUES (?,?,?,?,?)')
    .bind(id, ctx.replyCid, ctx.handle, text, created).run();
  await ctx.env.DB.prepare('UPDATE conversations SET preview = ?, updated = ? WHERE id = ?')
    .bind(text.slice(0, 80), created, ctx.replyCid).run();
  await ctx.env.DB.prepare('UPDATE members SET unread = unread + 1 WHERE cid = ? AND handle != ?')
    .bind(ctx.replyCid, ctx.handle).run();

  // 推送给所有成员
  const allMembers = await ctx.env.DB.prepare('SELECT handle FROM members WHERE cid = ?')
    .bind(ctx.replyCid).all<{ handle: string }>();
  const msg = { id, cid: ctx.replyCid, sender: ctx.handle, body: text, created };
  for (const { handle } of allMembers.results) {
    const stub = ctx.env.AVATAR.get(ctx.env.AVATAR.idFromName(handle));
    stub.fetch(new Request('https://room/push', {
      method: 'POST',
      body: JSON.stringify({ type: 'message', message: msg }),
    })).catch(() => {});
  }

  return { ok: true, id, sentTo: ctx.replyPeer ?? null };
}
