import type { Hono } from 'hono';
import { presence } from '../service/hub';
import type { AppVariables, Env } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountPresenceApi(app: App) {
  app.get('/api/presence', async (c) => {
    return c.json(await presence(c.env, c.get('userId')));
  });
}
