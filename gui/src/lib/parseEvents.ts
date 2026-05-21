// 把 events 行（每行一条 LLM 标准 message）解析为 UI 可渲染的 item 序列。
//
// 规则：
//   - user.content                                       → 用户气泡
//   - assistant.content（无 tool_calls）                  → AI 气泡
//   - assistant.tool_calls = [t1,t2,...]                  → 一个 tool_group（含 N 个 call，无 result）
//     （若同时有 content，先 push 一条 assistant 气泡）
//   - role=tool                                          → 回填到最后一个 tool_group 里对应 toolCallId 的 call.result

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export interface ToolCallItem {
  toolCallId: string;
  name: string;
  args: string;
  result?: string;
}

export type ChatItem =
  | { kind: 'user';        key: string; eventId: number; content: string; created: number }
  | { kind: 'assistant';   key: string; eventId: number; content: string; created: number }
  | { kind: 'tool_group';  key: string; eventId: number; calls: ToolCallItem[]; created: number };

export interface EventRow {
  id: number;
  sid: string;
  message: {
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    [k: string]: any;
  };
  meta: any;
  created: number;
}

function alreadyRendered(items: ChatItem[], eventId: number): boolean {
  return items.some((it) => it.eventId === eventId);
}

export function applyEvent(items: ChatItem[], row: EventRow): ChatItem[] {
  const m = row.message;
  if (!m) return items;

  if (m.role === 'user' && typeof m.content === 'string' && m.content) {
    if (alreadyRendered(items, row.id)) return items;
    return [...items, {
      kind: 'user',
      key: `e${row.id}`,
      eventId: row.id,
      content: m.content,
      created: row.created,
    }];
  }

  if (m.role === 'assistant') {
    if (alreadyRendered(items, row.id)) return items;
    const out = [...items];
    if (typeof m.content === 'string' && m.content) {
      out.push({
        kind: 'assistant',
        key: `e${row.id}`,
        eventId: row.id,
        content: m.content,
        created: row.created,
      });
    }
    if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      out.push({
        kind: 'tool_group',
        key: `g${row.id}`,
        eventId: row.id,
        created: row.created,
        calls: m.tool_calls.map((tc) => ({
          toolCallId: tc.id,
          name: tc?.function?.name ?? '工具',
          args: tc?.function?.arguments ?? '',
          result: undefined,
        })),
      });
    }
    return out;
  }

  if (m.role === 'tool') {
    const tcId = m.tool_call_id;
    if (!tcId) return items;
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
    // 从后往前找：最后一个 tool_group 里第一个匹配 toolCallId 且无 result 的 call
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind !== 'tool_group') continue;
      const idx = it.calls.findIndex((c) => c.toolCallId === tcId && !c.result);
      if (idx < 0) continue;
      const next = [...items];
      const newCalls = it.calls.map((c, ci) => (ci === idx ? { ...c, result: content } : c));
      next[i] = { ...it, calls: newCalls };
      return next;
    }
    return items;
  }

  return items;
}

export function buildItems(rows: EventRow[]): ChatItem[] {
  let items: ChatItem[] = [];
  for (const r of rows) items = applyEvent(items, r);
  return items;
}
