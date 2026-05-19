export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: Role;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
}

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LlmMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
  usage?: Usage | null;
  reasoning_content?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiUrl: string;
  defaultModel: string;
  keyUrl?: string;
}

export interface ChatSettings {
  provider: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  avatarWorkerUrl: string;
  avatarId: string;
  avatarToken: string;
  avatarEnabled: boolean;
}

export type ChatEvent =
  | { type: 'delta'; delta: string }
  | { type: 'usage'; usage?: Usage | null }
  | { type: 'assistant_tool_calls'; message: ChatMessage }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; message: ChatMessage }
  | { type: 'done'; message: ChatMessage; text: string; usage?: Usage | null };
