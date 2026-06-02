import { chat as runAiChat } from '../ai/index';
import { stripImage } from '../ai/vision';
import { toolsFor } from '../ai/tools';
import { buildSystem } from './prompt';
import type { ChatMessage, ChatLite } from '../ai/types';
import type { Env, DeviceInfo } from '../../types';
import type { OutFrame } from '../ws/frames';
import type { Repo } from '../repository/repo';

export interface RunDeps {
  env: Env;
  uid: string;
  chatId: string | null;
  repo: Repo;
  devices: DeviceInfo[];
  callToolEndpoint: (deviceId: string, name: string, args: unknown) => Promise<string>;
  onEvent: (f: OutFrame) => void;
  signal: AbortSignal;
}

/** 跑一条会话:查史 → 拼消息 → ai.chat(tool 循环)→ 落新消息 */
export async function runChat(d: RunDeps): Promise<void> {
  const currentChat: ChatLite | null = d.chatId ? await d.repo.getChat(d.chatId) : null;
  const s = await d.repo.loadSettings();
  const history = await d.repo.loadHistory(d.chatId);
  const system: ChatMessage = { role: 'system', content: buildSystem(currentChat, s.persona, d.devices) };

  const apiUrl = (s.llm_url || d.env.LLM_URL || '').trim();
  const apiKey = (s.llm_key || d.env.LLM_KEY || '').trim();
  const model = (s.llm_model || d.env.LLM_MODEL || '').trim();
  const missing = [
    !apiUrl && '接口地址',
    !apiKey && 'API Key',
    !model && '模型名',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`模型未配置:请到「设置 → 模型配置」填写 ${missing.join('、')}。`);
  }

  const result = await runAiChat([system, ...history], {
    apiUrl,
    apiKey,
    model,
    tools: toolsFor({
      computer: d.devices.some((x) => x.kind === 'computer' && x.online),
      browser: d.devices.some((x) => x.kind === 'browser' && x.online),
      vision: !!s.vision,
    }),
    vision: !!s.vision,
    maxRounds: s.max_rounds || Number(d.env.LLM_MAX_ROUNDS) || 30,
    signal: d.signal,
    ctx: { uid: d.uid, chat: currentChat, store: d.repo, callToolEndpoint: d.callToolEndpoint, signal: d.signal },
    onEvent: async (e) => {
      if (e.type === 'assistant_tool_calls' || e.type === 'tool_result' || e.type === 'done') {
        const m: any = e.message;
        const kind = m.role === 'assistant'
          ? (m.tool_calls?.length ? 'tool_call' : 'text')
          : (m.role === 'tool' ? 'tool_result' : 'text');
        // 流式:每一条立刻落库 + 推帧(带 id/meta/created),前端直接 append
        // 落库剥掉截图 base64(不进 D1、不上 R2);广播仍带原图,前端实时展示
        const r = await d.repo.addMessage({ chatId: d.chatId, message: stripImage(m), meta: { kind } });
        d.onEvent({ type: 'message', chat: d.chatId, role: m.role ?? 'assistant', message: m, id: r.id, meta: { kind }, created: r.created });
      }
    },
  });

  if (d.chatId && result.text) await d.repo.setChat(d.chatId, { preview: result.text.slice(0, 120) });
  d.onEvent({ type: 'chats.update' });
}
