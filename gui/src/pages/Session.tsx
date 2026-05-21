import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import { req, type Session as SessionType } from '../lib/api';
import { onFrame, sendFrame, isOpen } from '../lib/socket';
import { applyEvent, type ChatItem, type EventRow } from '../lib/parseEvents';
import { useMe } from '../lib/me';
import Composer from '../components/Composer';
import MessageRow, { AgentAv, CircleLabel } from '../components/MessageRow';
import ToolCard from '../components/ToolCard';

const SUGGESTS = [
  { icon: '✍️', label: '帮我写点东西', prompt: '帮我写一段……' },
  { icon: '💡', label: '给我一些灵感', prompt: '给我一些关于……的灵感' },
  { icon: '📝', label: '总结一下',     prompt: '帮我总结一下……' },
  { icon: '💻', label: '写段代码',     prompt: '用 ____ 写一段代码,实现……' },
  { icon: '🌐', label: '翻译',         prompt: '把下面这段翻译成……\n\n' },
  { icon: '🎓', label: '解释一个概念', prompt: '用通俗的话解释一下:' },
];

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 5)  return { icon: '🌙', text: '深夜好' };
    if (h < 11) return { icon: '☀️', text: '早上好' };
    if (h < 13) return { icon: '🌤', text: '中午好' };
    if (h < 18) return { icon: '🌻', text: '下午好' };
    if (h < 22) return { icon: '🌆', text: '晚上好' };
    return { icon: '🌙', text: '夜里好' };
  }, []);
}

function fmtClock(ts: number) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function Session() {
  const { sid = '' } = useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const [session, setSession] = useState<SessionType | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const greeting = useGreeting();

  async function loadHistory() {
    const rows = await req<EventRow[]>(`/api/sessions/${sid}/events`).catch(() => [] as EventRow[]);
    let next: ChatItem[] = [];
    for (const r of rows) next = applyEvent(next, r);
    setItems(next);
  }

  useEffect(() => {
    req<SessionType>(`/api/sessions/${sid}`).then((s) => {
      setSession(s);
      if (s.status === 'thinking') setRunning(true);
    }).catch(() => {});
    loadHistory();
  }, [sid]);

  useEffect(() => {
    const off = onFrame((f: any) => {
      if (!f || typeof f !== 'object') return;
      if (f.type === 'event' && f.event?.sid === sid) {
        const row: EventRow = {
          id: f.event.id,
          sid: f.event.sid,
          message: f.event.message,
          meta: null,
          created: f.event.created ?? Math.floor(Date.now() / 1000),
        };
        setItems((prev) => applyEvent(prev, row));
        return;
      }
      if (f.type === 'session.thinking' && f.sid === sid) { setRunning(true); setErrMsg(''); return; }
      if (f.type === 'session.done' && f.sid === sid)     { setRunning(false); return; }
      if (f.type === 'session.error' && f.sid === sid)    { setRunning(false); setErrMsg(f.message ?? '处理失败'); return; }
      if (f.type === 'ws:open') loadHistory();
    });
    return off;
  }, [sid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items, running]);

  function send(text: string) {
    if (running) return;
    setErrMsg('');
    if (!isOpen()) { setErrMsg('连接未就绪，请稍候'); return; }
    if (!sendFrame({ type: 'session.send', sid, text })) {
      setErrMsg('发送失败，连接已断开');
    }
  }

  const hasItems = items.length > 0;
  const myName = me.name || me.handle;

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={() => navigate('/sessions')} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1 truncate">{session?.title || '智能体'}</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!hasItems && !running && (
          <div className="flex flex-col items-center pt-10 pb-6 text-center">
            <div className="text-5xl mb-3 animate-[bob_4s_ease-in-out_infinite]">{greeting.icon}</div>
            <h1 className="text-2xl font-medium tracking-tight bg-gradient-to-r from-accent via-purple-500 to-pink-500 text-transparent bg-clip-text">{greeting.text}</h1>
            <p className="text-sm text-neutral-400 mt-1 mb-6">今天想聊点什么？</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm px-4">
              {SUGGESTS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setDraft(s.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-left text-sm hover:border-accent/40 transition-colors"
                >
                  <span className="text-base flex-shrink-0">{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-100">
          {items.map((it) => {
            if (it.kind === 'user') {
              return (
                <MessageRow
                  key={it.key}
                  who={myName}
                  time={fmtClock(it.created)}
                  avatar={<CircleLabel label={myName.slice(0, 1).toUpperCase()} size={28} bg="#10b981" />}
                >
                  <div className="whitespace-pre-wrap">{it.content}</div>
                </MessageRow>
              );
            }
            if (it.kind === 'assistant') {
              return (
                <MessageRow
                  key={it.key}
                  who="智能体"
                  action="说"
                  time={fmtClock(it.created)}
                  avatar={<AgentAv size={28} />}
                >
                  <div className="md" dangerouslySetInnerHTML={{ __html: marked.parse(it.content) as string }} />
                </MessageRow>
              );
            }
            // tool_group —— 一轮调多个工具，共用一个智能体 header
            return (
              <MessageRow
                key={it.key}
                who="智能体"
                action={it.calls.length > 1 ? `调用 ${it.calls.length} 个工具` : '调用工具'}
                time={fmtClock(it.created)}
                avatar={<AgentAv size={28} />}
              >
                <div className="space-y-1.5">
                  {it.calls.map((c) => (
                    <ToolCard
                      key={c.toolCallId}
                      name={c.name}
                      args={c.args}
                      result={c.result}
                    />
                  ))}
                </div>
              </MessageRow>
            );
          })}

          {running && (
            <MessageRow who="智能体" action="说" avatar={<AgentAv size={28} />} muted>
              <span className="typing-dots">
                <span /><span /><span />
              </span>
            </MessageRow>
          )}
        </div>

        {errMsg && (
          <div className="mx-auto max-w-[88%] text-center text-red-600 text-sm py-2 px-3 my-2 bg-red-50 rounded-xl">
            {errMsg}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        onSend={send}
        running={running}
        value={draft}
        onChange={setDraft}
      />
    </div>
  );
}
