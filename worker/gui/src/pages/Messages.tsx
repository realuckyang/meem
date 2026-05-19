import { useEffect, useState } from 'react';
import { req, type Conversation, type Me, type Mode, type Settings } from '../api';
import Avatar from '../components/Avatar';
import { pushToast } from '../components/Toast';
import { fmtTime } from '../lib/time';
import ConversationView from './ConversationView';

const MESSAGE_AGENT_MODES: { key: Mode; label: string; desc: string }[] = [
  { key: 'observe', label: '观察', desc: '只读上下文，生成回复草稿' },
  { key: 'approval', label: '审批', desc: '需要关键操作时等待确认' },
  { key: 'managed', label: '托管', desc: '按权限完整处理并给出草稿' },
];

export default function Messages({
  conversationId,
  processSessionId,
  onOpenConversation,
  onCloseConversation,
}: {
  conversationId?: string;
  processSessionId?: string;
  onOpenConversation: (id: string) => void;
  onCloseConversation: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [address, setAddress] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [saving, setSaving] = useState(false);

  const refresh = () => req<Conversation[]>('/api/messages/conversations').then(setConversations).catch(() => {});
  const loadSettings = () => req<Settings>('/api/settings').then(setSettings).catch(() => {});

  useEffect(() => {
    refresh();
    loadSettings();
    req<Me>('/api/me').then((me) => setAddress(me.publicAddress)).catch(() => {});
    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (
        frame?.type === 'conversation-message' ||
        frame?.type === 'conversation-message' ||
        frame?.type === 'conversation-updated' ||
        frame?.type === 'conversation-deleted'
      ) refresh();
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, []);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    pushToast('已复制消息地址', 'success');
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function saveMessageSettings(next: Partial<Pick<Settings, 'public_messages_enabled' | 'mode_message_agent'>>) {
    if (!settings || saving) return;
    const optimistic = { ...settings, ...next };
    setSettings(optimistic);
    setSaving(true);
    try {
      const updated = await req<Settings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      setSettings(updated);
    } catch {
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  }

  const visible = conversations.filter((t) => t.status !== 'archived');
  const publicMessagesEnabled = settings?.public_messages_enabled !== false;

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 shrink-0 flex items-center px-4 border-b bg-white/85 backdrop-blur font-semibold">
        <span className="flex-1 flex items-center gap-1.5">
          <span className="text-lg leading-none">💬</span>
          <span>消息</span>
        </span>
        {address && (
          <button
            onClick={() => setShowAddress((value) => !value)}
            title={showAddress ? '收起消息地址' : '查看 / 分享消息地址'}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              showAddress ? 'text-neutral-900 bg-neutral-100' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1 1" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {address && showAddress && (
          <section className="border-b bg-white px-4 py-3 meem-fade-enter">
            <div className="text-[11px] text-neutral-400">消息地址 · 把它分享出去就能收到新会话</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate text-[13px] text-neutral-700">
                {address}
              </div>
              <button
                onClick={copyAddress}
                className="h-7 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-[12px] text-neutral-600 hover:bg-neutral-50"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] text-neutral-900">接收消息</div>
                <div className="mt-0.5 text-[11px] text-neutral-400">
                  {publicMessagesEnabled ? '公开地址可以收到新消息' : '公开地址暂不接收新消息'}
                </div>
              </div>
              <button
                onClick={() => saveMessageSettings({ public_messages_enabled: !publicMessagesEnabled })}
                disabled={!settings || saving}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                  publicMessagesEnabled ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
                aria-pressed={publicMessagesEnabled}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    publicMessagesEnabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3">
              <div className="text-[11px] text-neutral-400">AI 处理模式</div>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {MESSAGE_AGENT_MODES.map((mode) => {
                  const active = settings?.mode_message_agent === mode.key;
                  return (
                    <button
                      key={mode.key}
                      onClick={() => saveMessageSettings({ mode_message_agent: mode.key })}
                      disabled={!settings || saving}
                      className={`rounded-md border px-2 py-1.5 text-[12px] transition disabled:opacity-50 ${
                        active
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-neutral-400">
                {MESSAGE_AGENT_MODES.find((mode) => mode.key === settings?.mode_message_agent)?.desc || '加载中'}
              </div>
            </div>
          </section>
        )}
        <section>
          {visible.length === 0 && (
            <div className="px-6 pt-10 pb-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 grid place-items-center text-2xl">📭</div>
              <div className="mt-3 text-sm text-neutral-500">暂无消息</div>
              <div className="mt-1 text-[12px] text-neutral-400">
                给别人发消息，或者分享你的地址
              </div>
            </div>
          )}
          {visible.map((conversation) => {
            const display = conversation.contact_name || '联系人';
            return (
              <button
                key={conversation.id}
                onClick={() => onOpenConversation(conversation.id)}
                className="w-full text-left px-4 py-3 border-b bg-white hover:bg-neutral-50 flex items-center gap-3"
              >
                <Avatar seed={display} label={display} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium truncate">{display}</span>
                    <span className="text-xs text-neutral-400 ml-auto pl-2 shrink-0">
                      {fmtTime(conversation.updated_at)}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-500 truncate">
                    {conversation.last_message_preview || conversation.title}
                  </div>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="text-xs bg-red-500 text-white rounded-full px-1.5 min-w-[18px] text-center font-semibold">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      {conversationId && (
        <ConversationView
          conversationId={conversationId}
          processSessionId={processSessionId}
          onClose={() => {
            onCloseConversation();
            refresh();
          }}
        />
      )}
    </div>
  );
}
