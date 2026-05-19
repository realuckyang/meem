import { useEffect, useState } from 'react';
import { req, type Presence, type Session } from '../api';
import OpenAIIcon from '../components/OpenAIIcon';
import { fmtTime } from '../lib/time';
import { statusLabel, statusPillClass } from '../lib/sessionStatus';
import { pushToast } from '../components/Toast';
import SessionView from './SessionView';

export default function AgentChatView({
  onClose,
  onSettings,
  onOpenSession,
  onCloseSession,
  sessionId,
}: {
  onClose?: () => void;
  onSettings?: () => void;
  onOpenSession?: (id: string) => void;
  onCloseSession?: () => void;
  sessionId?: string;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connectorOnline, setConnectorOnline] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [cwd, setCwd] = useState('');

  const refresh = () => req<Session[]>('/api/sessions')
    .then((list) => setSessions(list.filter((session) => session.kind === 'direct_chat')))
    .catch(() => {});

  useEffect(() => {
    refresh();
    const checkPresence = () => req<Presence>('/api/presence')
      .then((data) => setConnectorOnline(data.sessions.some((session) => session.kind === 'desktop')))
      .catch(() => setConnectorOnline(false));
    checkPresence();
    const timer = setInterval(checkPresence, 5000);

    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent).detail;
      if (frame?.type === 'session-started' ||
          frame?.type === 'session-status' ||
          frame?.type === 'session-deleted') refresh();
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => {
      clearInterval(timer);
      window.removeEventListener('meem:frame', onFrame as EventListener);
    };
  }, []);

  const cwdOptions = [
    { label: '默认工作区', value: '' },
    { label: '桌面', value: '/Users/woodchange/Desktop' },
    { label: 'Meem', value: '/Users/woodchange/Desktop/meem' },
  ];

  async function createNew() {
    if (creating) return;
    if (connectorOnline === false) {
      pushToast('连接器未就绪，无法发起会话', 'error');
      return;
    }
    setCreating(true);
    try {
      const { session_id } = await req<{ session_id: string }>('/api/sessions/direct', {
        method: 'POST',
        body: JSON.stringify({ cwd: cwd.trim() || null }),
      });
      setDraftOpen(false);
      onOpenSession?.(session_id);
      refresh();
    } catch {} finally { setCreating(false); }
  }

  return (
    <div className={`${onClose ? 'absolute inset-0 z-30' : 'h-full'} flex flex-col bg-neutral-50`}>
      <header className="h-12 shrink-0 flex items-center gap-1 px-3 border-b bg-white/85 backdrop-blur">
        {onClose && (
          <button onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center text-neutral-700 text-lg">‹</button>
        )}
        <div className="flex-1 font-semibold text-[15px] flex items-center gap-1.5">
          <span className="text-lg leading-none">⌘</span>
          <span>Codex</span>
        </div>
        <button
          onClick={() => setDraftOpen((open) => !open)}
          disabled={creating}
          title={connectorOnline === false ? '连接器未就绪' : '新建会话'}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${
            connectorOnline === false ? 'text-neutral-300' : 'text-neutral-700 hover:bg-neutral-100'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {onSettings && (
          <button
            onClick={onSettings}
            title="设置"
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2.05 2.05 0 0 1-2.9 2.9l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .9l-.02.05a2.05 2.05 0 0 1-3.76 0l-.02-.05a1.7 1.7 0 0 0-1-.9 1.7 1.7 0 0 0-1.88.34l-.04.04a2.05 2.05 0 0 1-2.9-2.9l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.9-1l-.05-.02a2.05 2.05 0 0 1 0-3.76l.05-.02a1.7 1.7 0 0 0 .9-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2.05 2.05 0 0 1 2.9-2.9l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.9l.02-.05a2.05 2.05 0 0 1 3.76 0l.02.05a1.7 1.7 0 0 0 1 .9 1.7 1.7 0 0 0 1.88-.34l.04-.04a2.05 2.05 0 0 1 2.9 2.9l-.04.04A1.7 1.7 0 0 0 19.4 9c.12.4.43.73.9 1l.05.02a2.05 2.05 0 0 1 0 3.76l-.05.02a1.7 1.7 0 0 0-.9 1Z" />
            </svg>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {draftOpen && (
          <section className="border-b bg-white px-4 py-3">
            <div className="text-[11px] text-neutral-400">工作目录</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cwdOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => setCwd(option.value)}
                  className={`rounded-md border px-2 py-1 text-[12px] ${
                    cwd === option.value
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                placeholder="默认使用 Meem 会话工作区，也可以填写本机绝对路径"
                className="min-w-0 flex-1 border-b border-neutral-200 bg-transparent py-1 text-[13px] text-neutral-800 outline-none focus:border-neutral-900 placeholder:text-neutral-400"
              />
              <button
                onClick={createNew}
                disabled={creating || connectorOnline === false}
                className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] text-white disabled:bg-neutral-300"
              >
                {creating ? '创建中' : '创建'}
              </button>
            </div>
          </section>
        )}

        {connectorOnline === false && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-white border border-amber-200 text-amber-600 flex items-center justify-center text-lg font-medium">!</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-900">连接器未就绪</div>
                <div className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  在本地运行{' '}
                  <code className="px-1 rounded bg-amber-100/80 text-amber-700">npm --prefix server start</code>，
                  或打开桌面 App 让连接器上线后才能创建新会话。
                </div>
              </div>
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="p-10 text-center text-neutral-400 text-sm">
            还没有 Codex 会话。
            <br />
            点右上角 <span className="text-neutral-700 font-medium">+</span> 开一段。
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 bg-white">
            {sessions.map((session) => {
              const title = session.title?.trim() || '（空会话）';
              return (
                <button
                  key={session.id}
                  onClick={() => onOpenSession?.(session.id)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0">
                    <OpenAIIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm truncate">{title}</span>
                      <span className="ml-auto text-xs text-neutral-400 shrink-0">{fmtTime(session.updated_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={statusPillClass(session.status)}>{statusLabel(session.status)}</span>
                      {session.cwd && (
                        <span className="truncate text-[11px] text-neutral-400">{session.cwd}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-neutral-300 text-sm">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sessionId && (
        <SessionView
          sessionId={sessionId}
          onClose={() => onCloseSession?.()}
        />
      )}
    </div>
  );
}
