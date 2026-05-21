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

interface SessionSendInput {
  uid: string;
  sid: string;
  text: string;
  handle: string;
  // 由 auto-reply 入站触发器调用时，告诉 chat() 允许用 conversation_reply
  replyCid?: string;
  replyPeer?: string;
  // 由 suggest/auto 触发时附加的额外系统提示词（来自 settings.whisper_*_prompt）
  extraSystem?: string;
  // 不广播 thinking/done（auto 触发的后台 session 不需要打扰用户）
  silent?: boolean;
}

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

export async function runSessionSend(env: Env, input: SessionSendInput, broadcast: Broadcast): Promise<void> {
  const { uid, sid, text, handle, extraSystem, replyCid, replyPeer, silent } = input;
  const emit = silent ? (() => {}) : broadcast;
  if (!sid || !text?.trim()) {
    broadcast({ type: 'session.error', sid, message: 'sid 和 text 必填' });
    return;
  }

  // 1. 会话归属 + 取 trigger
  const session = await env.DB.prepare(
    'SELECT id, kind, trigger, title FROM sessions WHERE id = ? AND uid = ?'
  ).bind(sid, uid).first<{ id: string; kind: string; trigger: string | null; title: string }>();
  if (!session) {
    broadcast({ type: 'session.error', sid, message: '会话不存在' });
    return;
  }

  // 2. 模型配置
  const settings = await env.DB.prepare(
    'SELECT prompt, url, "key" as apiKey, model, max_rounds, tool_max_chars, vision FROM settings WHERE uid = ?'
  ).bind(uid).first<{ prompt: string; url: string; apiKey: string; model: string; max_rounds: number; tool_max_chars: number; vision: number }>();
  // 外部传入的 extraSystem 已经包含模式特定提示词，这里不再读取 whisper_*_prompt
  if (!settings?.url || !settings?.apiKey || !settings?.model) {
    broadcast({ type: 'session.error', sid, message: '请先到「设置 → 大模型」配置 API 信息' });
    return;
  }

  // 3. 装上下文：完全从 DB 读，不混硬编码指令
  //   - settings.prompt（用户人设，能看能编）
  //   - 所有 priority=must 的记忆（系统指令也以记忆形式存在，能看能编能删）
  //   - 若是悄悄商量场景，再注入对话 transcript 作为数据
  const systemParts: string[] = [];
  if (settings.prompt?.trim()) systemParts.push(settings.prompt.trim());

  const mustMems = await env.DB.prepare(
    'SELECT title, content, summary FROM memories WHERE uid = ? AND priority = ? ORDER BY updated DESC LIMIT 30'
  ).bind(uid, 'must').all<{ title: string; content: string; summary: string }>();
  for (const m of mustMems.results) {
    systemParts.push(`### ${m.title}\n${m.content || m.summary}`);
  }

  // 模式特定提示词（由调用方根据 settings.whisper_*_prompt 准备好后传入）
  if (extraSystem?.trim()) systemParts.push(extraSystem.trim());

  if (session.trigger) {
    const trig = await env.DB.prepare(
      'SELECT cid, sender, body FROM messages WHERE id = ?'
    ).bind(session.trigger).first<{ cid: string; sender: string; body: string }>();
    if (trig) {
      const transcript = await env.DB.prepare(
        'SELECT sender, body, created FROM messages WHERE cid = ? ORDER BY created ASC LIMIT 200'
      ).bind(trig.cid).all<{ sender: string; body: string; created: number }>();

      const lines = transcript.results.map((m) => {
        const who = m.sender === handle ? '我' : `@${m.sender}`;
        return `${who}: ${m.body}`;
      }).join('\n');

      systemParts.push(
        `### 来自其他对话的上下文（用户和 @${trig.sender}）\n` +
        `${lines || '（仅这一条）'}\n` +
        `\n最新一条来自对方：「${trig.body}」\n` +
        `用户想跟你私下商量怎么回。`
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
  emit({ type: 'event', event: { id: userId, sid, message: userMsg } });

  // 首条消息自动起标题：取前 20 字
  if (!session.title?.trim()) {
    const autoTitle = text.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (autoTitle) {
      await env.DB.prepare('UPDATE sessions SET title = ? WHERE id = ?').bind(autoTitle, sid).run();
      emit({ type: 'session.title', sid, title: autoTitle });
    }
  }

  emit({ type: 'session.thinking', sid });
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
      vision: !!settings.vision,
      toolContext: { env, uid, handle, replyCid, replyPeer },
      onEvent: async (e) => {
        if (e.type === 'assistant_message') {
          const m = (e as any).message;
          const usage = (e as any).usage ?? null;
          const id = await insertEvent(env, sid, uid, m, usage ? { usage } : null);
          emit({ type: 'event', event: { id, sid, message: m } });
        }
        if (e.type === 'tool_result') {
          const m = (e as any).message;
          const id = await insertEvent(env, sid, uid, m, null);
          emit({ type: 'event', event: { id, sid, message: m } });
        }
      },
    });
  } catch (e: any) {
    await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('error', sid).run();
    emit({ type: 'session.error', sid, message: `调用失败: ${e?.message ?? e}` });
    return;
  }

  // 6. 收尾
  await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('done', sid).run();
  emit({ type: 'session.done', sid });
}

async function insertEvent(env: Env, sid: string, uid: string, message: any, meta: unknown): Promise<number> {
  const r = await env.DB.prepare(
    'INSERT INTO events (sid, uid, message, meta) VALUES (?, ?, ?, ?)'
  ).bind(sid, uid, JSON.stringify(message), meta ? JSON.stringify(meta) : null).run();
  return Number(r.meta?.last_row_id ?? 0);
}
