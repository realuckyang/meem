import type { Hono } from 'hono';
import { newId, now } from '../lib/id';
import { messagePreview, normalizeAddress, normalizeHandle, normalizeName } from '../lib/normalize';
import { upsertContact } from '../repository/contacts';
import { loadConversation, loadConversationByToken, upsertConversation } from '../repository/conversations';
import { insertMessage, listPublicMessages } from '../repository/messages';
import { loadSettings } from '../repository/settings';
import { publicProfile, loadUserByPublicAddress } from '../service/profile';
import { notifyHub } from '../service/hub';
import { dispatchMessageAgentTask } from '../service/messageAgent';
import type { AppVariables, Env, PublicMessageInput } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountPublicApi(app: App) {
  app.get('/api/public/profile/:handle', async (c) => {
    const profile = await publicProfile(c.env, new URL(c.req.url).origin, c.req.param('handle'));
    if (!profile) return c.json({ error: 'not found' }, 404);
    return c.json(profile);
  });

  app.post('/api/public/messages', async (c) => {
    const body = await c.req.json<PublicMessageInput>().catch(() => ({} as PublicMessageInput));
    const profile = await publicProfile(c.env, new URL(c.req.url).origin, normalizeHandle(body.handle));
    if (!profile || normalizeHandle(body.handle) !== profile.handle) {
      return c.json({ error: 'not found' }, 404);
    }
    const settings = await loadSettings(c.env, profile.id);
    if (!settings.public_messages_enabled) return c.json({ error: '消息暂未开放' }, 403);

    const text = String(body.text || '').trim();
    if (!text) return c.json({ error: 'text required' }, 400);
    if (text.length > 4000) return c.json({ error: 'text too long' }, 400);

    const origin = new URL(c.req.url).origin;
    const ts = now();
    const senderName = normalizeName(body.sender_name);
    const senderAddress = normalizeAddress(body.sender_address) || `anonymous:${newId()}`;
    const title = messagePreview(text).slice(0, 80) || '新的消息';
    const preview = messagePreview(text);

    const contactId = await upsertContact(c.env, profile.id, senderName, senderAddress, ts);
    const conversationRef = await upsertConversation(c.env, profile.id, contactId, title, preview, true, ts);
    const conversationId = conversationRef.id;
    const message = await insertMessage(
      c.env, profile.id, conversationId, contactId, 'inbound', senderName, senderAddress, text, ts,
    );

    const broadcasts: Promise<unknown>[] = [
      notifyHub(c.env, profile.id, { type: 'conversation-message', conversation: await loadConversation(c.env, profile.id, conversationId), message }),
      dispatchMessageAgentTask(c.env, profile.id, conversationId, (message as any).id),
    ];

    const senderUser = await loadUserByPublicAddress(c.env, origin, senderAddress);
    if (senderUser && senderUser.id !== profile.id) {
      const senderContactId = await upsertContact(c.env, senderUser.id, profile.name, profile.address, ts);
      const senderConversationRef = await upsertConversation(c.env, senderUser.id, senderContactId, title, preview, false, ts);
      const senderMessage = await insertMessage(
        c.env, senderUser.id, senderConversationRef.id, senderContactId, 'outbound',
        senderName, profile.address, text, ts,
      );
      const senderConversation = await loadConversation(c.env, senderUser.id, senderConversationRef.id);
      broadcasts.push(notifyHub(c.env, senderUser.id, { type: 'conversation-message', conversation: senderConversation, message: senderMessage }));
    }

    c.executionCtx.waitUntil(Promise.all(broadcasts));
    return c.json({
      ok: true,
      conversation_id: conversationId,
      message_id: (message as any).id,
      receipt_url: `${origin}/t/${conversationRef.public_token}`,
    });
  });

  app.get('/api/public/conversations/:token', async (c) => {
    const conversation = await loadConversationByToken(c.env, c.req.param('token'));
    if (!conversation) return c.json({ error: 'not found' }, 404);
    const messages = await listPublicMessages(c.env, (conversation as any).user_id, (conversation as any).id);
    const { user_id: _userId, ...publicConversation } = conversation as any;
    return c.json({ conversation: publicConversation, messages });
  });
}
