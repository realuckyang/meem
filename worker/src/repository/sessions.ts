import type { DispatchSession, Env } from '../types';

export async function createMessageAgentSession(
  env: Env,
  input: {
    id: string;
    userId: string;
    title: string;
    conversationId: string;
    messageId: string;
    ts: number;
  },
) {
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, kind, status, title, conversation_id, trigger_message_id, created_at, updated_at)
     VALUES (?, ?, 'message_agent', 'thinking', ?, ?, ?, ?, ?)`,
  ).bind(input.id, input.userId, input.title, input.conversationId, input.messageId, input.ts, input.ts).run();
}

export async function listSessions(env: Env, userId: string, filter: { kind?: string; conversationId?: string }) {
  const where: string[] = ['user_id = ?'];
  const binds: string[] = [userId];
  if (filter.kind) {
    where.push('kind = ?');
    binds.push(filter.kind);
  }
  if (filter.conversationId) {
    where.push('conversation_id = ?');
    binds.push(filter.conversationId);
  }
  const rs = await env.DB.prepare(
    `SELECT id, kind, status, title, conversation_id, trigger_message_id, codex_thread_id, cwd, created_at, updated_at, finished_at
     FROM sessions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC LIMIT 200`,
  ).bind(...binds).all();
  return rs.results || [];
}

export async function loadSession(env: Env, userId: string, id: string) {
  return env.DB.prepare(
    `SELECT id, kind, status, title, conversation_id, trigger_message_id, codex_thread_id, cwd, created_at, updated_at, finished_at
     FROM sessions WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
}

export async function createDirectSession(
  env: Env,
  input: { id: string; userId: string; status: string; title: string | null; cwd: string | null; ts: number; finishedAt: number | null },
) {
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, kind, status, title, cwd, created_at, updated_at, finished_at)
     VALUES (?, ?, 'direct_chat', ?, ?, ?, ?, ?, ?)`,
  ).bind(input.id, input.userId, input.status, input.title, input.cwd, input.ts, input.ts, input.finishedAt).run();
}

export async function loadDispatchSession(env: Env, userId: string, id: string) {
  return env.DB.prepare(
    `SELECT id, user_id, kind, title, conversation_id, trigger_message_id, cwd
     FROM sessions WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first<DispatchSession>();
}

export async function markSessionThinking(env: Env, userId: string, sessionId: string, title: string, ts: number) {
  await env.DB.prepare(
    `UPDATE sessions SET status = 'thinking', title = COALESCE(title, ?), updated_at = ?, finished_at = NULL WHERE id = ? AND user_id = ?`,
  ).bind(title, ts, sessionId, userId).run();
}

export async function deleteSession(env: Env, userId: string, sessionId: string) {
  const r = await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE session_id = ? AND user_id = ?').bind(sessionId, userId),
    env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(sessionId, userId),
  ]);
  return Boolean(r[1]?.meta?.changes);
}

export async function patchSession(
  env: Env,
  userId: string,
  sessionId: string,
  body: { status?: string; codex_thread_id?: string; title?: string | null },
  ts: number,
) {
  const valid = ['thinking','awaiting_approval','awaiting_input','done','cancelled','errored'];
  const status = body.status && valid.includes(body.status) ? body.status : null;
  const sets = ['updated_at = ?'];
  const binds: any[] = [ts];
  if (status) {
    sets.push('status = ?');
    binds.push(status);
    if (['done','cancelled','errored'].includes(status)) {
      sets.push('finished_at = ?');
      binds.push(ts);
    }
  }
  if (typeof body.codex_thread_id === 'string') {
    sets.push('codex_thread_id = ?');
    binds.push(body.codex_thread_id);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    sets.push('title = ?');
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    binds.push(title || null);
  }
  binds.push(sessionId, userId);
  const r = await env.DB.prepare(
    `UPDATE sessions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  if (!r.meta?.changes) return null;
  return env.DB.prepare(
    'SELECT id, status, title, finished_at, updated_at FROM sessions WHERE id = ? AND user_id = ?',
  ).bind(sessionId, userId).first();
}
