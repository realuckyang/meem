import { useEffect, useMemo, useState } from 'react';
import { emitMeem, req, type Session, type SessionEvent } from '../api';
import OpenAIIcon from '../components/OpenAIIcon';
import { fmtClock } from '../lib/time';
import { statusLabel, statusPillClass } from '../lib/sessionStatus';
import { pushToast } from '../components/Toast';

export default function InboxAgentBlock({
  session,
  onOpen,
  onStart,
}: {
  session?: Session;
  onOpen: () => void;
  onStart: () => Promise<void>;
}) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [liveText, setLiveText] = useState('');
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setLiveText('');
      return;
    }

    req<{ session: Session; events: SessionEvent[] }>(`/api/sessions/${session.id}`)
      .then((body) => setEvents(body.events))
      .catch(() => {});

    const onFrame = (event: Event) => {
      const frame = (event as CustomEvent<any>).detail;
      if (!frame || frame.session_id !== session.id) return;
      if (frame.type === 'session-event') {
        setEvents((prev) => prev.some((item) => item.id === frame.event.id) ? prev : [...prev, frame.event]);
      }
      if (frame.type === 'agent-event-live') {
        const live = frame.event;
        if (live.live === 'item-partial' && live.kind === 'agent_message') {
          setLiveText(live.text || '');
        }
        if (live.live === 'item-done') setLiveText('');
      }
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, [session?.id]);

  const latestAgentMessage = useMemo(() => {
    return [...events].reverse().find((event) => event.kind === 'agent_message');
  }, [events]);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      await onStart();
    } catch {} finally {
      setStarting(false);
    }
  }

  function adopt(text: string) {
    emitMeem('meem:adopt-as-reply', { text });
    pushToast('已放入回复框', 'success');
  }

  // 没有 session：只显示一个虚线触发按钮
  if (!session) {
    return (
      <div className="ml-[40px] mr-4 pl-3 border-l border-neutral-200">
        <button
          onClick={start}
          disabled={starting}
          className="inline-flex items-center gap-1 my-1.5 px-2 py-1 text-[11.5px] text-neutral-400 hover:text-neutral-700 border border-dashed border-neutral-300 hover:border-neutral-400 rounded transition disabled:text-neutral-300"
        >
          <span className="text-[13px] leading-none">+</span>
          {starting ? '正在连接 Codex' : '让 Codex 起草回复'}
        </button>
      </div>
    );
  }

  const live = !['done', 'cancelled', 'errored'].includes(session.status);
  const text = liveText || latestAgentMessage?.payload?.text || '';

  // 折叠态：一行 pill + 时间 + 展开
  if (!expanded) {
    return (
      <div className="ml-[40px] mr-4 pl-3 border-l border-neutral-200">
        <button
          onClick={() => setExpanded(true)}
          className="my-1.5 inline-flex items-center gap-2 text-[11.5px] text-neutral-500 hover:text-neutral-900"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-900 text-white">
            <OpenAIIcon size={9} />
          </span>
          <span>Codex</span>
          <span className={statusPillClass(session.status)}>{statusLabel(session.status)}</span>
          {text && <span className="truncate max-w-[12rem] text-neutral-400">「{text.slice(0, 24)}{text.length > 24 ? '…' : ''}」</span>}
          <span className="text-neutral-400 tabular-nums">{fmtClock(session.updated_at)}</span>
          <span className="text-neutral-300">▾</span>
        </button>
      </div>
    );
  }

  // 展开态
  return (
    <div className="ml-[40px] mr-4 my-1 pl-3 border-l border-neutral-200">
      <div className="grid grid-cols-[20px_1fr] gap-2 px-3 py-2 bg-neutral-50/40 rounded-lg">
        <div className="pt-1">
          <div className="w-5 h-5 rounded-full grid place-items-center text-white bg-neutral-900">
            <OpenAIIcon size={11} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 text-[12px] leading-[1.4]">
            <span className="font-semibold text-neutral-700">Codex</span>
            <span className={statusPillClass(session.status)}>{statusLabel(session.status)}</span>
            <span className="ml-auto pl-2 text-[10.5px] text-neutral-400 tabular-nums shrink-0">
              {fmtClock(session.updated_at)}
            </span>
            <button onClick={() => setExpanded(false)}
                    className="text-[11px] text-neutral-400 hover:text-neutral-700">收起</button>
          </div>

          {text ? (
            <div className="mt-1 text-[12.5px] leading-[1.55] text-neutral-700 whitespace-pre-wrap break-words">
              {text}
              {liveText && <span className="inline-block w-1 h-3 bg-neutral-400 ml-0.5 align-text-bottom animate-pulse" />}
            </div>
          ) : live ? (
            <div className="mt-1 flex items-center gap-1 h-[14px]">
              <span className="twain-dot" />
              <span className="twain-dot" />
              <span className="twain-dot" />
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-3">
            {text && !live && (
              <button onClick={() => adopt(text)}
                      className="text-[11.5px] text-neutral-900 px-2 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200">
                采用为回复
              </button>
            )}
            <button onClick={onOpen}
                    className="text-[11.5px] text-neutral-500 hover:text-neutral-900">
              {live ? '查看过程' : '继续讨论'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
