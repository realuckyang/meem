import type { Env } from '../../types';
import { createUser, getUser, hasUser, publicUser, signToken, verifyPassword } from '../auth';
import { json, readJson } from '../http';

/** 公共路由(鉴权之前):auth/status · auth/setup · auth/login */
export async function authPublic(env: Env, p: string, method: string, req: Request): Promise<Response | null> {
  if (p === 'auth/status' && method === 'GET') return json({ configured: await hasUser(env) });

  if (p === 'auth/setup' && method === 'POST') {
    if (await hasUser(env)) return json({ error: 'already_configured' }, 409);
    const b = await readJson(req);
    const password = String(b.password || '');
    if (password.length < 8) return json({ error: 'password_too_short' }, 400);
    const user = await createUser(env, password, String(b.name || 'Meem'));
    return json({ token: await signToken(user), user: publicUser(user) });
  }

  if (p === 'auth/login' && method === 'POST') {
    const b = await readJson(req);
    const user = await getUser(env);
    if (!user) return json({ error: 'not_configured' }, 409);
    if (!(await verifyPassword(String(b.password || ''), user.salt, user.hash))) return json({ error: 'unauthorized' }, 401);
    return json({ token: await signToken(user), user: publicUser(user) });
  }

  return null;
}
