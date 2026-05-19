// 这个文件只放共享的东西：
//   - 类型定义（接口契约）
//   - auth（localStorage token）
//   - req() / pub()（通用请求 · 自动加鉴权 · 自动 dispatch 错误）
//   - openSocket / pushTokenToLocalServer / emitMeem
//
// 具体的 endpoint URL / body 拼装都放到调用方，不要再做"api.xxx() 包一层"了。

const TOKEN_KEY = 'meem.token';
const ACCOUNT_KEY = 'meem.account';

// ============ 类型契约 ============
export type Mode = 'observe' | 'approval' | 'managed';
export type SessionStatus =
  | 'thinking' | 'awaiting_approval' | 'awaiting_input'
  | 'done' | 'cancelled' | 'errored';

export type Session = {
  id: string;
  kind: 'direct_chat' | 'message_agent';
  status: SessionStatus;
  title: string | null;
  conversation_id?: string | null;
  trigger_message_id?: string | null;
  codex_thread_id?: string | null;
  cwd?: string | null;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
};

export type AgentEvent = {
  id: string;
  session_id: string;
  seq?: number;
  kind: string;
  payload: any;
  in_reply_to: string | null;
  created_at: number;
};

export type Presence = {
  sessions: Array<{
    id: string;
    kind: 'web' | 'desktop';
    capabilities: {
      client: boolean;
      codex: boolean;
      codexVersion?: string;
      codexLoggedIn?: boolean;
      bridgeVersion?: string;
      bridgeStartedAt?: number;
      os?: string;
      hostname?: string;
    };
  }>;
};

export type Settings = {
  prompt: string;
  public_messages_enabled: boolean;
  mode_direct: Mode;
  mode_message_agent: Mode;
  updated_at?: number;
};

export type Inclusion = 'must_read' | 'starred' | 'stored';
export type Memory = {
  id: string;
  title: string;
  summary: string;
  content: string;
  inclusion: Inclusion;
  created_at: number;
  updated_at: number;
};

export type Contact = {
  id: string;
  name: string;
  address: string;
  note: string;
  created_at: number;
  updated_at: number;
  last_contact_at: number | null;
};

export type DomainUser = {
  id: string;
  handle: string;
  name: string;
  publicAddress: string;
  created_at: number;
  updated_at: number;
};

export type Conversation = {
  id: string;
  public_token?: string;
  contact_id: string | null;
  title: string;
  status: 'open' | 'replied' | 'archived';
  unread_count: number;
  last_message_preview: string;
  created_at: number;
  updated_at: number;
  contact_name: string | null;
  contact_address: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  contact_id: string | null;
  direction: 'inbound' | 'outbound';
  sender_name: string;
  sender_address: string;
  body: string;
  created_at: number;
};

export type Me = {
  id: string;
  name: string;
  baseUrl: string;
  publicAddress: string;
};

export type PublicProfile = {
  handle: string;
  name: string;
  address: string;
};

export type PublicConversation = {
  conversation: {
    id: string;
    title: string;
    status: 'open' | 'replied' | 'archived';
    last_message_preview: string;
    created_at: number;
    updated_at: number;
  };
  messages: Array<{
    id: string;
    direction: 'inbound' | 'outbound';
    sender_name: string;
    body: string;
    created_at: number;
  }>;
};

// ============ auth ============
export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  account: () => localStorage.getItem(ACCOUNT_KEY) || 'owner',
  set: (token: string, account?: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    if (account) localStorage.setItem(ACCOUNT_KEY, account);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  },
};

// ============ 通用请求 ============
async function send<T>(path: string, init: RequestInit, withAuth: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth) {
    const token = auth.token();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error || response.statusText || `HTTP ${response.status}`;
    try {
      window.dispatchEvent(new CustomEvent('meem:error', { detail: { message, status: response.status } }));
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/** 带 Bearer token 的请求；非 2xx 抛错并 dispatch `meem:error`。 */
export function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  return send<T>(path, init, true);
}

/** 不带鉴权（公开个人主页、公开回执等）。 */
export function pub<T>(path: string, init: RequestInit = {}): Promise<T> {
  return send<T>(path, init, false);
}

// ============ WS ============
export function openSocket(): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(auth.token() || '')}`);
}

// ============ 跨组件信令 ============
export function emitMeem(event: string, detail?: any) {
  try { window.dispatchEvent(new CustomEvent(event, { detail })); } catch {}
}

// ============ Tauri local bridge ============
declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  }
}

export function pushTokenToLocalServer() {
  const invoke = window.__TAURI__?.core?.invoke;
  const token = auth.token();
  if (!invoke || !token) return;
  invoke('local_bridge_get', {
    path: '/api/auth',
    method: 'POST',
    body: JSON.stringify({ token }),
  }).catch(() => {});
}
