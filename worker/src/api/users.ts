import type { Env } from '../types';
import type { Ctx } from './helpers';
import { json } from './helpers';

export async function handleUsers(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  if (ctx.method !== 'GET') return new Response('method not allowed', { status: 405 });
  const q = ctx.url.searchParams.get('q') ?? '';
  const rows = await env.DB.prepare(
    'SELECT id, handle, name, bio, cover FROM users WHERE handle LIKE ? AND id != ? LIMIT 20'
  ).bind(`%${q}%`, ctx.me.id).all();
  return json(rows.results);
}

// GET /api/users/:handle —— 单个用户详情
export async function handleUserByHandle(_request: Request, env: Env, _ctx: Ctx, handle: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT id, handle, name, bio, cover FROM users WHERE handle = ?'
  ).bind(handle).first();
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  return json(row);
}
