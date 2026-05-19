import { chat } from '../ai/handler.js';
import type { ChatMessage, ChatSettings } from '../ai/types';

export type AvatarStatus = 'off' | 'connecting' | 'online' | 'working' | 'error';

export interface AvatarHandle {
  close: () => void;
}

type StatusListener = (status: AvatarStatus, detail?: string) => void;

interface AgentTaskFrame {
  type: 'agent-task';
  task?: AgentTask;
}

interface AgentCancelFrame {
  type: 'agent-cancel';
  session_id?: string;
}

interface AgentTask {
  session_id: string;
  kind?: string;
  conversation_id?: string | null;
  message_id?: string | null;
  title?: string | null;
  prompt?: string | null;
  memories?: Array<Record<string, unknown>>;
  turns?: Array<{
    role?: string;
    label?: string;
    content?: string;
    instruction?: string;
  }>;
  contact?: {
    name?: string;
    address?: string;
  } | null;
  trigger?: {
    content?: string;
    created_at?: number;
  };
}

function wsUrl(baseUrl: string, token: string) {
  const url = new URL(baseUrl || 'https://meem.chatnext.ai');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.searchParams.set('token', token);
  url.searchParams.set('avatar', '1');
  return url.toString();
}

function apiUrl(baseUrl: string, path: string) {
  const url = new URL(baseUrl || 'https://meem.chatnext.ai');
  url.pathname = path;
  url.search = '';
  return url.toString();
}

async function api(settings: ChatSettings, method: string, path: string, body?: unknown) {
  const response = await fetch(apiUrl(settings.meemBaseUrl, path), {
    method,
    headers: {
      Authorization: `Bearer ${settings.meemToken}`,
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`worker ${response.status}: ${text || response.statusText}`);
  }
  return response.json().catch(() => ({}));
}

function memoryText(memories: AgentTask['memories']) {
  if (!Array.isArray(memories) || memories.length === 0) return '';
  return memories
    .slice(0, 20)
    .map((item, index) => `${index + 1}. ${JSON.stringify(item)}`)
    .join('\n');
}

function taskToMessages(task: AgentTask): ChatMessage[] {
  const system = [
    '你是用户开启的 meem 分身。',
    '你正在代表用户处理来自外部联系人的消息。',
    '如果任务要求直接回复对方，只输出可以发送给对方的正文，不要添加解释。',
    task.prompt ? `用户长期偏好：\n${task.prompt}` : '',
    task.contact?.name ? `当前联系人：${task.contact.name}` : '',
    memoryText(task.memories) ? `相关记忆：\n${memoryText(task.memories)}` : ''
  ].filter(Boolean).join('\n\n');

  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  const turns = Array.isArray(task.turns) ? task.turns : [];
  for (const turn of turns) {
    const role = turn.role === 'assistant' ? 'assistant' : 'user';
    const parts = [
      turn.label ? `【${turn.label}】` : '',
      turn.content || '',
      turn.instruction ? `\n要求：${turn.instruction}` : ''
    ].filter(Boolean);
    messages.push({ role, content: parts.join('\n') });
  }

  if (messages.length === 1 && task.trigger?.content) {
    messages.push({ role: 'user', content: task.trigger.content });
  }
  return messages;
}

async function persistSessionResult(settings: ChatSettings, task: AgentTask, text: string, status = 'done') {
  if (!task.session_id) return;
  await api(settings, 'POST', `/api/sessions/${encodeURIComponent(task.session_id)}/events`, {
    events: [
      {
        kind: 'agent_message',
        payload: { text },
        in_reply_to: task.message_id || task.trigger?.created_at || null
      }
    ]
  });
  await api(settings, 'PATCH', `/api/sessions/${encodeURIComponent(task.session_id)}`, {
    status,
    title: task.title || text.slice(0, 80)
  });
}

async function replyToConversation(settings: ChatSettings, task: AgentTask, text: string) {
  if (task.kind !== 'message_agent' || !task.conversation_id) return;
  await api(settings, 'POST', `/api/messages/conversations/${encodeURIComponent(task.conversation_id)}/reply`, {
    text
  });
}

export function startAvatar(settings: ChatSettings, onStatus: StatusListener): AvatarHandle {
  let closed = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let reconnectMs = 1000;
  const cancelled = new Set<string>();

  const cleanupReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null) return;
    const wait = reconnectMs;
    reconnectMs = Math.min(30000, reconnectMs * 2);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, wait);
  };

  const sendHello = () => {
    socket?.send(JSON.stringify({
      type: 'hello',
      capabilities: {
        avatar: true,
        client: false,
        codex: false,
        codexVersion: '',
        codexLoggedIn: false,
        bridgeVersion: 'extension',
        bridgeStartedAt: Date.now(),
        os: navigator.platform || '',
        hostname: 'chrome-extension'
      }
    }));
  };

  const handleTask = async (task?: AgentTask) => {
    if (!task?.session_id || cancelled.has(task.session_id)) return;
    onStatus('working', task.title || task.kind || 'agent-task');
    try {
      const result = await chat(taskToMessages(task), {
        ...settings,
        maxRounds: 30,
        onEvent: () => {}
      });
      if (cancelled.has(task.session_id)) return;
      const text = result.text.trim();
      await persistSessionResult(settings, task, text, 'done');
      await replyToConversation(settings, task, text);
      onStatus('online');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await persistSessionResult(settings, task, `分身处理失败：${message}`, 'errored').catch(() => {});
      onStatus('error', message);
    }
  };

  function connect() {
    if (closed) return;
    if (!settings.meemToken.trim()) {
      onStatus('error', '缺少 meem token');
      return;
    }
    onStatus('connecting');
    try {
      socket?.close();
      socket = new WebSocket(wsUrl(settings.meemBaseUrl, settings.meemToken));
      socket.addEventListener('open', () => {
        reconnectMs = 1000;
        onStatus('online');
        sendHello();
      });
      socket.addEventListener('message', (event) => {
        let frame: AgentTaskFrame | AgentCancelFrame | { type?: string };
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (frame.type === 'agent-task') {
          handleTask((frame as AgentTaskFrame).task);
        }
        if (frame.type === 'agent-cancel' && (frame as AgentCancelFrame).session_id) {
          cancelled.add(String((frame as AgentCancelFrame).session_id));
        }
      });
      socket.addEventListener('close', () => {
        if (!closed) {
          onStatus('connecting');
          scheduleReconnect();
        }
      });
      socket.addEventListener('error', () => {
        onStatus('error', 'WebSocket 连接失败');
      });
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : String(error));
      scheduleReconnect();
    }
  }

  connect();

  return {
    close: () => {
      closed = true;
      cleanupReconnect();
      socket?.close();
      socket = null;
      onStatus('off');
    }
  };
}
