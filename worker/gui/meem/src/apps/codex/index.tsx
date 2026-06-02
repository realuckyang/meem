import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Brain, FileEdit, Menu, Plus, Send, Square, Terminal, TriangleAlert } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { useSelectedDevice, DeviceSelect, DeviceGuide } from '../../system/useDevices';
import { onFrame, sendWs } from '../../system/lib/ws';
import { makeReqId } from '../../system/lib/fmt';
import { api } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../system/ui/sheet';
import { cn } from '../../system/lib/utils';

interface Thread { id: string; cwd?: string; title?: string; preview?: string; updated_at?: number }
interface EvItem { id: string; kind: string; text?: string; meta?: any; done?: boolean }

export default function CodexApp(_: SystemAppProps) {
  const [device, setDevice, devices] = useSelectedDevice('computer');
  const online = !!devices.find((d) => d.id === device)?.online;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [items, setItems] = useState<EvItem[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [err, setErr] = useState('');

  const pending = useRef<Map<string, (d: any) => void>>(new Map());
  const turnReq = useRef('');
  const scroller = useRef<HTMLDivElement>(null);

  function call(type: string, data: any = {}): Promise<any> {
    const reqId = makeReqId('cx');
    return new Promise((resolve) => {
      pending.current.set(reqId, resolve);
      sendWs({ type, to: 'client', device, data: { reqId, ...data } });
      setTimeout(() => { if (pending.current.delete(reqId)) resolve(null); }, 130_000);
    });
  }

  // 把一条事件 upsert 进列表(按 item id;partial 更新文本,final 标记 done)
  function applyEvent(phase: string, it: EvItem) {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === it.id);
      const next = { ...it, done: phase === 'final' };
      if (i >= 0) { const copy = prev.slice(); copy[i] = { ...copy[i], ...next }; return copy; }
      return [...prev, next];
    });
  }

  useEffect(() => {
    const off = onFrame((m: any) => {
      const ty: string = m?.type || '';
      if (!ty.startsWith('codex.')) return;
      const d = m.data || {};
      if (d.reqId && d.reqId === turnReq.current) {
        if (ty === 'codex.event' && d.item) { applyEvent(d.phase, d.item); return; }
        if (ty === 'codex.turn.ok') { setRunning(false); if (!cur && d.threadId) setCur(d.threadId); loadThreads(); return; }
        if (ty === 'codex.turn.err') { setRunning(false); setErr(d.error || 'Codex 出错'); return; }
      }
      const cb = d.reqId && pending.current.get(d.reqId);
      if (cb) { pending.current.delete(d.reqId); cb(d); }
    });
    return off;
  }, [cur]);

  useEffect(() => { setThreads([]); setCur(null); setItems([]); if (online) loadThreads(); }, [online, device]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [items]);

  async function loadThreads() {
    const d = await call('codex.threads');
    if (d?.threads) setThreads(d.threads);
  }
  async function newThread() {
    setErr('');
    const d = await call('codex.new');
    setDrawer(false);
    if (d?.thread?.id) { setCur(d.thread.id); setItems([]); loadThreads(); }
  }
  async function openThread(id: string) {
    setErr(''); setDrawer(false); setCur(id); setItems([]);
    const d = await api.codexEvents(id).catch(() => ({ events: [] }));
    setItems((d.events || []).map((e) => ({ id: e.id, kind: e.kind, text: e.text, meta: e.meta, done: true })));
  }
  function send() {
    const text = input.trim();
    if (!text || running || !online) return;
    setErr(''); setInput('');
    const reqId = makeReqId('turn'); turnReq.current = reqId;
    setRunning(true);
    sendWs({ type: 'codex.turn', to: 'client', device, data: { reqId, threadId: cur, prompt: text } });
  }
  function stop() { turnReq.current = ''; setRunning(false); sendWs({ type: 'codex.stop', to: 'client', device, data: { reqId: makeReqId('cx') } }); }

  if (!online) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="Codex" left={devices.length ? <DeviceSelect value={device} onChange={setDevice} devices={devices} /> : undefined} />
        <DeviceGuide devices={devices} selected={device} kind="computer" />
      </main>
    );
  }

  const curThread = threads.find((t) => t.id === cur);
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar
        title={curThread ? threadLabel(curThread) : 'Codex'}
        left={<div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => setDrawer(true)} aria-label="会话"><Menu /></Button><DeviceSelect value={device} onChange={setDevice} devices={devices} /></div>}
      />

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="flex w-[300px] flex-col bg-secondary p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="flex items-center gap-2"><Terminal className="size-4 text-cyan" />Codex 会话</SheetTitle>
          </SheetHeader>
          <div className="p-3"><Button variant="outline" className="w-full bg-background" onClick={newThread}><Plus />新会话</Button></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {threads.map((t) => (
              <button key={t.id} onClick={() => openThread(t.id)}
                className={cn('block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-background',
                  t.id === cur ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground')}>
                <span className="block truncate">{threadLabel(t)}</span>
                {t.cwd && <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground/70">{t.cwd}</span>}
              </button>
            ))}
            {threads.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">暂无会话</div>}
          </div>
        </SheetContent>
      </Sheet>

      <section ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <Terminal className="mx-auto size-8 text-cyan" />
              <div className="mt-3 text-lg font-bold text-foreground">Codex</div>
              <div className="mt-1 text-sm text-muted-foreground">在本机 codex 上跑一段对话 · 左上角切换会话</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pb-36 pt-6 md:px-8">
            {items.map((it) => <EventRow key={it.id} it={it} />)}
            {running && <div className="flex gap-1 pl-1"><Dot /><Dot d={120} /><Dot d={240} /></div>}
            {err && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</div>}
          </div>
        )}
      </section>

      <div className="border-t border-border bg-card/70 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="给 Codex 发消息(Enter 发送,Shift+Enter 换行)"
            className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm"
          />
          {running
            ? <Button variant="outline" size="icon" className="size-10 shrink-0" onClick={stop} aria-label="停止"><Square className="fill-current" /></Button>
            : <Button size="icon" className="size-10 shrink-0" onClick={send} disabled={!input.trim()} aria-label="发送"><Send /></Button>}
        </div>
      </div>
    </main>
  );
}

function EventRow({ it }: { it: EvItem }) {
  const k = it.kind;
  if (k === 'user_message') {
    return <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm text-accent-foreground">{it.text}</div></div>;
  }
  if (k === 'agent_message') {
    return (
      <div className="min-w-0">
        {it.text
          ? <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>{it.text}</ReactMarkdown></div>
          : <span className="inline-flex gap-1 pt-1"><Dot /><Dot d={120} /><Dot d={240} /></span>}
      </div>
    );
  }
  if (k === 'reasoning') {
    if (!it.text?.trim()) return null;   // codex 多数不暴露推理文本,空的就不渲染
    return <div className="flex items-start gap-2 text-xs italic leading-5 text-muted-foreground"><Brain className="mt-0.5 size-3.5 shrink-0" /><span className="whitespace-pre-wrap">{it.text}</span></div>;
  }
  if (k === 'command_exec' || k === 'agent_command_exec' || k === 'shell' || k === 'agent_shell') {
    const cmd = it.meta?.command ?? it.text ?? '';
    const stdout = it.meta?.stdout || it.meta?.stderr || '';
    const exit = it.meta?.exit_code;
    return (
      <div className="rounded-lg border border-border bg-card/50">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          <Terminal className="size-3.5 text-cyan" /><span>命令</span>
          {exit !== undefined && <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px]', exit === 0 ? 'bg-lime/15 text-lime' : 'bg-red-400/15 text-red-400')}>exit {exit}</span>}
        </div>
        <pre className="overflow-x-auto px-3 py-2 font-mono text-[11.5px] leading-5 text-foreground">{Array.isArray(cmd) ? cmd.join(' ') : cmd}</pre>
        {stdout && <pre className="max-h-48 overflow-auto border-t border-border/60 bg-background/60 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">{String(stdout).slice(0, 2000)}</pre>}
      </div>
    );
  }
  if (k === 'file_change' || k === 'agent_file_change') {
    return <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs text-foreground"><FileEdit className="size-3.5 text-amber" /><span className="truncate font-mono">{it.meta?.path || it.text || '文件改动'}</span></div>;
  }
  if (k === 'agent_plan' || k === 'plan') {
    const steps = it.meta?.plan?.steps || it.meta?.steps || [];
    return (
      <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">计划</div>
        <ol className="list-decimal space-y-0.5 pl-5 text-xs">
          {steps.map((s: any, i: number) => <li key={i} className={cn(s.status === 'completed' && 'text-muted-foreground line-through')}>{s.title || s.description || s.step || '(步骤)'}</li>)}
        </ol>
      </div>
    );
  }
  if (k === 'agent_error' || k === 'error') {
    return <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /><span>{it.text || it.meta?.message || '出错'}</span></div>;
  }
  // 其他(tool_call 等)默认折行文本
  return it.text ? <div className="text-xs text-muted-foreground"><span className="font-mono text-[10px] text-cyan">{k}</span> · {it.text}</div> : null;
}

function Dot({ d = 0 }: { d?: number }) {
  return <i className="size-1.5 animate-pulse rounded-full bg-cyan" style={{ animationDelay: `${d}ms` }} />;
}

function threadLabel(t: Thread) {
  return t.title?.trim() || t.preview?.trim() || (t.cwd ? t.cwd.split('/').pop() || t.cwd : '') || ('会话 ' + t.id.slice(0, 6));
}
