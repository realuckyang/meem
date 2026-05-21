// session domain —— 处理所有 session.* 帧（人↔AI agent 对话）。
//
// 持久化：events 表，一行一条 LLM 标准消息。
// 工具循环：内置在 ai/handler.chat()，按需调 functions.* → DO /dispatch → 扩展执行。
// trigger 注入：若 session 是由别人的某条消息触发的（kind='agent' + trigger=msgId），
//   在 system prompt 里告诉 LLM 它正在协助讨论哪条来信。

import { chat, type ChatMessage } from '../ai/handler';
import type { Env } from '../types';
import type { FrameContext } from './dispatch';

type Broadcast = (frame: unknown) => void;

interface SessionSendInput { uid: string; sid: string; text: string; handle: string; }

interface EventRow {
  id: number;
  sid: string;
  uid: string;
  message: string;
  meta: string | null;
  created: number;
}

// ── 帧路由 ──────────────────────────────────────────────────────────────────

export async function handle(ctx: FrameContext, frame: { type: string; [k: string]: any }): Promise<void> {
  switch (frame.type) {
    case 'session.send':
      return runSessionSend(
        ctx.env,
        { uid: ctx.uid, sid: String(frame.sid ?? ''), text: String(frame.text ?? ''), handle: ctx.handle },
        ctx.broadcast,
      );
    default: return;
  }
}

// ── 业务：发一条消息 ────────────────────────────────────────────────────────

async function runSessionSend(env: Env, input: SessionSendInput, broadcast: Broadcast): Promise<void> {
  const { uid, sid, text, handle } = input;
  if (!sid || !text?.trim()) {
    broadcast({ type: 'session.error', sid, message: 'sid 和 text 必填' });
    return;
  }

  // 1. 会话归属 + 取 trigger
  const session = await env.DB.prepare(
    'SELECT id, kind, trigger FROM sessions WHERE id = ? AND uid = ?'
  ).bind(sid, uid).first<{ id: string; kind: string; trigger: string | null }>();
  if (!session) {
    broadcast({ type: 'session.error', sid, message: '会话不存在' });
    return;
  }

  // 2. 模型配置
  const settings = await env.DB.prepare(
    'SELECT prompt, url, "key" as apiKey, model, max_rounds, tool_max_chars FROM settings WHERE uid = ?'
  ).bind(uid).first<{ prompt: string; url: string; apiKey: string; model: string; max_rounds: number; tool_max_chars: number }>();
  if (!settings?.url || !settings?.apiKey || !settings?.model) {
    broadcast({ type: 'session.error', sid, message: '请先到「设置 → 大模型」配置 API 信息' });
    return;
  }

  // 3. 装上下文：base prompt + must 记忆 + trigger 注入（如有） + 历史 + 当前用户消息
  const systemParts: string[] = [];
  if (settings.prompt?.trim()) systemParts.push(settings.prompt.trim());

  // must 优先级记忆——每次对话都注入
  const mustMems = await env.DB.prepare(
    'SELECT title, content, summary FROM memories WHERE uid = ? AND priority = ? ORDER BY updated DESC LIMIT 30'
  ).bind(uid, 'must').all<{ title: string; content: string; summary: string }>();
  if (mustMems.results.length) {
    const memText = mustMems.results
      .map((m) => `### ${m.title}\n${m.content || m.summary}`)
      .join('\n\n');
    systemParts.push(
      `# 关于用户（务必记住）\n\n${memText}\n\n` +
      `如果用户透露了新的重要信息，或者你发现已有记忆需要更新，主动调用 memory_add / memory_edit。\n` +
      `还有更多记忆通过 memory_search 可以查到。`
    );
  } else {
    systemParts.push(
      `你有一个记忆库——通过 memory_search / memory_list 查询，通过 memory_add / memory_edit / memory_delete 管理。\n` +
      `当用户透露关于自己的重要信息（偏好、关键事实、长期目标），主动用 memory_add 记下来。`
    );
  }

  if (session.trigger) {
    const trig = await env.DB.prepare(
      'SELECT sender, body, created FROM messages WHERE id = ?'
    ).bind(session.trigger).first<{ sender: string; body: string; created: number }>();
    if (trig) {
      systemParts.push(
        `你正在帮用户私下讨论一条收到的消息（用户不会回到原对话直接发），上下文如下：\n` +
        `发件人：@${trig.sender}\n` +
        `内容：${trig.body}\n\n` +
        `接下来用户会跟你商量怎么解读、怎么回。你可以帮他思考、起草回复、查信息。`
      );
    }
  }
  const systemPrompt = systemParts.join('\n\n');

  const history = await env.DB.prepare(
    'SELECT id, message FROM events WHERE sid = ? ORDER BY id ASC'
  ).bind(sid).all<EventRow>();

  const messages: ChatMessage[] = [];
  for (const e of history.results) {
    try { messages.push(JSON.parse(e.message) as ChatMessage); } catch {}
  }
  const userMsg: ChatMessage = { role: 'user', content: text };
  messages.push(userMsg);

  // 4. 持久化 + 广播 user 事件
  const userId = await insertEvent(env, sid, uid, userMsg, null);
  broadcast({ type: 'event', event: { id: userId, sid, message: userMsg } });

  broadcast({ type: 'session.thinking', sid });
  await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('thinking', sid).run();

  // 5. 跑 chat loop——每个 assistant_message / tool_result 都通过 onEvent 直接持久化
  try {
    await chat(messages, {
      apiUrl: settings.url,
      apiKey: settings.apiKey,
      model: settings.model,
      system: systemPrompt || undefined,
      maxRounds: settings.max_rounds,
      toolResultMaxChars: settings.tool_max_chars,
      toolContext: { env, uid, handle },
      onEvent: async (e) => {
        if (e.type === 'assistant_message') {
          const m = (e as any).message;
          const usage = (e as any).usage ?? null;
          const id = await insertEvent(env, sid, uid, m, usage ? { usage } : null);
          broadcast({ type: 'event', event: { id, sid, message: m } });
        }
        if (e.type === 'tool_result') {
          const m = (e as any).message;
          const id = await insertEvent(env, sid, uid, m, null);
          broadcast({ type: 'event', event: { id, sid, message: m } });
        }
      },
    });
  } catch (e: any) {
    await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('error', sid).run();
    broadcast({ type: 'session.error', sid, message: `调用失败: ${e?.message ?? e}` });
    return;
  }

  // 6. 收尾
  await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('done', sid).run();
  broadcast({ type: 'session.done', sid });
}

async function insertEvent(env: Env, sid: string, uid: string, message: any, meta: unknown): Promise<number> {
  const r = await env.DB.prepare(
    'INSERT INTO events (sid, uid, message, meta) VALUES (?, ?, ?, ?)'
  ).bind(sid, uid, JSON.stringify(message), meta ? JSON.stringify(meta) : null).run();
  return Number(r.meta?.last_row_id ?? 0);
}
