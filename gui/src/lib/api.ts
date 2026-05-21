import { API_BASE } from './env';
const BASE = API_BASE;

let _token = localStorage.getItem('meem_token') ?? '';

export function setToken(t: string) {
  _token = t;
  localStorage.setItem('meem_token', t);
}

export function clearToken() {
  _token = '';
  localStorage.removeItem('meem_token');
}

export function hasToken() {
  return !!_token;
}

export async function req<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw Object.assign(new Error(body?.error ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// ── typed helpers ──────────────────────────────────────────────────────────

export interface Me {
  id: string;
  handle: string;
  name: string;
  bio: string;
  settings: Settings;
}

export interface Settings {
  uid: string;
  prompt: string;
  public: number;
  mode: 'auto' | 'review';
  url: string;
  key: string;
  model: string;
  max_rounds: number;
  tool_max_chars: number;
}

export interface Conversation {
  id: string;
  preview: string;
  updated: number;
  created: number;
  unread: number;
  peer?: string;
}

export interface Message {
  id: string;
  cid: string;
  sender: string;
  body: string;
  created: number;
}

export interface Session {
  id: string;
  uid: string;
  kind: 'direct' | 'agent';
  status: 'thinking' | 'approval' | 'input' | 'done' | 'cancelled' | 'error';
  title: string | null;
  trigger: string | null;
  created: number;
  updated: number;
  finished: number | null;
}

export interface MemoryItem {
  id: string;
  uid: string;
  title: string;
  summary: string;
  content: string;
  priority: 'must' | 'starred' | 'stored';
  created: number;
  updated: number;
}

export interface User {
  id: string;
  handle: string;
  name: string;
  bio?: string;
}
