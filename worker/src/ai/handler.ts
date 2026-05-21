// chat() —— LLM agentic loop。
//
// 用法：
//   const result = await chat(messages, {
//     apiUrl, apiKey, model, system,
//     toolContext: { env, handle },
//     onEvent: (e) => broadcast(e),
//   });
//
// 事件流（onEvent）：
//   { type: 'tool_calls',  tool_calls }
//   { type: 'tool_result', message }
//   { type: 'done',        text }
//
// 触发 tool_calls 时，工具执行通过 functions.ts 走 DO /dispatch → 扩展 bg.ts。

import { tools } from './tools';
import { runTools, type ToolCall, type ToolMessage } from './runner';
import { normalizeAgentMessages, normalizeChatOptions, type ChatOptions } from './utils';
// @ts-ignore — JS module
import { callLlmRegular } from '../llm/index.js';
import type { ToolContext } from './functions';

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

export interface ChatConfig extends ChatOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider?: string;
  system?: string;
  vision?: boolean;
  toolContext: ToolContext;
  onEvent?: (e: ChatEvent) => void | Promise<void>;
}

export interface ChatResult {
  text: string;
  messages: ChatMessage[];
}

export async function chat(input: ChatMessage[], config: ChatConfig): Promise<ChatResult> {
  const opts = normalizeChatOptions(config);
  const workMessages: ChatMessage[] = [];
  if (config.system?.trim()) workMessages.push({ role: 'system', content: config.system });
  workMessages.push(...normalizeAgentMessages(input, {
    model: config.model,
    apiUrl: config.apiUrl,
    provider: config.provider,
  }) as ChatMessage[]);

  // 工具过滤：
  // - vision 关闭 → 不暴露 browser_screenshot
  // - 没有 replyCid（非 auto 触发 session）→ 不暴露 conversation_reply
  const exposedTools = (tools as readonly any[]).filter((t) => {
    const name = t.function?.name;
    if (name === 'browser_screenshot' && !config.vision) return false;
    if (name === 'conversation_reply' && !config.toolContext.replyCid) return false;
    return true;
  });

  let round = 0;
  while (round++ < opts.maxRounds) {
    const payload = { model: config.model, messages: workMessages, tools: exposedTools };
    const { message, usage }: { message: any; usage: any } =
      await callLlmRegular(config.apiUrl, config.apiKey, payload, { provider: config.provider });

    if (!message.role) message.role = 'assistant';

    // message 保留原样（含 reasoning_content / tool_calls / ...）；usage 与 message 并列向上抛
    workMessages.push(message);
    await config.onEvent?.({ type: 'assistant_message', message, usage });

    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      const toolMessages: ToolMessage[] = await runTools(message.tool_calls as ToolCall[], {
        toolContext: config.toolContext,
        enableToolResultTruncate: opts.enableToolResultTruncate,
        toolResultMaxChars: opts.toolResultMaxChars,
        onResult: (m) => config.onEvent?.({ type: 'tool_result', message: m }),
      });
      for (const m of toolMessages) workMessages.push(m as ChatMessage);
      continue;
    }

    const text: string = message?.content ?? '';
    await config.onEvent?.({ type: 'done', text });
    return { text, messages: workMessages };
  }

  const text = '(达到最大轮次限制)';
  const overflow: ChatMessage = { role: 'assistant', content: text };
  workMessages.push(overflow);
  await config.onEvent?.({ type: 'assistant_message', message: overflow, usage: null });
  await config.onEvent?.({ type: 'done', text });
  return { text, messages: workMessages };
}
