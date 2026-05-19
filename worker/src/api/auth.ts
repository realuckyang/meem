import type { Hono } from 'hono';
import { normalizeHandle } from '../lib/normalize';
import { signToken } from '../lib/password';
import { createUser, authenticatePassword } from '../service/auth';
import { loadUserByHandle, usersCount } from '../repository/users';
import type { AppVariables, Env } from '../types';

type App = Hono<{ Bindings: Env; Variables: AppVariables }>;

export function mountAuthApi(app: App) {
  app.get('/api/auth/status', async (c) => {
    return c.json({
      initialized: await usersCount(c.env) > 0,
      account: '',
    });
  });

  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json<{ account?: string; password?: string }>()
      .catch(() => ({} as { account?: string; password?: string }));
    const account = normalizeHandle(body.account);
    const password = String(body.password || '');
    if (!account || !password) return c.json({ error: 'account and password required' }, 400);
    if (account.length > 80 || password.length > 200) return c.json({ error: 'account or password too long' }, 400);
    const user = await authenticatePassword(c.env, account, password);
    if (!user) return c.json({ error: 'account or password is incorrect' }, 401);
    return c.json({ token: await signToken(user), account: user.handle, initialized: true, created: false });
  });

  app.post('/api/auth/register', async (c) => {
    const body = await c.req.json<{ account?: string; password?: string }>()
      .catch(() => ({} as { account?: string; password?: string }));
    const account = normalizeHandle(body.account);
    const password = String(body.password || '');
    if (!account || !password) return c.json({ error: 'account and password required' }, 400);
    if (account.length > 40 || password.length > 200) return c.json({ error: 'account or password too long' }, 400);
    if (await loadUserByHandle(c.env, account)) return c.json({ error: 'account already exists' }, 409);
    const user = await createUser(c.env, account, password);
    return c.json({ token: await signToken(user), account: user.handle, initialized: true, created: true });
  });
}
