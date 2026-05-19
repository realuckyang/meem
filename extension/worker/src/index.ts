export interface Env {
  AVATAR: DurableObjectNamespace;
}

interface AvatarMessage {
  id: string;
  text: string;
  senderName: string;
  createdAt: number;
}

interface StoredMessage extends AvatarMessage {
  reply?: string;
  repliedAt?: number;
}

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...(init.headers || {}),
  },
});

const text = (body: string, init: ResponseInit = {}) => new Response(body, {
  ...init,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

function roomStub(env: Env, avatarId: string) {
  return env.AVATAR.get(env.AVATAR.idFromName(avatarId));
}

function roomRequest(request: Request, avatarId: string, path: string) {
  const url = new URL(request.url);
  url.pathname = path;
  url.searchParams.set('avatarId', avatarId);
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

    if (url.pathname === '/status') {
      return json({ avatarId, online: this.sockets.size > 0, connections: this.sockets.size });
    }

    if (url.pathname === '/ws') {
      return this.handleWebSocket(request);
    }

    if (url.pathname === '/message' && request.method === 'POST') {
      return this.handleMessage(request, url);
    }

    if (url.pathname === '/reply' && request.method === 'POST') {
      return this.handleReply(request);
    }

    if (url.pathname.startsWith('/message/') && request.method === 'GET') {
      const id = url.pathname.split('/').filter(Boolean)[1];
      const stored = await this.state.storage.get<StoredMessage>(`message:${id}`);
      if (!stored) return json({ error: 'not found' }, { status: 404 });
      return json({ message: stored });
    }

    return json({ error: 'not found' }, { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected websocket' }, { status: 426 });
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return json({ error: 'token required' }, { status: 401 });

    const storedToken = await this.state.storage.get<string>('token');
    if (storedToken && storedToken !== token) {
      return json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!storedToken) {
      await this.state.storage.put('token', token);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.add(server);
    server.send(JSON.stringify({ type: 'welcome', connectionId: randomId() }));

    server.addEventListener('message', (event) => {
      try {
        const frame = JSON.parse(String(event.data));
        if (frame?.type === 'hello') {
          server.send(JSON.stringify({ type: 'ready', online: true }));
        }
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

    const message: StoredMessage = {
      id: randomId(),
      text: messageText,
      senderName: String(body.senderName || '访客').trim().slice(0, 80) || '访客',
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

    const reply = String(body.text || '').trim();
    const next: StoredMessage = {
      ...stored,
      reply,
      repliedAt: Date.now(),
    };
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

    if (url.pathname === '/api/health') {
      return json({ ok: true, app: 'meem-exetension' });
    }

    const match = url.pathname.match(/^\/api\/avatar\/([^/]+)(?:\/(.*))?$/);
    if (!match) return json({ error: 'not found' }, { status: 404 });

    const avatarId = decodeURIComponent(match[1]);
    const action = match[2] || 'status';
    const actionPath = `/${action}`;
    return roomStub(env, avatarId).fetch(roomRequest(request, avatarId, actionPath));
  },
};
