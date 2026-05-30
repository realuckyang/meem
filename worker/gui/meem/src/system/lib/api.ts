export interface Chat { id: string; title: string; category: string; status: string; preview: string; parent: string | null; created: number; updated: number; }
export interface Msg { id: string; chat_id: string | null; message: any; meta: any; created: number; }
export interface TerminalSnippet { id: string; name: string; command: string; autoSend: boolean; position: number; }

const TOKEN_KEY = 'meem_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function J<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.error || r.statusText), { status: r.status, data });
  return data as T;
}
const parse = (v: any) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const hydrate = (m: any): Msg => ({ ...m, message: parse(m.message), meta: parse(m.meta) });
const API = '/meem/api';
const headers = () => ({ 'content-type': 'application/json', ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) });
const get = (url: string) => fetch(url, { headers: headers() });
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
const put = (url: string, body: unknown) => fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
const del = (url: string) => fetch(url, { method: 'DELETE', headers: headers() });

export const api = {
  authStatus: () => J<{ configured: boolean }>(fetch(`${API}/auth/status`)),
  setup: (body: { password: string; name?: string }) => J<{ token: string; user: any }>(post(`${API}/auth/setup`, body)),
  login: (body: { password: string }) => J<{ token: string; user: any }>(post(`${API}/auth/login`, body)),
  me: () => J<{ user: any }>(get(`${API}/me`)),
  installConfig: () => J<{ baseUrl: string; wsUrl: string; token: string }>(get(`${API}/install/config`)),
  list: () => J<{ chats: Chat[] }>(get(`${API}/chats`)),
  detail: (id: string) => J<{ chat: Chat | null; messages: any[] }>(get(`${API}/chats/` + id))
    .then((d) => ({ chat: d.chat, messages: d.messages.map(hydrate) })),
  newChat: (title: string) => J<{ chat: { id: string; title: string } }>(post(`${API}/chats`, { title })),
  send: (id: string, text: string) => post(`${API}/chats/${id}/send`, { text }),
  rename: (id: string, title: string) => post(`${API}/chats/${id}/send`, { _noop: true, title }), // 预留
  decide: (id: string, chosen: string) => post(`${API}/decisions/${id}/decide`, { chosen }),
  snippets: () => J<{ snippets: TerminalSnippet[] }>(get(`${API}/terminal/snippets`)),
  createSnippet: (body: { name: string; command: string; autoSend: boolean }) => J<{ snippet: TerminalSnippet }>(post(`${API}/terminal/snippets`, body)),
  updateSnippet: (id: string, body: Partial<{ name: string; command: string; autoSend: boolean; position: number }>) => put(`${API}/terminal/snippets/${id}`, body),
  deleteSnippet: (id: string) => del(`${API}/terminal/snippets/${id}`),
  settings: () => J<Record<string, any>>(get(`${API}/settings`)),
  saveSettings: (b: Record<string, unknown>) => put(`${API}/settings`, b),
};
