import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json, newId } from './helpers';
import { pushToHandle } from '../ws/status';
import { runSessionSend } from '../ws/session';

export async function handleConversationList(_request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT c.id, c.preview, c.updated, c.created, m.unread,
           (SELECT handle FROM members WHERE cid = c.id AND handle != ? LIMIT 1) as peer
    FROM conversations c
    JOIN members m ON m.cid = c.id AND m.handle = ?
    ORDER BY c.updated DESC
    LIMIT 50
  `).bind(ctx.me.handle, ctx.me.handle).all();
  return json(rows.results);
}

export async function handleConversationCreate(request: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { peer } = await request.json<any>();
  if (!peer) return err('peer required');
  if (peer === ctx.me.handle) return err('cannot message yourself');
  const peerUser = await env.DB.prepare('SELECT handle FROM users WHERE handle = ?').bind(peer).first();
  if (!peerUser) return err('user not found', 404);
  const existing = await env.DB.prepare(`
    SELECT c.id FROM conversations c
    JOIN members m1 ON m1.cid = c.id AND m1.handle = ?
    JOIN members m2 ON m2.cid = c.id AND m2.handle = ?
  `).bind(ctx.me.handle, peer).first<{ id: string }>();
  if (existing) return json({ id: existing.id });
  const id = newId();
  await env.DB.prepare('INSERT INTO conversations (id) VALUES (?)').bind(id).run();
  await env.DB.prepare('INSERT INTO members (cid, handle) VALUES (?,?),(?,?)')
    .bind(id, ctx.me.handle, id, peer).run();
  return json({ id }, { status: 201 });
}

export async function handleMessages(request: Request, env: Env, ctx: Ctx, cid: string): Promise<Response> {
  const member = await env.DB.prepare('SELECT handle FROM members WHERE cid = ? AND handle = ?')
    .bind(cid, ctx.me.handle).first();
  if (!member) return err('not found', 404);

  if (ctx.method === 'GET') {
    const before = ctx.url.searchParams.get('before');
    const rows = await env.DB.prepare(
      before
        ? 'SELECT * FROM messages WHERE cid = ? AND created < ? ORDER BY created DESC LIMIT 50'
        : 'SELECT * FROM messages WHERE cid = ? ORDER BY created DESC LIMIT 50'
    ).bind(...(before ? [cid, Number(before)] : [cid])).all();
    await env.DB.prepare('UPDATE members SET unread = 0 WHERE cid = ? AND handle = ?')
      .bind(cid, ctx.me.handle).run();
    return json(rows.results.reverse());
  }

  if (ctx.method === 'POST') {
    const { body } = await request.json<any>();
    if (!body) return err('body required');
    const id = newId();
    const created = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO messages (id,cid,sender,body,created) VALUES (?,?,?,?,?)')
      .bind(id, cid, ctx.me.handle, body, created).run();
    await env.DB.prepare('UPDATE conversations SET preview = ?, updated = ? WHERE id = ?')
      .bind(body.slice(0, 80), created, cid).run();
    await env.DB.prepare('UPDATE members SET unread = unread + 1 WHERE cid = ? AND handle != ?')
      .bind(cid, ctx.me.handle).run();

    const members = await env.DB.prepare('SELECT handle FROM members WHERE cid = ?')
      .bind(cid).all<{ handle: string }>();
    const msg = { id, cid, sender: ctx.me.handle, body, created };
    for (const { handle } of members.results) {
      await pushToHandle(env, handle, { type: 'message', message: msg });
    }

    // 触发其他成员的智能体（按各自 whisper_mode）
    for (const { handle: peerHandle } of members.results) {
      if (peerHandle === ctx.me.handle) continue;  // 不触发发件人自己
      ctx.execCtx.waitUntil(triggerWhisper(env, peerHandle, id, ctx.me.handle, cid));
    }

    return json(msg, { status: 201 });
  }

  return new Response('method not allowed', { status: 405 });
}

// 入站消息触发收件人的智能体：按 whisper_mode 决定行为。
// silent=不做事；suggest=建议草稿；auto=代发回复（带 conversation_reply 工具）。
async function triggerWhisper(
  env: Env,
  peerHandle: string,
  triggerMsgId: string,
  senderHandle: string,
  cid: string,
): Promise<void> {
  try {
    const peer = await env.DB.prepare('SELECT id FROM users WHERE handle = ?').bind(peerHandle).first<{ id: string }>();
    if (!peer) return;

    const s = await env.DB.prepare(
      'SELECT whisper_mode, whisper_suggest_prompt, whisper_auto_prompt FROM settings WHERE uid = ?'
    ).bind(peer.id).first<{ whisper_mode: string; whisper_suggest_prompt: string; whisper_auto_prompt: string }>();
    const mode = s?.whisper_mode ?? 'silent';
    if (mode === 'silent') return;

    // 创建一个 agent session，trigger 指向触发消息
    const sid = newId();
    await env.DB.prepare(
      'INSERT INTO sessions (id, uid, kind, status, title, trigger) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(sid, peer.id, 'agent', 'done', mode === 'auto' ? '自动回复' : '主动建议', triggerMsgId).run();

    const extraSystem = (mode === 'suggest' ? s?.whisper_suggest_prompt : s?.whisper_auto_prompt) ?? '';
    const seedText = '收到对方一条新消息，请按当前模式的要求处理。';

    await runSessionSend(
      env,
      {
        uid: peer.id,
        sid,
        text: seedText,
        handle: peerHandle,
        extraSystem,
        ...(mode === 'auto' ? { replyCid: cid, replyPeer: senderHandle } : {}),
        silent: false,  // 仍广播到 peer 的 WS，让他打开就能看到智能体的活动
      },
      // 给 peerHandle 广播，不是给当前 sender
      (frame) => { void pushToHandle(env, peerHandle, frame); },
    );
  } catch {
    // 触发失败不影响正常消息送达
  }
}
