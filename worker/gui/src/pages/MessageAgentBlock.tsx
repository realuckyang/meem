import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMeem, req, type Session, type AgentEvent } from '../api';
import OpenAIIcon from '../components/OpenAIIcon';
import { fmtClock } from '../lib/time';
import { pushToast } from '../components/Toast';
import styles from './MessageAgentBlock.module.css';

export default function MessageAgentBlock({
  session,
  onStart,
}: {
  session?: Session;
  onStart: () => Promise<void>;
}) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [liveText, setLiveText] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setLiveText('');
      return;
    }

    req<{ session: Session; events: AgentEvent[] }>(`/api/sessions/${session.id}`)
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

  async function send(text: string) {
    if (!session || !text.trim()) return;
    try {
      await req<{ event_id: string }>(`/api/sessions/${session.id}/turn`, {
        method: 'POST',
        body: JSON.stringify({ text: text.trim() }),
      });
    } catch {}
  }

  function adopt(text: string) {
    emitMeem('meem:adopt-as-reply', { text });
    pushToast('已放入回复框', 'success');
  }

  if (!session) {
    return (
      <div className={styles.internalBlock}>
        <button
          onClick={start}
          disabled={starting}
          className={styles.agentTrigger}
        >
          <span className={styles.agentTriggerPlus}>+</span>
          <span>{starting ? 'Codex 处理中…' : '跟 Codex 讨论这条'}</span>
        </button>
      </div>
    );
  }

  const live = !['done', 'cancelled', 'errored'].includes(session.status);
  const text = liveText || latestAgentMessage?.payload?.text || '';

  return (
    <div className={styles.internalBlock}>
      {events.map((event) => (
        <InlineEvent key={event.id} event={event} />
      ))}
      {liveText ? (
        <AgentMessage text={liveText} time={fmtClock(session.updated_at)} streaming />
      ) : live && !events.some((event) => event.kind === 'agent_message') ? (
        <RowShell avatar={<AgentAv />}>
          <Headline who="Codex" action="说" time={fmtClock(session.updated_at)} />
          <Body muted>
            <span className={styles.typingDots}>
              <span />
              <span />
              <span />
            </span>
          </Body>
        </RowShell>
      ) : null}
      {text && !live && (
        <div className={styles.inlineAction}>
          <button className={styles.agentTrigger} onClick={() => adopt(text)}>
            采用为回复
          </button>
        </div>
      )}
      <AgentComposer onSend={send} disabled={live} />
    </div>
  );
}

function InlineEvent({ event }: { event: AgentEvent }) {
  const payload = event.payload || {};
  const text = payload.text || payload.message || '';
  const time = fmtClock(event.created_at);
  if (event.kind === 'user_message') {
    if (!text) return null;
    return <MeToAgent text={text} time={time} />;
  }
  if (event.kind === 'agent_message') {
    if (!text) return null;
    return <AgentMessage text={text} time={time} />;
  }
  return <AuxEvent event={event} time={time} />;
}

function RowShell({
  avatar,
  children,
}: {
  avatar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.avCol}>{avatar}</div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

function Headline({
  who,
  action,
  time,
}: {
  who: string;
  action: string;
  time: string;
}) {
  return (
    <div className={styles.headline}>
      <span>
        <b className={styles.who}>{who}</b>
        <span className={styles.action}> {action}</span>
      </span>
      <span className={styles.time}>{time}</span>
    </div>
  );
}

function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <div className={`${styles.body} ${muted ? styles.bodyMuted : ''}`}>{children}</div>;
}

function AgentAv() {
  return (
    <div className={`${styles.circleAv} ${styles.circleAgent}`}>
      <OpenAIIcon size={11} />
    </div>
  );
}

function MeAv() {
  return (
    <div className={styles.circleAv} style={{ background: 'var(--text)' }}>
      我
    </div>
  );
}

function MeToAgent({ text, time }: { text: string; time: string }) {
  return (
    <RowShell avatar={<MeAv />}>
      <Headline who="你" action="对 Codex 说" time={time} />
      <Body>{text}</Body>
    </RowShell>
  );
}

function AgentMessage({
  text,
  time,
  streaming,
}: {
  text: string;
  time: string;
  streaming?: boolean;
}) {
  return (
    <RowShell avatar={<AgentAv />}>
      <Headline who="Codex" action="说" time={time} />
      <Body>
        {text}
        {streaming && <span className={styles.streamCursor}>▍</span>}
      </Body>
    </RowShell>
  );
}

function AuxEvent({ event, time }: { event: AgentEvent; time: string }) {
  const payload = event.payload || {};
  const meta = kindMeta(event.kind);
  return (
    <RowShell avatar={<AuxAv icon={meta.icon} />}>
      <Headline who="Codex" action={meta.label} time={time} />
      <Body muted>{renderAuxBody(event.kind, payload)}</Body>
    </RowShell>
  );
}

function AuxAv({ icon }: { icon: string }) {
  return (
    <div className={`${styles.circleAv} ${styles.circleAux}`}>
      {icon}
    </div>
  );
}

function renderAuxBody(kind: string, payload: any) {
  if (kind === 'agent_command_exec' || kind === 'agent_shell') {
    const command = payload?.meta?.command || payload?.text || '';
    const stdout = payload?.meta?.stdout || '';
    const stderr = payload?.meta?.stderr || '';
    const exit = payload?.meta?.exit_code;
    return (
      <>
        {command ? <code className={styles.inlineCode}>{Array.isArray(command) ? command.join(' ') : command}</code> : null}
        {(stdout || stderr || exit !== undefined) ? (
          <pre className={styles.auxPre}>
{exit !== undefined ? `[exit ${exit}]\n` : ''}{String(stdout || stderr).slice(0, 1200)}{String(stdout || stderr).length > 1200 ? '\n...(截断)' : ''}
          </pre>
        ) : null}
      </>
    );
  }
  if (kind === 'agent_tool_call') {
    const name = payload?.meta?.name || payload?.meta?.tool || payload?.text || '工具调用';
    const args = payload?.meta?.arguments;
    return (
      <>
        <span>{String(name)}</span>
        {args ? <code className={styles.inlineCode}>{typeof args === 'string' ? args : JSON.stringify(args)}</code> : null}
      </>
    );
  }
  if (kind === 'agent_plan') {
    const steps = Array.isArray(payload?.plan?.steps) ? payload.plan.steps : [];
    if (!steps.length) return payload?.text || '更新了计划';
    return (
      <ol className={styles.planList}>
        {steps.map((step: any, index: number) => (
          <li key={index} className={step.status === 'completed' ? styles.planDone : ''}>
            {step.title || step.description || step.step || '(no title)'}
          </li>
        ))}
      </ol>
    );
  }
  if (kind === 'agent_file_change') {
    return payload?.meta?.path || payload?.text || '改了文件';
  }
  if (kind === 'agent_error') {
    return payload?.message || payload?.text || '运行出错';
  }
  return payload?.text || payload?.message || '';
}

function kindMeta(kind: string): { label: string; icon: string } {
  switch (kind) {
    case 'agent_command_exec': return { label: '执行 shell 命令', icon: '⌘' };
    case 'agent_shell': return { label: '执行 shell 命令', icon: '⌘' };
    case 'agent_tool_call': return { label: '调用工具', icon: '◆' };
    case 'agent_file_change': return { label: '改了文件', icon: '✎' };
    case 'agent_plan': return { label: '制定了计划', icon: '☰' };
    case 'agent_reasoning': return { label: '思考', icon: '·' };
    case 'agent_error': return { label: '出错', icon: '!' };
    default: return { label: kind, icon: '•' };
  }
}

function AgentComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useAutoGrow<HTMLTextAreaElement>(text);
  const composingRef = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [inputRef, open]);

  async function commit() {
    const t = text.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(t);
      setText('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        className={styles.agentTrigger}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <span className={styles.agentTriggerPlus}>+</span>
        <span>{disabled ? 'Codex 处理中…' : '跟 Codex 讨论这条'}</span>
      </button>
    );
  }

  return (
    <div className={styles.agentInline}>
      <textarea
        ref={inputRef}
        className={styles.agentInlineInput}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="对 Codex 说"
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onBlur={() => {
          if (!text.trim() && !busy) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !text.trim()) {
            setOpen(false);
            return;
          }
          if (e.key !== 'Enter' || e.shiftKey) return;
          if (composingRef.current || (e.nativeEvent as KeyboardEvent).isComposing) return;
          e.preventDefault();
          commit();
        }}
      />
      <button
        className={`${styles.agentInlineSend} ${text.trim() ? styles.active : ''}`}
        onClick={commit}
        disabled={busy || !text.trim() || disabled}
      >
        ⇧
      </button>
    </div>
  );
}

function useAutoGrow<T extends HTMLTextAreaElement>(value: string) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 100);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 100 ? 'auto' : 'hidden';
  }, [value]);
  return ref;
}
