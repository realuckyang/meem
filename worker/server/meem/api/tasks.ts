import * as tasks from '../services/tasks';
import { json, readJson, type RouteCtx } from '../http';

/** 任务列表 · 增删改查 · id 走查询参数(?id=) */
async function handle({ p, method, req, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'tasks') return json({ error: 'not found' }, 404);
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json({ items: await tasks.list(repo, url.searchParams.get('status') || undefined) });
  if (method === 'POST') {
    const r = await tasks.create(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'PUT' && id) { await tasks.update(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await tasks.remove(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}

export { handle as tasks };
