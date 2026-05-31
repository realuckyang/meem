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
  snippets: () => J<{ snippets: TerminalSnippet[] }>(get(`${API}/terminal/snippets`)),
  createSnippet: (body: { name: string; command: string; autoSend: boolean }) => J<{ snippet: TerminalSnippet }>(post(`${API}/terminal/snippets`, body)),
  updateSnippet: (id: string, body: Partial<{ name: string; command: string; autoSend: boolean; position: number }>) => put(`${API}/terminal/snippets/${id}`, body),
  deleteSnippet: (id: string) => del(`${API}/terminal/snippets/${id}`),
  settings: () => J<Record<string, any>>(get(`${API}/settings`)),
  saveSettings: (b: Record<string, unknown>) => put(`${API}/settings`, b),
  contentList: (kind?: string) => J<{ items: ContentItem[] }>(get(`${API}/content${kind ? `?kind=${kind}` : ''}`)),
  contentCreate: (b: Partial<ContentItem>) => J<{ item: ContentItem }>(post(`${API}/content`, b)),
  contentUpdate: (id: string, b: Partial<ContentItem>) => put(`${API}/content/${id}`, b),
  contentDelete: (id: string) => del(`${API}/content/${id}`),
  docsNotebooks: () => J<{ notebooks: DocNotebook[] }>(get(`${API}/docs/notebooks`)),
  docsPages: (nb: string | null) => J<{ pages: DocPageMeta[] }>(get(`${API}/docs/pages${nb ? `?notebook=${encodeURIComponent(nb)}` : ''}`)),
  docsPage: (id: string) => J<{ page: DocPage }>(get(`${API}/docs/pages/${id}`)),
  docsCreateNotebook: (b: { name: string; parentId?: string | null }) => J<{ notebook: DocNotebook }>(post(`${API}/docs/notebooks`, b)),
  docsRenameNotebook: (id: string, name: string) => put(`${API}/docs/notebooks/${id}`, { name }),
  docsDeleteNotebook: (id: string) => del(`${API}/docs/notebooks/${id}`),
  docsCreatePage: (b: { notebookId: string | null; title: string }) => J<{ page: DocPage }>(post(`${API}/docs/pages`, b)),
  docsUpdatePage: (id: string, b: Partial<{ title: string; content: string }>) => put(`${API}/docs/pages/${id}`, b),
  docsDeletePage: (id: string) => del(`${API}/docs/pages/${id}`),
};

export interface DocNotebook { id: string; parent_id: string | null; name: string; icon: string | null; sort_order: number; created: number; updated: number; }
export interface DocPageMeta { id: string; notebook_id: string | null; title: string; icon: string | null; sort_order: number; updated: number; }
export interface DocPage extends DocPageMeta { content: string; created: number; }

export interface ContentItem {
  id: string; site_uid: string; kind: 'dynamic' | 'article' | 'project';
  title: string; body: string; url: string; tags: string;
  status: 'draft' | 'published'; pinned: number; created: number; updated: number;
}
