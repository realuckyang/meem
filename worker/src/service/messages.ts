import { now, newId } from '../lib/id';
import { messagePreview, normalizeAddress, normalizeName } from '../lib/normalize';
import { upsertContact } from '../repository/contacts';
import {
  findOpenConversationByContact,
  loadConversation,
  updateConversationPreview,
  upsertConversation,
} from '../repository/conversations';
import { insertMessage } from '../repository/messages';
import { loadSettings } from '../repository/settings';
import { loadUserById } from '../repository/users';
import type { Env, SendMessageInput } from '../types';
import { notifyHub } from './hub';
import { loadUserByPublicAddress, publicProfile } from './profile';
import { dispatchMessageAgentTask } from './messageAgent';

export async function openConversation(env: Env, userId: string, origin: string, body: { address?: string; contact_name?: string }) {
  const address = normalizeAddress(body.address);
  if (!address) throw new Error('address required');
  const peer = await loadUserByPublicAddress(env, origin, address);
  const name = normalizeName(body.contact_name, peer?.name || peer?.handle || '联系人');
  const ts = now();
  const contactId = await upsertContact(env, userId, name, address, ts);
  const existing = await findOpenConversationByContact(env, userId, contactId);
  const conversationRef = existing || await upsertConversation(env, userId, contactId, name, '', false, ts);
  const conversation = await loadConversation(env, userId, conversationRef.id);
  await notifyHub(env, userId, { type: 'conversation-message', conversation });
  return conversation;
}

export async function sendMessage(env: Env, userId: string, origin: string, body: SendMessageInput) {
  const address = normalizeAddress(body.address);
  const text = String(body.text || '').trim();
  if (!address) throw new Error('address required');
  if (!text) throw new Error('text required');
  if (text.length > 4000) throw new Error('text too long');

  const owner = await loadUserById(env, userId);
  const ownerProfile = owner ? await publicProfile(env, origin, owner.handle) : null;
  if (!ownerProfile) throw new Error('user not found');

  const peer = await loadUserByPublicAddress(env, origin, address);
  if (!peer) throw new Error('只能发送到 Meem 地址');
  if (peer.id === userId) throw new Error('不能发送给自己');

  const peerSettings = await loadSettings(env, peer.id);
  if (!peerSettings.public_messages_enabled) throw new Error('对方暂未接收消息');

  const ts = now();
  const preview = messagePreview(text);
  const peerProfile = await publicProfile(env, origin, peer.handle);
  const contactName = normalizeName(body.contact_name, peerProfile?.name || peer.handle);
  const senderContactId = await upsertContact(env, userId, contactName, address, ts);
  const senderConversationRef = await upsertConversation(env, userId, senderContactId, contactName, preview, false, ts);
  const senderMessage = await insertMessage(
    env, userId, senderConversationRef.id, senderContactId, 'outbound',
    ownerProfile.name, address, text, ts,
  );
  const senderConversation = await loadConversation(env, userId, senderConversationRef.id);

  const peerContactId = await upsertContact(env, peer.id, ownerProfile.name, ownerProfile.address, ts);
  const peerConversationRef = await upsertConversation(env, peer.id, peerContactId, ownerProfile.name, preview, true, ts);
  const peerMessage = await insertMessage(
    env, peer.id, peerConversationRef.id, peerContactId, 'inbound',
    ownerProfile.name, ownerProfile.address, text, ts,
  );
  const peerConversation = await loadConversation(env, peer.id, peerConversationRef.id);

  await Promise.all([
    notifyHub(env, userId, { type: 'conversation-message', conversation: senderConversation, message: senderMessage }),
    notifyHub(env, peer.id, { type: 'conversation-message', conversation: peerConversation, message: peerMessage }),
    dispatchMessageAgentTask(env, peer.id, peerConversationRef.id, (peerMessage as any).id),
  ]);

  return { conversation: senderConversation, message: senderMessage };
}

export async function replyToConversation(env: Env, userId: string, origin: string, conversationId: string, text: string) {
  const conversation = await loadConversation(env, userId, conversationId) as any;
  if (!conversation) throw new Error('not found');
  const body = text.trim();
  if (!body) throw new Error('text required');
  if (body.length > 4000) throw new Error('text too long');
  const ts = now();
  const messageId = newId();
  const preview = messagePreview(body);
  const owner = await loadUserById(env, userId);
  const ownerProfile = owner ? await publicProfile(env, origin, owner.handle) : null;
  await env.DB.prepare(
    `INSERT INTO messages (id, user_id, conversation_id, contact_id, direction, sender_name, sender_address, body, created_at)
     VALUES (?, ?, ?, ?, 'outbound', 'Meem', ?, ?, ?)`,
  ).bind(messageId, userId, conversationId, conversation.contact_id, conversation.contact_address || '', body, ts).run();
  await updateConversationPreview(env, userId, conversationId, preview, ts);
  const message = await env.DB.prepare(
    `SELECT id, conversation_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM messages WHERE id = ? AND user_id = ?`,
  ).bind(messageId, userId).first();
  const broadcasts: Promise<unknown>[] = [
    notifyHub(env, userId, { type: 'conversation-message', conversation_id: conversationId, message }),
  ];
  const peer = conversation.contact_address
    ? await loadUserByPublicAddress(env, origin, conversation.contact_address)
    : null;
  if (peer && ownerProfile && peer.id !== userId) {
    const peerContactId = await upsertContact(env, peer.id, ownerProfile.name, ownerProfile.address, ts);
    const peerConversationRef = await upsertConversation(env, peer.id, peerContactId, preview.slice(0, 80) || '新的消息', preview, true, ts);
    const peerMessage = await insertMessage(
      env, peer.id, peerConversationRef.id, peerContactId, 'inbound',
      ownerProfile.name, ownerProfile.address, body, ts,
    );
    const peerConversation = await loadConversation(env, peer.id, peerConversationRef.id);
    broadcasts.push(
      notifyHub(env, peer.id, { type: 'conversation-message', conversation: peerConversation, message: peerMessage }),
      dispatchMessageAgentTask(env, peer.id, peerConversationRef.id, (peerMessage as any).id),
    );
  }
  await Promise.all(broadcasts);
  return message;
}
