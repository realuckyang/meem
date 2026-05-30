// ai/ 是无状态执行器:只认 messages + 注入的 store/callToolEndpoint,不碰 D1/WS 细节。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatLite {
  id: string;
  title: string;
  parent: string | null;
  peer_handle: string | null;
  status: string;
}

export interface DecisionOptionIn { label: string; recommend?: boolean }

/** server 注入给 ai/ 的数据出入口(ai/ 只认这个接口,不知道底层是 D1 还是 sqlite) */
export interface Store {
  createChat(p: { title: string; category?: string; parent?: string | null; purpose?: string }): Promise<{ id: string; title: string }>;
  getChat(id: string): Promise<ChatLite | null>;
  setChat(id: string, fields: Partial<{ status: string; preview: string; closed: number }>): Promise<void>;
  addMessage(m: { chatId: string | null; message: ChatMessage; meta?: unknown }): Promise<void>;

  sql(query: string): Promise<unknown[]>;
  r2Put(path: string, content: string): Promise<void>;
  r2Get(path: string): Promise<string | null>;
  r2List(prefix: string): Promise<string[]>;
  r2Delete(path: string): Promise<void>;

  inboxList(status: string): Promise<unknown[]>;
  inboxRead(id: string): Promise<unknown | null>;
  inboxReply(id: string, text: string): Promise<void>;
  inboxLink(chatId: string | null, label: string): Promise<string>;
}

/** 工具执行上下文 */
export interface ToolCtx {
  uid: string;
  chat: ChatLite | null;
  store: Store;
  /** 电脑/浏览器工具:把 tool.call 经 WS 发到对应端,等 tool.result */
  callToolEndpoint: (kind: 'computer' | 'browser', name: string, args: unknown) => Promise<string>;
  signal?: AbortSignal;
}

export interface ChatEvent {
  type: 'assistant_tool_calls' | 'tool_result' | 'done' | 'usage' | 'start' | 'end';
  message?: ChatMessage;
  text?: string;
  usage?: unknown;
}

export interface ChatOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  ctx: ToolCtx;
  tools: unknown[];
  maxRounds?: number;
  toolResultMaxChars?: number;
  onEvent?: (e: ChatEvent) => void;
  signal?: AbortSignal;
}
