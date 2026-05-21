// 「跟分身私聊」——挂在对方消息下方的悄悄话。
//
// 视觉：缩进到对方消息正文列、左侧竖线、整体淡化，强化「附属于那条消息」的感觉。
// 内容：自定义紧凑行布局（不复用 MessageRow，以控制更小的留白）。

import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { req, type Session as SessionType } from '../lib/api';
import { onFrame, sendFrame, isOpen } from '../lib/socket';
import { applyEvent, type ChatItem, type EventRow } from '../lib/parseEvents';
import ToolCard from './ToolCard';

interface Props {
  messageId: string;
  initialSession: SessionType | null;
  onAdopt: (text: string) => void;
}

// 与父级 MessageRow 的正文列对齐：父级 grid-cols-[28px_1fr] gap-2.5 px-4
// → 头像区 28 + gap 10 + 左 padding 16 = 54px。这里用 ml-[54px] 让左侧竖线与正文起点对齐。
const BLOCK_INDENT = 'ml-[54px] mr-4';
const BAR = 'pl-3 border-l-2 border-purple-200/70';

function fmtClock(ts: number) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageAgentBlock({ messageId, initialSession, onAdopt }: Props) {
  const [expanded, setExpanded] = useState(!!initialSession);
  const [session, setSession] = useState<SessionType | null>(initialSession);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const sid = session?.id;
  const composing = useRef(false);

  useEffect(() => {
    if (!sid) { setItems([]); return; }
    req<EventRow[]>(`/api/sessions/${sid}/events`).then((rows) => {
      let next: ChatItem[] = [];
      for (const r of rows) next = applyEvent(next, r);
      setItems(next);
    }).catch(() => {});
  }, [sid]);

  useEffect(() => {
    if (!sid) return;
    return onFrame((f: any) => {
      if (!f || typeof f !== 'object') return;
      if (f.type === 'event' && f.event?.sid === sid) {
        const row: EventRow = {
          id: f.event.id, sid: f.event.sid, message: f.event.message, meta: null,
          created: f.event.created ?? Math.floor(Date.now() / 1000),
        };
        setItems((prev) => applyEvent(prev, row));
      } else if (f.type === 'session.thinking' && f.sid === sid) { setRunning(true); setErr(''); }
      else if (f.type === 'session.done' && f.sid === sid)       { setRunning(false); }
      else if (f.type === 'session.error' && f.sid === sid)      { setRunning(false); setErr(f.message ?? '处理失败'); }
    });
  }, [sid]);

  async function summon() {
    setExpanded(true);
    if (session || creating) return;
    setCreating(true);
    try {
      const s = await req<SessionType>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ kind: 'agent', trigger: messageId, title: '私聊分身' }),
      });
      setSession(s);
    } catch (e: any) {
      setErr(e?.message ?? '创建失败');
    } finally {
      setCreating(false);
    }
  }

  function doSend() {
    const t = draft.trim();
    if (!t || !sid || running) return;
    setErr('');
    if (!isOpen()) { setErr('连接未就绪'); return; }
    if (sendFrame({ type: 'session.send', sid, text: t })) setDraft('');
    else setErr('发送失败');
  }

  const lastAssistant = [...items].reverse().find((it) => it.kind === 'assistant');

  // ── 折叠态：只是个虚线按钮 ──
  if (!expanded) {
    return (
      <div className={`${BLOCK_INDENT} ${BAR} py-1.5`}>
        <button
          onClick={summon}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-purple-500/80 hover:text-purple-700 transition-colors"
        >
          <span>🤫</span>
          <span>跟分身悄悄商量</span>
        </button>
      </div>
    );
  }

  // ── 展开态 ──
  return (
    <div className={`${BLOCK_INDENT} ${BAR} my-1 pb-2 space-y-2 bg-purple-50/30`}>
      <div className="flex items-center gap-1.5 pt-1.5 text-[10.5px] text-purple-600">
        <span>🤫</span>
        <span className="flex-1">悄悄商量 · 对方看不到</span>
        <button onClick={() => setExpanded(false)} className="text-purple-400 hover:text-purple-700 px-1">收起</button>
      </div>

      {creating && (
        <div className="text-[12px] text-neutral-400 py-1">召唤中…</div>
      )}

      {items.map((it) => {
        if (it.kind === 'user') {
          return (
            <Row
              key={it.key}
              avatar={<span className="w-4 h-4 rounded-full bg-neutral-700 text-white text-[9px] grid place-items-center font-semibold flex-shrink-0">我</span>}
              who="你"
              time={fmtClock(it.created)}
              tone="user"
            >
              <div className="whitespace-pre-wrap">{it.content}</div>
            </Row>
          );
        }
        if (it.kind === 'assistant') {
          return (
            <Row
              key={it.key}
              avatar={<span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[9px] grid place-items-center flex-shrink-0">🤖</span>}
              who="分身"
              time={fmtClock(it.created)}
              tone="ai"
            >
              <div className="md md-mini" dangerouslySetInnerHTML={{ __html: marked.parse(it.content) as string }} />
            </Row>
          );
        }
        // tool_group —— 同一轮多个工具共享分身 header
        return (
          <Row
            key={it.key}
            avatar={<span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[9px] grid place-items-center flex-shrink-0">🤖</span>}
            who="分身"
            action={it.calls.length > 1 ? `调用 ${it.calls.length} 个工具` : '调用工具'}
            time={fmtClock(it.created)}
            tone="ai"
          >
            <div className="space-y-1">
              {it.calls.map((c) => (
                <ToolCard key={c.toolCallId} name={c.name} args={c.args} result={c.result} size="mini" />
              ))}
            </div>
          </Row>
        );
      })}

      {running && (
        <Row
          avatar={<span className="w-4 h-4 rounded-full bg-neutral-900 text-white text-[9px] grid place-items-center flex-shrink-0">🤖</span>}
          who="分身"
          tone="ai"
        >
          <span className="typing-dots"><span /><span /><span /></span>
        </Row>
      )}

      {err && <div className="text-[12px] text-red-500 pl-5">{err}</div>}

      {lastAssistant && lastAssistant.kind === 'assistant' && !running && (
        <div className="pl-5">
          <button
            onClick={() => onAdopt(lastAssistant.content)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-purple-600 hover:text-purple-900 border border-dashed border-purple-300 hover:border-purple-500 rounded transition-colors"
          >
            采用为回复 ↑
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !composing.current && !e.nativeEvent.isComposing) {
              e.preventDefault(); doSend();
            }
          }}
          disabled={!sid || running}
          placeholder={running ? '思考中…' : '问问分身…'}
          className="flex-1 resize-none px-2 py-1 text-[12px] leading-snug bg-white border border-neutral-200 rounded focus:border-purple-400 transition-colors disabled:opacity-50 max-h-20"
        />
        <button
          onClick={doSend}
          disabled={!sid || running || !draft.trim()}
          className={`w-6 h-6 rounded text-[11px] flex-shrink-0 transition-colors ${
            draft.trim() && !running ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-neutral-100 text-neutral-400'
          }`}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function Row({
  avatar, who, action, time, tone, children,
}: {
  avatar: React.ReactNode;
  who: string;
  action?: string;
  time?: string;
  tone: 'user' | 'ai';
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="pt-0.5">{avatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 text-[10.5px]">
          <span className={`font-semibold ${tone === 'user' ? 'text-neutral-700' : 'text-purple-700'}`}>{who}</span>
          {action && <span className="text-neutral-400 font-normal truncate">{action}</span>}
          {time && <span className="ml-auto text-neutral-400 tabular-nums">{time}</span>}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-700 break-words">
          {children}
        </div>
      </div>
    </div>
  );
}
