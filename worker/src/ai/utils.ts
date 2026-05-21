// 共用工具：tool result 截断、参数校验。

interface TruncateOptions { enabled?: boolean; maxChars?: number; }
interface TruncatedResult { content: string; truncated: boolean; originalLength: number; }

export function truncateToolResult(content: unknown, { enabled = true, maxChars = 12000 }: TruncateOptions = {}): TruncatedResult {
  const limit = Math.max(1000, Math.min(50000, Number(maxChars) || 12000));
  const text = String(content ?? '');
  if (!enabled || text.length <= limit) {
    return { content: text, truncated: false, originalLength: text.length };
  }
  const head = Math.floor(limit * 0.7);
  const tail = limit - head;
  const clipped = `${text.slice(0, head)}\n...[truncated ${text.length - limit} chars]...\n${text.slice(-tail)}`;
  return { content: clipped, truncated: true, originalLength: text.length };
}

export interface ChatOptions {
  maxRounds?: number;
  enableToolResultTruncate?: boolean;
  toolResultMaxChars?: number;
}

export interface NormalizedChatOptions {
  maxRounds: number;
  enableToolResultTruncate: boolean;
  toolResultMaxChars: number;
}

export function normalizeChatOptions(o: ChatOptions = {}): NormalizedChatOptions {
  return {
    maxRounds: Math.max(1, Math.min(50, Number(o.maxRounds) || 20)),
    enableToolResultTruncate: o.enableToolResultTruncate !== false,
    toolResultMaxChars: Math.max(1000, Math.min(50000, Number(o.toolResultMaxChars) || 12000)),
  };
}

type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

interface AgentToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AgentMessage {
  role: AgentRole;
  content: string | null;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
  name?: string;
}

interface NormalizeAgentMessagesOptions {
  model?: string;
  apiUrl?: string;
  provider?: string;
}

export function shouldReplayReasoning(model?: string, apiUrl?: string, provider?: string): boolean {
  const modelId = String(model || '').trim();
  const url = String(apiUrl || '').trim();
  const providerId = String(provider || '').trim();
  return providerId === 'deepseek' || modelId.startsWith('deepseek-') || url.includes('api.deepseek.com');
}

export function normalizeAgentMessages(
  messages: unknown[] = [],
  options: NormalizeAgentMessagesOptions = {},
): AgentMessage[] {
  if (!Array.isArray(messages)) return [];

  const validRoles = new Set<AgentRole>(['system', 'user', 'assistant', 'tool']);
  const replayReasoning = shouldReplayReasoning(options.model, options.apiUrl, options.provider);
  const normalized: AgentMessage[] = [];

  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, any>;
    const role = String(raw.role || '').trim() as AgentRole;
    if (!validRoles.has(role)) continue;

    const message: AgentMessage = {
      role,
      content: raw.content == null ? (role === 'assistant' && Array.isArray(raw.tool_calls) ? null : '') : String(raw.content),
    };

    if (role === 'assistant' && Array.isArray(raw.tool_calls)) {
      message.tool_calls = raw.tool_calls;
    }
    if (role === 'tool' && raw.tool_call_id) {
      message.tool_call_id = String(raw.tool_call_id);
    }
    if ((role === 'assistant' || role === 'tool') && raw.name) {
      message.name = String(raw.name);
    }
    if (
      replayReasoning &&
      role === 'assistant' &&
      typeof raw.reasoning_content === 'string' &&
      raw.reasoning_content.trim()
    ) {
      message.reasoning_content = raw.reasoning_content;
    }

    normalized.push(message);
  }

  const toolMessages = new Map<string, AgentMessage>();
  for (const message of normalized) {
    if (message.role === 'tool' && message.tool_call_id) {
      toolMessages.set(message.tool_call_id, message);
    }
  }

  const missingToolResult =
    '工具调用未返回结果：可能因系统中断、服务重启、超时或其它未知原因，导致本次执行结果未被记录。';
  const repaired: AgentMessage[] = [];

  for (const message of normalized) {
    if (message.role === 'tool') continue;
    repaired.push(message);

    if (message.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        const toolCallId = String(toolCall?.id || '').trim();
        if (!toolCallId) continue;
        const toolMessage = toolMessages.get(toolCallId);
        if (toolMessage) {
          repaired.push(toolMessage);
          toolMessages.delete(toolCallId);
        } else {
          repaired.push({ role: 'tool', tool_call_id: toolCallId, content: missingToolResult });
        }
      }
    }
  }

  return repaired;
}
