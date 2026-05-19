import type { Hono } from 'hono';
import { now } from '../lib/id';
import { normalizeAddress, normalizeName } from '../lib/normalize';
import {
  createOrUpdateContact,
  deleteContact,
  listContacts,
  loadContactById,
  patchContact,
} from '../repository/contacts';
import { notifyHub } from '../service/hub';
import type { AppVariables, Env } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountContactsApi(app: App) {
  app.get('/api/contacts', async (c) => {
    return c.json(await listContacts(c.env, c.get('userId')));
  });

  app.post('/api/contacts', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ name?: string; address?: string; note?: string }>()
      .catch(() => ({} as { name?: string; address?: string; note?: string }));
    const name = normalizeName(body.name, '');
    const address = normalizeAddress(body.address || '');
    const note = String(body.note || '').trim().slice(0, 500);
    if (!name || !address) return c.json({ error: 'name and address required' }, 400);
    const contact = await createOrUpdateContact(c.env, userId, { name, address, note }, now());
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-updated', contact }));
    return c.json(contact);
  });

  app.patch('/api/contacts/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const body = await c.req.json<{ name?: string; address?: string; note?: string }>()
      .catch(() => ({} as { name?: string; address?: string; note?: string }));
    const cleaned = {
      ...(typeof body.name === 'string' ? { name: normalizeName(body.name, '') } : {}),
      ...(typeof body.address === 'string' ? { address: normalizeAddress(body.address) } : {}),
      ...(typeof body.note === 'string' ? { note: String(body.note).slice(0, 500) } : {}),
    };
    const ok = await patchContact(c.env, userId, id, cleaned, now());
    if (!ok) return c.json({ error: 'not found' }, 404);
    const contact = await loadContactById(c.env, userId, id);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-updated', contact }));
    return c.json(contact);
  });

  app.delete('/api/contacts/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    if (!await deleteContact(c.env, userId, id)) return c.json({ error: 'not found' }, 404);
    c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-deleted', id }));
    return c.json({ ok: true });
  });
}
