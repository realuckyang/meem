// Meem REST 入口 · 按 path 层级分配
//   先公共(auth/*),过鉴权门,再按前缀 startsWith 派给各域。
//   简单域 = 单文件(content.ts / settings.ts ...);多级域 = 目录(docs/)。
import type { Env } from '../../types';
import { authorize } from '../auth';
import { makeRepo } from '../repository/repo';
import { json, type RouteCtx } from '../http';
import { authPublic } from './auth';
import { account } from './account';
import { docs } from './docs';
import { terminal } from './terminal';
import { tasks } from './tasks';
import { notes } from './notes';
import { codex } from './codex';
import { devices } from './devices';
import { settings } from './settings';

const notFound = () => json({ error: 'not found' }, 404);

export async function handleApi(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const p = url.pathname.replace(/^\/meem\/api\//, '');
  const method = req.method;

  // 公共路由(鉴权前)
  if (p.startsWith('auth/')) return (await authPublic(env, p, method, req)) ?? notFound();

  // 鉴权门
  const user = await authorize(req, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const c: RouteCtx = { env, p, method, req, url, ctx, repo: makeRepo(env, user.meem_uid), user };

  // 按前缀分配
  if (p === 'me' || p.startsWith('install/')) return account(c);
  if (p.startsWith('docs/')) return docs(c);
  if (p.startsWith('terminal/')) return terminal(c);
  if (p.startsWith('settings')) return settings(c);
  if (p.startsWith('tasks')) return tasks(c);
  if (p.startsWith('notes')) return notes(c);
  if (p.startsWith('codex/')) return codex(c);
  if (p.startsWith('devices')) return devices(c);
  return notFound();
}
