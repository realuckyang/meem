import { chat } from '../ai/handler.js';
import type { ChatMessage, ChatSettings } from '../ai/types';

export type AvatarStatus = 'off' | 'connecting' | 'online' | 'working' | 'error';

export interface AvatarHandle {
  close: () => void;
}

type StatusListener = (status: AvatarStatus, detail?: string) => void;
type IncomingListener = (incoming: AvatarIncomingMessage) => void;

interface AvatarMessageFrame {
  type: 'avatar-message';
  message?: AvatarMessage;
}

interface AvatarMessage {
  id: string;
  text: string;
  senderName?: string;
  senderAccount?: string;
  createdAt?: number;
}

export interface AvatarIncomingMessage {
  mode: 'approval' | 'hosted';
  message: AvatarMessage;
  messages: ChatMessage[];
  reply?: string;
}

function workerUrl(settings: ChatSettings, path: string) {
  const url = new URL(settings.avatarWorkerUrl || 'https://meem-extension.chatnext.ai');
  url.pathname = path;
  url.search = '';
  return url.toString();
}

function wsUrl(settings: ChatSettings) {
  const url = new URL(settings.avatarWorkerUrl || 'https://meem-extension.chatnext.ai');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/api/avatar/${encodeURIComponent(settings.avatarId)}/ws`;
  url.searchParams.set('token', settings.avatarToken);
  return url.toString();
}

async function postReply(settings: ChatSettings, messageId: string, text: string) {
  const response = await fetch(workerUrl(settings, `/api/avatar/${encodeURIComponent(settings.avatarId)}/reply`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: settings.avatarToken,
      messageId,
      text
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`worker ${response.status}: ${detail || response.statusText}`);
  }
}

function messageToChat(message: AvatarMessage): ChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        '你是用户开启的 meem 分身。',
        '你正在代表用户回复外部访客。',
        '只输出可以直接发给对方的回复正文，不要添加解释。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        message.senderName ? `访客：${message.senderName}` : '访客',
        message.text
      ].join('\n\n')
    }
  ];
}

export function startAvatar(settings: ChatSettings, onStatus: StatusListener, onIncoming: IncomingListener): AvatarHandle {
  let closed = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let reconnectMs = 1000;

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

  const handleMessage = async (message?: AvatarMessage) => {
    if (!message?.id || !message.text) return;
    const initialMessages = messageToChat(message);
    if (settings.avatarMode === 'approval') {
      onIncoming({ mode: 'approval', message, messages: initialMessages });
      onStatus('online');
      return;
    }

    onStatus('working', message.senderName || message.id);
    try {
      const result = await chat(initialMessages, {
        ...settings,
        maxRounds: 30,
        onEvent: () => {}
      });
      const reply = result.text.trim();
      await postReply(settings, message.id, reply);
      onIncoming({ mode: 'hosted', message, messages: result.messages, reply });
      onStatus('online');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await postReply(settings, message.id, `分身处理失败：${detail}`).catch(() => {});
      onStatus('error', detail);
    }
  };

  function connect() {
    if (closed) return;
    if (!settings.avatarId.trim()) {
      onStatus('error', '缺少分身 ID');
      return;
    }
    if (!settings.avatarToken.trim()) {
      onStatus('error', '缺少分身密钥');
      return;
    }

    onStatus('connecting');
    try {
      socket?.close();
      socket = new WebSocket(wsUrl(settings));
      socket.addEventListener('open', () => {
        reconnectMs = 1000;
        onStatus('online');
        socket?.send(JSON.stringify({ type: 'hello' }));
      });
      socket.addEventListener('message', (event) => {
        let frame: AvatarMessageFrame | { type?: string };
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (frame.type === 'avatar-message') {
          handleMessage((frame as AvatarMessageFrame).message);
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
