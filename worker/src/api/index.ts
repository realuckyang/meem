import type { Env } from '../types';
import { authorize, cors, err } from './helpers';
import { handleRegister, handleLogin } from './auth';
import { handleMe } from './me';
import { handleSettings } from './settings';
import { handleUsers, handleUserByHandle } from './users';
import {
  handleConversationList,
  handleConversationCreate,
  handleMessages,
} from './conversations';
import {
  handleSessionList,
  handleSessionCreate,
  handleSession,
  handleEvents,
} from './sessions';
import {
  handleMemoryList,
  handleMemoryCreate,
  handleMemory,
} from './memories';
import { handleStatus, handleUpgrade } from '../ws';
import { handleMediaGet, handleMediaUpload } from './media';

export async function route(request: Request, env: Env, execCtx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === 'OPTIONS') return cors();

  // ── public ──
  if (pathname === '/api/register' && method === 'POST') return handleRegister(request, env);
  if (pathname === '/api/login' && method === 'POST') return handleLogin(request, env);

  // /r/:key —— 公开读取 R2（截图、附件）
  const mediaMatch = pathname.match(/^\/r\/([A-Za-z0-9._\-/]+)$/);
  if (mediaMatch && method === 'GET') return handleMediaGet(request, env, mediaMatch[1]);

  // ── require auth ──
  const me = await authorize(env, request);
  if (!me && pathname.startsWith('/api/')) return err('unauthorized', 401);
  if (!me) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('not found', { status: 404 });

  const ctx = { me, url, method, execCtx };

  // ── REST ──
  if (pathname === '/api/me') return handleMe(request, env, ctx);
  if (pathname === '/api/settings') return handleSettings(request, env, ctx);
  if (pathname === '/api/users') return handleUsers(request, env, ctx);
  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) return handleUserByHandle(request, env, ctx, userMatch[1]);

  if (pathname === '/api/conversations') {
    if (method === 'GET') return handleConversationList(request, env, ctx);
    if (method === 'POST') return handleConversationCreate(request, env, ctx);
  }
  const msgMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (msgMatch) return handleMessages(request, env, ctx, msgMatch[1]);

  if (pathname === '/api/sessions') {
    if (method === 'GET') return handleSessionList(request, env, ctx);
    if (method === 'POST') return handleSessionCreate(request, env, ctx);
  }
  const eventsMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
  if (eventsMatch) return handleEvents(request, env, ctx, eventsMatch[1]);
  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) return handleSession(request, env, ctx, sessionMatch[1]);

  if (pathname === '/api/media/upload') return handleMediaUpload(request, env, ctx);

  if (pathname === '/api/memories') {
    if (method === 'GET') return handleMemoryList(request, env, ctx);
    if (method === 'POST') return handleMemoryCreate(request, env, ctx);
  }
  const memMatch = pathname.match(/^\/api\/memories\/([^/]+)$/);
  if (memMatch) return handleMemory(request, env, ctx, memMatch[1]);

  // ── WS channels ──
  if (pathname === '/api/ws') return handleUpgrade(request, env, ctx);
  if (pathname === '/api/status' && method === 'GET') return handleStatus(request, env, ctx);

  if (pathname.startsWith('/api/')) return err('not found', 404);
  return env.ASSETS ? env.ASSETS.fetch(request) : new Response('not found', { status: 404 });
}
