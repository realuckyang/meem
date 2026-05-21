// /api/agents —— 用户的智能体实例 CRUD + 工具勾选
//
// GET  /api/agents                      列出我的所有 agent
// GET  /api/agents/:id                  单个 agent 详情（含 tools 数组）
// POST /api/agents                      新建（emoji/name/desc/prompt + tools[]）
// PATCH /api/agents/:id                 更新字段 + 可选 tools 全量替换
// DELETE /api/agents/:id                删除（preset 不可删）
// GET  /api/registry                    列出所有可勾的工具元数据
// POST /api/agents/seed                 为当前用户播种预置（用于注册后兜底）

import type { Env } from '../types';
import type { Ctx } from './helpers';
import { err, json, newId } from './helpers';
import { REGISTRY } from '../ai/handler';

interface AgentRow {
  id: string; uid: string; name: string; emoji: string; description: string;
  prompt: string; preset: string | null; created: number; updated: number;
}

async function loadTools(env: Env, agentId: string): Promise<string[]> {
  const rows = await env.DB.prepare('SELECT tool_name FROM maps WHERE agent_id = ?')
    .bind(agentId).all<{ tool_name: string }>();
  return rows.results.map((r) => r.tool_name);
}

async function setTools(env: Env, agentId: string, tools: string[]): Promise<void> {
  const valid = tools.filter((t) => REGISTRY[t]);
  await env.DB.prepare('DELETE FROM maps WHERE agent_id = ?').bind(agentId).run();
  if (valid.length === 0) return;
  // 批量 insert
  await env.DB.batch(valid.map((t) =>
    env.DB.prepare('INSERT INTO maps (agent_id, tool_name) VALUES (?, ?)').bind(agentId, t)
  ));
}

export async function handleAgentList(_req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, uid, name, emoji, description, prompt, preset, created, updated FROM agents WHERE uid = ? ORDER BY preset IS NOT NULL DESC, updated DESC'
  ).bind(ctx.me.id).all<AgentRow>();
  return json(rows.results);
}

export async function handleAgentCreate(req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const { name, emoji = '🤖', description = '', prompt = '', tools = [] } = await req.json<any>();
  if (!String(name ?? '').trim()) return err('name 必填');

  const id = `cust_${newId().slice(0, 12)}`;
  await env.DB.prepare(
    'INSERT INTO agents (id, uid, name, emoji, description, prompt, preset) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, ctx.me.id, String(name).trim(), String(emoji), String(description), String(prompt), null).run();

  if (Array.isArray(tools) && tools.length) await setTools(env, id, tools.map(String));

  const row = await env.DB.prepare(
    'SELECT id, uid, name, emoji, description, prompt, preset, created, updated FROM agents WHERE id = ?'
  ).bind(id).first<AgentRow>();
  return json({ ...row, tools: await loadTools(env, id) }, { status: 201 });
}

export async function handleAgent(req: Request, env: Env, ctx: Ctx, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT id, uid, name, emoji, description, prompt, preset, created, updated FROM agents WHERE id = ? AND uid = ?'
  ).bind(id, ctx.me.id).first<AgentRow>();
  if (!row) return err('not found', 404);

  if (ctx.method === 'GET') {
    return json({ ...row, tools: await loadTools(env, id) });
  }

  if (ctx.method === 'PATCH') {
    const body = await req.json<any>();
    const fields: string[] = ['updated = unixepoch()'];
    const vals: unknown[] = [];
    if (body.name !== undefined)        { fields.push('name = ?');        vals.push(String(body.name)); }
    if (body.emoji !== undefined)       { fields.push('emoji = ?');       vals.push(String(body.emoji)); }
    if (body.description !== undefined) { fields.push('description = ?'); vals.push(String(body.description)); }
    if (body.prompt !== undefined)      { fields.push('prompt = ?');      vals.push(String(body.prompt)); }
    if (fields.length > 1) {
      vals.push(id, ctx.me.id);
      await env.DB.prepare(`UPDATE agents SET ${fields.join(',')} WHERE id = ? AND uid = ?`).bind(...vals).run();
    }
    if (Array.isArray(body.tools)) {
      await setTools(env, id, body.tools.map(String));
    }
    const fresh = await env.DB.prepare(
      'SELECT id, uid, name, emoji, description, prompt, preset, created, updated FROM agents WHERE id = ?'
    ).bind(id).first<AgentRow>();
    return json({ ...fresh, tools: await loadTools(env, id) });
  }

  if (ctx.method === 'DELETE') {
    if (row.preset) return err('预置 agent 不可删除', 400);
    // 顺便删 maps + sessions（孤儿会话直接清掉）
    await env.DB.batch([
      env.DB.prepare('DELETE FROM maps WHERE agent_id = ?').bind(id),
      env.DB.prepare('DELETE FROM events WHERE sid IN (SELECT id FROM sessions WHERE agent_id = ?)').bind(id),
      env.DB.prepare('DELETE FROM sessions WHERE agent_id = ?').bind(id),
      env.DB.prepare('DELETE FROM agents WHERE id = ? AND uid = ?').bind(id, ctx.me.id),
    ]);
    return json({ ok: true });
  }

  return new Response('method not allowed', { status: 405 });
}

// 列出注册表里所有工具元数据（供前端勾选 UI 渲染分组）
export async function handleRegistry(_req: Request, _env: Env, _ctx: Ctx): Promise<Response> {
  const out = Object.values(REGISTRY).map((def: any) => ({
    name:        def.name,
    description: def.description,
    kind:        def.kind,
    target_preset: def.target_preset ?? null,
  }));
  return json(out);
}

// 兜底播种：为当前用户补齐五个预置 agent（若已有则跳过）
export async function handleAgentSeed(_req: Request, env: Env, ctx: Ctx): Promise<Response> {
  const presets: { preset: string; name: string; emoji: string; description: string; prompt: string; tools: string[] }[] = [
    { preset: 'chief',   name: '主助手',     emoji: '🤖',
      description: '你的主智能体，负责对话和编排其他专才',
      prompt: '',
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

  for (const p of presets) {
    const existing = await env.DB.prepare(
      'SELECT id FROM agents WHERE uid = ? AND preset = ?'
    ).bind(ctx.me.id, p.preset).first<{ id: string }>();
    if (existing) continue;
    const id = `${p.preset}_${ctx.me.id}`;
    await env.DB.prepare(
      'INSERT INTO agents (id, uid, name, emoji, description, prompt, preset) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, ctx.me.id, p.name, p.emoji, p.description, p.prompt, p.preset).run();
    await setTools(env, id, p.tools);
  }
  return json({ ok: true });
}
