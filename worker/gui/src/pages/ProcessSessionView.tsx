import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMeem, req, type InboxMessage, type Session, type SessionEvent, type SessionStatus } from '../api';
import Composer from '../components/Composer';
import OpenAIIcon from '../components/OpenAIIcon';
import { statusLabel, statusPillClass } from '../lib/sessionStatus';
import { pushToast } from '../components/Toast';
import { EventRow, LivePartialRow, ThinkingRow } from './SessionEventRows';

export default function ProcessSessionView({
  sessionId,
  triggerMessage,
  onClose,
}: {
  sessionId: string;
  triggerMessage?: InboxMessage | null;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [livePartials, setLivePartials] = useState<Map<string, any>>(new Map());
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    req<{ session: Session; events: SessionEvent[] }>(`/api/sessions/${sessionId}`)
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
        const live = frame.event;
        if (live.live === 'item-partial' && live.id) {
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.set(live.id, live);
            return next;
          });
        }
        if (live.live === 'item-done' && live.id) {
          setLivePartials((prev) => {
            const next = new Map(prev);
            next.delete(live.id);
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

  const live = !session ? false : !['done', 'cancelled', 'errored'].includes(session.status);
  const label = session ? statusLabel(session.status) : '';

  async function stop() {
    if (!session || busy) return;
    setBusy(true);
    try {
      await req<{ status: SessionStatus }>(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setSession((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
      setLivePartials(new Map());
    } finally {
      setBusy(false);
    }
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
    } finally {
      setBusy(false);
    }
  }

  // 最新一条 agent_message 作为可"采用"的草稿
  const latestAgentText = useMemo(() => {
    const reversed = [...events].reverse();
    return reversed.find((event) => event.kind === 'agent_message')?.payload?.text || '';
  }, [events]);

  function adoptAsReply() {
    if (!latestAgentText) return;
    emitMeem('meem:adopt-as-reply', { text: latestAgentText });
    pushToast('已放入回复框', 'success');
    onClose();
  }

  return (
    <div className="absolute inset-0 z-50">
      <button
        onClick={onClose}
        aria-label="关闭"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] meem-fade-enter"
      />
      <div className="meem-sheet-enter absolute inset-x-0 bottom-0 top-[15%] flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-neutral-300" />
        </div>

        <header className="shrink-0 border-b bg-white px-4 pt-1 pb-3">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[11px] text-neutral-400">和 Codex 讨论这条消息</div>
            <div className="flex items-center gap-2">
              {session && (
                <span className={statusPillClass(session.status)}>{label}</span>
              )}
              <button onClick={onClose}
                      className="text-[12px] text-neutral-500 hover:text-neutral-900">关闭</button>
            </div>
          </div>
          {triggerMessage ? (
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white bg-neutral-700 shrink-0">
                {initial(triggerMessage.sender_name)}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-neutral-500">
                  <span className="font-semibold text-neutral-700">{triggerMessage.sender_name || '访客'}</span>
                  <span> · {fmtClock(triggerMessage.created_at)}</span>
                </div>
                <div className="mt-0.5 text-[13.5px] text-neutral-900 whitespace-pre-wrap break-words">
                  {triggerMessage.body}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-[15px] font-semibold">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900 text-white">
                <OpenAIIcon size={11} />
              </span>
              Codex
              {label && <span className="text-[11px] text-neutral-400 font-normal">· {label}</span>}
            </div>
          )}

          {latestAgentText && (
            <div className="mt-2 flex justify-end">
              <button onClick={adoptAsReply}
                      className="text-[12px] text-neutral-900 px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200">
                采用为回复 →
              </button>
            </div>
          )}
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto bg-neutral-50">
          <div className="divide-y divide-neutral-200">
            {events.length === 0 && livePartials.size === 0 && (
              <div className="p-10 text-center text-neutral-400 text-sm">等待处理。</div>
            )}
            {events.map((event) => <EventRow key={event.id} event={event} />)}
            {[...livePartials.values()].map((partial) => <LivePartialRow key={partial.id} live={partial} />)}
            {live && livePartials.size === 0 && <ThinkingRow />}
          </div>
        </div>

        <Composer
          value={composer}
          onChange={setComposer}
          onSubmit={send}
          placeholder="对 Codex 说... · 回车发送 · Shift+回车换行"
          disabled={busy}
          live={live}
          onStop={stop}
        />
      </div>
    </div>
  );
}

function initial(value: string) {
  return (value || '?').slice(0, 1).toUpperCase();
}

function fmtClock(ts: number) {
  const date = new Date(ts * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
