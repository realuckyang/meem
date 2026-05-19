import type { Hono } from 'hono';
import { listSessions } from '../repository/sessions';
import {
  addSessionEvents,
  appendTurn,
  createDirectChat,
  getSessionDetail,
  removeSession,
  updateSession,
} from '../service/sessions';
import type { AppVariables, Env } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountSessionsApi(app: App) {
  app.get('/api/sessions', async (c) => {
    return c.json(await listSessions(c.env, c.get('userId'), {
      kind: c.req.query('kind') || '',
      conversationId: c.req.query('conversation_id') || '',
    }));
  });

  app.get('/api/sessions/:id', async (c) => {
    const detail = await getSessionDetail(c.env, c.get('userId'), c.req.param('id'));
    if (!detail) return c.json({ error: 'not found' }, 404);
    return c.json(detail);
  });

  app.post('/api/sessions/direct', async (c) => {
    const body = await c.req.json<{ text?: string; cwd?: string }>()
      .catch(() => ({} as { text?: string; cwd?: string }));
    return c.json({ session_id: await createDirectChat(c.env, c.get('userId'), body) });
  });

  app.post('/api/sessions/:id/turn', async (c) => {
    const { text } = await c.req.json<{ text: string }>();
    try {
      const eventId = await appendTurn(c.env, c.get('userId'), c.req.param('id'), text || '');
      if (!eventId) return c.json({ error: 'not found' }, 404);
      return c.json({ event_id: eventId });
    } catch (err: any) {
      return c.json({ error: err?.message || 'text required' }, 400);
    }
  });

  app.post('/api/sessions/:id/events', async (c) => {
    const body = await c.req.json<{
      events: Array<{ kind: string; payload?: any; in_reply_to?: string }>;
    }>();
    if (!Array.isArray(body.events) || !body.events.length) return c.json({ error: 'events required' }, 400);
    const rows = await addSessionEvents(c.env, c.get('userId'), c.req.param('id'), body.events);
    if (!rows) return c.json({ error: 'not found' }, 404);
    return c.json({ inserted: rows.length });
  });

  app.delete('/api/sessions/:id', async (c) => {
    if (!await removeSession(c.env, c.get('userId'), c.req.param('id'))) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true });
  });

  app.patch('/api/sessions/:id', async (c) => {
    const body = await c.req.json<{ status?: string; codex_thread_id?: string; title?: string | null }>()
      .catch(() => ({} as { status?: string; codex_thread_id?: string; title?: string | null }));
    const updated = await updateSession(c.env, c.get('userId'), c.req.param('id'), body);
    if (!updated) return c.json({ error: 'not found' }, 404);
    return c.json(updated);
  });
}
