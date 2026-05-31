import type { Env } from '../../types';
import { makeRepo } from '../repository';
import * as settings from '../services/settings';
import * as terminal from '../services/terminal';
import { authorize, createUser, getUser, hasUser, publicUser, signToken, verifyPassword } from '../auth';

const UID = 'me';
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const readJson = async (req: Request): Promise<any> => { try { return await req.json(); } catch { return {}; } };

// 聊天 / 会话 / 决策全部走 WS(见 server/meem/ws/room.ts);REST 只保留 auth、安装、终端片段、设置。
export async function handleApi(req: Request, env: Env, url: URL, _ctx: ExecutionContext): Promise<Response> {
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

  // ── 对外内容(动态/文章/项目) ──
  if (p === 'content' && method === 'GET') return json({ items: await repo.listContent(url.searchParams.get('kind') || undefined) });
  if (p === 'content' && method === 'POST') {
    const b = await readJson(req);
    if (!String(b.kind || '').trim() || !String(b.title || '').trim()) return json({ error: 'kind_and_title_required' }, 400);
    return json({ item: await repo.createContent({ kind: b.kind, title: b.title, body: b.body, url: b.url, tags: b.tags, status: b.status, pinned: b.pinned ? 1 : 0 }) });
  }
  if ((mm = p.match(/^content\/([^/]+)$/)) && method === 'PUT') {
    const b = await readJson(req);
    await repo.updateContent(mm[1], { kind: b.kind, title: b.title, body: b.body, url: b.url, tags: b.tags, status: b.status, pinned: b.pinned === undefined ? undefined : (b.pinned ? 1 : 0) });
    return json({ ok: true });
  }
  if ((mm = p.match(/^content\/([^/]+)$/)) && method === 'DELETE') { await repo.deleteContent(mm[1]); return json({ ok: true }); }

  // ── 文档(私有) ──
  if (p === 'docs/notebooks' && method === 'GET') return json({ notebooks: await repo.docNotebooks() });
  if (p === 'docs/notebooks' && method === 'POST') { const b = await readJson(req); if (!String(b.name || '').trim()) return json({ error: 'name_required' }, 400); return json({ notebook: await repo.docCreateNotebook({ name: b.name, parentId: b.parentId ?? null, icon: b.icon }) }); }
  if ((mm = p.match(/^docs\/notebooks\/([^/]+)$/)) && method === 'PUT') { const b = await readJson(req); await repo.docRenameNotebook(mm[1], String(b.name || '')); return json({ ok: true }); }
  if ((mm = p.match(/^docs\/notebooks\/([^/]+)$/)) && method === 'DELETE') { await repo.docDeleteNotebook(mm[1]); return json({ ok: true }); }
  if (p === 'docs/pages' && method === 'GET') return json({ pages: await repo.docPagesList(url.searchParams.get('notebook') || null) });
  if (p === 'docs/pages' && method === 'POST') { const b = await readJson(req); return json({ page: await repo.docCreatePage({ notebookId: b.notebookId ?? null, title: String(b.title || '新页面') }) }); }
  if ((mm = p.match(/^docs\/pages\/([^/]+)$/)) && method === 'GET') { const pg = await repo.docGetPage(mm[1]); return pg ? json({ page: pg }) : json({ error: 'not_found' }, 404); }
  if ((mm = p.match(/^docs\/pages\/([^/]+)$/)) && method === 'PUT') { const b = await readJson(req); await repo.docUpdatePage(mm[1], { title: b.title, content: b.content, icon: b.icon }); return json({ ok: true }); }
  if ((mm = p.match(/^docs\/pages\/([^/]+)$/)) && method === 'DELETE') { await repo.docDeletePage(mm[1]); return json({ ok: true }); }

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
