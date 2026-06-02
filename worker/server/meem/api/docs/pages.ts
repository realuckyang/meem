import * as docs from '../../services/docs';
import { json, readJson, type RouteCtx } from '../../http';

/** 页面 · id / notebook 走查询参数(?id= / ?notebook=) */
export async function pages({ method, req, url, repo }: RouteCtx): Promise<Response> {
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') {
    if (id) {
      const pg = await docs.getPage(repo, id);
      return pg ? json({ page: pg }) : json({ error: 'not_found' }, 404);
    }
    return json({ pages: await docs.pages(repo, url.searchParams.get('notebook') || null) });
  }
  if (method === 'POST') return json({ page: await docs.createPage(repo, await readJson(req)) });
  if (method === 'PUT' && id) { await docs.updatePage(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await docs.deletePage(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}
