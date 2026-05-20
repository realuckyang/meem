import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ContactRound, MonitorCheck, RadioTower, Settings } from 'lucide-react';
import { chat } from './ai/handler.js';
import { providers, settingsForProvider } from './ai/providers';
import type { ChatEvent, ChatMessage, ChatSettings } from './ai/types';
import { type AvatarIncomingMessage, type AvatarStatus, startAvatar } from './lib/avatar';
import {
  type DomainUser,
  type TimelineItem,
  api,
  auth,
  loadItems,
  loadSettings,
  saveItems,
  saveSettings
} from './lib/storage';
import { type ActiveTabInfo, readActiveTab } from './lib/tabs';

type RunState = 'idle' | 'thinking' | 'tooling' | 'error';
type Page = 'timeline' | 'contacts' | 'settings';
type SettingsTab = 'profile' | 'model' | 'browser' | 'avatar' | 'binding' | 'data' | 'account';

const visibleRoles = new Set(['user', 'assistant']);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function titleFromText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 42) || '新事项';
}

function visibleMessages(messages: ChatMessage[]) {
  return messages.filter((message) => {
    if (!visibleRoles.has(message.role)) return false;
    if (message.role === 'assistant' && !message.content && message.tool_calls?.length) return true;
    return typeof message.content === 'string' && message.content.length > 0;
  });
}

function roleLabel(role: string) {
  if (role === 'user') return '你';
  if (role === 'assistant') return '分身';
  return '工具';
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function itemKindLabel(item: TimelineItem) {
  if (item.kind === 'message') return item.contactName || '本网域消息';
  return '对话事项';
}

function SettingsPanel({
  value,
  account,
  browserOnline,
  activeTab,
  counts,
  onChange,
  onSave,
  onLogout,
  saved,
  pairCode,
  onCreatePairCode,
}: {
  value: ChatSettings;
  account: string;
  browserOnline: boolean;
  activeTab: ActiveTabInfo | null;
  counts: { items: number; users: number };
  onChange: (next: ChatSettings) => void;
  onSave: () => void;
  onLogout: () => void;
  saved: boolean;
  pairCode: string;
  onCreatePairCode: () => void;
}) {
  const provider = providers.find((item) => item.id === value.provider) ?? providers[0];
  const [tab, setTab] = useState<SettingsTab>('profile');
  const tabs: Array<{ key: SettingsTab; label: string }> = [
    { key: 'profile', label: '身份' },
    { key: 'model', label: '模型' },
    { key: 'browser', label: '浏览器' },
    { key: 'avatar', label: '分身' },
    { key: 'binding', label: '绑定' },
    { key: 'data', label: '数据' },
    { key: 'account', label: '账号' },
  ];

  return (
    <section className="page-card" aria-label="设置">
      <div className="panel-title">设置</div>
      <nav className="settings-tabs" aria-label="设置分类">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'active' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'profile' && (
        <div className="settings-section">
          <label>
            <span>名字</span>
            <input
              value={value.displayName}
              onChange={(event) => onChange({ ...value, displayName: event.target.value })}
              placeholder="别人看到的名字"
            />
          </label>
          <label>
            <span>描述</span>
            <textarea
              value={value.description}
              onChange={(event) => onChange({ ...value, description: event.target.value })}
              placeholder="写给同事看的身份说明、职责或可联系范围"
              rows={5}
            />
          </label>
          <div className="settings-actions">
            <span>保存后，同事更容易知道谁是谁。</span>
            <button type="button" onClick={onSave}>{saved ? '已保存' : '保存'}</button>
          </div>
        </div>
      )}

      {tab === 'model' && (
        <div className="settings-section">
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
        </div>
      )}

      {tab === 'avatar' && (
        <div className="settings-section">
          <label>
            <span>模式</span>
            <select
              value={value.avatarMode}
              onChange={(event) => onChange({ ...value, avatarMode: event.target.value as ChatSettings['avatarMode'] })}
            >
              <option value="off">关闭</option>
              <option value="approval">审批</option>
              <option value="hosted">托管</option>
            </select>
          </label>
          <label>
            <span>分身服务</span>
            <input
              value={value.avatarWorkerUrl}
              onChange={(event) => onChange({ ...value, avatarWorkerUrl: event.target.value })}
              placeholder="https://meem-extension.chatnext.ai"
            />
          </label>
          <label>
            <span>分身 ID</span>
            <input
              value={value.avatarId}
              onChange={(event) => onChange({ ...value, avatarId: event.target.value })}
              placeholder="公开收信地址"
            />
          </label>
          <label>
            <span>分身密钥</span>
            <input
              type="password"
              value={value.avatarToken}
              onChange={(event) => onChange({ ...value, avatarToken: event.target.value })}
              placeholder="插件连接分身服务的密钥"
            />
          </label>
          <div className="settings-actions">
            <span>{value.avatarMode === 'hosted' ? '托管时，分身会自动处理并回复。' : value.avatarMode === 'approval' ? '审批时，消息会进入事项流等待处理。' : '关闭后不接收新消息。'}</span>
            <button type="button" onClick={onSave}>{saved ? '已保存' : '保存'}</button>
          </div>
        </div>
      )}

      {tab === 'browser' && (
        <div className="settings-section">
          <div className={`account-panel ${browserOnline ? 'online' : ''}`}>
            <strong>{browserOnline ? '浏览器已接入' : '浏览器未接入'}</strong>
            <span>{browserOnline ? '插件可以读取当前页面并执行授权操作。' : '安装并启用桌面插件后，分身可以接管浏览器任务。'}</span>
          </div>
          <div className="settings-metric">
            <span>当前页面</span>
            <strong>{activeTab ? compactUrl(activeTab.url) || activeTab.title || '已连接' : '未连接'}</strong>
          </div>
          <div className="settings-actions">
            <span>浏览器能力由桌面插件提供。</span>
            <button type="button">安装插件</button>
          </div>
        </div>
      )}

      {tab === 'binding' && (
        <div className="settings-section">
          <div className="pair-box">
            <div>
              <strong>绑定插件</strong>
              <span>在桌面插件登录页输入一次性绑定码。</span>
            </div>
            <button type="button" onClick={onCreatePairCode}>生成绑定码</button>
          </div>
          {pairCode && <div className="pair-code">{pairCode}</div>}
        </div>
      )}

      {tab === 'account' && (
        <div className="settings-section">
          <div className="account-panel">
            <strong>{account || '当前账号'}</strong>
            <span>账号用于隔离事项、联系人、分身配置和插件绑定。</span>
          </div>
          <button type="button" className="logout-button inline" onClick={onLogout}>退出登录</button>
        </div>
      )}

      {tab === 'data' && (
        <div className="settings-section">
          <div className="data-grid">
            <div className="settings-metric">
              <span>事项</span>
              <strong>{counts.items}</strong>
            </div>
            <div className="settings-metric">
              <span>本网域成员</span>
              <strong>{counts.users}</strong>
            </div>
          </div>
          <div className="account-panel">
            <strong>云端同步</strong>
            <span>同一账号在网页端和插件端共享事项与联系人。</span>
          </div>
        </div>
      )}
    </section>
  );
}

function ContactsPanel({
  users,
  currentAccount,
}: {
  users: DomainUser[];
  currentAccount: string;
}) {
  return (
    <section className="page-card" aria-label="通讯录">
      <div className="panel-title">通讯录</div>
      <div className="domain-list">
        <div className="subhead">
          <strong>本网域</strong>
          <span>{users.length} 位成员</span>
        </div>
        {users.length === 0 ? (
          <div className="panel-empty">还没有其他成员</div>
        ) : users.map((user) => (
          <div key={user.id} className={`contact-row ${user.account === currentAccount ? 'self' : ''}`}>
            <div className="contact-avatar">{user.account.slice(0, 1).toUpperCase()}</div>
            <div className="contact-copy">
              <div>{user.account === currentAccount ? `${user.name}（我）` : user.name}</div>
              <span>{user.description || `@${user.account}`}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
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

function MessageRow({ message }: { message: ChatMessage }) {
  return (
    <div className={`message-row ${message.role}`}>
      <div className="message-author">{roleLabel(message.role)}</div>
      <div className="message-bubble">{message.content}</div>
    </div>
  );
}

function LoginPage({ onDone }: { onDone: () => void }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (pairing) await auth.claimPairCode(pairCode);
      else await auth.login(account, password, registering);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-mark">M</div>
        <h1>{pairing ? '绑定桌面插件' : registering ? '创建分身账号' : '进入分身工作台'}</h1>
        <p>{pairing ? '在手机端设置页生成绑定码，再输入到这里。' : '每个账号拥有独立的事项、联系人和分身入口。'}</p>
        {pairing ? (
          <label>
            <span>绑定码</span>
            <input
              value={pairCode}
              onChange={(event) => setPairCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="6 位数字"
            />
          </label>
        ) : (
          <>
            <label>
              <span>账号</span>
              <input value={account} onChange={(event) => setAccount(event.target.value)} autoCapitalize="none" />
            </label>
            <label>
              <span>密码</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </>
        )}
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" disabled={busy || (pairing ? pairCode.length !== 6 : (!account.trim() || password.length < 6))}>
          {busy ? '请稍候' : pairing ? '绑定' : registering ? '注册' : '登录'}
        </button>
        <div className="auth-links">
          <button type="button" className="auth-switch" onClick={() => { setPairing(false); setRegistering((value) => !value); }}>
            {registering ? '已有账号，去登录' : '没有账号，创建一个'}
          </button>
          <button type="button" className="auth-switch" onClick={() => { setPairing((value) => !value); setRegistering(false); }}>
            {pairing ? '账号密码登录' : '用绑定码登录'}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function App() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const [account, setAccount] = useState('');
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [users, setUsers] = useState<DomainUser[]>([]);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [detailDraft, setDetailDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('timeline');
  const [runState, setRunState] = useState<RunState>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [toolEvents, setToolEvents] = useState<ChatEvent[]>([]);
  const [settingsSaved, setSettingsSaved] = useState(true);
  const [pairCode, setPairCode] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTabInfo | null>(null);
  const [browserOnline, setBrowserOnline] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('off');
  const [avatarDetail, setAvatarDetail] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const shownMessages = useMemo(() => visibleMessages(selectedItem?.messages || []), [selectedItem]);
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.updatedAt - a.updatedAt),
    [items]
  );
  const busy = runState === 'thinking' || runState === 'tooling';

  const reloadAccountData = async () => {
    const [settingsData, itemData, accountName] = await Promise.all([
      loadSettings(),
      loadItems(),
      auth.account(),
    ]);
    const profile = await api.profile().catch(() => ({
      displayName: settingsData.displayName,
      description: settingsData.description,
    }));
    setSettings({
      ...settingsData,
      displayName: profile.displayName || settingsData.displayName,
      description: profile.description || settingsData.description,
    });
    setItems(itemData);
    setAccount(accountName);
    api.users().then(setUsers).catch(() => setUsers([]));
  };

  useEffect(() => {
    auth.token().then(async (token) => {
      if (!token) {
        setLogged(false);
        return;
      }
      try {
        const me = await auth.me();
        setAccount(me.account);
        setLogged(true);
        await reloadAccountData();
      } catch {
        setLogged(false);
      }
    });
  }, []);

  useEffect(() => {
    if (logged) reloadAccountData().catch(() => {});
  }, [logged]);

  useEffect(() => {
    const refresh = () => readActiveTab()
      .then((tab) => {
        setActiveTab(tab);
        setBrowserOnline(Boolean(tab && typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting));
      })
      .catch(() => {
        setActiveTab(null);
        setBrowserOnline(false);
      });
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settings || settings.avatarMode === 'off') {
      setAvatarStatus('off');
      setAvatarDetail('');
      return;
    }
    const handle = startAvatar(
      settings,
      (status, detail = '') => {
        setAvatarStatus(status);
        setAvatarDetail(detail);
      },
      (incoming) => {
        persistAvatarItem(incoming).catch(() => {});
      }
    );
    return () => handle.close();
  }, [
    settings?.avatarMode,
    settings?.avatarWorkerUrl,
    settings?.avatarId,
    settings?.avatarToken,
    settings?.provider,
    settings?.apiUrl,
    settings?.apiKey,
    settings?.model
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [shownMessages.length, streamingText, toolEvents.length, selectedId]);

  async function persistItems(next: TimelineItem[]) {
    setItems(next);
    await saveItems(next);
  }

  async function persistSettings() {
    if (!settings) return;
    await saveSettings(settings);
    await api.saveProfile({
      displayName: settings.displayName,
      description: settings.description,
    });
    api.users().then(setUsers).catch(() => setUsers([]));
    setSettingsSaved(true);
  }

  async function logout() {
    await auth.clear();
    setItems([]);
    setUsers([]);
    setAccount('');
    setPage('timeline');
    setLogged(false);
  }

  async function createPairCode() {
    const result = await auth.createPairCode();
    setPairCode(result.code);
    window.setTimeout(() => setPairCode(''), 5 * 60 * 1000);
  }

  function stopRun() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunState('idle');
  }

  function openPage(next: Page) {
    setSelectedId(null);
    setPage(next);
  }

  async function runItemTurn(item: TimelineItem, messages: ChatMessage[]) {
    if (!settings) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamingText('');
    setToolEvents([]);
    setRunState('thinking');

    try {
      const result = await chat(messages, {
        ...settings,
        signal: controller.signal,
        onEvent: (chatEvent) => {
          if (chatEvent.type === 'delta') setStreamingText((current) => current + chatEvent.delta);
          if (chatEvent.type === 'tool_call') {
            setRunState('tooling');
            setToolEvents((current) => [...current, chatEvent]);
          }
          if (chatEvent.type === 'tool_result') setToolEvents((current) => [...current, chatEvent]);
          if (chatEvent.type === 'done') setRunState('idle');
        }
      });
      const now = Date.now();
      const nextItem: TimelineItem = {
        ...item,
        messages: result.messages,
        summary: result.text.trim().slice(0, 120),
        status: 'ready',
        updatedAt: now,
      };
      await persistItems([nextItem, ...items.filter((entry) => entry.id !== item.id)]);
      setStreamingText('');
      setRunState('idle');
    } catch (error) {
      if (controller.signal.aborted) {
        setStreamingText('');
        setRunState('idle');
        return;
      }
      const now = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      const nextItem: TimelineItem = {
        ...item,
        messages: [...messages, { role: 'assistant', content: message }],
        summary: message,
        status: 'error',
        updatedAt: now,
      };
      await persistItems([nextItem, ...items.filter((entry) => entry.id !== item.id)]);
      setStreamingText('');
      setRunState('error');
    } finally {
      abortRef.current = null;
    }
  }

  async function persistAvatarItem(incoming: AvatarIncomingMessage) {
    const now = Date.now();
    const item: TimelineItem = {
      id: incoming.message.id,
      kind: 'message',
      title: titleFromText(incoming.message.text),
      summary: incoming.reply || incoming.message.text,
      status: 'ready',
      createdAt: incoming.message.createdAt || now,
      updatedAt: now,
      messages: incoming.messages,
      contactName: incoming.message.senderName,
      contactAddress: incoming.message.senderAccount,
    };
    setItems((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)];
      void saveItems(next);
      return next;
    });
  }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    const text = draft.trim();
    if (!text) return;
    const now = Date.now();
    const item: TimelineItem = {
      id: newId(),
      kind: 'agent',
      title: titleFromText(text),
      summary: text,
      status: 'working',
      createdAt: now,
      updatedAt: now,
      messages: [{ role: 'user', content: text }],
    };
    const next = [item, ...items];
    setDraft('');
    setSelectedId(item.id);
    await persistItems(next);
    await runItemTurn(item, item.messages);
  }

  async function submitDetail(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem || !settings || busy) return;
    const text = detailDraft.trim();
    if (!text) return;
    const now = Date.now();
    const nextMessages: ChatMessage[] = [...selectedItem.messages, { role: 'user', content: text }];
    const nextItem: TimelineItem = {
      ...selectedItem,
      messages: nextMessages,
      summary: text,
      status: 'working',
      updatedAt: now,
    };
    setDetailDraft('');
    await persistItems(items.map((entry) => entry.id === selectedItem.id ? nextItem : entry));
    await runItemTurn(nextItem, nextMessages);
  }

  if (logged === null) return <div className="boot-screen">meem</div>;
  if (!logged) return <LoginPage onDone={() => setLogged(true)} />;
  if (!settings) return <div className="boot-screen">meem</div>;

  const pageTitle = page === 'contacts' ? '通讯录' : page === 'settings' ? '设置' : 'Meem Dispatch';
  const pageSubtitle = page === 'contacts'
    ? `${users.length} 位成员`
    : page === 'settings'
      ? `${account || '账号'} · ${settings.model}`
      : activeTab ? compactUrl(activeTab.url) || activeTab.title || '独立分身事项流' : '独立分身事项流';
  const avatarOpen = Boolean(settings.avatarMode !== 'off' && settings.avatarId.trim() && settings.avatarToken.trim());
  const avatarLabel = settings.avatarMode === 'off'
    ? '关闭'
    : avatarOpen
      ? avatarStatus === 'online' ? (settings.avatarMode === 'hosted' ? '托管中' : '待审批') : avatarStatus === 'working' ? '处理中' : avatarStatus === 'connecting' ? '连接中' : '等待连接'
      : '待配置';

  return (
    <main className="app-shell">
      <header className="topbar">
        {page === 'timeline' ? (
          <div className="brand-mark">M</div>
        ) : (
          <button className="icon-button" type="button" title="返回事项流" onClick={() => setPage('timeline')}>
            <ArrowLeft size={18} strokeWidth={1.8} />
          </button>
        )}
        <div className="topbar-copy">
          <div className="brand-title">{pageTitle}</div>
          <div className="tab-line" title={pageSubtitle}>
            {pageSubtitle}
          </div>
        </div>
        <button
          className={`icon-button ${page === 'contacts' ? 'active' : ''}`}
          type="button"
          title="通讯录"
          onClick={() => openPage('contacts')}
        >
          <ContactRound size={18} strokeWidth={1.8} />
        </button>
        <button
          className={`icon-button ${page === 'settings' ? 'active' : ''}`}
          type="button"
          title="设置"
          onClick={() => openPage('settings')}
        >
          <Settings size={18} strokeWidth={1.8} />
        </button>
      </header>

      <section className="status-dock" aria-label="运行状态">
        <div className={`status-card ${browserOnline ? 'online' : 'offline'}`}>
          <MonitorCheck size={17} strokeWidth={1.8} />
          <div>
            <span>浏览器</span>
            <strong>{browserOnline ? '在线' : '未接入'}</strong>
          </div>
          {!browserOnline && <button type="button">安装插件</button>}
        </div>
        <div className={`status-card ${avatarOpen ? 'online' : 'offline'}`} title={avatarDetail}>
          <RadioTower size={17} strokeWidth={1.8} />
          <div>
            <span>分身</span>
            <strong>{avatarLabel}</strong>
          </div>
          {!avatarOpen && <button type="button" onClick={() => openPage('settings')}>设置</button>}
        </div>
      </section>

      {page === 'contacts' && (
        <section className="page-surface">
          <ContactsPanel users={users} currentAccount={account} />
        </section>
      )}
      {page === 'settings' && (
        <section className="page-surface">
          <SettingsPanel
            value={settings}
            account={account}
            browserOnline={browserOnline}
            activeTab={activeTab}
            counts={{ items: items.length, users: users.length }}
            onChange={(next) => {
              setSettings(next);
              setSettingsSaved(false);
            }}
            onSave={persistSettings}
            onLogout={logout}
            saved={settingsSaved}
            pairCode={pairCode}
            onCreatePairCode={createPairCode}
          />
        </section>
      )}

      {page === 'timeline' && selectedItem ? (
        <section className="detail">
          <div className="detail-header">
            <button type="button" onClick={() => setSelectedId(null)}>‹</button>
            <div>
              <div>{selectedItem.title}</div>
              <span>{itemKindLabel(selectedItem)} · {formatTime(selectedItem.updatedAt)}</span>
            </div>
          </div>
          <div ref={scrollRef} className="conversation">
            {shownMessages.map((message, index) => <MessageRow key={`${message.role}-${index}`} message={message} />)}
            {streamingText && (
              <div className="message-row assistant">
                <div className="message-author">分身</div>
                <div className="message-bubble streaming">{streamingText}</div>
              </div>
            )}
            <ToolActivity events={toolEvents} />
          </div>
          <footer className="composer-wrap">
            <StatusLine
              runState={runState}
              model={settings.model}
            />
            <form className="composer" onSubmit={submitDetail}>
              <textarea
                value={detailDraft}
                onChange={(event) => setDetailDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="继续处理这个事项"
                rows={1}
              />
              {busy ? (
                <button className="send-button secondary" type="button" onClick={stopRun}>停</button>
              ) : (
                <button className="send-button" type="submit" disabled={!detailDraft.trim()}>发</button>
              )}
            </form>
          </footer>
        </section>
      ) : page === 'timeline' ? (
        <>
          <section className="timeline">
            <div className="timeline-hero">
              <div>
                <p>事项流</p>
                <h1>所有需要分身处理的事，都落在这里。</h1>
              </div>
              <span>{sortedItems.length} 件</span>
            </div>
            {sortedItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">所有事情都从这里开始</div>
                <div className="empty-text">输入一句话，分身会把它变成事项；外部来信、处理结果和后续回复也会进入同一条流。</div>
              </div>
            ) : sortedItems.map((item) => (
              <button key={item.id} type="button" className={`item-card ${item.status}`} onClick={() => setSelectedId(item.id)}>
                <span className="item-rail" />
                <div className="item-meta">
                  <span>{itemKindLabel(item)}</span>
                  <time>{formatTime(item.updatedAt)}</time>
                </div>
                <div className="item-title">{item.title}</div>
                <div className="item-summary">{item.summary}</div>
              </button>
            ))}
          </section>
          <footer className="composer-wrap">
            <StatusLine
              runState={runState}
              model={settings.model}
            />
            <form className="composer" onSubmit={submitNew}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="创建一个事项"
                rows={1}
              />
              {busy ? (
                <button className="send-button secondary" type="button" onClick={stopRun}>停</button>
              ) : (
                <button className="send-button" type="submit" disabled={!draft.trim()}>发</button>
              )}
            </form>
          </footer>
        </>
      ) : null}
    </main>
  );
}

function StatusLine({
  runState,
  model,
}: {
  runState: RunState;
  model: string;
}) {
  return (
    <div className="status-line">
      <span className={`status-dot ${runState}`} />
      <span>{runState === 'tooling' ? '正在使用工具' : runState === 'thinking' ? '正在处理' : runState === 'error' ? '上次请求失败' : model}</span>
    </div>
  );
}
