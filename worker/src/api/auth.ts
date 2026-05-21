import { b64url, hashPassword, signToken } from '../auth';
import type { Env } from '../types';
import { err, json, newId } from './helpers';

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { handle, password, name = '' } = await request.json<any>();
  if (!handle || !password) return err('handle and password required');
  const existing = await env.DB.prepare('SELECT id FROM users WHERE handle = ?').bind(handle).first();
  if (existing) return err('handle taken', 409);
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, salt);
  const secret = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const id = newId();
  await env.DB.prepare('INSERT INTO users (id,handle,name,salt,hash,secret) VALUES (?,?,?,?,?,?)')
    .bind(id, handle, name, salt, hash, secret).run();
  await env.DB.prepare('INSERT INTO settings (uid) VALUES (?)').bind(id).run();
  await seedDefaultMemories(env, id);
  await seedPresetAgents(env, id);
  const token = await signToken(id, secret);
  return json({ token, handle, name });
}

const SEED_MEMORIES: { title: string; summary: string; content: string }[] = [
  {
    title: '记忆使用指引',
    summary: '何时调用 memory_* 工具维护长期记忆',
    content: `你拥有一个长期记忆库，通过 5 个工具维护：

- memory_search(query) — 按关键词搜索
- memory_list(priority?) — 列出（可按优先级过滤）
- memory_add({title, content, priority?}) — 新增；priority 默认 stored
- memory_edit({id, ...}) — 修改
- memory_delete({id}) — 仅在用户明确要求"忘记"或记忆完全过时时使用

优先级：
- must     每次对话都注入到系统提示
- starred  重要参考，可被搜到
- stored   默认级别，安静放着待检索

当用户透露重要事实（偏好、关键身份、长期目标、人际关系、习惯）时，主动调用 memory_add 记下来。
当发现旧记忆过时或可丰富时，主动 memory_edit 更新。`,
  },
  {
    title: '建议输出格式',
    summary: '在合适场景下，回复末尾追加 <suggestions> JSON 区块',
    content: `当用户需要"接下来怎么办"的可点击选项时，在回复**末尾**追加一段建议区块：

<suggestions>
[
  {"type": "reply", "text": "给对方的回复草稿，短、自然、直接可发"},
  {"type": "ask",   "text": "用户可能想继续问你的方向"}
]
</suggestions>

- type=reply：仅在「悄悄商量」场景下有意义——给对话中"对方"的回复草稿。点击后会塞进用户给对方的主输入框。
- type=ask：用户可能想继续追问你的话题。点击后塞进当前对话的输入框。
- 每种 0-3 条
- 严格合法 JSON 数组，不要在 <suggestions> 内加其他文字、注释或代码块标记
- 没有合适建议就不要输出这段，正常结束就行`,
  },
];

async function seedDefaultMemories(env: Env, uid: string): Promise<void> {
  for (const m of SEED_MEMORIES) {
    await env.DB.prepare(
      'INSERT INTO memories (id, uid, title, summary, content, priority) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(newId(), uid, m.title, m.summary, m.content, 'must').run();
  }
}

const SEED_AGENTS: { preset: string; name: string; emoji: string; description: string; prompt: string; tools: string[] }[] = [
  { preset: 'chief',   name: '主助手',     emoji: '🤖',
    description: '你的主智能体，负责对话和编排其他专才', prompt: '',
    tools: ['conversation_reply', 'use_browser', 'use_memory', 'use_feed'] },
  { preset: 'browser', name: '浏览器助手', emoji: '🌐',
    description: '帮你操作浏览器：打开标签、导航、执行脚本、截图',
    prompt: '你是浏览器专才。用户会给你一个任务，请利用浏览器工具完成它，给出简洁的执行结果。如果需要多步操作，自己规划顺序。',
    tools: ['browser_status','browser_open_tab','browser_tabs','browser_activate_tab','browser_close_tab','browser_navigate','browser_evaluate','browser_screenshot'] },
  { preset: 'memory',  name: '记忆管家',   emoji: '🧠',
    description: '管理你的长期记忆：增删改查',
    prompt: '你是记忆管家。用户会给你一个记忆相关的任务。请自行决定：是否值得记？记成什么优先级（must/starred/stored）？该 add 还是先查再 edit？给出操作结果摘要。',
    tools: ['memory_search','memory_list','memory_add','memory_edit','memory_delete'] },
  { preset: 'feed',    name: '广播官',     emoji: '📣',
    description: '帮你浏览社区、发广播、评论、点赞',
    prompt: '你是社区广播专才。用户会给你一个社区互动任务。请利用 feed_* 工具完成，给出执行结果。注意社交分寸。',
    tools: ['feed_list','feed_search','feed_read','feed_post','feed_comment','feed_like'] },
  { preset: 'whisper', name: '私聊参谋',   emoji: '🤫',
    description: '基于你和别人的对话，私下帮你出主意',
    prompt: '你是用户的私聊参谋。用户会让你帮他想怎么回复别人。请基于已有的对话上下文，给出回复建议或处理思路。',
    tools: ['conversation_reply','use_browser','use_memory','use_feed'] },
];

async function seedPresetAgents(env: Env, uid: string): Promise<void> {
  for (const a of SEED_AGENTS) {
    const id = `${a.preset}_${uid}`;
    await env.DB.prepare(
      'INSERT INTO agents (id, uid, name, emoji, description, prompt, preset) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, uid, a.name, a.emoji, a.description, a.prompt, a.preset).run();
    for (const t of a.tools) {
      await env.DB.prepare('INSERT INTO maps (agent_id, tool_name) VALUES (?, ?)').bind(id, t).run();
    }
  }
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { handle, password } = await request.json<any>();
  if (!handle || !password) return err('handle and password required');
  const user = await env.DB.prepare('SELECT id,handle,name,salt,hash,secret FROM users WHERE handle = ?')
    .bind(handle).first<{ id: string; handle: string; name: string; salt: string; hash: string; secret: string }>();
  if (!user) return err('invalid credentials', 401);
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.hash) return err('invalid credentials', 401);
  const token = await signToken(user.id, user.secret);
  return json({ token, handle: user.handle, name: user.name });
}
