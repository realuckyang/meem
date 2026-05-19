import { useEffect, useRef, useState } from 'react';
import { req, type Session, type AgentEvent, type SessionStatus } from '../api';
import Composer from '../components/Composer';
import OpenAIIcon from '../components/OpenAIIcon';
import { pushToast } from '../components/Toast';
import { EventRow, LivePartialRow, ThinkingRow } from './AgentEventRows';

type RenameState = { active: boolean; value: string };
type Confirm = null | 'delete';

function compactPath(value?: string | null) {
  const path = String(value || '').trim();
  if (!path) return '默认工作区';
  return path.replace(/^\/Users\/woodchange(?=\/|$)/, '~');
}

export default function SessionView({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [livePartials, setLivePartials] = useState<Map<string, any>>(new Map());
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rename, setRename] = useState<RenameState>({ active: false, value: '' });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    req<{ session: Session; events: AgentEvent[] }>(`/api/sessions/${sessionId}`)
      .then((body) => {
        setSession(body.session);
        setEvents(body.events);
      })
      .catch(() => {});

    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent<any>).detail;
      if (!frame || frame.session_id !== sessionId) return;
      if (frame.type === 'session-event') {
        setEvents((prev) => prev.some((item) => item.id === frame.event.id) ? prev : [...prev, frame.event]);
      }
      if (frame.type === 'session-status') {
        setSession((prev) => prev ? {
          ...prev,
          status: frame.status,
          title: Object.prototype.hasOwnProperty.call(frame, 'title') ? frame.title : prev.title,
          updated_at: frame.updated_at,
          finished_at: frame.finished_at,
        } : prev);
        if (['done', 'cancelled', 'errored'].includes(frame.status)) setLivePartials(new Map());
      }
      if (frame.type === 'agent-event-live') {
        const ev = frame.event;
        if (ev.live === 'item-partial' && ev.id) {
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.set(ev.id, ev);
            return next;
          });
        }
        if (ev.live === 'item-done' && ev.id) {
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.delete(ev.id);
            return next;
          });
        }
      }
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, [sessionId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [events.length, livePartials.size]);

  useEffect(() => {
    if (rename.active) renameRef.current?.focus();
  }, [rename.active]);

  // 点空白关菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener('mousedown', onDown, { once: true }), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const live = !session ? false : !['done', 'cancelled', 'errored'].includes(session.status);

  async function stopAndReset() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await req<{ status: SessionStatus }>(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setSession((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
      setLivePartials(new Map());
    } catch {} finally { setBusy(false); }
  }

  async function send() {
    const text = composer.trim();
    if (!text || busy) return;
    setBusy(true);
    setComposer('');
    try {
      await req<{ event_id: string }>(`/api/sessions/${sessionId}/turn`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    } catch {
      setComposer(text);
    } finally { setBusy(false); }
  }

  function startRename() {
    setMenuOpen(false);
    if (!session) return;
    setRename({ active: true, value: session.title || '' });
  }

  async function commitRename() {
    if (!session || busy) return;
    const value = rename.value.trim();
    setBusy(true);
    try {
      const updated = await req<{ title: string | null }>(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: value || null }),
      });
      setSession((prev) => prev ? { ...prev, title: updated.title ?? null } : prev);
      setRename({ active: false, value: '' });
      pushToast('已重命名', 'success');
    } catch {} finally { setBusy(false); }
  }

  async function deleteSession() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await req(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      onClose();
    } catch {} finally { setBusy(false); }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-50">
      <header className="h-11 shrink-0 flex items-center px-2 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-neutral-700 text-lg">‹</button>

        <div className="flex-1 min-w-0 px-1">
          {rename.active ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={renameRef}
                value={rename.value}
                onChange={(e) => setRename({ active: true, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') setRename({ active: false, value: '' });
                }}
                placeholder="对话标题"
                className="w-full text-center font-semibold text-[15px] bg-transparent border-b border-neutral-300 focus:border-neutral-900 outline-none py-0.5"
                maxLength={80}
              />
              <button onClick={commitRename} disabled={busy}
                      className="text-[12px] text-neutral-900 px-1 disabled:text-neutral-300">完成</button>
            </div>
          ) : (
            <div className="text-center font-semibold text-[15px] flex items-center justify-center gap-1.5 truncate">
              <span className="inline-flex w-5 h-5 rounded-full bg-neutral-900 text-white items-center justify-center">
                <OpenAIIcon size={11} />
              </span>
              <span>Codex</span>
            </div>
          )}
        </div>

        <div className="relative w-7">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((open) => !open); }}
            disabled={busy}
            title="更多"
            className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-neutral-900 disabled:text-neutral-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div onMouseDown={(e) => e.stopPropagation()}
                 className="absolute right-0 top-8 z-50 w-56 overflow-hidden rounded-xl border bg-white py-1 text-sm shadow-lg meem-fade-enter">
              <div className="px-3 py-2 border-b border-neutral-100">
                <div className="text-[11px] text-neutral-400">工作目录</div>
                <div title={session?.cwd || '默认工作区'} className="mt-0.5 truncate text-[12px] text-neutral-700">
                  {compactPath(session?.cwd)}
                </div>
              </div>
              <button onClick={startRename}
                      className="block w-full px-3 py-2 text-left hover:bg-neutral-50">重命名</button>
              <button onClick={() => { setMenuOpen(false); setConfirm('delete'); }}
                      className="block w-full px-3 py-2 text-left text-red-500 hover:bg-red-50/60">删除对话</button>
            </div>
          )}
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="divide-y divide-neutral-200">
          {events.length === 0 && livePartials.size === 0 && (
            <div className="p-10 text-center text-neutral-400 text-sm">说点啥…</div>
          )}
          {events.map((event) => <EventRow key={event.id} event={event} />)}
          {[...livePartials.values()].map((partial) => <LivePartialRow key={partial.id} live={partial} />)}
          {live && livePartials.size === 0 && <ThinkingRow />}
        </div>
      </div>

      {confirm === 'delete' && (
        <div className="absolute inset-0 z-50 flex items-end justify-center">
          <button aria-label="cancel"
                  onClick={() => setConfirm(null)}
                  className="absolute inset-0 bg-black/30 meem-fade-enter" />
          <div className="relative mx-3 mb-3 w-full max-w-md rounded-2xl bg-white shadow-xl p-4 meem-sheet-enter">
            <div className="font-semibold text-[15px]">删除这个对话？</div>
            <div className="text-sm text-neutral-500 mt-1">对话和过程事件都会被清掉，无法恢复。</div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100">取消</button>
              <button onClick={async () => { setConfirm(null); await deleteSession(); }}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300">删除</button>
            </div>
          </div>
        </div>
      )}

      <Composer
        value={composer}
        onChange={setComposer}
        onSubmit={send}
        placeholder="对 Codex 说... · 回车发送 · Shift+回车换行"
        disabled={busy}
        live={live}
        onStop={stopAndReset}
      />
    </div>
  );
}
