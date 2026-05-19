import type { Context, Next } from 'hono';
import { authorized } from '../service/auth';
import type { AppVariables, Env } from '../types';

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export async function requireAuth(c: AppContext, next: Next) {
  const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const user = await authorized(c.env, auth);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', user.id);
  await next();
}
