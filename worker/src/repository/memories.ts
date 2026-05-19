import { INCLUSIONS } from '../lib/constants';
import { newId } from '../lib/id';
import type { Env, Inclusion, Memory } from '../types';

export async function loadMemoriesForUser(env: Env, userId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, title, summary, content, inclusion, created_at, updated_at
     FROM memories WHERE user_id = ?
     ORDER BY
       CASE inclusion WHEN 'must_read' THEN 0 WHEN 'starred' THEN 1 ELSE 2 END,
       updated_at DESC`,
  ).bind(userId).all<Memory>();
  return (rs.results || []) as Memory[];
}

export async function createMemory(
  env: Env,
  userId: string,
  body: { title: string; summary: string; content: string; inclusion: Inclusion },
  ts: number,
) {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO memories (id, user_id, title, summary, content, inclusion, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, userId, body.title, body.summary, body.content, body.inclusion, ts, ts).run();
  return loadMemory(env, userId, id);
}

export async function patchMemory(
  env: Env,
  userId: string,
  id: string,
  body: { title?: string; summary?: string; content?: string; inclusion?: string },
  ts: number,
) {
  const sets: string[] = ['updated_at = ?'];
  const binds: any[] = [ts];
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 120);
    if (!title) throw new Error('title required');
    sets.push('title = ?'); binds.push(title);
  }
  if (typeof body.summary === 'string') { sets.push('summary = ?'); binds.push(body.summary.slice(0, 500)); }
  if (typeof body.content === 'string') { sets.push('content = ?'); binds.push(body.content.slice(0, 8000)); }
  if (typeof body.inclusion === 'string' && INCLUSIONS.includes(body.inclusion as Inclusion)) {
    sets.push('inclusion = ?'); binds.push(body.inclusion);
  }
  binds.push(id, userId);
  const r = await env.DB.prepare(
    `UPDATE memories SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  return Boolean(r.meta?.changes);
}

export async function loadMemory(env: Env, userId: string, id: string) {
  return env.DB.prepare(
    `SELECT id, title, summary, content, inclusion, created_at, updated_at
     FROM memories WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first<Memory>();
}

export async function deleteMemory(env: Env, userId: string, id: string) {
  const r = await env.DB.prepare(
    'DELETE FROM memories WHERE id = ? AND user_id = ?',
  ).bind(id, userId).run();
  return Boolean(r.meta?.changes);
}
