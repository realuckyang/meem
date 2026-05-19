import type { Env } from '../types';

export async function nextEventSeq(env: Env, sessionId: string) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE session_id = ?',
  ).bind(sessionId).first<{ max_seq: number }>();
  return Number(row?.max_seq || 0) + 1;
}

export async function listEvents(env: Env, userId: string, sessionId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, session_id, seq, kind, payload_json, in_reply_to, created_at
     FROM events WHERE session_id = ? AND user_id = ?
     ORDER BY seq ASC, created_at ASC, id ASC`,
  ).bind(sessionId, userId).all();
  return rs.results || [];
}

export async function listPastTurns(env: Env, userId: string, sessionId: string) {
  const rs = await env.DB.prepare(
    `SELECT kind, payload_json FROM events
     WHERE session_id = ? AND user_id = ?
       AND kind IN ('user_message','agent_message')
     ORDER BY seq ASC, created_at ASC, id ASC
     LIMIT 40`,
  ).bind(sessionId, userId).all<{ kind: string; payload_json: string }>();
  return rs.results || [];
}

export async function insertUserEvent(
  env: Env,
  input: { id: string; userId: string; sessionId: string; seq: number; text: string; ts: number },
) {
  await env.DB.prepare(
    `INSERT INTO events (id, user_id, session_id, seq, kind, payload_json, created_at)
     VALUES (?, ?, ?, ?, 'user_message', ?, ?)`,
  ).bind(input.id, input.userId, input.sessionId, input.seq, JSON.stringify({ text: input.text }), input.ts).run();
}

export async function insertEvents(
  env: Env,
  userId: string,
  sessionId: string,
  events: Array<{ kind: string; payload?: any; in_reply_to?: string }>,
  startSeq: number,
  ts: number,
) {
  const stmts: D1PreparedStatement[] = [];
  const rows: any[] = [];
  let seq = startSeq;
  for (const item of events) {
    const id = crypto.randomUUID();
    stmts.push(env.DB.prepare(
      `INSERT INTO events (id, user_id, session_id, seq, kind, payload_json, in_reply_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, userId, sessionId, seq, item.kind, JSON.stringify(item.payload ?? {}), item.in_reply_to ?? null, ts));
    rows.push({
      id, session_id: sessionId, seq, kind: item.kind,
      payload: item.payload ?? {}, in_reply_to: item.in_reply_to ?? null, created_at: ts,
    });
    seq += 1;
  }
  await env.DB.batch(stmts);
  return rows;
}
