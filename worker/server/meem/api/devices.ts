import * as devices from '../services/devices';
import { json, readJson, type RouteCtx } from '../http';

/** 设备 · 增删改查 · id 走查询参数(?id=) */
async function handle({ p, method, req, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'devices') return json({ error: 'not found' }, 404);
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json({ devices: await devices.list(repo) });
  if (method === 'POST') {
    const r = await devices.create(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'PUT' && id) { await devices.update(repo, id, await readJson(req)); return json({ ok: true }); }
  if (method === 'DELETE' && id) { await devices.remove(repo, id); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}

export { handle as devices };
