import type { ChatMessage } from './types';

export interface LmResult { message: ChatMessage; usage: unknown | null; }

/** OpenAI 兼容 chat/completions(非流式) */
export async function callLm(
  apiUrl: string,
  apiKey: string,
  payload: { model: string; messages: ChatMessage[]; tools?: unknown[] },
  opts: { signal?: AbortSignal } = {},
): Promise<LmResult> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      ...payload,
      tool_choice: payload.tools && payload.tools.length ? 'auto' : undefined,
      stream: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LM ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json<any>();
  const message = json?.choices?.[0]?.message;
  if (!message) throw new Error('LM 返回缺 choices[0].message');
  // 原样保留模型返回的整条 message(含 reasoning_content 等厂商字段),仅规范 role/content,
  // 否则带 thinking 的模型(如 Kimi)回传 tool_call 消息时会因缺 reasoning_content 报 400。
  return { message: { ...message, role: 'assistant', content: message.content ?? null }, usage: json?.usage ?? null };
}
