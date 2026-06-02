import { callLm } from './lm';
import { runTools } from './runner';
import { expandImages } from './vision';
import type { ChatMessage, ChatOptions } from './types';

export interface ChatResult { text: string; messages: ChatMessage[]; awaitHuman: boolean; }

/** 无状态多轮 tool-use 循环。messages 已由 server 组装好(含 system)。 */
export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
  const work: ChatMessage[] = [...messages];
  const maxRounds = opts.maxRounds ?? 30;
  let round = 0;

  while (round++ < maxRounds) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // 视觉开启时:把截图类 tool 结果展开成多模态(仅发往模型,不改 work/落库)
    const payloadMessages = opts.vision ? work.map(expandImages) : work;
    const { message, usage } = await callLm(
      opts.apiUrl, opts.apiKey,
      { model: opts.model, messages: payloadMessages, tools: opts.tools },
      { signal: opts.signal },
    );
    if (usage) await opts.onEvent?.({ type: 'usage', usage });

    if (message.tool_calls?.length) {
      work.push(message);
      await opts.onEvent?.({ type: 'assistant_tool_calls', message });
      const { messages: toolMsgs, awaitHuman } = await runTools(message.tool_calls, opts.ctx);
      for (const tm of toolMsgs) { work.push(tm); await opts.onEvent?.({ type: 'tool_result', message: tm }); }
      if (awaitHuman) return { text: '', messages: work, awaitHuman: true };
      continue;
    }

    const text = typeof message.content === 'string' ? message.content : '';
    work.push(message);
    await opts.onEvent?.({ type: 'done', message, text });
    return { text, messages: work, awaitHuman: false };
  }

  const text = '(达到最大轮次限制)';
  const m: ChatMessage = { role: 'assistant', content: text };
  work.push(m);
  await opts.onEvent?.({ type: 'done', message: m, text });
  return { text, messages: work, awaitHuman: false };
}

export type { ChatMessage } from './types';
