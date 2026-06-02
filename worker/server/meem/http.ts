// HTTP/请求层公共件 · 被 api 路由共用(不属于任何具体路由)
import type { Env } from '../types';
import type { Repo } from './repository/repo';
import type { MeemUser } from './auth';

export const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export const readJson = async (req: Request): Promise<any> => {
  try { return await req.json(); } catch { return {}; }
};

/** 已鉴权路由的上下文 */
export interface RouteCtx {
  env: Env;
  p: string;        // 去掉 /meem/api/ 前缀的路径
  method: string;
  req: Request;
  url: URL;
  ctx: ExecutionContext;
  repo: Repo;
  user: MeemUser;
}
