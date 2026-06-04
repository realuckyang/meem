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

function serveApp(req: Request, env: Env, url: URL): Promise<Response> {
  // 控制台 SPA 落在根路径:非文件路径回退到 index.html,文件路径直接取静态资源
  if (!hasFileExt(url.pathname)) return env.ASSETS.fetch(assetRequest(req, '/index.html'));
  return env.ASSETS.fetch(req);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // 实时通道 → Room DO
    if (url.pathname === '/ws') {
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
    // REST
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, url, ctx);
    // 控制台 SPA + 静态资源(如扩展下载包 /downloads/...)
    return serveApp(req, env, url);
  },
};
