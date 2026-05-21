// Tool runner——把 LLM 返回的 tool_calls 拿来执行（通过 functions），生成 role=tool 消息。

import * as functions from './functions';
import { truncateToolResult } from './utils';
import type { ToolContext } from './functions';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

interface RunOptions {
  toolContext: ToolContext;
  enableToolResultTruncate?: boolean;
  toolResultMaxChars?: number;
  onResult?: (msg: ToolMessage) => void | Promise<void>;
}

export async function runTools(
  toolCalls: ToolCall[],
  opts: RunOptions,
): Promise<ToolMessage[]> {
  const out: ToolMessage[] = [];
  // 并行执行，保持顺序写回
  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      const name = tc.function.name;
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
      let content: unknown;
      try {
        const fn = (functions as Record<string, any>)[name];
        if (!fn) throw new Error(`未知工具: ${name}`);
        content = await fn(args, opts.toolContext);
      } catch (e: any) {
        content = `tool error: ${e?.message ?? String(e)}`;
      }
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      const trimmed = truncateToolResult(text, {
        enabled: opts.enableToolResultTruncate,
        maxChars: opts.toolResultMaxChars,
      });
      return { role: 'tool' as const, tool_call_id: tc.id, content: trimmed.content };
    }),
  );
  for (const m of results) {
    out.push(m);
    if (opts.onResult) await opts.onResult(m);
  }
  return out;
}
