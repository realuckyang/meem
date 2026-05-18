import { Hono } from 'hono';
import { DurableObject } from 'cloudflare:workers';
import { decodeJwt, SignJWT, jwtVerify } from 'jose';

export interface Env {
  DB: D1Database;
  HUB: DurableObjectNamespace<Hub>;
  ASSETS: Fetcher;
}

const DEFAULT_PROMPT = '你是用户的 Meem 智能体。你运行在用户自己的电脑上，可以根据权限模式使用 Codex 处理任务。';
const VALID_MODES = ['observe', 'approval', 'managed'] as const;
type Mode = typeof VALID_MODES[number];
type AuthUser = {
  id: string;
  handle: string;
  name: string;
  password_salt: string | null;
  password_hash: string | null;
  auth_secret: string | null;
};
type PublicMessageInput = {
  handle?: string;
  sender_name?: string;
  sender_address?: string;
  text?: string;
};
type SessionKind = 'direct_chat' | 'inbox_reply';
type DispatchSession = {
  id: string;
  user_id: string;
  kind: SessionKind;
  title: string | null;
  inbox_thread_id: string | null;
  trigger_msg_id: string | null;
};

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
const hubStub = (env: Env) => env.HUB.get(env.HUB.idFromName('default'));
const newId = () => crypto.randomUUID();
const now = () => Math.floor(Date.now() / 1000);

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array | ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function passwordHash(password: string, salt: string) {
  return sha256Hex(`${salt}:${password}`);
}

async function loadUserByHandle(env: Env, handle: string): Promise<AuthUser | null> {
  return env.DB.prepare(
    `SELECT id, handle, name, password_salt, password_hash, auth_secret
     FROM users WHERE handle = ?`,
  ).bind(handle).first<AuthUser>();
}

async function loadUserById(env: Env, id: string): Promise<AuthUser | null> {
  return env.DB.prepare(
    `SELECT id, handle, name, password_salt, password_hash, auth_secret
     FROM users WHERE id = ?`,
  ).bind(id).first<AuthUser>();
}

async function usersCount(env: Env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  return Number(row?.count || 0);
}

function secretKey(secret: string) {
  return encoder.encode(secret);
}

async function signToken(user: AuthUser) {
  if (!user.auth_secret) throw new Error('auth secret missing');
  return new SignJWT({ handle: user.handle })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer('meem')
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey(user.auth_secret));
}

async function authorized(env: Env, raw: string): Promise<AuthUser | null> {
  if (!raw) return null;
  try {
    const decoded = decodeJwt(raw);
    const userId = String(decoded.sub || '');
    if (!userId) return null;
    const user = await loadUserById(env, userId);
    if (!user?.auth_secret) return null;
    const result = await jwtVerify(raw, secretKey(user.auth_secret), {
      issuer: 'meem',
      subject: user.id,
    });
    return result.payload.sub === user.id ? user : null;
  } catch {
    return null;
  }
}

async function requireAuth(c: any, next: any) {
  const auth = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const user = await authorized(c.env, auth);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', user.id);
  await next();
}

async function notifyHub(env: Env, userId: string, frame: unknown) {
  await hubStub(env).fetch('https://hub/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userId, frame }),
  });
}

async function loadSettings(env: Env, userId: string) {
  const row = await env.DB.prepare(
    'SELECT prompt, mode_direct FROM settings WHERE user_id = ?',
  ).bind(userId).first<{ prompt: string; mode_direct: Mode }>();
  return {
    prompt: row?.prompt || DEFAULT_PROMPT,
    mode_direct: row?.mode_direct || 'managed',
  };
}

function safeParse(raw: string) {
  try { return JSON.parse(raw); } catch { return {}; }
}

function normalizeAddress(value: unknown) {
  return String(value || '').trim().slice(0, 240);
}

function normalizeHandle(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
}

function normalizeName(value: unknown, fallback = '访客') {
  return String(value || '').trim().slice(0, 80) || fallback;
}

function messagePreview(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

async function publicProfile(env: Env, origin: string, handle: string) {
  const user = await loadUserByHandle(env, handle);
  if (!user) return null;
  return {
    id: user.id,
    handle: user.handle,
    name: user.name || user.handle,
    address: `${origin}/u/${encodeURIComponent(user.handle)}`,
  };
}

async function nextEventSeq(env: Env, sessionId: string) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(seq), 0) AS max_seq FROM session_events WHERE session_id = ?',
  ).bind(sessionId).first<{ max_seq: number }>();
  return Number(row?.max_seq || 0) + 1;
}

async function createUser(env: Env, handle: string, password: string) {
  const userId = newId();
  const ts = now();
  const salt = randomHex(16);
  const hash = await passwordHash(password, salt);
  const secret = randomHex(32);
  const user: AuthUser = {
    id: userId,
    handle,
    name: handle,
    password_salt: salt,
    password_hash: hash,
    auth_secret: secret,
  };
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, handle, name, password_salt, password_hash, auth_secret, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(userId, handle, handle, salt, hash, secret, ts, ts),
    env.DB.prepare(
      `INSERT INTO settings (user_id, prompt, mode_direct, created_at, updated_at)
       VALUES (?, ?, 'managed', ?, ?)`,
    ).bind(userId, DEFAULT_PROMPT, ts, ts),
  ]);
  return user;
}

async function dispatchInboxAgentTask(env: Env, userId: string, threadId: string, messageId: string) {
  const settings = await loadSettings(env, userId);
  const memories = await loadMemoriesForUser(env, userId);
  const thread = await env.DB.prepare(
    `SELECT t.id, t.title, t.contact_id, c.name AS contact_name, c.address AS contact_address
     FROM inbox_threads t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(threadId, userId).first<{
    id: string;
    title: string;
    contact_id: string | null;
    contact_name: string | null;
    contact_address: string | null;
  }>();
  const message = await env.DB.prepare(
    `SELECT id, thread_id, direction, sender_name, sender_address, body, created_at
     FROM inbox_messages WHERE id = ? AND user_id = ? AND direction = 'inbound'`,
  ).bind(messageId, userId).first<{
    id: string;
    thread_id: string;
    direction: 'inbound';
    sender_name: string;
    sender_address: string;
    body: string;
    created_at: number;
  }>();
  if (!thread || !message) return;

  const history = await env.DB.prepare(
    `SELECT direction, sender_name, body, created_at
     FROM inbox_messages WHERE thread_id = ? AND user_id = ?
     ORDER BY created_at ASC, id ASC LIMIT 20`,
  ).bind(threadId, userId).all<{
    direction: 'inbound' | 'outbound';
    sender_name: string;
    body: string;
    created_at: number;
  }>();

  const turns = (history.results || []).map((item) => ({
    role: item.direction === 'outbound' ? 'assistant' : 'user',
    content: item.body,
  }));
  turns.push({
    role: 'user',
    content: [
      `外部联系人 ${message.sender_name || thread.contact_name || '访客'} 发来消息：`,
      message.body,
      '',
      '请代表用户生成一条可以直接发送给对方的回复。只输出回复正文。',
    ].join('\n'),
  });

  const sessionId = newId();
  const title = messagePreview(message.body).slice(0, 80) || thread.title || '处理来信';
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, kind, status, title, inbox_thread_id, trigger_msg_id, created_at, updated_at)
     VALUES (?, ?, 'inbox_reply', 'thinking', ?, ?, ?, ?, ?)`,
  ).bind(sessionId, userId, title, threadId, messageId, ts, ts).run();

  await notifyHub(env, userId, { type: 'session-started', session: {
    id: sessionId,
    user_id: userId,
    kind: 'inbox_reply',
    status: 'thinking',
    title,
    inbox_thread_id: threadId,
    trigger_msg_id: messageId,
    created_at: ts,
    updated_at: ts,
    finished_at: null,
  }});

  await notifyHub(env, userId, {
    type: 'agent-task',
    task: {
      session_id: sessionId,
      kind: 'inbox_reply',
      mode: settings.mode_direct,
      owner_id: userId,
      peer_id: thread.contact_id,
      inbox_thread_id: threadId,
      inbox_message_id: messageId,
      contact: {
        name: thread.contact_name || message.sender_name || '访客',
        address: thread.contact_address || message.sender_address || '',
      },
      trigger: {
        content: message.body,
        sender_id: thread.contact_id,
        created_at: message.created_at,
      },
      prompt: settings.prompt,
      memories,
      history: history.results || [],
      turns,
      trigger_msg_id: messageId,
      title: thread.title,
    },
  });
}

app.get('/api/health', (c) => c.json({ ok: true, app: 'meem' }));

app.get('/api/auth/status', async (c) => {
  return c.json({
    initialized: await usersCount(c.env) > 0,
    account: '',
  });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json<{ account?: string; password?: string }>()
    .catch(() => ({} as { account?: string; password?: string }));
  const account = normalizeHandle(body.account);
  const password = String(body.password || '');
  if (!account || !password) return c.json({ error: 'account and password required' }, 400);
  if (account.length > 80 || password.length > 200) return c.json({ error: 'account or password too long' }, 400);

  let user = await loadUserByHandle(c.env, account);
  let created = false;
  if (!user && !await usersCount(c.env)) {
    try {
      user = await createUser(c.env, account, password);
      created = true;
    } catch {
      // 竞态：另一个请求刚刚创建了同名用户，回查
      user = await loadUserByHandle(c.env, account);
    }
  }

  if (!user?.password_salt || !user.password_hash || !user.auth_secret) {
    return c.json({ error: 'account or password is incorrect' }, 401);
  }
  const hash = await passwordHash(password, user.password_salt);
  if (hash !== user.password_hash) {
    return c.json({ error: 'account or password is incorrect' }, 401);
  }
  return c.json({ token: await signToken(user), account: user.handle, initialized: true, created });
});

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json<{ account?: string; password?: string }>()
    .catch(() => ({} as { account?: string; password?: string }));
  const account = normalizeHandle(body.account);
  const password = String(body.password || '');
  if (!account || !password) return c.json({ error: 'account and password required' }, 400);
  if (account.length > 40 || password.length > 200) return c.json({ error: 'account or password too long' }, 400);
  if (await loadUserByHandle(c.env, account)) return c.json({ error: 'account already exists' }, 409);
  const user = await createUser(c.env, account, password);
  return c.json({ token: await signToken(user), account: user.handle, initialized: true, created: true });
});

app.get('/api/public/profile/:handle', async (c) => {
  const profile = await publicProfile(c.env, new URL(c.req.url).origin, c.req.param('handle'));
  if (!profile) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(profile);
});

app.post('/api/public/messages', async (c) => {
  const body = await c.req.json<PublicMessageInput>().catch(() => ({} as PublicMessageInput));
  const profile = await publicProfile(c.env, new URL(c.req.url).origin, normalizeHandle(body.handle));
  if (!profile || normalizeHandle(body.handle) !== profile.handle) {
    return c.json({ error: 'not found' }, 404);
  }

  const text = String(body.text || '').trim();
  if (!text) return c.json({ error: 'text required' }, 400);
  if (text.length > 4000) return c.json({ error: 'text too long' }, 400);

  const ts = now();
  const newContactId = newId();
  const messageId = newId();
  const senderName = normalizeName(body.sender_name);
  const senderAddress = normalizeAddress(body.sender_address) || `anonymous:${messageId}`;
  const title = messagePreview(text).slice(0, 80) || '新的来信';
  const preview = messagePreview(text);

  // 1) upsert contact，拿到稳定 contact_id
  await c.env.DB.prepare(
    `INSERT INTO contacts (id, user_id, name, address, created_at, updated_at, last_contact_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, address) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at,
       last_contact_at = excluded.last_contact_at`,
  ).bind(newContactId, profile.id, senderName, senderAddress, ts, ts, ts).run();
  const contactRow = await c.env.DB.prepare(
    `SELECT id FROM contacts WHERE user_id = ? AND address = ?`,
  ).bind(profile.id, senderAddress).first<{ id: string }>();
  const contactId = contactRow?.id || newContactId;

  // 2) 找该联系人最近一条 open 的 thread；找不到就开新的
  const existingThread = await c.env.DB.prepare(
    `SELECT id, public_token FROM inbox_threads
     WHERE user_id = ? AND contact_id = ? AND status != 'archived'
     ORDER BY updated_at DESC LIMIT 1`,
  ).bind(profile.id, contactId).first<{ id: string; public_token: string }>();

  let threadId: string;
  let publicToken: string;
  if (existingThread) {
    threadId = existingThread.id;
    publicToken = existingThread.public_token;
    await c.env.DB.prepare(
      `UPDATE inbox_threads SET status = 'open', unread_count = unread_count + 1,
         last_message_preview = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(preview, ts, threadId, profile.id).run();
  } else {
    threadId = newId();
    publicToken = randomHex(24);
    await c.env.DB.prepare(
      `INSERT INTO inbox_threads (id, user_id, public_token, contact_id, title, status, unread_count, last_message_preview, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', 1, ?, ?, ?)`,
    ).bind(threadId, profile.id, publicToken, contactId, title, preview, ts, ts).run();
  }

  // 3) 插入消息
  await c.env.DB.prepare(
    `INSERT INTO inbox_messages (id, user_id, thread_id, contact_id, direction, sender_name, sender_address, body, created_at)
     VALUES (?, ?, ?, ?, 'inbound', ?, ?, ?, ?)`,
  ).bind(messageId, profile.id, threadId, contactId, senderName, senderAddress, text, ts).run();

  const thread = await c.env.DB.prepare(
    `SELECT t.id, t.contact_id, t.title, t.status, t.unread_count, t.last_message_preview,
            t.created_at, t.updated_at, c.name AS contact_name, c.address AS contact_address
     FROM inbox_threads t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(threadId, profile.id).first();
  const message = await c.env.DB.prepare(
    `SELECT id, thread_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM inbox_messages WHERE id = ? AND user_id = ?`,
  ).bind(messageId, profile.id).first();
  c.executionCtx.waitUntil(Promise.all([
    notifyHub(c.env, profile.id, { type: 'inbox-message', thread, message }),
    dispatchInboxAgentTask(c.env, profile.id, threadId, messageId),
  ]));
  return c.json({
    ok: true,
    thread_id: threadId,
    message_id: messageId,
    receipt_url: `${new URL(c.req.url).origin}/t/${publicToken}`,
  });
});

app.get('/api/public/threads/:token', async (c) => {
  const token = c.req.param('token');
  const thread = await c.env.DB.prepare(
    `SELECT id, user_id, title, status, last_message_preview, created_at, updated_at
     FROM inbox_threads WHERE public_token = ?`,
  ).bind(token).first();
  if (!thread) return c.json({ error: 'not found' }, 404);
  const messages = await c.env.DB.prepare(
    `SELECT id, direction, sender_name, body, created_at
     FROM inbox_messages WHERE thread_id = ? AND user_id = ? ORDER BY created_at ASC, id ASC`,
  ).bind((thread as any).id, (thread as any).user_id).all();
  const { user_id: _userId, ...publicThread } = thread as any;
  return c.json({ thread: publicThread, messages: messages.results });
});

app.use('/api/*', requireAuth);

app.get('/api/me', async (c) => {
  const userId = c.get('userId');
  const user = await loadUserById(c.env, userId);
  if (!user) return c.json({ error: 'not found' }, 404);
  const profile = await publicProfile(c.env, new URL(c.req.url).origin, user.handle);
  return c.json({
    id: user.id,
    name: profile?.name || user.name || user.handle,
    baseUrl: new URL(c.req.url).origin,
    publicAddress: profile?.address || '',
  });
});

app.get('/api/users', async (c) => {
  const origin = new URL(c.req.url).origin;
  const rs = await c.env.DB.prepare(
    `SELECT id, handle, name, created_at, updated_at
     FROM users ORDER BY handle ASC LIMIT 500`,
  ).all<{ id: string; handle: string; name: string; created_at: number; updated_at: number }>();
  return c.json((rs.results || []).map((user) => ({
    ...user,
    publicAddress: `${origin}/u/${encodeURIComponent(user.handle)}`,
  })));
});

app.get('/api/contacts', async (c) => {
  const userId = c.get('userId');
  const rs = await c.env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE user_id = ?
     ORDER BY COALESCE(last_contact_at, updated_at) DESC LIMIT 500`,
  ).bind(userId).all();
  return c.json(rs.results);
});

app.post('/api/contacts', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ name?: string; address?: string; note?: string }>()
    .catch(() => ({} as { name?: string; address?: string; note?: string }));
  const name = normalizeName(body.name, '');
  const address = normalizeAddress(body.address || '');
  const note = String(body.note || '').trim().slice(0, 500);
  if (!name || !address) return c.json({ error: 'name and address required' }, 400);
  const ts = now();
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO contacts (id, user_id, name, address, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, address) DO UPDATE SET
       name = excluded.name,
       note = excluded.note,
       updated_at = excluded.updated_at`,
  ).bind(id, userId, name, address, note, ts, ts).run();
  const contact = await c.env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE user_id = ? AND address = ?`,
  ).bind(userId, address).first();
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-updated', contact }));
  return c.json(contact);
});

app.patch('/api/contacts/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; address?: string; note?: string }>()
    .catch(() => ({} as { name?: string; address?: string; note?: string }));
  const sets: string[] = ['updated_at = ?'];
  const binds: any[] = [now()];
  if (typeof body.name === 'string') { sets.push('name = ?'); binds.push(normalizeName(body.name, '')); }
  if (typeof body.address === 'string') { sets.push('address = ?'); binds.push(normalizeAddress(body.address)); }
  if (typeof body.note === 'string') { sets.push('note = ?'); binds.push(String(body.note).slice(0, 500)); }
  binds.push(id, userId);
  const r = await c.env.DB.prepare(
    `UPDATE contacts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  const contact = await c.env.DB.prepare(
    `SELECT id, name, address, note, created_at, updated_at, last_contact_at
     FROM contacts WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-updated', contact }));
  return c.json(contact);
});

app.delete('/api/contacts/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    `DELETE FROM contacts WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'contact-deleted', id }));
  return c.json({ ok: true });
});

// ---------------- 记忆 ----------------
const INCLUSIONS = ['must_read', 'starred', 'stored'] as const;
type Inclusion = typeof INCLUSIONS[number];

async function loadMemoriesForUser(env: Env, userId: string) {
  const rs = await env.DB.prepare(
    `SELECT id, title, summary, content, inclusion, created_at, updated_at
     FROM memories WHERE user_id = ?
     ORDER BY
       CASE inclusion WHEN 'must_read' THEN 0 WHEN 'starred' THEN 1 ELSE 2 END,
       updated_at DESC`,
  ).bind(userId).all();
  return (rs.results || []) as Array<{
    id: string; title: string; summary: string; content: string;
    inclusion: Inclusion; created_at: number; updated_at: number;
  }>;
}

app.get('/api/memories', async (c) => {
  return c.json(await loadMemoriesForUser(c.env, c.get('userId')));
});

app.post('/api/memories', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ title?: string; summary?: string; content?: string; inclusion?: string }>()
    .catch(() => ({} as { title?: string; summary?: string; content?: string; inclusion?: string }));
  const title = String(body.title || '').trim().slice(0, 120);
  if (!title) return c.json({ error: 'title required' }, 400);
  const inclusion: Inclusion = INCLUSIONS.includes(body.inclusion as Inclusion)
    ? (body.inclusion as Inclusion)
    : 'stored';
  const id = newId();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO memories (id, user_id, title, summary, content, inclusion, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, userId, title,
    String(body.summary || '').slice(0, 500),
    String(body.content || '').slice(0, 8000),
    inclusion, ts, ts,
  ).run();
  const row = await c.env.DB.prepare(
    `SELECT id, title, summary, content, inclusion, created_at, updated_at
     FROM memories WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-updated', memory: row }));
  return c.json(row);
});

app.patch('/api/memories/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; summary?: string; content?: string; inclusion?: string }>()
    .catch(() => ({} as { title?: string; summary?: string; content?: string; inclusion?: string }));
  const sets: string[] = ['updated_at = ?'];
  const binds: any[] = [now()];
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 120);
    if (!title) return c.json({ error: 'title required' }, 400);
    sets.push('title = ?'); binds.push(title);
  }
  if (typeof body.summary === 'string') { sets.push('summary = ?'); binds.push(body.summary.slice(0, 500)); }
  if (typeof body.content === 'string') { sets.push('content = ?'); binds.push(body.content.slice(0, 8000)); }
  if (typeof body.inclusion === 'string' && INCLUSIONS.includes(body.inclusion as Inclusion)) {
    sets.push('inclusion = ?'); binds.push(body.inclusion);
  }
  binds.push(id, userId);
  const r = await c.env.DB.prepare(
    `UPDATE memories SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  const row = await c.env.DB.prepare(
    `SELECT id, title, summary, content, inclusion, created_at, updated_at
     FROM memories WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-updated', memory: row }));
  return c.json(row);
});

app.delete('/api/memories/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(
    'DELETE FROM memories WHERE id = ? AND user_id = ?',
  ).bind(id, userId).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'memory-deleted', id }));
  return c.json({ ok: true });
});

app.get('/api/inbox/threads', async (c) => {
  const userId = c.get('userId');
  const rs = await c.env.DB.prepare(
    `SELECT t.id, t.public_token, t.contact_id, t.title, t.status, t.unread_count, t.last_message_preview,
            t.created_at, t.updated_at, c.name AS contact_name, c.address AS contact_address
     FROM inbox_threads t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC LIMIT 200`,
  ).bind(userId).all();
  return c.json(rs.results);
});

app.get('/api/inbox/threads/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const thread = await c.env.DB.prepare(
    `SELECT t.id, t.public_token, t.contact_id, t.title, t.status, t.unread_count, t.last_message_preview,
            t.created_at, t.updated_at, c.name AS contact_name, c.address AS contact_address
     FROM inbox_threads t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(id, userId).first();
  if (!thread) return c.json({ error: 'not found' }, 404);
  const messages = await c.env.DB.prepare(
    `SELECT id, thread_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM inbox_messages WHERE thread_id = ? AND user_id = ? ORDER BY created_at ASC, id ASC`,
  ).bind(id, userId).all();
  await c.env.DB.prepare(
    `UPDATE inbox_threads SET unread_count = 0 WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).run();
  return c.json({ thread: { ...(thread as any), unread_count: 0 }, messages: messages.results });
});

app.patch('/api/inbox/threads/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string }>()
    .catch(() => ({} as { status?: string }));
  const valid = ['open', 'replied', 'archived'];
  if (!body.status || !valid.includes(body.status)) {
    return c.json({ error: 'status required' }, 400);
  }
  const ts = now();
  const r = await c.env.DB.prepare(
    `UPDATE inbox_threads SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
  ).bind(body.status, ts, id, userId).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'inbox-thread-updated', id, status: body.status }));
  return c.json({ ok: true, id, status: body.status });
});

app.delete('/api/inbox/threads/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const r = await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM inbox_messages WHERE thread_id = ? AND user_id = ?').bind(id, userId),
    c.env.DB.prepare('DELETE FROM inbox_threads WHERE id = ? AND user_id = ?').bind(id, userId),
  ]);
  if (!r[1]?.meta?.changes) return c.json({ error: 'not found' }, 404);
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'inbox-thread-deleted', id }));
  return c.json({ ok: true });
});

app.post('/api/inbox/threads/:id/process', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json<{ message_id?: string }>().catch(() => ({} as { message_id?: string }));
  const message = body.message_id
    ? await c.env.DB.prepare(
      `SELECT id FROM inbox_messages
       WHERE id = ? AND thread_id = ? AND user_id = ? AND direction = 'inbound'`,
    ).bind(body.message_id, id, userId).first<{ id: string }>()
    : await c.env.DB.prepare(
      `SELECT id FROM inbox_messages
       WHERE thread_id = ? AND user_id = ? AND direction = 'inbound'
       ORDER BY created_at DESC, id DESC LIMIT 1`,
    ).bind(id, userId).first<{ id: string }>();
  if (!message) return c.json({ error: 'inbound message not found' }, 404);
  await dispatchInboxAgentTask(c.env, userId, id, message.id);
  return c.json({ ok: true, message_id: message.id });
});

app.post('/api/inbox/threads/:id/reply', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const thread = await c.env.DB.prepare(
    `SELECT t.id, t.contact_id, c.name AS contact_name, c.address AS contact_address
     FROM inbox_threads t LEFT JOIN contacts c ON c.id = t.contact_id
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(id, userId).first<{ id: string; contact_id: string | null; contact_name: string | null; contact_address: string | null }>();
  if (!thread) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ text?: string }>().catch(() => ({} as { text?: string }));
  const text = String(body.text || '').trim();
  if (!text) return c.json({ error: 'text required' }, 400);
  if (text.length > 4000) return c.json({ error: 'text too long' }, 400);
  const ts = now();
  const messageId = newId();
  const preview = messagePreview(text);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO inbox_messages (id, user_id, thread_id, contact_id, direction, sender_name, sender_address, body, created_at)
       VALUES (?, ?, ?, ?, 'outbound', 'Meem', ?, ?, ?)`,
    ).bind(messageId, userId, id, thread.contact_id, thread.contact_address || '', text, ts),
    c.env.DB.prepare(
      `UPDATE inbox_threads SET status = 'replied', unread_count = 0, last_message_preview = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    ).bind(preview, ts, id, userId),
  ]);
  const message = await c.env.DB.prepare(
    `SELECT id, thread_id, contact_id, direction, sender_name, sender_address, body, created_at
     FROM inbox_messages WHERE id = ? AND user_id = ?`,
  ).bind(messageId, userId).first();
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'inbox-reply', thread_id: id, message }));
  return c.json({ message });
});

app.get('/api/settings', async (c) => {
  return c.json(await loadSettings(c.env, c.get('userId')));
});

app.put('/api/settings', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ prompt?: string; mode_direct?: string }>()
    .catch(() => ({} as { prompt?: string; mode_direct?: string }));
  // partial update：只改提供的字段
  const current = await loadSettings(c.env, userId);
  const prompt = typeof body.prompt === 'string' ? body.prompt : current.prompt;
  const mode = VALID_MODES.includes(body.mode_direct as Mode)
    ? (body.mode_direct as Mode)
    : current.mode_direct;
  const ts = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO settings (user_id, prompt, mode_direct, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       prompt = excluded.prompt,
       mode_direct = excluded.mode_direct,
       updated_at = excluded.updated_at`,
  ).bind(userId, prompt, mode, ts, ts).run();
  return c.json({ prompt, mode_direct: mode, updated_at: ts });
});

app.get('/api/presence', async (c) => {
  const res = await hubStub(c.env).fetch(`https://hub/presence?user=${c.get('userId')}`);
  return c.json(await res.json());
});

app.get('/api/sessions', async (c) => {
  const userId = c.get('userId');
  const kind = c.req.query('kind') || '';
  const inboxThreadId = c.req.query('inbox_thread_id') || '';
  const where: string[] = ['user_id = ?'];
  const binds: string[] = [userId];
  if (kind) {
    where.push('kind = ?');
    binds.push(kind);
  }
  if (inboxThreadId) {
    where.push('inbox_thread_id = ?');
    binds.push(inboxThreadId);
  }
  const rs = await c.env.DB.prepare(
    `SELECT id, kind, status, title, inbox_thread_id, trigger_msg_id, codex_thread_id, created_at, updated_at, finished_at
     FROM sessions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC LIMIT 200`,
  ).bind(...binds).all();
  return c.json(rs.results);
});

app.get('/api/sessions/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const session = await c.env.DB.prepare(
    `SELECT id, kind, status, title, inbox_thread_id, trigger_msg_id, codex_thread_id, created_at, updated_at, finished_at
     FROM sessions WHERE id = ? AND user_id = ?`,
  ).bind(id, userId).first();
  if (!session) return c.json({ error: 'not found' }, 404);
  const events = await c.env.DB.prepare(
    `SELECT id, session_id, seq, kind, payload_json, in_reply_to, created_at
     FROM session_events WHERE session_id = ? AND user_id = ?
     ORDER BY seq ASC, created_at ASC, id ASC`,
  ).bind(id, userId).all();
  return c.json({
    session,
    events: (events.results as any[]).map((event) => ({
      ...event,
      payload: safeParse(event.payload_json),
    })),
  });
});

app.post('/api/sessions/direct', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ text?: string }>()
    .catch(() => ({} as { text?: string }));
  const text = body.text?.trim() || '';
  const sessionId = newId();
  const ts = Math.floor(Date.now() / 1000);
  const status = text ? 'thinking' : 'done';
  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, kind, status, title, created_at, updated_at, finished_at)
     VALUES (?, ?, 'direct_chat', ?, ?, ?, ?, ?)`,
  ).bind(sessionId, userId, status, text.slice(0, 80) || null, ts, ts, text ? null : ts).run();

  await notifyHub(c.env, userId, { type: 'session-started', session: {
    id: sessionId, user_id: userId, kind: 'direct_chat', status, title: text.slice(0, 80) || null,
    created_at: ts, updated_at: ts, finished_at: text ? null : ts,
  }});

  if (text) {
    await appendUserMessageAndDispatch(c.env, {
      id: sessionId,
      user_id: userId,
      kind: 'direct_chat',
      title: text.slice(0, 80) || null,
      inbox_thread_id: null,
      trigger_msg_id: null,
    }, text);
  }
  return c.json({ session_id: sessionId });
});

app.post('/api/sessions/:id/turn', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const session = await c.env.DB.prepare(
    `SELECT id, user_id, kind, title, inbox_thread_id, trigger_msg_id
     FROM sessions WHERE id = ? AND user_id = ?`,
  ).bind(sessionId, userId).first<DispatchSession>();
  if (!session) return c.json({ error: 'not found' }, 404);
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: 'text required' }, 400);
  const eventId = await appendUserMessageAndDispatch(c.env, session, text.trim());
  return c.json({ event_id: eventId });
});

async function appendUserMessageAndDispatch(env: Env, session: DispatchSession, text: string) {
  const settings = await loadSettings(env, session.user_id);
  const memories = await loadMemoriesForUser(env, session.user_id);
  const sessionId = session.id;
  const userId = session.user_id;
  const ts = Math.floor(Date.now() / 1000);
  const eventId = newId();
  const seq = await nextEventSeq(env, sessionId);
  const title = session.title || text.slice(0, 80);

  // 先拉历史对话——在写入新 turn 之前，结果不包含本次
  const past = await env.DB.prepare(
    `SELECT kind, payload_json FROM session_events
     WHERE session_id = ? AND user_id = ?
       AND kind IN ('user_message','agent_message')
     ORDER BY seq ASC, created_at ASC, id ASC
     LIMIT 40`,
  ).bind(sessionId, userId).all();
  const pastTurns = (past.results as any[] | undefined ?? [])
    .map((row) => ({
      role: row.kind === 'agent_message' ? 'assistant' : 'user',
      content: safeParse(row.payload_json).text || '',
    }))
    .filter((turn) => turn.content);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sessions SET status = 'thinking', title = COALESCE(title, ?), updated_at = ?, finished_at = NULL WHERE id = ? AND user_id = ?`,
    ).bind(text.slice(0, 80), ts, sessionId, userId),
    env.DB.prepare(
      `INSERT INTO session_events (id, user_id, session_id, seq, kind, payload_json, created_at)
       VALUES (?, ?, ?, ?, 'user_message', ?, ?)`,
    ).bind(eventId, userId, sessionId, seq, JSON.stringify({ text }), ts),
  ]);

  await notifyHub(env, userId, { type: 'session-status', session_id: sessionId,
    status: 'thinking', updated_at: ts, finished_at: null });
  await notifyHub(env, userId, { type: 'session-event', session_id: sessionId, event: {
    id: eventId, session_id: sessionId, seq, kind: 'user_message',
    payload: { text }, in_reply_to: null, created_at: ts,
  }});

  const triggerMsgId = session.kind === 'inbox_reply'
    ? (session.trigger_msg_id || eventId)
    : 'direct';

  await notifyHub(env, userId, {
    type: 'agent-task',
    task: {
      session_id: sessionId,
      kind: session.kind,
      mode: settings.mode_direct,
      owner_id: userId,
      peer_id: null,
      inbox_thread_id: session.inbox_thread_id,
      inbox_message_id: session.trigger_msg_id,
      trigger: { content: text, sender_id: userId, created_at: ts },
      prompt: settings.prompt,
      memories,
      history: [],
      turns: [...pastTurns, { role: 'user', content: text }],
      trigger_msg_id: triggerMsgId,
      title,
    },
  });
  return eventId;
}

app.post('/api/sessions/:id/events', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const own = await c.env.DB.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId).first();
  if (!own) return c.json({ error: 'not found' }, 404);

  const body = await c.req.json<{
    events: Array<{ kind: string; payload?: any; in_reply_to?: string }>;
  }>();
  if (!Array.isArray(body.events) || !body.events.length) {
    return c.json({ error: 'events required' }, 400);
  }
  const ts = Math.floor(Date.now() / 1000);
  const stmts: D1PreparedStatement[] = [];
  const newRows: any[] = [];
  let seq = await nextEventSeq(c.env, sessionId);
  for (const item of body.events) {
    const id = newId();
    stmts.push(c.env.DB.prepare(
      `INSERT INTO session_events (id, user_id, session_id, seq, kind, payload_json, in_reply_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, userId, sessionId, seq, item.kind, JSON.stringify(item.payload ?? {}), item.in_reply_to ?? null, ts));
    newRows.push({
      id, session_id: sessionId, seq, kind: item.kind,
      payload: item.payload ?? {}, in_reply_to: item.in_reply_to ?? null, created_at: ts,
    });
    seq += 1;
  }
  await c.env.DB.batch(stmts);
  c.executionCtx.waitUntil(Promise.all(newRows.map((row) =>
    notifyHub(c.env, userId, { type: 'session-event', session_id: sessionId, event: row })
  )));
  return c.json({ inserted: newRows.length });
});

app.delete('/api/sessions/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const r = await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM session_events WHERE session_id = ? AND user_id = ?').bind(sessionId, userId),
    c.env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(sessionId, userId),
  ]);
  const deleted = r[1]?.meta?.changes || 0;
  if (!deleted) return c.json({ error: 'not found' }, 404);
  c.executionCtx.waitUntil(notifyHub(c.env, userId, { type: 'session-deleted', session_id: sessionId }));
  return c.json({ ok: true });
});

app.patch('/api/sessions/:id', async (c) => {
  const userId = c.get('userId');
  const sessionId = c.req.param('id');
  const body = await c.req.json<{ status?: string; codex_thread_id?: string; title?: string | null }>()
    .catch(() => ({} as { status?: string; codex_thread_id?: string; title?: string | null }));
  const valid = ['thinking','awaiting_approval','awaiting_input','done','cancelled','errored'];
  const status = body.status && valid.includes(body.status) ? body.status : null;
  const ts = Math.floor(Date.now() / 1000);
  const sets = ['updated_at = ?'];
  const binds: any[] = [ts];
  if (status) {
    sets.push('status = ?');
    binds.push(status);
    if (['done','cancelled','errored'].includes(status)) {
      sets.push('finished_at = ?');
      binds.push(ts);
    }
  }
  if (typeof body.codex_thread_id === 'string') {
    sets.push('codex_thread_id = ?');
    binds.push(body.codex_thread_id);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    sets.push('title = ?');
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    binds.push(title || null);
  }
  binds.push(sessionId, userId);
  const r = await c.env.DB.prepare(
    `UPDATE sessions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...binds).run();
  if (!r.meta?.changes) return c.json({ error: 'not found' }, 404);
  const updated = await c.env.DB.prepare(
    'SELECT id, status, title, finished_at, updated_at FROM sessions WHERE id = ? AND user_id = ?',
  ).bind(sessionId, userId).first();

  const broadcasts = [notifyHub(c.env, userId, { type: 'session-status', session_id: sessionId,
    status: (updated as any)?.status, title: (updated as any)?.title,
    finished_at: (updated as any)?.finished_at, updated_at: (updated as any)?.updated_at })];
  if (status === 'cancelled') {
    broadcasts.push(notifyHub(c.env, userId, { type: 'agent-cancel', session_id: sessionId }));
  }
  c.executionCtx.waitUntil(Promise.all(broadcasts));
  return c.json(updated);
});

app.get('/ws', async (c) => {
  const token = c.req.query('token') ?? '';
  const user = await authorized(c.env, token);
  if (!user) return c.text('unauthorized', 401);
  const url = new URL(c.req.url);
  url.searchParams.set('user', user.id);
  return hubStub(c.env).fetch(new Request(url.toString(), c.req.raw));
});

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;

interface Capabilities {
  client: boolean;
  codex: boolean;
  codexVersion: string;
  codexLoggedIn: boolean;
  bridgeVersion: string;
  bridgeStartedAt: number;
  os: string;
  hostname: string;
}

interface HubSession {
  id: string;
  user: string;
  kind: 'web' | 'desktop';
  capabilities: Capabilities;
  socket: WebSocket;
}

export class Hub extends DurableObject<Env> {
  private sessions = new Map<string, HubSession>();

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/notify') {
      const { user, frame } = await req.json<{ user: string; frame: unknown }>();
      let delivered = 0;
      for (const session of this.sessions.values()) {
        if (session.user !== user) continue;
        try { session.socket.send(JSON.stringify(frame)); delivered += 1; } catch {}
      }
      return Response.json({ delivered });
    }

    if (url.pathname === '/presence') {
      const user = url.searchParams.get('user') ?? '';
      const sessions = [...this.sessions.values()]
        .filter((session) => session.user === user)
        .map((session) => ({ id: session.id, kind: session.kind, capabilities: session.capabilities }));
      return Response.json({ sessions });
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const user = url.searchParams.get('user') || '';
    const kind: 'web' | 'desktop' = url.searchParams.get('client') === '1' ? 'desktop' : 'web';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const session: HubSession = {
      id: crypto.randomUUID(),
      user,
      kind,
      capabilities: {
        client: kind === 'desktop',
        codex: false,
        codexVersion: '',
        codexLoggedIn: false,
        bridgeVersion: '',
        bridgeStartedAt: 0,
        os: '',
        hostname: '',
      },
      socket: server,
    };
    this.sessions.set(session.id, session);
    server.send(JSON.stringify({ type: 'welcome', session_id: session.id, kind }));

    server.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'hello' && msg.capabilities && typeof msg.capabilities === 'object') {
          const caps = msg.capabilities;
          session.capabilities = {
            client: kind === 'desktop',
            codex: Boolean(caps.codex),
            codexVersion: String(caps.codexVersion ?? '').slice(0, 40),
            codexLoggedIn: Boolean(caps.codexLoggedIn),
            bridgeVersion: String(caps.bridgeVersion ?? '').slice(0, 40),
            bridgeStartedAt: Number(caps.bridgeStartedAt) || 0,
            os: String(caps.os ?? '').slice(0, 80),
            hostname: String(caps.hostname ?? '').slice(0, 80),
          };
          return;
        }
      } catch {}
    });

    server.addEventListener('close', () => this.sessions.delete(session.id));
    server.addEventListener('error', () => this.sessions.delete(session.id));

    return new Response(null, { status: 101, webSocket: client });
  }
}
