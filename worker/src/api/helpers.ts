import { verifyToken } from '../auth';
import type { Env } from '../types';

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(init.headers ?? {}),
    },
  });

export const err = (msg: string, status = 400) => json({ error: msg }, { status });

export const cors = () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
  });

export const newId = () => crypto.randomUUID();

export interface UserRow {
  id: string;
  handle: string;
  name: string;
  secret: string;
}

export async function authorize(env: Env, request: Request): Promise<UserRow | null> {
  const url = new URL(request.url);
  const token =
    request.headers.get('Authorization')?.replace('Bearer ', '') ||
    url.searchParams.get('token') ||
    undefined;
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const { sub } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!sub) return null;
    const row = await env.DB.prepare('SELECT id, handle, name, secret FROM users WHERE id = ?')
      .bind(sub).first<UserRow>();
    if (!row) return null;
    const valid = await verifyToken(token, row.secret);
    if (!valid) return null;
    return row;
  } catch {
    return null;
  }
}

export interface Ctx {
  me: UserRow;
  url: URL;
  method: string;
}
