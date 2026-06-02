import { runFunction } from './functions';
import type { ToolCall, ChatMessage, ToolCtx } from './types';

/** 并发执行一批 tool_calls,返回 tool 消息 + 是否需停下等用户拍板(结果不截断,原样返回) */
export async function runTools(
  toolCalls: ToolCall[],
  ctx: ToolCtx,
): Promise<{ messages: ChatMessage[]; awaitHuman: boolean }> {
  let awaitHuman = false;
  const messages = await Promise.all(toolCalls.map(async (tc): Promise<ChatMessage> => {
    if (ctx.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let args: any = {};
    try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
    let content: string;
    try {
      const r = await runFunction(tc.function.name, args, ctx);
      if (typeof r === 'string') content = r;
      else { content = r.content; if (r.awaitHuman) awaitHuman = true; }
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      content = `tool error: ${e?.message || String(e)}`;
    }
    return { role: 'tool', tool_call_id: tc.id, content };
  }));
  return { messages, awaitHuman };
}
