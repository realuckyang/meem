import { chat as runAiChat } from '../../ai/index';
import { toolsFor } from '../../ai/tools';
import { buildSystem } from '../prompt';
import type { ChatMessage, ChatLite } from '../../ai/types';
import type { Env, ConnectionStatus } from '../../../types';
import type { OutFrame, ToolEndpointKind } from '../../ws/frames';
import type { Repo } from '../../repository';

export interface RunDeps {
  env: Env;
  uid: string;
  chatId: string | null;
  repo: Repo;
  connections: ConnectionStatus;
  callToolEndpoint: (kind: ToolEndpointKind, name: string, args: unknown) => Promise<string>;
  onEvent: (f: OutFrame) => void;
  signal: AbortSignal;
}

/** 跑一条会话:查史 → 拼消息 → ai.chat(tool 循环)→ 落新消息 */
export async function runChat(d: RunDeps): Promise<void> {
  const currentChat: ChatLite | null = d.chatId ? await d.repo.getChat(d.chatId) : null;
  const s = await d.repo.loadSettings();
  const history = await d.repo.loadHistory(d.chatId);
  const system: ChatMessage = { role: 'system', content: buildSystem(currentChat, s.persona, d.connections) };

  const result = await runAiChat([system, ...history], {
    apiUrl: s.llm_url || d.env.LLM_URL,
    apiKey: s.llm_key || d.env.LLM_KEY,
    model: s.llm_model || d.env.LLM_MODEL,
    tools: toolsFor(d.connections),
    maxRounds: s.max_rounds || Number(d.env.LLM_MAX_ROUNDS) || 30,
    signal: d.signal,
    ctx: { uid: d.uid, chat: currentChat, store: d.repo, callToolEndpoint: d.callToolEndpoint, signal: d.signal },
    onEvent: (e) => {
      if (e.type === 'assistant_tool_calls' || e.type === 'tool_result' || e.type === 'done') {
        d.onEvent({ type: 'message', chat: d.chatId, role: e.message?.role ?? 'assistant', message: e.message });
      }
    },
  });

  const fresh = result.messages.slice(1 + history.length);
  for (const m of fresh) {
    const kind = m.role === 'assistant'
      ? (m.tool_calls?.length ? 'tool_call' : 'text')
      : (m.role === 'tool' ? 'tool_result' : 'text');
    await d.repo.addMessage({ chatId: d.chatId, message: m, meta: { kind } });
  }
  if (d.chatId && result.text) await d.repo.setChat(d.chatId, { preview: result.text.slice(0, 120) });
  d.onEvent({ type: 'chats.update' });
}
