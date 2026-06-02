import { publicUser } from '../auth';
import { json, type RouteCtx } from '../http';

/** 账户:me · install/config */
export async function account({ p, method, req, url, user }: RouteCtx): Promise<Response> {
  if (p === 'me' && method === 'GET') return json({ user: publicUser(user) });

  if (p === 'install/config' && method === 'GET') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
    const base = `${url.protocol}//${url.host}`;
    const ws = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
    return json({ baseUrl: base, wsUrl: ws, token });
  }

  return json({ error: 'not found' }, 404);
}
