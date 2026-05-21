// 媒体存储：
//   GET  /r/:key                公开匿名读
//   POST /api/media/upload?ext=png   鉴权写入（扩展直接传截图等二进制内容）

import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json } from './helpers';

export async function handleMediaGet(_request: Request, env: Env, key: string): Promise<Response> {
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}

export async function handleMediaUpload(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  if (ctx.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const ext = (ctx.url.searchParams.get('ext') || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(ext)) return err('unsupported ext');
  const mime = request.headers.get('content-type') || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return err('empty body');
  if (bytes.byteLength > 10 * 1024 * 1024) return err('too large (max 10MB)');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const id = crypto.randomUUID().slice(0, 8);
  const key = `shots/${ctx.me.id}/${stamp}-${id}.${ext === 'jpg' ? 'jpeg' : ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });

  return json({
    url: `https://meem.yanglong.yun/r/${key}`,
    key,
    bytes: bytes.byteLength,
  });
}
