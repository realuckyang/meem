import { callLm } from './lm';
import { runTools } from './runner';
import type { ChatMessage, ChatOptions } from './types';

export interface ChatResult { text: string; messages: ChatMessage[]; awaitHuman: boolean; }

/** 无状态多轮 tool-use 循环。messages 已由 server 组装好(含 system)。 */
export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const work: ChatMessage[] = [...messages];
  const maxRounds = opts.maxRounds ?? 30;
  let round = 0;

  while (round++ < maxRounds) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const { message, usage } = await callLm(
      opts.apiUrl, opts.apiKey,
      { model: opts.model, messages: work, tools: opts.tools },
      { signal: opts.signal },
    );
    if (usage) opts.onEvent?.({ type: 'usage', usage });

    if (message.tool_calls?.length) {
      work.push(message);
      opts.onEvent?.({ type: 'assistant_tool_calls', message });
      const { messages: toolMsgs, awaitHuman } = await runTools(message.tool_calls, opts.ctx, opts.toolResultMaxChars);
      for (const tm of toolMsgs) { work.push(tm); opts.onEvent?.({ type: 'tool_result', message: tm }); }
      if (awaitHuman) return { text: '', messages: work, awaitHuman: true };
      continue;
    }

    const text = message.content ?? '';
    work.push(message);
    opts.onEvent?.({ type: 'done', message, text });
    return { text, messages: work, awaitHuman: false };
  }

  const text = '(达到最大轮次限制)';
  const m: ChatMessage = { role: 'assistant', content: text };
  work.push(m);
  opts.onEvent?.({ type: 'done', message: m, text });
  return { text, messages: work, awaitHuman: false };
}

export type { ChatMessage } from './types';
