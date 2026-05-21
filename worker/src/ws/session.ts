// session domain —— 处理 session.send 帧（用户跟某个 agent 对话）。
//
// 现在每个 session 挂在一个 agent 上（sessions.agent_id）。
// agent 决定 prompt + 工具白名单（maps）；settings 表只提供模型 API 配置。
//
// systemExtra 用来注入运行时数据：must memories + whisper trigger 上下文。
// agent.prompt 跟 systemExtra 拼起来作为 LLM 的 system message。

import { chat, type ChatMessage, type AgentRow } from '../ai/handler';
import type { Env } from '../types';
import type { FrameContext } from './dispatch';

type Broadcast = (frame: unknown) => void;

interface SessionSendInput {
  uid: string;
  sid: string;
  text: string;
  handle: string;
  replyCid?: string;
  replyPeer?: string;
  /** suggest/auto 触发时附加的额外系统提示词（来自 settings.whisper_*_prompt） */
  extraSystem?: string;
  silent?: boolean;
}

interface EventRow {
  id: number; sid: string; uid: string; message: string; meta: string | null; created: number;
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

  // 1. 会话归属 + agent 绑定
  const session = await env.DB.prepare(
    'SELECT id, agent_id, kind, trigger, title FROM sessions WHERE id = ? AND uid = ?'
  ).bind(sid, uid).first<{ id: string; agent_id: string; kind: string; trigger: string | null; title: string }>();
  if (!session) {
    broadcast({ type: 'session.error', sid, message: '会话不存在' });
    return;
  }

  if (!session.agent_id) {
    broadcast({ type: 'session.error', sid, message: '会话未绑定 agent' });
    return;
  }

  // 2. agent + maps
  const agent = await env.DB.prepare(
    'SELECT id, uid, name, emoji, description, prompt, preset FROM agents WHERE id = ? AND uid = ?'
  ).bind(session.agent_id, uid).first<AgentRow>();
  if (!agent) {
    broadcast({ type: 'session.error', sid, message: 'agent 不存在' });
    return;
  }
  const mapRows = await env.DB.prepare(
    'SELECT tool_name FROM maps WHERE agent_id = ?'
  ).bind(agent.id).all<{ tool_name: string }>();
  const toolNames = mapRows.results.map((r) => r.tool_name);

  // 3. 模型 API 配置（暂时所有 agent 共用一份 settings）
  const settings = await env.DB.prepare(
    'SELECT url, "key" as apiKey, model, max_rounds, tool_max_chars, vision FROM settings WHERE uid = ?'
  ).bind(uid).first<{ url: string; apiKey: string; model: string; max_rounds: number; tool_max_chars: number; vision: number }>();
  if (!settings?.url || !settings?.apiKey || !settings?.model) {
    broadcast({ type: 'session.error', sid, message: '请先到「我 → 大模型」配置 API 信息' });
    return;
  }

  // 4. systemExtra：must memories + whisper trigger 上下文
  const extraParts: string[] = [];
  const mustMems = await env.DB.prepare(
    'SELECT title, content, summary FROM memories WHERE uid = ? AND priority = ? ORDER BY updated DESC LIMIT 30'
  ).bind(uid, 'must').all<{ title: string; content: string; summary: string }>();
  for (const m of mustMems.results) {
    extraParts.push(`### ${m.title}\n${m.content || m.summary}`);
  }
  if (extraSystem?.trim()) extraParts.push(extraSystem.trim());

  if (session.trigger) {
    const trig = await env.DB.prepare(
      'SELECT cid, sender, body FROM messages WHERE id = ?'
    ).bind(session.trigger).first<{ cid: string; sender: string; body: string }>();
    if (trig) {
      const transcript = await env.DB.prepare(
        'SELECT sender, body, created FROM messages WHERE cid = ? ORDER BY created ASC LIMIT 200'
      ).bind(trig.cid).all<{ sender: string; body: string; created: number }>();
      const lines = transcript.results.map((m) =>
        `${m.sender === handle ? '我' : '@' + m.sender}: ${m.body}`
      ).join('\n');
      extraParts.push(
        `### 来自其他对话的上下文（用户和 @${trig.sender}）\n${lines || '（仅这一条）'}\n\n` +
        `最新一条来自对方：「${trig.body}」\n用户想跟你私下商量怎么回。`
      );
    }
  }

  // 5. 装历史
  const history = await env.DB.prepare(
    'SELECT id, message FROM events WHERE sid = ? ORDER BY id ASC'
  ).bind(sid).all<EventRow>();
  const messages: ChatMessage[] = [];
  for (const e of history.results) {
    try { messages.push(JSON.parse(e.message) as ChatMessage); } catch {}
  }
  const userMsg: ChatMessage = { role: 'user', content: text };
  messages.push(userMsg);

  // 6. 持久化 + 广播 user 事件
  const userId = await insertEvent(env, sid, uid, userMsg, null);
  emit({ type: 'event', event: { id: userId, sid, message: userMsg } });

  if (!session.title?.trim()) {
    const autoTitle = text.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (autoTitle) {
      await env.DB.prepare('UPDATE sessions SET title = ? WHERE id = ?').bind(autoTitle, sid).run();
      emit({ type: 'session.title', sid, title: autoTitle });
    }
  }

  emit({ type: 'session.thinking', sid });
  await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('thinking', sid).run();

  // 7. 跑 chat 循环（顶层 agent）
  try {
    await chat(messages, {
      agent,
      toolNames,
      apiUrl: settings.url,
      apiKey: settings.apiKey,
      model: settings.model,
      systemExtra: extraParts.join('\n\n') || undefined,
      maxRounds: settings.max_rounds,
      toolResultMaxChars: settings.tool_max_chars,
      vision: !!settings.vision,
      toolContext: { env, uid, handle, replyCid, replyPeer },
      onEvent: async (e) => {
        // 子 agent 的 event 也写入主 session（带上 subAgent 标记，前端可折叠）
        if (e.type === 'assistant_message') {
          const m = (e as any).message;
          const usage = (e as any).usage ?? null;
          const meta: any = {};
          if (usage) meta.usage = usage;
          if ((e as any).subAgent) meta.subAgent = (e as any).subAgent;
          const id = await insertEvent(env, sid, uid, m, Object.keys(meta).length ? meta : null);
          emit({ type: 'event', event: { id, sid, message: m, subAgent: (e as any).subAgent } });
        }
        if (e.type === 'tool_result') {
          const m = (e as any).message;
          const meta: any = {};
          if ((e as any).subAgent) meta.subAgent = (e as any).subAgent;
          const id = await insertEvent(env, sid, uid, m, Object.keys(meta).length ? meta : null);
          emit({ type: 'event', event: { id, sid, message: m, subAgent: (e as any).subAgent } });
        }
      },
    });
  } catch (e: any) {
    await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('error', sid).run();
    emit({ type: 'session.error', sid, message: `调用失败: ${e?.message ?? e}` });
    return;
  }

  await env.DB.prepare('UPDATE sessions SET status = ?, updated = unixepoch() WHERE id = ?').bind('done', sid).run();
  emit({ type: 'session.done', sid });
}

async function insertEvent(env: Env, sid: string, uid: string, message: any, meta: unknown): Promise<number> {
  const r = await env.DB.prepare(
    'INSERT INTO events (sid, uid, message, meta) VALUES (?, ?, ?, ?)'
  ).bind(sid, uid, JSON.stringify(message), meta ? JSON.stringify(meta) : null).run();
  return Number(r.meta?.last_row_id ?? 0);
}
