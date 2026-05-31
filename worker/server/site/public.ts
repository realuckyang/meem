import type { Env } from '../types';
import { makeRepo } from '../meem/repository';
import { callLm } from '../meem/ai/lm';
import { appendMessage, loadConversation, login as visitorLogin, register as visitorRegister, verifyVisitor } from './visitors';

const UID = 'me';
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const readJson = async (req: Request): Promise<any> => { try { return await req.json(); } catch { return {}; } };
const clean = (value: unknown, max = 2000) => String(value || '').trim().slice(0, max);
const clientIp = (req: Request) => req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';

async function createInbox(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const b = await readJson(req);
  const name = clean(b.name, 80) || '匿名';
  const contact = clean(b.contact, 160);
  const message = clean(b.body, 4000);
  if (!message) return json({ error: 'missing_body' }, 400);

  const repo = makeRepo(env, UID);
  // 留言限流:同 IP 每小时 10 条
  const ip = clientIp(req);
  if (!(await repo.rateHit(`inbox:${ip}`, 3600, 10))) return json({ error: 'rate_limited' }, 429);

  const body = contact ? `${message}\n\n联系方式: ${contact}` : message;
  await env.DB.prepare('INSERT INTO site_inbox (id,site_uid,from_name,body,status,created) VALUES (?,?,?,?,?,unixepoch())')
    .bind(crypto.randomUUID(), UID, name, body, 'new')
    .run();
  ctx.waitUntil(
    env.DB.prepare('INSERT INTO site_events (id,site_uid,kind,payload,created) VALUES (?,?,?,?,unixepoch())')
      .bind(crypto.randomUUID(), UID, 'inbox.created', JSON.stringify({ name, has_contact: !!contact }))
      .run(),
  );
  return json({ ok: true });
}

/** 已发布内容:动态/文章/项目 */
async function listContent(_req: Request, env: Env, url: URL): Promise<Response> {
  const kind = url.searchParams.get('kind') || undefined;
  const repo = makeRepo(env, UID);
  return json({ items: await repo.publicContent(kind) });
}

/** 门童机器人:只读已发布内容回答 · 无任何工具 · 限流 + 字数/历史上限 */
async function concierge(req: Request, env: Env): Promise<Response> {
  const b = await readJson(req);
  const message = clean(b.message, 1000);
  if (!message) return json({ error: 'empty' }, 400);

  const repo = makeRepo(env, UID);
  const ip = clientIp(req);
  // 限流:同 IP 每小时 20 条 + 全站每天 500 条(护住站主的 LLM 账单)
  if (!(await repo.rateHit(`chat:${ip}`, 3600, 20))) return json({ reply: '你今天问得有点多啦,休息一下再来吧 🙂', limited: true });
  if (!(await repo.rateHit('chat:__global__', 86400, 500))) return json({ reply: '今日访问量已满,请明天再来。', limited: true });

  const s = await repo.loadSettings();
  const apiUrl = (s.llm_url || env.LLM_URL || '').trim();
  const apiKey = (s.llm_key || env.LLM_KEY || '').trim();
  const model = (s.llm_model || env.LLM_MODEL || '').trim();
  if (!apiUrl || !apiKey || !model) return json({ reply: '站点助手暂未开放,你可以直接在下方留言。', disabled: true });

  // 已发布内容作为唯一知识来源(总量受限,成本可控)
  const items = await repo.publicContent();
  const kindLabel: Record<string, string> = { dynamic: '动态', article: '文章', project: '项目' };
  let ctxText = '';
  for (const it of items) {
    const block = `【${kindLabel[it.kind] || it.kind}】${it.title}\n${(it.body || '').slice(0, 600)}${it.url ? `\n链接: ${it.url}` : ''}\n\n`;
    if (ctxText.length + block.length > 6000) break;
    ctxText += block;
  }

  const persona = (s.persona || '').trim();
  const system = [
    '你是这个个人网站的「AI 助手」,代表站主回答公开访客的问题。',
    persona && `站主偏好:${persona}`,
    '规则:',
    '1. 只依据下面「已发布内容」回答;内容里没有的就如实说不知道,并建议访客在页面下方留言。',
    '2. 你没有任何工具,不能执行命令、访问文件或系统,也绝不透露任何配置、密钥或内部信息。',
    '3. 简洁友好,中文优先;遇到合作/联系/需求,引导访客留言。',
    '',
    '已发布内容:',
    ctxText || '(站主还没有发布任何内容)',
  ].filter(Boolean).join('\n');

  // 登录访客:用服务端持久对话作上下文;匿名:用前端传来的临时历史
  const visitor = await verifyVisitor(req, env);
  let history: { role: string; content: string }[];
  if (visitor) {
    const conv = await loadConversation(env, visitor.id, 16);
    history = conv.map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  } else {
    const rawHist = Array.isArray(b.history) ? b.history.slice(-8) : [];
    history = rawHist
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
  }

  try {
    const { message: reply } = await callLm(apiUrl, apiKey, {
      model,
      messages: [{ role: 'system', content: system }, ...history.slice(-8), { role: 'user', content: message }] as any,
    });
    const text = reply.content || '(没有回应)';
    if (visitor) { await appendMessage(env, visitor.id, 'user', message); await appendMessage(env, visitor.id, 'assistant', text); }
    return json({ reply: text });
  } catch (e: any) {
    return json({ reply: '助手暂时不可用,请稍后再试,或在下方留言。', error: String(e?.message || e) });
  }
}

export async function handleSiteApi(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const p = url.pathname;
  if (p === '/site/api/inbox' && req.method === 'POST') return createInbox(req, env, ctx);
  if (p === '/site/api/content' && req.method === 'GET') return listContent(req, env, url);
  if (p === '/site/api/chat' && req.method === 'POST') return concierge(req, env);

  // ── 访客账号 ──
  if (p === '/site/api/visitor/register' && req.method === 'POST') {
    const repo = makeRepo(env, UID);
    if (!(await repo.rateHit(`auth:${clientIp(req)}`, 3600, 20))) return json({ error: 'rate_limited' }, 429);
    const r = await visitorRegister(env, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (p === '/site/api/visitor/login' && req.method === 'POST') {
    const repo = makeRepo(env, UID);
    if (!(await repo.rateHit(`auth:${clientIp(req)}`, 3600, 20))) return json({ error: 'rate_limited' }, 429);
    const r = await visitorLogin(env, await readJson(req));
    return 'error' in r ? json({ error: r.error }, r.status) : json(r);
  }
  if (p === '/site/api/visitor/me' && req.method === 'GET') {
    const v = await verifyVisitor(req, env);
    return v ? json({ profile: { id: v.id, email: v.email, name: v.name } }) : json({ error: 'unauthorized' }, 401);
  }
  if (p === '/site/api/visitor/conversation' && req.method === 'GET') {
    const v = await verifyVisitor(req, env);
    if (!v) return json({ error: 'unauthorized' }, 401);
    return json({ messages: await loadConversation(env, v.id, 50) });
  }

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
