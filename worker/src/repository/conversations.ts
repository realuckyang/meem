import { newId, randomHex } from '../lib/id';
import type { Env } from '../types';

export async function upsertConversation(
  env: Env,
  userId: string,
  contactId: string,
  title: string,
  preview: string,
  incoming: boolean,
  ts: number,
) {
  const existing = await env.DB.prepare(
    `SELECT id, public_token FROM conversations
     WHERE user_id = ? AND contact_id = ? AND status != 'archived'
     ORDER BY updated_at DESC LIMIT 1`,
  ).bind(userId, contactId).first<{ id: string; public_token: string }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE conversations SET status = ?, unread_count = CASE WHEN ? THEN unread_count + 1 ELSE 0 END,
         last_message_preview = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(incoming ? 'open' : 'replied', incoming ? 1 : 0, preview, ts, existing.id, userId).run();
    return existing;
  }

  const id = newId();
  const publicToken = randomHex(24);
  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, public_token, contact_id, title, status, unread_count, last_message_preview, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, userId, publicToken, contactId, title, incoming ? 'open' : 'replied', incoming ? 1 : 0, preview, ts, ts).run();
  return { id, public_token: publicToken };
}

export async function loadConversation(env: Env, userId: string, conversationId: string) {
  return env.DB.prepare(
    `SELECT t.id, t.public_token, t.contact_id, t.title, t.status, t.unread_count, t.last_message_preview,
            t.created_at, t.updated_at, c.name AS contact_name, c.address AS contact_address
     FROM conversations t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(conversationId, userId).first();
}

export async function listConversations(env: Env, userId: string) {
  const rs = await env.DB.prepare(
    `SELECT t.id, t.public_token, t.contact_id, t.title, t.status, t.unread_count, t.last_message_preview,
            t.created_at, t.updated_at, c.name AS contact_name, c.address AS contact_address
     FROM conversations t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC LIMIT 200`,
  ).bind(userId).all();
  return rs.results || [];
}

export async function findOpenConversationByContact(env: Env, userId: string, contactId: string) {
  return env.DB.prepare(
    `SELECT id FROM conversations
     WHERE user_id = ? AND contact_id = ? AND status != 'archived'
     ORDER BY updated_at DESC LIMIT 1`,
  ).bind(userId, contactId).first<{ id: string }>();
}

export async function loadConversationByToken(env: Env, token: string) {
  return env.DB.prepare(
    `SELECT id, user_id, title, status, last_message_preview, created_at, updated_at
     FROM conversations WHERE public_token = ?`,
  ).bind(token).first();
}

export async function markConversationRead(env: Env, userId: string, conversationId: string) {
  await env.DB.prepare(
    `UPDATE conversations SET unread_count = 0 WHERE id = ? AND user_id = ?`,
  ).bind(conversationId, userId).run();
}

export async function updateConversationStatus(env: Env, userId: string, id: string, status: string, ts: number) {
  const r = await env.DB.prepare(
    `UPDATE conversations SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
  ).bind(status, ts, id, userId).run();
  return Boolean(r.meta?.changes);
}

export async function updateConversationPreview(env: Env, userId: string, id: string, preview: string, ts: number) {
  await env.DB.prepare(
    `UPDATE conversations SET status = 'replied', unread_count = 0, last_message_preview = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
  ).bind(preview, ts, id, userId).run();
}

export async function deleteConversation(env: Env, userId: string, id: string) {
  const r = await env.DB.batch([
    env.DB.prepare('DELETE FROM messages WHERE conversation_id = ? AND user_id = ?').bind(id, userId),
    env.DB.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').bind(id, userId),
  ]);
  return Boolean(r[1]?.meta?.changes);
}
