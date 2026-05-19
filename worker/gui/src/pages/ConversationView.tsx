import { useEffect, useMemo, useRef, useState } from 'react';
import { req, type Message, type Conversation, type Session } from '../api';
import Composer from '../components/Composer';
import Avatar from '../components/Avatar';
import { fmtClock } from '../lib/time';
import { pushToast } from '../components/Toast';
import MessageAgentBlock from './MessageAgentBlock';

export default function ConversationView({
  conversationId,
  onClose,
}: {
  conversationId: string;
  processSessionId?: string;
  onClose: () => void;
}) {
  const [conversation, setThread] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'delete'>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const refresh = () => req<{ conversation: Conversation; messages: Message[] }>(`/api/messages/conversations/${conversationId}`)
    .then((body) => {
      setThread(body.conversation);
      setMessages(body.messages);
    })
    .catch(() => {});
  const refreshSessions = () => req<Session[]>(
    `/api/sessions?kind=message_agent&conversation_id=${encodeURIComponent(conversationId)}`,
  ).then(setSessions).catch(() => {});

  useEffect(() => {
    refresh();
    refreshSessions();
    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if ((frame?.type === 'conversation-message' && frame.conversation?.id === conversationId) ||
          (frame?.type === 'conversation-message' && frame.conversation_id === conversationId)) {
        refresh();
      }
      if ((frame?.type === 'session-started' && frame.session?.conversation_id === conversationId) ||
          frame?.type === 'session-status') {
        refreshSessions();
      }
    };
    window.addEventListener('meem:frame', onFrame as EventListener);

    const onAdopt = (event: Event) => {
      const text = (event as CustomEvent).detail?.text;
      if (typeof text === 'string') setComposer(text);
    };
    window.addEventListener('meem:adopt-as-reply', onAdopt as EventListener);
    return () => {
      window.removeEventListener('meem:frame', onFrame as EventListener);
      window.removeEventListener('meem:adopt-as-reply', onAdopt as EventListener);
    };
  }, [conversationId]);

  // 点空白关菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener('mousedown', onDown, { once: true }), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages.length, sessions.length]);

  const sessionsByMessage = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      if (!session.trigger_message_id) continue;
      const list = map.get(session.trigger_message_id) ?? [];
      list.push(session);
      map.set(session.trigger_message_id, list);
    }
    return map;
  }, [sessions]);

  async function send() {
    const text = composer.trim();
    if (!text || busy) return;
    setBusy(true);
    setComposer('');
    try {
      const { message } = await req<{ message: Message }>(`/api/messages/conversations/${conversationId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setMessages((prev) => [...prev, message]);
    } catch {
      setComposer(text);
    } finally {
      setBusy(false);
    }
  }

  async function processMessage(messageId: string) {
    try {
      await req(`/api/messages/conversations/${conversationId}/process`, {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId }),
      });
      await refreshSessions();
    } catch {}
  }

  async function archive() {
    setMenuOpen(false);
    try {
      await req(`/api/messages/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      pushToast('已归档', 'success');
      onClose();
    } catch {}
  }

  async function copyAddress() {
    setMenuOpen(false);
    if (!conversation?.contact_address) return;
    await navigator.clipboard.writeText(conversation.contact_address).catch(() => {});
    pushToast('已复制地址', 'success');
  }

  async function deleteThread() {
    setConfirm(null);
    try {
      await req(`/api/messages/conversations/${conversationId}`, { method: 'DELETE' });
      onClose();
    } catch {}
  }

  const contactName = conversation?.contact_name || '联系人';
  const contactAddress = conversation?.contact_address || '';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-2 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-700 text-lg">‹</button>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-semibold text-[15px] truncate">{contactName}</div>
          {contactAddress && (
            <div className="text-[11px] text-neutral-400 truncate">{contactAddress}</div>
          )}
        </div>
        <div className="relative w-7">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((open) => !open); }}
                  className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-neutral-900">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div onMouseDown={(e) => e.stopPropagation()}
                 className="absolute right-0 top-8 z-50 w-40 overflow-hidden rounded-xl border bg-white py-1 text-sm shadow-lg meem-fade-enter">
              {contactAddress && (
                <button onClick={copyAddress}
                        className="block w-full px-3 py-2 text-left hover:bg-neutral-50">复制地址</button>
              )}
              <button onClick={archive}
                      className="block w-full px-3 py-2 text-left hover:bg-neutral-50">归档</button>
              <button onClick={() => { setMenuOpen(false); setConfirm('delete'); }}
                      className="block w-full px-3 py-2 text-left text-red-500 hover:bg-red-50/60">删除</button>
            </div>
          )}
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="divide-y divide-neutral-200">
          {messages.map((message) => {
            const outbound = message.direction === 'outbound';
            const relatedSessions = sessionsByMessage.get(message.id) ?? [];
            const activeSession = relatedSessions[0];
            return (
              <div key={message.id}>
                <MessageRow
                  who={outbound ? '我' : (message.sender_name || contactName)}
                  contactName={contactName}
                  outbound={outbound}
                  body={message.body}
                  time={fmtClock(message.created_at)}
                />
                {!outbound && (
                  <MessageAgentBlock
                    session={activeSession}
                    onStart={() => processMessage(message.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Composer
        value={composer}
        onChange={setComposer}
        onSubmit={send}
        placeholder="发送消息... · 回车发送"
        disabled={busy}
      />

      {confirm === 'delete' && (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <button aria-label="cancel"
                  onClick={() => setConfirm(null)}
                  className="absolute inset-0 bg-black/30 meem-fade-enter" />
          <div className="relative mx-3 mb-3 w-full max-w-md rounded-2xl bg-white shadow-xl p-4 meem-sheet-enter">
            <div className="font-semibold text-[15px]">删除这条会话？</div>
            <div className="text-sm text-neutral-500 mt-1">会话内所有消息将被清掉，无法恢复。</div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100">取消</button>
              <button onClick={deleteThread}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({
  who, contactName, body, time, outbound,
}: {
  who: string;
  contactName: string;
  body: string;
  time: string;
  outbound: boolean;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2.5 px-4 py-3.5 bg-white">
      <div className="pt-0.5">
        {outbound
          ? <div className="w-7 h-7 rounded-full bg-emerald-600 text-white grid place-items-center text-[11px] font-semibold">我</div>
          : <Avatar seed={contactName} label={contactName} size={28} />}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 text-[14px] leading-[1.4]">
          <span className="font-semibold text-neutral-900 truncate">{who}</span>
          <span className="ml-auto pl-2 text-xs text-neutral-400 tabular-nums shrink-0">{time}</span>
        </div>
        <div className="mt-1.5 text-[13.5px] leading-[1.55] text-neutral-900 whitespace-pre-wrap break-words">
          {body}
        </div>
      </div>
    </div>
  );
}
