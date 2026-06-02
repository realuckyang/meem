import * as content from '../services/content';
import { json, readJson, type RouteCtx } from '../http';

/** 对外内容:动态 / 文章 / 项目 · id 走查询参数(?id=) */
async function handle({ p, method, req, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'content') return json({ error: 'not found' }, 404);
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json({ items: await content.list(repo, url.searchParams.get('kind') || undefined) });
  if (method === 'POST') {
    const r = await content.create(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'PUT' && id) { await content.update(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await content.remove(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}

export { handle as content };
