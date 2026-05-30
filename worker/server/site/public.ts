import type { Env } from '../types';

const UID = 'me';
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const readJson = async (req: Request): Promise<any> => { try { return await req.json(); } catch { return {}; } };
const clean = (value: unknown, max = 2000) => String(value || '').trim().slice(0, max);

async function triggerMeem(env: Env): Promise<void> {
  const stub = env.ROOM.get(env.ROOM.idFromName(UID));
  await stub.fetch(`https://room/trigger?uid=${UID}`, { method: 'POST', body: JSON.stringify({ chat: null }) });
}

async function createInbox(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const b = await readJson(req);
  const name = clean(b.name, 80) || '匿名';
  const contact = clean(b.contact, 160);
  const message = clean(b.body, 4000);
  if (!message) return json({ error: 'missing_body' }, 400);
  const body = contact ? `${message}\n\n联系方式: ${contact}` : message;
  await env.DB.prepare('INSERT INTO site_inbox (id,site_uid,from_name,body,status,created) VALUES (?,?,?,?,?,unixepoch())')
    .bind(crypto.randomUUID(), UID, name, body, 'new')
    .run();
  ctx.waitUntil(Promise.all([
    triggerMeem(env),
    env.DB.prepare('INSERT INTO site_events (id,site_uid,kind,payload,created) VALUES (?,?,?,?,unixepoch())')
      .bind(crypto.randomUUID(), UID, 'inbox.created', JSON.stringify({ name, has_contact: !!contact }))
      .run(),
  ]));
  return json({ ok: true });
}

export async function handleSiteApi(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  if (url.pathname === '/site/api/inbox' && req.method === 'POST') return createInbox(req, env, ctx);
  return json({ error: 'not_found' }, 404);
}

export async function handlePublic(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const token = url.pathname.replace(/^\/p\//, '');
  if (req.method === 'POST') return createInbox(req, env, ctx);
  return new Response(publicHtml(token), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function publicHtml(token: string): string {
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>联系</title><body style="font-family:-apple-system,sans-serif;max-width:480px;margin:40px auto;padding:0 20px">
<h2>给我留言</h2><p style="color:#666">对方的 AI 会先看到,需要时才转达本人。</p>
<input id=name placeholder="你的称呼" style="width:100%;padding:10px;margin:6px 0;font-size:15px">
<textarea id=body placeholder="想说的..." style="width:100%;height:120px;padding:10px;font-size:15px"></textarea>
<button onclick="fetch(location.pathname,{method:'POST',body:JSON.stringify({name:name.value,body:body.value})}).then(()=>{document.body.innerHTML='<h2>已送达</h2>'})" style="padding:11px 22px;font-size:15px;margin-top:8px">发送</button>
<script>const token=${JSON.stringify(token)};</script></body>`;
}
