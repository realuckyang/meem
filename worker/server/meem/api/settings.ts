import * as settings from '../services/settings';
import { json, readJson, type RouteCtx } from '../http';

/** 设置(模型配置等;连接状态走 WS,不在此) */
async function handle({ p, method, req, repo }: RouteCtx): Promise<Response> {
  if (p === 'settings' && method === 'GET') return json(await settings.get(repo));
  if (p === 'settings' && method === 'PUT') { await settings.update(repo, await readJson(req)); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}

export { handle as settings };
