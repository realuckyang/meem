import type { Hono } from 'hono';
import { listUsers, loadUserById } from '../repository/users';
import { publicProfile } from '../service/profile';
import type { AppVariables, Env } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountMeApi(app: App) {
  app.get('/api/me', async (c) => {
    const userId = c.get('userId');
    const user = await loadUserById(c.env, userId);
    if (!user) return c.json({ error: 'not found' }, 404);
    const profile = await publicProfile(c.env, new URL(c.req.url).origin, user.handle);
    return c.json({
      id: user.id,
      name: profile?.name || user.name || user.handle,
      baseUrl: new URL(c.req.url).origin,
      publicAddress: profile?.address || '',
    });
  });

  app.get('/api/users', async (c) => {
    const origin = new URL(c.req.url).origin;
    const users = await listUsers(c.env);
    return c.json(users.map((user) => ({
      ...user,
      publicAddress: `${origin}/u/${encodeURIComponent(user.handle)}`,
    })));
  });
}
