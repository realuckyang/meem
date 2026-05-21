// chat() —— 递归 LLM agentic loop，支持子 agent (use_X)。
//
// 调用方传入：
//   - agentId: 当前 chat 跑的是哪个 agent 实例（决定 prompt + tools）
//   - messages: 用户输入历史
//   - 配置：apiUrl/key/model/vision/toolContext
//
// 当 LLM 调用 use_X(task) 时：
//   - 用 ctx.uid + REGISTRY[use_X].target_preset 查找子 agent（同一用户的同 preset 实例）
//   - 递归 chat()，把 task 作为 user 消息塞进去
//   - 子 agent 的 final text 作为 tool result 回灌主 agent

import { runTools, type ToolCall, type ToolMessage } from './runner';
import { normalizeAgentMessages, normalizeChatOptions, truncateToolResult, type ChatOptions } from './utils';
// @ts-ignore — JS module
import { callLlmRegular } from '../llm/index.js';
import type { ToolContext } from './functions';
import { buildToolsForAgent, getToolDef, REGISTRY } from './registry';
import type { Env } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatEvent {
  type: 'assistant_message' | 'tool_result' | 'done' | 'error';
  [k: string]: any;
}

export interface AgentRow {
  id: string;
  uid: string;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  preset: string | null;
}

export interface ChatConfig extends ChatOptions {
  agent: AgentRow;
  toolNames: string[];                 // 从 maps 表读出来的工具白名单
  apiUrl: string;
  apiKey: string;
  model: string;
  provider?: string;
  /** 额外注入的 system 文本（例如 must memories、whisper trigger 上下文） */
  systemExtra?: string;
  vision?: boolean;
  toolContext: ToolContext;
  /** 递归深度，默认 0；保护 LLM 抽风 */
  depth?: number;
  /** 调用栈（agent preset 名），防自环 */
  callStack?: string[];
  onEvent?: (e: ChatEvent) => void | Promise<void>;
}

export interface ChatResult {
  text: string;
  messages: ChatMessage[];
}

const MAX_DEPTH = 4;

export async function chat(input: ChatMessage[], config: ChatConfig): Promise<ChatResult> {
  const opts = normalizeChatOptions(config);
  const depth = config.depth ?? 0;
  const callStack = config.callStack ?? [];

  if (depth > MAX_DEPTH) {
    const text = `(agent 嵌套深度超过 ${MAX_DEPTH}，已中止)`;
    await config.onEvent?.({ type: 'error', message: text });
    return { text, messages: [] };
  }

  // 装 system prompt：agent.prompt + systemExtra
  const systemParts: string[] = [];
  if (config.agent.prompt?.trim()) systemParts.push(config.agent.prompt.trim());
  if (config.systemExtra?.trim()) systemParts.push(config.systemExtra.trim());
  const systemPrompt = systemParts.join('\n\n');

  const workMessages: ChatMessage[] = [];
  if (systemPrompt) workMessages.push({ role: 'system', content: systemPrompt });
  workMessages.push(...normalizeAgentMessages(input, {
    model: config.model, apiUrl: config.apiUrl, provider: config.provider,
  }) as ChatMessage[]);

  const exposedTools = buildToolsForAgent(config.toolNames, {
    vision: config.vision, toolContext: config.toolContext,
  });

  let round = 0;
  while (round++ < opts.maxRounds) {
    const payload = { model: config.model, messages: workMessages, tools: exposedTools };
    const { message, usage }: { message: any; usage: any } =
      await callLlmRegular(config.apiUrl, config.apiKey, payload, { provider: config.provider });

    if (!message.role) message.role = 'assistant';
    workMessages.push(message);
    await config.onEvent?.({ type: 'assistant_message', message, usage });

    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls as ToolCall[] : [];
    if (toolCalls.length === 0) {
      const text: string = message?.content ?? '';
      await config.onEvent?.({ type: 'done', text });
      return { text, messages: workMessages };
    }

    // 分流：function vs agent
    const fnCalls: ToolCall[] = [];
    const agentCalls: ToolCall[] = [];
    for (const tc of toolCalls) {
      const def = getToolDef(tc.function.name);
      if (!def) {
        // 未知工具：当成 function 让 runner 报错
        fnCalls.push(tc);
        continue;
      }
      if (def.kind === 'function') fnCalls.push(tc);
      else if (def.kind === 'agent') agentCalls.push(tc);
      else fnCalls.push(tc);  // trigger 暂不实现，当 function 处理（runner 会 error）
    }

    // function 调用走原有 runner
    if (fnCalls.length > 0) {
      const toolMessages: ToolMessage[] = await runTools(fnCalls, {
        toolContext: config.toolContext,
        enableToolResultTruncate: opts.enableToolResultTruncate,
        toolResultMaxChars: opts.toolResultMaxChars,
        onResult: (m) => config.onEvent?.({ type: 'tool_result', message: m }),
      });
      for (const m of toolMessages) workMessages.push(m as ChatMessage);
    }

    // agent 调用：递归 chat()
    for (const tc of agentCalls) {
      const def = getToolDef(tc.function.name)!;
      if (def.kind !== 'agent') continue;
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      const task = String(args?.task ?? '').trim() || '（无内容）';

      const subAgent = await lookupAgent(config.toolContext.env, config.toolContext.uid, def.target_preset);
      let resultText: string;
      if (!subAgent) {
        resultText = `tool error: 找不到 preset='${def.target_preset}' 的子 agent`;
      } else if (callStack.includes(def.target_preset)) {
        resultText = `tool error: 检测到自环调用 (${[...callStack, def.target_preset].join(' → ')})`;
      } else {
        const subToolNames = await lookupMaps(config.toolContext.env, subAgent.id);
        try {
          const subResult = await chat(
            [{ role: 'user', content: task }],
            {
              ...config,
              agent: subAgent,
              toolNames: subToolNames,
              depth: depth + 1,
              callStack: [...callStack, def.target_preset],
              // 子 agent 的事件向上抛带上 parent 标记
              onEvent: (e) => config.onEvent?.({ ...e, subAgent: subAgent.preset }),
              // 子 agent 不继承 systemExtra（whisper 上下文等是主 agent 专属）
              systemExtra: undefined,
            },
          );
          resultText = subResult.text || '（子 agent 无输出）';
        } catch (e: any) {
          resultText = `tool error: ${e?.message ?? e}`;
        }
      }

      const truncated = truncateToolResult(resultText, {
        enabled: opts.enableToolResultTruncate,
        maxChars: opts.toolResultMaxChars,
      });
      const m: ToolMessage = { role: 'tool', tool_call_id: tc.id, content: truncated.content };
      workMessages.push(m as ChatMessage);
      await config.onEvent?.({ type: 'tool_result', message: m });
    }
  }

  const text = '(达到最大轮次限制)';
  const overflow: ChatMessage = { role: 'assistant', content: text };
  workMessages.push(overflow);
  await config.onEvent?.({ type: 'assistant_message', message: overflow, usage: null });
  await config.onEvent?.({ type: 'done', text });
  return { text, messages: workMessages };
}

// ── 辅助：从 DB 查子 agent + maps ──────────────────────────────────────────

async function lookupAgent(env: Env, uid: string, preset: string): Promise<AgentRow | null> {
  return env.DB.prepare(
    'SELECT id, uid, name, emoji, description, prompt, preset FROM agents WHERE uid = ? AND preset = ? LIMIT 1'
  ).bind(uid, preset).first<AgentRow>();
}

async function lookupMaps(env: Env, agentId: string): Promise<string[]> {
  const rows = await env.DB.prepare(
    'SELECT tool_name FROM maps WHERE agent_id = ?'
  ).bind(agentId).all<{ tool_name: string }>();
  return rows.results.map((r) => r.tool_name);
}

export { REGISTRY };
