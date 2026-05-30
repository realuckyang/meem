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
  return { message: { role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls }, usage: json?.usage ?? null };
}
