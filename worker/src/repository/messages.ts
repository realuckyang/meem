import { newId } from '../lib/id';
import type { Env } from '../types';

export async function insertMessage(
  env: Env,
  userId: string,
  conversationId: string,
  contactId: string | null,
  direction: 'inbound' | 'outbound',
  senderName: string,
  senderAddress: string,
  body: string,
  ts: number,
) {
  const id = newId();
  await env.DB.prepare(
    `INSERT INTO messages (id, user_id, conversation_id, contact_id, direction, sender_name, sender_address, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, userId, conversationId, contactId, direction, senderName, senderAddress, body, ts).run();
  return env.DB.prepare(
    `SELECT id, conversation_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM messages WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
}

export async function listMessages(env: Env, userId: string, conversationId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, conversation_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC, id ASC`,
  ).bind(conversationId, userId).all();
  return rs.results || [];
}

export async function listPublicMessages(env: Env, userId: string, conversationId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, direction, sender_name, body, created_at
     FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC, id ASC`,
  ).bind(conversationId, userId).all();
  return rs.results || [];
}

export async function loadInboundMessage(env: Env, userId: string, conversationId: string, messageId?: string) {
  if (messageId) {
    return env.DB.prepare(
      `SELECT id FROM messages
       WHERE id = ? AND conversation_id = ? AND user_id = ? AND direction = 'inbound'`,
    ).bind(messageId, conversationId, userId).first<{ id: string }>();
  }
  return env.DB.prepare(
    `SELECT id FROM messages
     WHERE conversation_id = ? AND user_id = ? AND direction = 'inbound'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).bind(conversationId, userId).first<{ id: string }>();
}

export async function loadMessageForAgent(env: Env, userId: string, messageId: string) {
  return env.DB.prepare(
    `SELECT id, conversation_id, direction, sender_name, sender_address, body, created_at
     FROM messages WHERE id = ? AND user_id = ? AND direction = 'inbound'`,
  ).bind(messageId, userId).first<{
    id: string;
    conversation_id: string;
    direction: 'inbound';
    sender_name: string;
    sender_address: string;
    body: string;
    created_at: number;
  }>();
}

export async function listMessageHistory(env: Env, userId: string, conversationId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, direction, sender_name, body, created_at
     FROM messages WHERE conversation_id = ? AND user_id = ?
     ORDER BY created_at ASC, id ASC LIMIT 20`,
  ).bind(conversationId, userId).all<{
    id: string;
    direction: 'inbound' | 'outbound';
    sender_name: string;
    body: string;
    created_at: number;
  }>();
  return rs.results || [];
}

export async function listConversationHistory(env: Env, userId: string, conversationId: string) {
  const rs = await env.DB.prepare(
    `SELECT direction, sender_name, sender_address, body, created_at
     FROM messages WHERE conversation_id = ? AND user_id = ?
     ORDER BY created_at ASC, id ASC LIMIT 20`,
  ).bind(conversationId, userId).all<{
    direction: 'inbound' | 'outbound';
    sender_name: string;
    sender_address: string;
    body: string;
    created_at: number;
  }>();
  return rs.results || [];
}
