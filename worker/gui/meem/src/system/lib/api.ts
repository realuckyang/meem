export interface Chat { id: string; title: string; category: string; status: string; preview: string; parent: string | null; created: number; updated: number; }
export interface Msg { id: string; chat_id: string | null; message: any; meta: any; created: number; }
export interface TerminalSnippet { id: string; name: string; command: string; autoSend: boolean; position: number; }

async function J<T>(p: Promise<Response>): Promise<T> { const r = await p; return r.json() as Promise<T>; }
const parse = (v: any) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const hydrate = (m: any): Msg => ({ ...m, message: parse(m.message), meta: parse(m.meta) });
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const put = (url: string, body: unknown) => fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const del = (url: string) => fetch(url, { method: 'DELETE' });
const API = '/meem/api';

export const api = {
  list: () => J<{ chats: Chat[] }>(fetch(`${API}/chats`)),
  detail: (id: string) => J<{ chat: Chat | null; messages: any[] }>(fetch(`${API}/chats/` + id))
    .then((d) => ({ chat: d.chat, messages: d.messages.map(hydrate) })),
  newChat: (title: string) => J<{ chat: { id: string; title: string } }>(post(`${API}/chats`, { title })),
  send: (id: string, text: string) => post(`${API}/chats/${id}/send`, { text }),
  rename: (id: string, title: string) => post(`${API}/chats/${id}/send`, { _noop: true, title }), // 预留
  decide: (id: string, chosen: string) => post(`${API}/decisions/${id}/decide`, { chosen }),
  snippets: () => J<{ snippets: TerminalSnippet[] }>(fetch(`${API}/terminal/snippets`)),
  createSnippet: (body: { name: string; command: string; autoSend: boolean }) => J<{ snippet: TerminalSnippet }>(post(`${API}/terminal/snippets`, body)),
  updateSnippet: (id: string, body: Partial<{ name: string; command: string; autoSend: boolean; position: number }>) => put(`${API}/terminal/snippets/${id}`, body),
  deleteSnippet: (id: string) => del(`${API}/terminal/snippets/${id}`),
  settings: () => J<Record<string, any>>(fetch(`${API}/settings`)),
  saveSettings: (b: Record<string, unknown>) => put(`${API}/settings`, b),
};
