// 广播 / 社区信息流
//
// 列表 / 详情 / 发帖 / 评论 / 点赞 / 搜索

import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json, newId } from './helpers';

const MAX_BODY = 4000;
const MAX_IMAGES = 9;

interface PostRow {
  id: string; author: string; body: string; images: string;
  likes: number; replies: number; created: number; updated: number;
}
interface CommentRow {
  id: string; post: string; parent: string | null; author: string;
  body: string; likes: number; created: number;
}

function safeJsonArr(s: string): string[] {
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; }
  catch { return []; }
}

function escapeFts(q: string): string {
  // FTS5 单 token 用双引号包裹，转义内部引号
  return '"' + q.replace(/"/g, '""') + '"';
}

async function liked(env: Env, uid: string, kind: 'post'|'comment', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(
    `SELECT target FROM reactions WHERE uid = ? AND target_kind = ? AND target IN (${placeholders})`
  ).bind(uid, kind, ...ids).all<{ target: string }>();
  return new Set(rows.results.map((r) => r.target));
}

function shapePost(row: PostRow, mineLikes: Set<string>) {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    images: safeJsonArr(row.images),
    likes: row.likes,
    replies: row.replies,
    liked: mineLikes.has(row.id),
    created: row.created,
    updated: row.updated,
  };
}

// GET /api/feed?sort=new|hot&cursor=<created>&limit=20&author=<handle>
export async function handleFeedList(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const limit = Math.min(Number(ctx.url.searchParams.get('limit')) || 20, 50);
  const cursor = Number(ctx.url.searchParams.get('cursor')) || 0;
  const author = ctx.url.searchParams.get('author') ?? '';

  const conds: string[] = [];
  const args: unknown[] = [];
  if (cursor) { conds.push('created < ?'); args.push(cursor); }
  if (author) { conds.push('author = ?'); args.push(author); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT * FROM posts ${where} ORDER BY created DESC LIMIT ?`
  ).bind(...args, limit).all<PostRow>();

  const likes = await liked(env, ctx.me.id, 'post', rows.results.map((r) => r.id));
  const items = rows.results.map((r) => shapePost(r, likes));
  const nextCursor = items.length === limit ? items[items.length - 1].created : null;
  return json({ items, nextCursor });
}

// GET /api/feed/search?q=...
export async function handleFeedSearch(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const q = (ctx.url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(Number(ctx.url.searchParams.get('limit')) || 20, 50);
  if (!q) return json({ items: [] });

  const rows = await env.DB.prepare(
    `SELECT posts.* FROM posts_fts JOIN posts ON posts.rowid = posts_fts.rowid
     WHERE posts_fts MATCH ? ORDER BY posts.created DESC LIMIT ?`
  ).bind(escapeFts(q), limit).all<PostRow>();
  const likes = await liked(env, ctx.me.id, 'post', rows.results.map((r) => r.id));
  return json({ items: rows.results.map((r) => shapePost(r, likes)) });
}

// POST /api/feed { body, images? }
export async function handleFeedCreate(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { body = '', images = [] } = await request.json<any>();
  const text = String(body).trim();
  const imgs = Array.isArray(images) ? images.filter((x) => typeof x === 'string').slice(0, MAX_IMAGES) : [];
  if (!text && !imgs.length) return err('内容不能为空');
  if (text.length > MAX_BODY) return err(`正文超过 ${MAX_BODY} 字`);

  const id = newId();
  await env.DB.prepare(
    'INSERT INTO posts (id, author, body, images) VALUES (?, ?, ?, ?)'
  ).bind(id, ctx.me.handle, text, JSON.stringify(imgs)).run();

  const row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<PostRow>();
  return json(shapePost(row!, new Set()), { status: 201 });
}

// GET /api/feed/:id —— 含评论树
// DELETE /api/feed/:id
export async function handleFeedItem(request: Request, env: Env, ctx: Ctx, pid: string): Promise<Response> {
  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(pid).first<PostRow>();
  if (!post) return err('not found', 404);

  if (ctx.method === 'GET') {
    const comments = await env.DB.prepare(
      'SELECT * FROM comments WHERE post = ? ORDER BY created ASC LIMIT 500'
    ).bind(pid).all<CommentRow>();
    const cIds = comments.results.map((c) => c.id);
    const [postLike, commentLikes] = await Promise.all([
      liked(env, ctx.me.id, 'post', [pid]),
      liked(env, ctx.me.id, 'comment', cIds),
    ]);
    return json({
      post: shapePost(post, postLike),
      comments: comments.results.map((c) => ({
        id: c.id, post: c.post, parent: c.parent, author: c.author,
        body: c.body, likes: c.likes, created: c.created, liked: commentLikes.has(c.id),
      })),
    });
  }

  if (ctx.method === 'DELETE') {
    if (post.author !== ctx.me.handle) return err('forbidden', 403);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reactions WHERE target_kind = ? AND target = ?').bind('post', pid),
      env.DB.prepare('DELETE FROM reactions WHERE target_kind = ? AND target IN (SELECT id FROM comments WHERE post = ?)').bind('comment', pid),
      env.DB.prepare('DELETE FROM comments WHERE post = ?').bind(pid),
      env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(pid),
    ]);
    return json({ ok: true });
  }

  return new Response('method not allowed', { status: 405 });
}

// POST /api/feed/:id/comments { body, parent? }
export async function handleCommentCreate(request: Request, env: Env, ctx: Ctx, pid: string): Promise<Response> {
  const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(pid).first<{ id: string }>();
  if (!post) return err('not found', 404);

  const { body = '', parent = null } = await request.json<any>();
  const text = String(body).trim();
  if (!text) return err('评论不能为空');
  if (text.length > 1000) return err('评论过长');

  if (parent) {
    const p = await env.DB.prepare('SELECT id FROM comments WHERE id = ? AND post = ?').bind(parent, pid).first();
    if (!p) return err('父评论不存在');
  }

  const id = newId();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO comments (id, post, parent, author, body) VALUES (?, ?, ?, ?, ?)')
      .bind(id, pid, parent ?? null, ctx.me.handle, text),
    env.DB.prepare('UPDATE posts SET replies = replies + 1, updated = unixepoch() WHERE id = ?').bind(pid),
  ]);
  const row = await env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<CommentRow>();
  return json({
    id: row!.id, post: row!.post, parent: row!.parent, author: row!.author,
    body: row!.body, likes: row!.likes, created: row!.created, liked: false,
  }, { status: 201 });
}

// DELETE /api/feed/comments/:id
export async function handleCommentDelete(_request: Request, env: Env, ctx: Ctx, cid: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT post, author FROM comments WHERE id = ?').bind(cid).first<{ post: string; author: string }>();
  if (!row) return err('not found', 404);
  if (row.author !== ctx.me.handle) return err('forbidden', 403);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM reactions WHERE target_kind = ? AND target = ?').bind('comment', cid),
    env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(cid),
    env.DB.prepare('UPDATE posts SET replies = MAX(replies - 1, 0) WHERE id = ?').bind(row.post),
  ]);
  return json({ ok: true });
}

// POST /api/feed/like { target_kind: 'post'|'comment', target: id }
// 切换式：已点过 → 取消；否则 → 加上
export async function handleLikeToggle(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { target_kind, target } = await request.json<any>();
  if (target_kind !== 'post' && target_kind !== 'comment') return err('target_kind 必须是 post 或 comment');
  if (!target || typeof target !== 'string') return err('target 必填');

  const table = target_kind === 'post' ? 'posts' : 'comments';
  const exists = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(target).first();
  if (!exists) return err('not found', 404);

  const has = await env.DB.prepare(
    'SELECT 1 as v FROM reactions WHERE uid = ? AND target_kind = ? AND target = ?'
  ).bind(ctx.me.id, target_kind, target).first();

  if (has) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reactions WHERE uid = ? AND target_kind = ? AND target = ?')
        .bind(ctx.me.id, target_kind, target),
      env.DB.prepare(`UPDATE ${table} SET likes = MAX(likes - 1, 0) WHERE id = ?`).bind(target),
    ]);
    const r = await env.DB.prepare(`SELECT likes FROM ${table} WHERE id = ?`).bind(target).first<{ likes: number }>();
    return json({ liked: false, likes: r?.likes ?? 0 });
  } else {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO reactions (uid, target_kind, target) VALUES (?, ?, ?)')
        .bind(ctx.me.id, target_kind, target),
      env.DB.prepare(`UPDATE ${table} SET likes = likes + 1 WHERE id = ?`).bind(target),
    ]);
    const r = await env.DB.prepare(`SELECT likes FROM ${table} WHERE id = ?`).bind(target).first<{ likes: number }>();
    return json({ liked: true, likes: r?.likes ?? 0 });
  }
}
