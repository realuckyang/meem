import * as docs from '../../services/docs';
import { json, readJson, type RouteCtx } from '../../http';

/** 笔记本 · id 走查询参数(?id=) */
export async function notebooks({ method, req, url, repo }: RouteCtx): Promise<Response> {
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json({ notebooks: await docs.notebooks(repo) });
  if (method === 'POST') {
    const b = await readJson(req);
    if (!String(b.name || '').trim()) return json({ error: 'name_required' }, 400);
    return json({ notebook: await docs.createNotebook(repo, b) });
  }
  if (method === 'PUT' && id) { await docs.updateNotebook(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await docs.deleteNotebook(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}
