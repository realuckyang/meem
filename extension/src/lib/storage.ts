import { defaultSettings } from '../ai/providers';
import type { ChatMessage, ChatSettings } from '../ai/types';

const SETTINGS_KEY = 'meem.settings';
const MESSAGES_KEY = 'meem.messages';
const ITEMS_KEY = 'meem.items';
const TOKEN_KEY = 'meem.auth.token';
const ACCOUNT_KEY = 'meem.auth.account';
const API_ORIGIN = 'https://meem-extension.chatnext.ai';
const IDB_NAME = 'meem-extension-store';
const IDB_STORE = 'kv';

export type ItemStatus = 'working' | 'ready' | 'error';
export type ItemKind = 'agent' | 'message';

export interface TimelineItem {
  id: string;
  kind: ItemKind;
  title: string;
  summary: string;
  status: ItemStatus;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  contactName?: string;
  contactAddress?: string;
}

export interface DomainUser {
  id: string;
  account: string;
  name: string;
  description: string;
}

export interface ProfileRecord {
  displayName: string;
  description: string;
  updatedAt?: number;
}

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get(key);
    const stored = data[key] as T | undefined;
    if (stored !== undefined) return stored;
  }
  if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
    const value = await idbGet<T>(key);
    return value ?? fallback;
  }
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
    await idbSet(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

async function removeLocal(key: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove(key);
    return;
  }
  if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
    await idbDelete(key);
    return;
  }
  localStorage.removeItem(key);
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.token();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const url = typeof location !== 'undefined' && location.protocol === 'chrome-extension:'
    ? `${API_ORIGIN}${path}`
    : path;
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) await auth.clear();
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  users: () => request<DomainUser[]>('/api/users'),
  profile: () => request<ProfileRecord>('/api/profile'),
  saveProfile: (profile: Pick<ProfileRecord, 'displayName' | 'description'>) => request<ProfileRecord>(
    '/api/profile',
    { method: 'PUT', body: JSON.stringify(profile) },
  ),
};

export const auth = {
  token: () => getLocal<string>(TOKEN_KEY, ''),
  account: () => getLocal<string>(ACCOUNT_KEY, ''),
  set: async (token: string, account: string) => {
    await setLocal(TOKEN_KEY, token);
    await setLocal(ACCOUNT_KEY, account);
  },
  clear: async () => {
    await removeLocal(TOKEN_KEY);
    await removeLocal(ACCOUNT_KEY);
  },
  login: async (account: string, password: string, register = false) => {
    const result = await request<{ token: string; account: string }>(
      register ? '/api/auth/register' : '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ account, password }) },
    );
    await auth.set(result.token, result.account);
    return result;
  },
  claimPairCode: async (code: string) => {
    const result = await request<{ token: string; account: string }>(
      '/api/pair/claim',
      { method: 'POST', body: JSON.stringify({ code }) },
    );
    await auth.set(result.token, result.account);
    return result;
  },
  createPairCode: () => request<{ code: string; expires_at: number }>(
    '/api/pair/create',
    { method: 'POST', body: JSON.stringify({}) },
  ),
  me: () => request<{ id: string; account: string }>('/api/me'),
};

export async function loadSettings(): Promise<ChatSettings> {
  return { ...defaultSettings, ...(await getLocal<Partial<ChatSettings>>(SETTINGS_KEY, {})) };
}

export async function saveSettings(settings: ChatSettings): Promise<void> {
  await setLocal(SETTINGS_KEY, settings);
}

export async function loadMessages(): Promise<ChatMessage[]> {
  return getLocal<ChatMessage[]>(MESSAGES_KEY, []);
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  await setLocal(MESSAGES_KEY, messages);
}

export async function loadItems(): Promise<TimelineItem[]> {
  const token = await auth.token();
  if (token) return request<TimelineItem[]>('/api/items');
  return getLocal<TimelineItem[]>(ITEMS_KEY, []);
}

export async function saveItems(items: TimelineItem[]): Promise<void> {
  const token = await auth.token();
  if (token) {
    await request('/api/items', { method: 'PUT', body: JSON.stringify({ items }) });
    return;
  }
  await setLocal(ITEMS_KEY, items);
}
