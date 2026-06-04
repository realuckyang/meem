import type { Env } from './types';
import { handleApi } from './meem/api';
import { Room } from './meem/ws/room';
import { authorize } from './meem/auth';
import { verifyDevice } from './meem/repository/devices';

export { Room };

const hasFileExt = (pathname: string) => /\.[a-z0-9]+$/i.test(pathname);

function assetRequest(req: Request, pathname: string): Request {
  const url = new URL(req.url);
  url.pathname = pathname;
  return new Request(url, req);
}

function serveMeem(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname === '/meem' ? '/meem/' : url.pathname;
  if (path === '/meem/' || !hasFileExt(path)) return env.ASSETS.fetch(assetRequest(req, '/meem/index.html'));
  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Meem 实时通道 → Room DO
    if (url.pathname === '/meem/ws') {
      const client = url.searchParams.get('client') || 'meem';
      // 控制台用主 token(JWT);设备(client/extension)用各自的设备 token + device id
      if (client === 'meem') {
        const user = await authorize(req, env);
        if (!user) return new Response('unauthorized', { status: 401 });
        const stub = env.ROOM.get(env.ROOM.idFromName(user.meem_uid));
        return stub.fetch(new Request(`https://room/connect?uid=${user.meem_uid}&client=meem`, req));
      }
      const token = url.searchParams.get('token') || '';
      const dev = await verifyDevice(env, token);
      if (!dev) return new Response('unauthorized device', { status: 401 });
      const stub = env.ROOM.get(env.ROOM.idFromName(dev.uid));
      return stub.fetch(new Request(`https://room/connect?uid=${dev.uid}&client=${client}&device=${encodeURIComponent(dev.id)}&kind=${dev.kind}`, req));
    }
    // Meem REST
    if (url.pathname.startsWith('/meem/api/')) return handleApi(req, env, url, ctx);
    // Meem 控制台和内部应用
    if (url.pathname === '/meem' || url.pathname.startsWith('/meem/')) return serveMeem(req, env, url);
    // 其余只放行静态资源(如扩展下载包 /downloads/...),其它一律 404
    if (hasFileExt(url.pathname)) return env.ASSETS.fetch(req);
    return new Response('Not Found', { status: 404 });
  },
};
