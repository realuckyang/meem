import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types';

interface Capabilities {
  client: boolean;
  avatar: boolean;
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
  kind: 'web' | 'desktop' | 'avatar';
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
        try {
          session.socket.send(JSON.stringify(frame));
          delivered += 1;
        } catch {}
      }
      return Response.json({ delivered });
    }

    if (url.pathname === '/presence') {
      const user = url.searchParams.get('user') ?? '';
      const sessions = [...this.sessions.values()]
        .filter((session) => session.user === user)
        .map((session) => ({
          id: session.id,
          kind: session.kind,
          capabilities: session.capabilities,
        }));
      return Response.json({ sessions });
    }

    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const user = url.searchParams.get('user') || '';
    const kind: 'web' | 'desktop' | 'avatar' = url.searchParams.get('avatar') === '1'
      ? 'avatar'
      : url.searchParams.get('client') === '1'
        ? 'desktop'
        : 'web';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const session: HubSession = {
      id: crypto.randomUUID(),
      user,
      kind,
      capabilities: {
        client: kind === 'desktop',
        avatar: kind === 'avatar',
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
            avatar: kind === 'avatar',
            codex: Boolean(caps.codex),
            codexVersion: String(caps.codexVersion ?? '').slice(0, 40),
            codexLoggedIn: Boolean(caps.codexLoggedIn),
            bridgeVersion: String(caps.bridgeVersion ?? '').slice(0, 40),
            bridgeStartedAt: Number(caps.bridgeStartedAt) || 0,
            os: String(caps.os ?? '').slice(0, 80),
            hostname: String(caps.hostname ?? '').slice(0, 80),
          };
        }
      } catch {}
    });

    server.addEventListener('close', () => this.sessions.delete(session.id));
    server.addEventListener('error', () => this.sessions.delete(session.id));

    return new Response(null, { status: 101, webSocket: client });
  }
}
