import { Hono } from 'hono';
import { mountAuthApi } from '../api/auth';
import { mountContactsApi } from '../api/contacts';
import { mountMeApi } from '../api/me';
import { mountMemoriesApi } from '../api/memories';
import { mountMessagesApi } from '../api/messages';
import { mountPresenceApi } from '../api/presence';
import { mountPublicApi } from '../api/public';
import { mountSessionsApi } from '../api/sessions';
import { mountSettingsApi } from '../api/settings';
import { authorized } from '../service/auth';
import { hubStub } from '../service/hub';
import type { AppVariables, Env } from '../types';
import { requireAuth } from './auth';

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

  app.get('/api/health', (c) => c.json({ ok: true, app: 'meem' }));

  mountAuthApi(app);
  mountPublicApi(app);

  app.use('/api/*', requireAuth);

  mountMeApi(app);
  mountContactsApi(app);
  mountMemoriesApi(app);
  mountMessagesApi(app);
  mountSettingsApi(app);
  mountPresenceApi(app);
  mountSessionsApi(app);

  app.get('/ws', async (c) => {
    const token = c.req.query('token') ?? '';
    const user = await authorized(c.env, token);
    if (!user) return c.text('unauthorized', 401);
    const url = new URL(c.req.url);
    url.searchParams.set('user', user.id);
    return hubStub(c.env).fetch(new Request(url.toString(), c.req.raw));
  });

  app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}
