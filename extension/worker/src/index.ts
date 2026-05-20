export interface Env {
  AVATAR: DurableObjectNamespace;
  DB: D1Database;
  ASSETS?: Fetcher;
}

interface AvatarMessage {
  id: string;
  text: string;
  senderName: string;
  senderAccount?: string;
  createdAt: number;
}

interface StoredMessage extends AvatarMessage {
  reply?: string;
  repliedAt?: number;
}

interface UserRow {
  id: string;
  account: string;
  password_salt: string;
  password_hash: string;
  auth_secret: string;
}

interface ProfileRow {
  display_name: string;
  description: string;
  updated_at: number;
}

const encoder = new TextEncoder();

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    ...(init.headers || {}),
  },
});

const text = (body: string, init: ResponseInit = {}) => new Response(body, {
  ...init,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    ...(init.headers || {}),
  },
});

const readJson = async <T>(request: Request): Promise<T> => {
  try {
    return await request.json<T>();
  } catch {
    return {} as T;
  }
};

const randomId = () => crypto.randomUUID();
const now = () => Date.now();

function normalizeAccount(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '').slice(0, 40);
}

function b64url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === 'string'
    ? encoder.encode(input)
    : input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(textValue: string) {
  return b64url(await crypto.subtle.digest('SHA-256', encoder.encode(textValue)));
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

async function hashPassword(password: string, salt: string) {
  return sha256(`${salt}:${password}`);
}

async function signToken(user: UserRow) {
  const payload = b64url(JSON.stringify({
    sub: user.id,
    account: user.account,
    exp: now() + 1000 * 60 * 60 * 24 * 90,
  }));
  const sig = await hmac(user.auth_secret, payload);
  return `${payload}.${sig}`;
}

async function loadUserByAccount(env: Env, account: string) {
  return env.DB.prepare('SELECT * FROM users WHERE account = ?').bind(account).first<UserRow>();
}

async function loadUserById(env: Env, id: string) {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

async function authorized(env: Env, request: Request) {
  const raw = request.headers.get('Authorization') || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  let body: { sub?: string; exp?: number };
  try {
    body = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
  if (!body.sub || !body.exp || body.exp < now()) return null;
  const user = await loadUserById(env, body.sub);
  if (!user) return null;
  const expected = await hmac(user.auth_secret, payload);
  return expected === signature ? user : null;
}

async function handleRegister(env: Env, request: Request) {
  const body = await readJson<{ account?: string; password?: string }>(request);
  const account = normalizeAccount(body.account);
  const password = String(body.password || '');
  if (!account || password.length < 6) return json({ error: 'account and password required' }, { status: 400 });
  if (await loadUserByAccount(env, account)) return json({ error: 'account exists' }, { status: 409 });
  const user: UserRow = {
    id: randomId(),
    account,
    password_salt: randomId(),
    password_hash: '',
    auth_secret: randomId(),
  };
  user.password_hash = await hashPassword(password, user.password_salt);
  await env.DB.prepare(
    'INSERT INTO users (id, account, password_salt, password_hash, auth_secret, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(user.id, user.account, user.password_salt, user.password_hash, user.auth_secret, now()).run();
  return json({ token: await signToken(user), account });
}

async function handleLogin(env: Env, request: Request) {
  const body = await readJson<{ account?: string; password?: string }>(request);
  const account = normalizeAccount(body.account);
  const password = String(body.password || '');
  const user = account ? await loadUserByAccount(env, account) : null;
  if (!user) return json({ error: 'account or password is incorrect' }, { status: 401 });
  const hash = await hashPassword(password, user.password_salt);
  if (hash !== user.password_hash) return json({ error: 'account or password is incorrect' }, { status: 401 });
  return json({ token: await signToken(user), account: user.account });
}

async function handleCreatePairCode(env: Env, request: Request) {
  const user = await authorized(env, request);
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const codeHash = await sha256(code);
  const ts = now();
  await env.DB.prepare('DELETE FROM pair_codes WHERE user_id = ? OR expires_at < ?').bind(user.id, ts).run();
  await env.DB.prepare(
    'INSERT INTO pair_codes (code_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).bind(codeHash, user.id, ts + 5 * 60 * 1000, ts).run();
  return json({ code, expires_at: ts + 5 * 60 * 1000 });
}

async function handleClaimPairCode(env: Env, request: Request) {
  const body = await readJson<{ code?: string }>(request);
  const code = String(body.code || '').replace(/\D+/g, '').slice(0, 6);
  if (code.length !== 6) return json({ error: 'code required' }, { status: 400 });
  const codeHash = await sha256(code);
  const ts = now();
  const row = await env.DB.prepare(
    'SELECT user_id, expires_at FROM pair_codes WHERE code_hash = ?',
  ).bind(codeHash).first<{ user_id: string; expires_at: number }>();
  if (!row || row.expires_at < ts) {
    await env.DB.prepare('DELETE FROM pair_codes WHERE code_hash = ? OR expires_at < ?').bind(codeHash, ts).run();
    return json({ error: 'code expired' }, { status: 404 });
  }
  const user = await loadUserById(env, row.user_id);
  await env.DB.prepare('DELETE FROM pair_codes WHERE code_hash = ?').bind(codeHash).run();
  if (!user) return json({ error: 'user not found' }, { status: 404 });
  return json({ token: await signToken(user), account: user.account });
}

async function listRows(env: Env, table: 'items', userId: string) {
  const result = await env.DB.prepare(
    `SELECT payload_json FROM ${table} WHERE user_id = ? ORDER BY updated_at DESC`,
  ).bind(userId).all<{ payload_json: string }>();
  return result.results.map((row) => JSON.parse(row.payload_json));
}

async function replaceRows(env: Env, table: 'items', userId: string, values: any[]) {
  const ts = now();
  const statements = [
    env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId),
    ...values.map((value) => env.DB.prepare(
      `INSERT INTO ${table} (id, user_id, payload_json, updated_at) VALUES (?, ?, ?, ?)`,
    ).bind(String(value.id || randomId()), userId, JSON.stringify(value), Number(value.updatedAt || value.updated_at || ts))),
  ];
  await env.DB.batch(statements);
}

async function loadProfile(env: Env, userId: string) {
  const row = await env.DB.prepare(
    'SELECT display_name, description, updated_at FROM profiles WHERE user_id = ?',
  ).bind(userId).first<ProfileRow>();
  return {
    displayName: row?.display_name || '',
    description: row?.description || '',
    updatedAt: row?.updated_at || 0,
  };
}

async function saveProfile(env: Env, userId: string, body: { displayName?: string; description?: string }) {
  const displayName = String(body.displayName || '').trim().slice(0, 80);
  const description = String(body.description || '').trim().slice(0, 800);
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO profiles (user_id, display_name, description, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       description = excluded.description,
       updated_at = excluded.updated_at`,
  ).bind(userId, displayName, description, ts).run();
  return { displayName, description, updatedAt: ts };
}

function roomStub(env: Env, avatarId: string) {
  return env.AVATAR.get(env.AVATAR.idFromName(avatarId));
}

function roomRequest(request: Request, avatarId: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(request.url);
  url.pathname = path;
  url.searchParams.set('avatarId', avatarId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url.toString(), request);
}

export class AvatarRoom implements DurableObject {
  private state: DurableObjectState;
  private sockets = new Set<WebSocket>();
  private waiters = new Map<string, (message: StoredMessage) => void>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const avatarId = url.searchParams.get('avatarId') || '';

    if (!avatarId) return json({ error: 'avatarId required' }, { status: 400 });
    if (request.method === 'OPTIONS') return text('', { status: 204 });
    if (url.pathname === '/status') return json({ avatarId, online: this.sockets.size > 0, connections: this.sockets.size });
    if (url.pathname === '/ws') return this.handleWebSocket(request);
    if (url.pathname === '/message' && request.method === 'POST') return this.handleMessage(request, url);
    if (url.pathname === '/reply' && request.method === 'POST') return this.handleReply(request);
    if (url.pathname.startsWith('/message/') && request.method === 'GET') {
      const id = url.pathname.split('/').filter(Boolean)[1];
      const stored = await this.state.storage.get<StoredMessage>(`message:${id}`);
      if (!stored) return json({ error: 'not found' }, { status: 404 });
      return json({ message: stored });
    }
    return json({ error: 'not found' }, { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, { status: 426 });
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return json({ error: 'token required' }, { status: 401 });
    const storedToken = await this.state.storage.get<string>('token');
    if (storedToken && storedToken !== token) return json({ error: 'unauthorized' }, { status: 401 });
    if (!storedToken) await this.state.storage.put('token', token);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);
    server.send(JSON.stringify({ type: 'welcome', connectionId: randomId() }));
    server.addEventListener('message', (event) => {
      try {
        const frame = JSON.parse(String(event.data));
        if (frame?.type === 'hello') server.send(JSON.stringify({ type: 'ready', online: true }));
      } catch {}
    });
    server.addEventListener('close', () => this.sockets.delete(server));
    server.addEventListener('error', () => this.sockets.delete(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleMessage(request: Request, url: URL): Promise<Response> {
    const body = await readJson<{ text?: string; senderName?: string }>(request);
    const messageText = String(body.text || '').trim();
    if (!messageText) return json({ error: 'text required' }, { status: 400 });
    if (messageText.length > 4000) return json({ error: 'text too long' }, { status: 400 });
    const senderAccount = url.searchParams.get('senderAccount') || '';

    const message: StoredMessage = {
      id: randomId(),
      text: messageText,
      senderName: String(body.senderName || senderAccount).trim().slice(0, 80) || senderAccount,
      senderAccount,
      createdAt: Date.now(),
    };
    await this.state.storage.put(`message:${message.id}`, message);
    let delivered = 0;
    const frame = JSON.stringify({ type: 'avatar-message', message });
    for (const socket of this.sockets) {
      try {
        socket.send(frame);
        delivered += 1;
      } catch {}
    }
    if (url.searchParams.get('wait') === '1') {
      const result = await this.waitForReply(message.id, 60000);
      return json({ delivered, message: result });
    }
    return json({ delivered, message });
  }

  private async handleReply(request: Request): Promise<Response> {
    const body = await readJson<{ token?: string; messageId?: string; text?: string }>(request);
    const token = String(body.token || '');
    const storedToken = await this.state.storage.get<string>('token');
    if (!storedToken || token !== storedToken) return json({ error: 'unauthorized' }, { status: 401 });
    const messageId = String(body.messageId || '');
    const stored = await this.state.storage.get<StoredMessage>(`message:${messageId}`);
    if (!stored) return json({ error: 'not found' }, { status: 404 });
    const next: StoredMessage = { ...stored, reply: String(body.text || '').trim(), repliedAt: Date.now() };
    await this.state.storage.put(`message:${messageId}`, next);
    this.waiters.get(messageId)?.(next);
    this.waiters.delete(messageId);
    return json({ message: next });
  }

  private async waitForReply(messageId: string, timeoutMs: number): Promise<StoredMessage> {
    const existing = await this.state.storage.get<StoredMessage>(`message:${messageId}`);
    if (existing?.reply !== undefined) return existing;
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.waiters.delete(messageId);
        resolve((await this.state.storage.get<StoredMessage>(`message:${messageId}`)) as StoredMessage);
      }, timeoutMs);
      this.waiters.set(messageId, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return text('', { status: 204 });

    if (url.pathname === '/api/health') return json({ ok: true, app: 'meem-extension' });
    if (url.pathname === '/api/auth/register' && request.method === 'POST') return handleRegister(env, request);
    if (url.pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(env, request);
    if (url.pathname === '/api/pair/claim' && request.method === 'POST') return handleClaimPairCode(env, request);

    const match = url.pathname.match(/^\/api\/avatar\/([^/]+)(?:\/(.*))?$/);
    if (match) {
      const avatarId = decodeURIComponent(match[1]);
      const action = match[2] || 'status';
      if (action === 'message' && request.method === 'POST') {
        const sender = await authorized(env, request);
        if (!sender) return json({ error: 'unauthorized' }, { status: 401 });
        return roomStub(env, avatarId).fetch(roomRequest(request, avatarId, `/${action}`, { senderAccount: sender.account }));
      }
      return roomStub(env, avatarId).fetch(roomRequest(request, avatarId, `/${action}`));
    }

    if (url.pathname.startsWith('/api/')) {
      const user = await authorized(env, request);
      if (!user) return json({ error: 'unauthorized' }, { status: 401 });
      if (url.pathname === '/api/me') return json({ id: user.id, account: user.account });
      if (url.pathname === '/api/profile' && request.method === 'GET') return json(await loadProfile(env, user.id));
      if (url.pathname === '/api/profile' && request.method === 'PUT') {
        const body = await readJson<{ displayName?: string; description?: string }>(request);
        return json(await saveProfile(env, user.id, body));
      }
      if (url.pathname === '/api/users') {
        const rows = await env.DB.prepare(
          `SELECT users.id, users.account, profiles.display_name, profiles.description
           FROM users
           LEFT JOIN profiles ON profiles.user_id = users.id
           ORDER BY users.created_at DESC
           LIMIT 200`,
        ).all<{ id: string; account: string; display_name?: string; description?: string }>();
        return json(rows.results.map((row) => ({
          id: row.id,
          account: row.account,
          name: row.display_name || row.account,
          description: row.description || '',
        })));
      }
      if (url.pathname === '/api/pair/create' && request.method === 'POST') return handleCreatePairCode(env, request);
      if (url.pathname === '/api/items' && request.method === 'GET') return json(await listRows(env, 'items', user.id));
      if (url.pathname === '/api/items' && request.method === 'PUT') {
        const body = await readJson<{ items?: any[] }>(request);
        await replaceRows(env, 'items', user.id, Array.isArray(body.items) ? body.items : []);
        return json({ ok: true });
      }
      return json({ error: 'not found' }, { status: 404 });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: 'not found' }, { status: 404 });
  },
};
