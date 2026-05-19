import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { chat } from './ai/handler.js';
import { providers, settingsForProvider } from './ai/providers';
import type { ChatEvent, ChatMessage, ChatSettings } from './ai/types';
import { type AvatarStatus, startAvatar } from './lib/avatar';
import { loadMessages, loadSettings, saveMessages, saveSettings } from './lib/storage';
import { type ActiveTabInfo, readActiveTab } from './lib/tabs';

type RunState = 'idle' | 'thinking' | 'tooling' | 'error';

const visibleRoles = new Set(['user', 'assistant']);

function roleLabel(role: string) {
  if (role === 'user') return '你';
  if (role === 'assistant') return 'meem';
  return '工具';
}

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function visibleMessages(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (!visibleRoles.has(message.role)) return false;
    if (message.role === 'assistant' && !message.content && message.tool_calls?.length) return true;
    return typeof message.content === 'string' && message.content.length > 0;
  });
}

function SettingsPanel({
  value,
  onChange,
  onSave,
  saved
}: {
  value: ChatSettings;
  onChange: (next: ChatSettings) => void;
  onSave: () => void;
  saved: boolean;
}) {
  const provider = providers.find((item) => item.id === value.provider) ?? providers[0];

  return (
    <section className="settings-panel" aria-label="模型设置">
      <div className="settings-grid">
        <label>
          <span>服务</span>
          <select
            value={value.provider}
            onChange={(event) => onChange(settingsForProvider(event.target.value, value))}
          >
            {providers.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>模型</span>
          <input
            value={value.model}
            onChange={(event) => onChange({ ...value, model: event.target.value })}
            placeholder={provider.defaultModel || 'model'}
          />
        </label>
      </div>
      <label>
        <span>API URL</span>
        <input
          value={value.apiUrl}
          onChange={(event) => onChange({ ...value, apiUrl: event.target.value })}
          placeholder={provider.apiUrl || 'https://.../chat/completions'}
        />
      </label>
      <label>
        <span>API Key</span>
        <input
          type="password"
          value={value.apiKey}
          onChange={(event) => onChange({ ...value, apiKey: event.target.value })}
          placeholder="本地保存"
        />
      </label>
      <div className="settings-actions">
        {provider.keyUrl && (
          <a href={provider.keyUrl} target="_blank" rel="noreferrer">打开密钥页</a>
        )}
        <button type="button" onClick={onSave}>{saved ? '已保存' : '保存'}</button>
      </div>
      <div className="settings-separator" />
      <label className="toggle-row">
        <span>分身</span>
        <input
          type="checkbox"
          checked={value.avatarEnabled}
          onChange={(event) => onChange({ ...value, avatarEnabled: event.target.checked })}
        />
      </label>
      <label>
        <span>meem URL</span>
        <input
          value={value.meemBaseUrl}
          onChange={(event) => onChange({ ...value, meemBaseUrl: event.target.value })}
          placeholder="https://meem.chatnext.ai"
        />
      </label>
      <label>
        <span>meem Token</span>
        <input
          type="password"
          value={value.meemToken}
          onChange={(event) => onChange({ ...value, meemToken: event.target.value })}
          placeholder="用于连接 worker 的登录 token"
        />
      </label>
    </section>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === 'assistant' && !message.content && message.tool_calls?.length) {
    return (
      <div className="message-row assistant">
        <div className="message-author">meem</div>
        <div className="tool-strip">
          {message.tool_calls.map((call) => (
            <span key={call.id}>{call.function.name}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`message-row ${message.role}`}>
      <div className="message-author">{roleLabel(message.role)}</div>
      <div className="message-bubble">{message.content}</div>
    </div>
  );
}

function ToolActivity({ events }: { events: ChatEvent[] }) {
  const items = events.filter((event) => event.type === 'tool_call' || event.type === 'tool_result').slice(-4);
  if (!items.length) return null;
  return (
    <div className="tool-activity">
      {items.map((event, index) => {
        if (event.type === 'tool_call') {
          return <span key={`${event.toolCall.id}-${index}`}>调用 {event.toolCall.function.name}</span>;
        }
        return <span key={`${event.message.tool_call_id}-${index}`}>工具返回</span>;
      })}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [runState, setRunState] = useState<RunState>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [toolEvents, setToolEvents] = useState<ChatEvent[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('off');
  const [avatarDetail, setAvatarDetail] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const shownMessages = useMemo(() => visibleMessages(messages), [messages]);
  const busy = runState === 'thinking' || runState === 'tooling';

  useEffect(() => {
    loadSettings().then(setSettings);
    loadMessages().then(setMessages);
  }, []);

  useEffect(() => {
    const refresh = () => readActiveTab().then(setActiveTab).catch(() => setActiveTab(null));
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settings?.avatarEnabled) {
      setAvatarStatus('off');
      setAvatarDetail('');
      return;
    }
    const handle = startAvatar(settings, (status, detail = '') => {
      setAvatarStatus(status);
      setAvatarDetail(detail);
    });
    return () => handle.close();
  }, [
    settings?.avatarEnabled,
    settings?.meemBaseUrl,
    settings?.meemToken,
    settings?.provider,
    settings?.apiUrl,
    settings?.apiKey,
    settings?.model
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [shownMessages.length, streamingText, toolEvents.length]);

  async function persistSettings() {
    if (!settings) return;
    await saveSettings(settings);
    setSettingsSaved(true);
  }

  async function clearConversation() {
    if (busy) return;
    setMessages([]);
    setStreamingText('');
    setToolEvents([]);
    await saveMessages([]);
  }

  function stopRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunState('idle');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    const text = draft.trim();
    if (!text) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    await saveMessages(baseMessages);
    setDraft('');
    setStreamingText('');
    setToolEvents([]);
    setRunState('thinking');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await chat(baseMessages, {
        ...settings,
        signal: controller.signal,
        onEvent: (chatEvent) => {
          if (chatEvent.type === 'delta') {
            setStreamingText((current) => current + chatEvent.delta);
          }
          if (chatEvent.type === 'tool_call') {
            setRunState('tooling');
            setToolEvents((current) => [...current, chatEvent]);
          }
          if (chatEvent.type === 'tool_result') {
            setToolEvents((current) => [...current, chatEvent]);
          }
          if (chatEvent.type === 'done') {
            setRunState('idle');
          }
        }
      });
      setMessages(result.messages);
      await saveMessages(result.messages);
      setStreamingText('');
      setRunState('idle');
    } catch (error) {
      if (controller.signal.aborted) {
        setRunState('idle');
        setStreamingText('');
        return;
      }
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: error instanceof Error ? error.message : String(error)
      };
      const next = [...baseMessages, errorMessage];
      setMessages(next);
      await saveMessages(next);
      setStreamingText('');
      setRunState('error');
    } finally {
      abortRef.current = null;
    }
  }

  if (!settings) {
    return <div className="boot-screen">meem</div>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">M</div>
        <div className="topbar-copy">
          <div className="brand-title">meem</div>
          <div className="tab-line" title={activeTab?.url || ''}>
            {activeTab ? compactUrl(activeTab.url) || activeTab.title || '当前标签页' : '未读取到标签页'}
          </div>
        </div>
        <button
          className="icon-button"
          type="button"
          title="设置"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19 13.5v-3l-2.1-.4a5.8 5.8 0 0 0-.7-1.6l1.2-1.8-2.1-2.1-1.8 1.2c-.5-.3-1-.5-1.6-.7L11.5 3h-3l-.4 2.1c-.6.2-1.1.4-1.6.7L4.7 4.6 2.6 6.7l1.2 1.8c-.3.5-.5 1-.7 1.6L1 10.5v3l2.1.4c.2.6.4 1.1.7 1.6l-1.2 1.8 2.1 2.1 1.8-1.2c.5.3 1 .5 1.6.7l.4 2.1h3l.4-2.1c.6-.2 1.1-.4 1.6-.7l1.8 1.2 2.1-2.1-1.2-1.8c.3-.5.5-1 .7-1.6l2.1-.4Z" />
          </svg>
        </button>
      </header>

      {settingsOpen && (
        <SettingsPanel
          value={settings}
          onChange={(next) => {
            setSettings(next);
            setSettingsSaved(false);
          }}
          onSave={persistSettings}
          saved={settingsSaved}
        />
      )}

      <section ref={scrollRef} className="conversation">
        {shownMessages.length === 0 && !streamingText ? (
          <div className="empty-state">
            <div className="empty-title">从当前网页开始</div>
            <div className="empty-text">可以让 meem 阅读页面、整理内容，或切换和导航标签页。</div>
          </div>
        ) : (
          shownMessages.map((message, index) => <MessageRow key={`${message.role}-${index}`} message={message} />)
        )}

        {streamingText && (
          <div className="message-row assistant">
            <div className="message-author">meem</div>
            <div className="message-bubble streaming">{streamingText}</div>
          </div>
        )}

        <ToolActivity events={toolEvents} />
      </section>

      <footer className="composer-wrap">
        <div className="status-line">
          <span className={`status-dot ${runState}`} />
          <span>{runState === 'tooling' ? '正在使用浏览器工具' : runState === 'thinking' ? '正在生成' : runState === 'error' ? '上次请求失败' : settings.model}</span>
          {settings.avatarEnabled && (
            <span className={`avatar-chip ${avatarStatus}`} title={avatarDetail}>
              分身 {avatarStatus === 'online' ? '在线' : avatarStatus === 'working' ? '处理中' : avatarStatus === 'connecting' ? '连接中' : avatarStatus === 'error' ? '异常' : '关闭'}
            </span>
          )}
          <button type="button" onClick={clearConversation} disabled={busy}>清空</button>
        </div>
        <form className="composer" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="输入对话"
            rows={1}
          />
          {busy ? (
            <button className="send-button secondary" type="button" onClick={stopRun}>停</button>
          ) : (
            <button className="send-button" type="submit" disabled={!draft.trim()}>发</button>
          )}
        </form>
      </footer>
    </main>
  );
}
