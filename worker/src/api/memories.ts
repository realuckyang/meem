import type { Hono } from 'hono';
import { INCLUSIONS } from '../lib/constants';
import { now } from '../lib/id';
import {
  createMemory,
  deleteMemory,
  loadMemoriesForUser,
  loadMemory,
  patchMemory,
} from '../repository/memories';
import { notifyHub } from '../service/hub';
import type { AppVariables, Env, Inclusion } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountMemoriesApi(app: App) {
  app.get('/api/memories', async (c) => {
    return c.json(await loadMemoriesForUser(c.env, c.get('userId')));
  });

  app.post('/api/memories', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ title?: string; summary?: string; content?: string; inclusion?: string }>()
      .catch(() => ({} as { title?: string; summary?: string; content?: string; inclusion?: string }));
    const title = String(body.title || '').trim().slice(0, 120);
    if (!title) return c.json({ error: 'title required' }, 400);
    const inclusion: Inclusion = INCLUSIONS.includes(body.inclusion as Inclusion)
      ? (body.inclusion as Inclusion)
      : 'stored';
    const memory = await createMemory(c.env, userId, {
      title,
      summary: String(body.summary || '').slice(0, 500),
      content: String(body.content || '').slice(0, 8000),
      inclusion,
    }, now());
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-updated', memory }));
    return c.json(memory);
  });

  app.patch('/api/memories/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = await c.req.json<{ title?: string; summary?: string; content?: string; inclusion?: string }>()
      .catch(() => ({} as { title?: string; summary?: string; content?: string; inclusion?: string }));
    try {
      if (!await patchMemory(c.env, userId, id, body, now())) return c.json({ error: 'not found' }, 404);
    } catch (err: any) {
      return c.json({ error: err?.message || 'invalid memory' }, 400);
    }
    const memory = await loadMemory(c.env, userId, id);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-updated', memory }));
    return c.json(memory);
  });

  app.delete('/api/memories/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    if (!await deleteMemory(c.env, userId, id)) return c.json({ error: 'not found' }, 404);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-deleted', id }));
    return c.json({ ok: true });
  });
}
