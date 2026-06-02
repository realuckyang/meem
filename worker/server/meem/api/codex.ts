import { json, type RouteCtx } from '../http';

/** Codex 会话历史 · 按 thread_id 读归一化事件(?thread=) */
async function handle({ p, method, url, repo }: RouteCtx): Promise<Response> {
  if (p !== 'codex/events') return json({ error: 'not found' }, 404);
  if (method !== 'GET') return json({ error: 'not found' }, 404);
  const threadId = url.searchParams.get('thread') || '';
  if (!threadId) return json({ events: [] });
  const rows = await repo.listCodexEvents(threadId);
  return json({ events: rows.map((r) => ({ id: r.id, kind: r.kind, ...safe(r.payload), created: r.created })) });
}

function safe(s: string): any { try { return JSON.parse(s); } catch { return { text: '' }; } }

export { handle as codex };
