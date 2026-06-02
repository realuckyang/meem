import * as notes from '../services/notes';
import { json, readJson, type RouteCtx } from '../http';

/** 随手记 · 增删改查 · id 走查询参数(?id=)· 搜索走 ?q= */
async function handle({ p, method, req, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'notes') return json({ error: 'not found' }, 404);
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json({ items: await notes.list(repo, url.searchParams.get('q') || undefined) });
  if (method === 'POST') {
    const r = await notes.create(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'PUT' && id) { await notes.update(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await notes.remove(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}

export { handle as notes };
