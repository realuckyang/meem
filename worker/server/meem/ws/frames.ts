// WS 帧定义。ws/ 只认这些类型,不掺业务。

export type ClientKind = 'client' | 'extension' | 'meem';
export type ToolEndpointKind = 'computer' | 'browser';

/** 进站帧(meem / client / extension 发来) */
export type InFrame =
  | { type: 'send'; chat?: string | null; text: string }       // meem:用户发话
  | { type: 'abort'; chat?: string | null }                    // meem:中止某会话
  | { type: 'ping' }
  | { type: 'tool.result'; id: string; result: unknown }         // client/extension:工具结果
  | { type: 'tool.error'; id: string; error: string };           // client/extension:工具出错

/** 出站帧(推给 meem 控制台) */
export type OutFrame =
  | { type: 'hello'; client: ClientKind; connections: { computer: boolean; browser: boolean } }
  | { type: 'pong' }
  | { type: 'message'; chat: string | null; role: string; content?: string; message?: unknown }
  | { type: 'agent.status'; chat: string | null; status: 'running' | 'done' | 'error'; error?: string }
  | { type: 'connection.status'; computer: boolean; browser: boolean }
  | { type: 'chats.update' }
  | { type: 'tool'; name: string; chat: string | null };

export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
