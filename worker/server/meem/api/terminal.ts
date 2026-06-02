import * as terminal from '../services/terminal';
import { json, readJson, type RouteCtx } from '../http';

/** 终端命令片段 · id 走查询参数(?id=) */
async function handle({ p, method, req, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'terminal/snippets') return json({ error: 'not found' }, 404);
  const id = url.searchParams.get('id') || '';

  if (method === 'GET') return json(await terminal.listSnippets(repo));
  if (method === 'POST') {
    const r = await terminal.createSnippet(repo, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'PUT' && id) {
    const r = await terminal.updateSnippet(repo, id, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (method === 'DELETE' && id) return json(await terminal.deleteSnippet(repo, id));
  return json({ error: 'not found' }, 404);
}

export { handle as terminal };
