import { newId, now } from '../lib/id';
import { normalizeCwd, safeParse } from '../lib/normalize';
import { listConversationHistory } from '../repository/messages';
import { loadMemoriesForUser } from '../repository/memories';
import {
  insertEvents,
  insertUserEvent,
  listEvents,
  listPastTurns,
  nextEventSeq,
} from '../repository/events';
import {
  createDirectSession,
  deleteSession,
  loadDispatchSession,
  loadSession,
  markSessionThinking,
  patchSession,
} from '../repository/sessions';
import { loadSettings } from '../repository/settings';
import type { DispatchSession, Env } from '../types';
import { notifyHub } from './hub';

export async function getSessionDetail(env: Env, userId: string, id: string) {
  const session = await loadSession(env, userId, id);
  if (!session) return null;
  const events = await listEvents(env, userId, id);
  return {
    session,
    events: (events as any[]).map((event) => ({
      ...event,
      payload: safeParse(event.payload_json),
    })),
  };
}

export async function createDirectChat(env: Env, userId: string, body: { text?: string; cwd?: string }) {
  const text = body.text?.trim() || '';
  const cwd = normalizeCwd(body.cwd);
  const sessionId = newId();
  const ts = now();
  const status = text ? 'thinking' : 'done';
  await createDirectSession(env, {
    id: sessionId,
    userId,
    status,
    title: text.slice(0, 80) || null,
    cwd,
    ts,
    finishedAt: text ? null : ts,
  });
  await notifyHub(env, userId, { type: 'session-started', session: {
    id: sessionId, user_id: userId, kind: 'direct_chat', status, title: text.slice(0, 80) || null,
    cwd, created_at: ts, updated_at: ts, finished_at: text ? null : ts,
  }});
  if (text) {
    await appendUserMessageAndDispatch(env, {
      id: sessionId,
      user_id: userId,
      kind: 'direct_chat',
      title: text.slice(0, 80) || null,
      conversation_id: null,
      trigger_message_id: null,
      cwd,
    }, text);
  }
  return sessionId;
}

export async function appendTurn(env: Env, userId: string, sessionId: string, text: string) {
  const session = await loadDispatchSession(env, userId, sessionId);
  if (!session) return null;
  if (!text.trim()) throw new Error('text required');
  return appendUserMessageAndDispatch(env, session, text.trim());
}

async function appendUserMessageAndDispatch(env: Env, session: DispatchSession, text: string) {
  const settings = await loadSettings(env, session.user_id);
  const memories = await loadMemoriesForUser(env, session.user_id);
  const sessionId = session.id;
  const userId = session.user_id;
  const ts = now();
  const eventId = newId();
  const seq = await nextEventSeq(env, sessionId);
  const title = session.title || text.slice(0, 80);

  const past = await listPastTurns(env, userId, sessionId);
  const pastTurns = past
    .map((row) => ({
      role: row.kind === 'agent_message' ? 'assistant' : 'user',
      actor: row.kind === 'agent_message'
        ? (session.kind === 'message_agent' ? 'codex_internal' : 'codex')
        : (session.kind === 'message_agent' ? 'owner' : 'user'),
      label: row.kind === 'agent_message'
        ? (session.kind === 'message_agent' ? 'Codex 内部回复' : 'Codex')
        : (session.kind === 'message_agent' ? '用户内部追问' : '用户'),
      content: safeParse(row.payload_json).text || '',
    }))
    .filter((turn) => turn.content);

  let turns: any[] = [...pastTurns, { role: 'user', content: text }];
  let contact: { name: string; address: string } | undefined;
  if (session.kind === 'message_agent' && session.conversation_id) {
    const conversation = await env.DB.prepare(
      `SELECT t.contact_id, c.name AS contact_name, c.address AS contact_address
       FROM conversations t LEFT JOIN contacts c ON c.id = t.contact_id
       WHERE t.id = ? AND t.user_id = ?`,
    ).bind(session.conversation_id, userId).first<{
      contact_id: string | null;
      contact_name: string | null;
      contact_address: string | null;
    }>();
    const conversationHistory = await listConversationHistory(env, userId, session.conversation_id);
    const firstInbound = conversationHistory.find((item) => item.direction === 'inbound');
    const contactName = conversation?.contact_name || firstInbound?.sender_name || '访客';
    contact = {
      name: contactName,
      address: conversation?.contact_address || firstInbound?.sender_address || '',
    };
    const conversationTurns = conversationHistory.map((item) => ({
      role: item.direction === 'outbound' ? 'assistant' : 'user',
      actor: item.direction === 'outbound' ? 'sent_to_contact' : 'external_contact',
      label: item.direction === 'outbound'
        ? '已发给外部联系人的回复'
        : `外部联系人 ${item.sender_name || contactName} 的消息`,
      content: item.body,
    }));
    turns = [
      ...conversationTurns,
      ...pastTurns,
      {
        role: 'user',
        actor: 'owner',
        label: '用户当前内部追问',
        content: text,
        instruction: '请围绕这封外部消息直接回答用户本人。这不是外部联系人的新消息，不要输出可直接发送给对方的回复，除非用户明确要求改写草稿。',
      },
    ];
  }

  await markSessionThinking(env, userId, sessionId, text.slice(0, 80), ts);
  await insertUserEvent(env, { id: eventId, userId, sessionId, seq, text, ts });

  await notifyHub(env, userId, { type: 'session-status', session_id: sessionId,
    status: 'thinking', updated_at: ts, finished_at: null });
  await notifyHub(env, userId, { type: 'session-event', session_id: sessionId, event: {
    id: eventId, session_id: sessionId, seq, kind: 'user_message',
    payload: { text }, in_reply_to: null, created_at: ts,
  }});

  const triggerMessageId = session.kind === 'message_agent'
    ? (session.trigger_message_id || eventId)
    : 'direct';

  await notifyHub(env, userId, {
    type: 'agent-task',
    task: {
      session_id: sessionId,
      kind: session.kind,
      mode: session.kind === 'message_agent' ? settings.mode_message_agent : settings.mode_direct,
      owner_id: userId,
      peer_id: null,
      conversation_id: session.conversation_id,
      message_id: session.trigger_message_id,
      cwd: session.cwd || null,
      contact,
      trigger: { content: text, sender_id: userId, created_at: ts },
      prompt: settings.prompt,
      memories,
      interaction: session.kind === 'message_agent' ? 'internal_discussion' : 'direct_chat',
      history: [],
      turns,
      trigger_message_id: triggerMessageId,
      title,
    },
  });
  return eventId;
}

export async function addSessionEvents(
  env: Env,
  userId: string,
  sessionId: string,
  events: Array<{ kind: string; payload?: any; in_reply_to?: string }>,
) {
  const own = await loadSession(env, userId, sessionId);
  if (!own) return null;
  const ts = now();
  const startSeq = await nextEventSeq(env, sessionId);
  const rows = await insertEvents(env, userId, sessionId, events, startSeq, ts);
  await Promise.all(rows.map((row) =>
    notifyHub(env, userId, { type: 'session-event', session_id: sessionId, event: row })
  ));
  return rows;
}

export async function removeSession(env: Env, userId: string, sessionId: string) {
  const deleted = await deleteSession(env, userId, sessionId);
  if (deleted) await notifyHub(env, userId, { type: 'session-deleted', session_id: sessionId });
  return deleted;
}

export async function updateSession(env: Env, userId: string, sessionId: string, body: { status?: string; codex_thread_id?: string; title?: string | null }) {
  const ts = now();
  const updated = await patchSession(env, userId, sessionId, body, ts);
  if (!updated) return null;
  const status = body.status || '';
  const broadcasts = [notifyHub(env, userId, { type: 'session-status', session_id: sessionId,
    status: (updated as any)?.status, title: (updated as any)?.title,
    finished_at: (updated as any)?.finished_at, updated_at: (updated as any)?.updated_at })];
  if (status === 'cancelled') {
    broadcasts.push(notifyHub(env, userId, { type: 'agent-cancel', session_id: sessionId }));
  }
  await Promise.all(broadcasts);
  return updated;
}
