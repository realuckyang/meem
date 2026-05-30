import type { Env } from '../../types';
import { makeRepo } from '../repository';
import * as chats from '../services/chats';
import * as decisions from '../services/decisions';
import * as settings from '../services/settings';
import * as terminal from '../services/terminal';
import { authorize, createUser, getUser, hasUser, publicUser, signToken, verifyPassword } from '../auth';

const UID = 'me';
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const readJson = async (req: Request): Promise<any> => { try { return await req.json(); } catch { return {}; } };

/** 通知 Room DO 跑某条会话(serialize + WS 流式) */
async function trigger(env: Env, chat: string | null): Promise<void> {
  const stub = env.ROOM.get(env.ROOM.idFromName(UID));
  await stub.fetch(`https://room/trigger?uid=${UID}`, { method: 'POST', body: JSON.stringify({ chat }) });
}

export async function handleApi(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const p = url.pathname.replace(/^\/meem\/api\//, '');
  const method = req.method;
  let mm: RegExpMatchArray | null;

  // ── auth ──
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

  const user = await authorize(req, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const repo = makeRepo(env, UID);

  if (p === 'me' && method === 'GET') return json({ user: publicUser(user) });
  if (p === 'install/config' && method === 'GET') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
    const base = `${url.protocol}//${url.host}`;
    const ws = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
    return json({ baseUrl: base, wsUrl: ws, token });
  }

  // ── chats / 看板 ──
  if (p === 'chats' && method === 'GET') return json(await chats.board(repo));
  if (p === 'chats' && method === 'POST') { const b = await readJson(req); const r = await chats.create(repo, b); if (b.purpose) ctx.waitUntil(trigger(env, r.id)); return json({ chat: r }); }
  if ((mm = p.match(/^chats\/([^/]+)$/)) && method === 'GET') return json(await chats.detail(repo, mm[1]));
  if ((mm = p.match(/^chats\/([^/]+)\/send$/)) && method === 'POST') {
    const b = await readJson(req);
    await repo.addMessage({ chatId: mm[1], message: { role: 'user', content: String(b.text ?? '') } });
    ctx.waitUntil(trigger(env, mm[1]));
    return json({ ok: true });
  }
  if (p === 'send' && method === 'POST') {
    const b = await readJson(req);
    await repo.addMessage({ chatId: null, message: { role: 'user', content: String(b.text ?? '') } });
    ctx.waitUntil(trigger(env, null));
    return json({ ok: true });
  }

  // ── decisions ──
  if (p === 'decisions' && method === 'GET') return json({ decisions: await decisions.open(repo) });
  if ((mm = p.match(/^decisions\/([^/]+)\/decide$/)) && method === 'POST') {
    const b = await readJson(req);
    const chatId = await decisions.decide(repo, mm[1], String(b.chosen ?? ''));
    if (chatId) ctx.waitUntil(trigger(env, chatId));
    return json({ ok: true });
  }

  // ── terminal snippets ──
  if (p === 'terminal/snippets' && method === 'GET') return json(await terminal.listSnippets(repo));
  if (p === 'terminal/snippets' && method === 'POST') {
    const r = await terminal.createSnippet(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if ((mm = p.match(/^terminal\/snippets\/([^/]+)$/)) && method === 'PUT') {
    const r = await terminal.updateSnippet(repo, mm[1], await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if ((mm = p.match(/^terminal\/snippets\/([^/]+)$/)) && method === 'DELETE') return json(await terminal.deleteSnippet(repo, mm[1]));

  // ── settings(连接状态走 WS connection.status,不走 REST) ──
  if (p === 'settings' && method === 'GET') return json(await settings.get(repo));
  if (p === 'settings' && method === 'PUT') { await settings.update(repo, await readJson(req)); return json({ ok: true }); }

  return json({ error: 'not found' }, 404);
}
