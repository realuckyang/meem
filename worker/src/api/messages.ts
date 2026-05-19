import type { Hono } from 'hono';
import { now } from '../lib/id';
import { deleteConversation, listConversations, loadConversation, markConversationRead, updateConversationStatus } from '../repository/conversations';
import { listMessages, loadInboundMessage } from '../repository/messages';
import { notifyHub } from '../service/hub';
import { dispatchMessageAgentTask } from '../service/messageAgent';
import { openConversation, replyToConversation, sendMessage } from '../service/messages';
import type { AppVariables, Env, SendMessageInput } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountMessagesApi(app: App) {
  app.get('/api/messages/conversations', async (c) => {
    return c.json(await listConversations(c.env, c.get('userId')));
  });

  app.post('/api/messages/conversations', async (c) => {
    const body = await c.req.json<{ address?: string; contact_name?: string }>()
      .catch(() => ({} as { address?: string; contact_name?: string }));
    try {
      return c.json({ conversation: await openConversation(c.env, c.get('userId'), new URL(c.req.url).origin, body) });
    } catch (err: any) {
      return c.json({ error: err?.message || 'failed' }, 400);
    }
  });

  app.post('/api/messages/send', async (c) => {
    const body = await c.req.json<SendMessageInput>().catch(() => ({} as SendMessageInput));
    try {
      return c.json(await sendMessage(c.env, c.get('userId'), new URL(c.req.url).origin, body));
    } catch (err: any) {
      const message = err?.message || 'failed';
      const status = message === 'user not found' ? 404 : message.includes('暂未') ? 403 : 400;
      return c.json({ error: message }, status);
    }
  });

  app.get('/api/messages/conversations/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const conversation = await loadConversation(c.env, userId, id);
    if (!conversation) return c.json({ error: 'not found' }, 404);
    const messages = await listMessages(c.env, userId, id);
    await markConversationRead(c.env, userId, id);
    return c.json({ conversation: { ...(conversation as any), unread_count: 0 }, messages });
  });

  app.patch('/api/messages/conversations/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = await c.req.json<{ status?: string }>()
      .catch(() => ({} as { status?: string }));
    const valid = ['open', 'replied', 'archived'];
    if (!body.status || !valid.includes(body.status)) return c.json({ error: 'status required' }, 400);
    if (!await updateConversationStatus(c.env, userId, id, body.status, now())) return c.json({ error: 'not found' }, 404);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'conversation-updated', id, status: body.status }));
    return c.json({ ok: true, id, status: body.status });
  });

  app.delete('/api/messages/conversations/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    if (!await deleteConversation(c.env, userId, id)) return c.json({ error: 'not found' }, 404);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'conversation-deleted', id }));
    return c.json({ ok: true });
  });

  app.post('/api/messages/conversations/:id/process', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = await c.req.json<{ message_id?: string }>().catch(() => ({} as { message_id?: string }));
    const message = await loadInboundMessage(c.env, userId, id, body.message_id);
    if (!message) return c.json({ error: 'inbound message not found' }, 404);
    await dispatchMessageAgentTask(c.env, userId, id, message.id);
    return c.json({ ok: true, message_id: message.id });
  });

  app.post('/api/messages/conversations/:id/reply', async (c) => {
    const body = await c.req.json<{ text?: string }>().catch(() => ({} as { text?: string }));
    try {
      const message = await replyToConversation(c.env, c.get('userId'), new URL(c.req.url).origin, c.req.param('id'), String(body.text || ''));
      return c.json({ message });
    } catch (err: any) {
      const message = err?.message || 'failed';
      return c.json({ error: message }, message === 'not found' ? 404 : 400);
    }
  });
}
