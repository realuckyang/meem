// WS 帧定义。ws/ 只认这些类型,不掺业务。

export type ClientKind = 'client' | 'extension' | 'meem';
export type ToolEndpointKind = 'computer' | 'browser';

/** 进站帧(meem / client / extension 发来)· 聊天全部走 WS,无 REST */
export type InFrame =
  | { type: 'send'; chat?: string | null; text: string }       // meem:用户发话
  | { type: 'abort'; chat?: string | null }                    // meem:中止某会话
  | { type: 'chats.list' }                                     // meem:要会话列表
  | { type: 'chat.open'; chat: string | null }                 // meem:要某会话历史
  | { type: 'chat.new'; title?: string; purpose?: string }     // meem:新建会话
  | { type: 'decide'; chat: string | null; chosen: string }    // meem:对决策拍板
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
  | { type: 'chats.list.ok'; chats: unknown[]; decisions: unknown[] }   // 回执:会话列表
  | { type: 'chat.history'; chat: string | null; messages: unknown[] }  // 回执:会话历史
  | { type: 'chat.new.ok'; chat: { id: string; title: string } }        // 回执:新建会话
  | { type: 'tool'; name: string; chat: string | null };

export const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
