import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ArrowUp, CheckCircle2, Cloud, Folder, Menu, Monitor, Plus, Square, TerminalSquare, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import Topbar from '../../system/Topbar';
import { type Chat, type Msg } from '../../system/lib/api';
import { onFrame, sendWs } from '../../system/lib/ws';
import type { SystemAppProps } from '../../system/registry';
import { Button } from '../../system/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../system/ui/sheet';
import { cn } from '../../system/lib/utils';
import LogoMark from '../../system/LogoMark';

// 把 WS 返回的消息行(message/meta 为 JSON 字符串)解析成对象
const parseField = (v: any) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const hydrate = (m: any): Msg => ({ ...m, message: parseField(m.message), meta: parseField(m.meta) });

export default function ChatApp(_: SystemAppProps) {
  const [convs, setConvs] = useState<Chat[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [running, setRunning] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, force] = useState(0);
  const [showPill, setShowPill] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const atBottom = useRef(true);

  const curRef = useRef<string | null>(null);
  const pending = useRef<string>('');

  const scrollToBottom = (smooth = false) => {
    const el = sectionRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottom.current = true;
    setShowPill(false);
  };
  function onScroll() {
    const el = sectionRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setShowPill(false);
  }

  // ===== 全部走 WS =====
  const reqList = () => sendWs({ type: 'chats.list' });
  const reqOpen = (id: string | null) => { if (id) sendWs({ type: 'chat.open', chat: id }); };
  const setCurrent = (id: string | null) => { curRef.current = id; setCur(id); };

  useEffect(() => { reqList(); }, []);
  useEffect(() => onFrame((f: any) => {
    switch (f.type) {
      case 'hello':
      case 'connection.status':
        force((n) => n + 1);
        if (f.type === 'hello') { reqList(); reqOpen(curRef.current); }
        break;
      case 'chats.list.ok':
        setConvs((f.chats || []).filter((m: Chat) => !m.parent));
        // 列表自带的实时 running 标注是权威态,据此重建运行集合
        setRunningIds(new Set((f.chats || []).filter((c: Chat) => c.running).map((c: Chat) => c.id)));
        break;
      case 'chats.update':
        reqList();
        break;
      case 'chat.history':
        if (f.chat === curRef.current) setMsgs((f.messages || []).map(hydrate));
        break;
      case 'chat.new.ok': {
        const id = f.chat?.id;
        if (!id) break;
        setCurrent(id);
        reqList();
        if (pending.current) { sendWs({ type: 'send', chat: id, text: pending.current }); pending.current = ''; }
        break;
      }
      case 'agent.status':
        // 全局维护运行集合(不限当前会话),驱动列表徽标
        if (f.chat) setRunningIds((s) => { const n = new Set(s); if (f.status === 'running') n.add(f.chat); else n.delete(f.chat); return n; });
        if (f.chat === curRef.current) {
          setRunning(f.status === 'running');
          if (f.status === 'running') setErr('');
          if (f.status === 'error') setErr(f.error || '运行出错');
        }
        break;
      case 'message': {
        if (f.chat !== curRef.current) break;
        const id: string = f.id || ('srv_' + (f.created ?? Date.now()));
        const created: number = f.created ?? 0;
        const meta: any = f.meta ?? null;
        const message: any = f.message ?? { role: f.role, content: f.content };
        setMsgs((prev) => {
          if (prev.some((m) => m.id === id)) return prev;
          // 用户回声:替换可能的 tmp 乐观项
          if (f.role === 'user' && f.content) {
            const idx = prev.findIndex((m) => m.id.startsWith('tmp') && m.message?.role === 'user' && m.message?.content === f.content);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = { id, chat_id: f.chat, message, meta, created };
              return copy;
            }
          }
          return [...prev, { id, chat_id: f.chat, message, meta, created }];
        });
        break;
      }
    }
  }), []);
  useEffect(() => { if (atBottom.current) scrollToBottom(); else setShowPill(true); }, [msgs, running]);

  function selectConv(id: string) {
    atBottom.current = true;
    setCurrent(id);
    setMsgs([]);
    reqOpen(id);
    setDrawerOpen(false);
  }
  function newChat() {
    setCurrent(null);
    setMsgs([]);
    setDrawerOpen(false);
    setTimeout(() => ta.current?.focus(), 50);
  }
  function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || running) return;
    setInput('');
    setErr('');
    if (ta.current) ta.current.style.height = 'auto';
    setMsgs((m) => [...m, { id: 'tmp' + Date.now(), chat_id: curRef.current, message: { role: 'user', content: t }, meta: null, created: 0 }]);
    setRunning(true);
    atBottom.current = true; // 自己发的,跳到底
    if (!curRef.current) { pending.current = t; sendWs({ type: 'chat.new', title: t.slice(0, 24) }); }
    else sendWs({ type: 'send', chat: curRef.current, text: t });
  }
  function stop() {
    sendWs({ type: 'abort', chat: curRef.current });
    setRunning(false);
  }
  function decide(label: string) {
    if (!curRef.current) return;
    setRunning(true);
    sendWs({ type: 'decide', chat: curRef.current, chosen: label });
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function grow() {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  const title = convs.find((c) => c.id === cur)?.title || '聊天';

  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar
        title={title}
        left={<Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="打开对话"><Menu /></Button>}
      />
      <ChatDrawer
        open={drawerOpen}
        convs={convs}
        cur={cur}
        runningIds={runningIds}
        onClose={() => setDrawerOpen(false)}
        onNew={newChat}
        onPick={selectConv}
      />
      <section ref={sectionRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {msgs.length === 0 && !running && !err ? <Welcome /> : (
          <div className="mx-auto flex max-w-read flex-col gap-6 px-5 pb-36 pt-7">
            {buildItems(msgs).map((it) => <ItemRow key={it.id} item={it} onDecide={decide} />)}
            {err && (
              <div className="flex items-start gap-3">
                <LogoMark className="size-8 rounded-md text-xs" />
                <div className="min-w-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-300">
                  <b className="text-red-200">运行出错</b>
                  <div className="mt-1 break-words font-mono text-xs text-red-300/90">{err}</div>
                </div>
              </div>
            )}
            {running && (
              <div className="flex items-start gap-3">
                <LogoMark className="size-8 rounded-md text-xs" />
                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                  Meem 正在做
                  <span className="inline-flex gap-1">
                    <i className="size-1.5 animate-pulse rounded-full bg-cyan shadow-glow-sm" />
                    <i className="size-1.5 animate-pulse rounded-full bg-cyan shadow-glow-sm [animation-delay:120ms]" />
                    <i className="size-1.5 animate-pulse rounded-full bg-cyan shadow-glow-sm [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      {showPill && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-cyan/50 bg-card/90 px-3.5 py-1.5 text-xs text-cyan shadow-glow-sm backdrop-blur transition-all hover:bg-card"
        >新消息 ↓</button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pb-5 pt-10">
        <div className="mx-auto max-w-read">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card/85 px-4 py-2 shadow-card backdrop-blur transition-all focus-within:border-cyan focus-within:shadow-glow-sm">
            <textarea
              ref={ta}
              value={input}
              rows={1}
              placeholder="给 Meem 发消息，或让它替你办点事..."
              className="max-h-44 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
              onChange={(e) => { setInput(e.target.value); grow(); }}
              onKeyDown={onKey}
            />
            {running ? (
              <Button size="icon" variant="outline" onClick={stop} aria-label="停止" className="size-9 rounded-full border-cyan text-cyan hover:text-cyan">
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button size="icon" disabled={!input.trim()} onClick={() => send()} aria-label="发送" className="size-9 rounded-full">
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ChatDrawer({
  open,
  convs,
  cur,
  runningIds,
  onClose,
  onNew,
  onPick,
}: {
  open: boolean;
  convs: Chat[];
  cur: string | null;
  runningIds: Set<string>;
  onClose: () => void;
  onNew: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="left" className="flex w-[300px] flex-col bg-secondary p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9 rounded-lg text-sm" />
            <div>
              <SheetTitle>聊天</SheetTitle>
              <div className="text-xs text-muted-foreground">Meem</div>
            </div>
          </div>
        </SheetHeader>
        <div className="p-3">
          <Button variant="outline" className="w-full bg-background" onClick={onNew}><Plus />新对话</Button>
        </div>
        <div className="px-4 pb-2 text-[11px] font-bold uppercase text-muted-foreground">对话</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {convs.map((c) => {
            const isRunning = runningIds.has(c.id);
            return (
              <button
                key={c.id}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                  c.id === cur && 'bg-background font-medium text-foreground shadow-sm',
                )}
                onClick={() => onPick(c.id)}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    isRunning ? 'animate-pulse bg-cyan shadow-glow-sm' : 'bg-muted-foreground/30',
                  )}
                  title={isRunning ? '进行中' : '已结束'}
                />
                <span className="truncate">{c.title || c.preview || '新对话'}</span>
              </button>
            );
          })}
          {convs.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">还没有对话</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const MD = ({ t }: { t: string }) => (
  <div className="md">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>{t}</ReactMarkdown>
  </div>
);

interface ToolCall { id: string; name: string; args: string; result?: string }
type Item =
  | { kind: 'user'; id: string; content: string }
  | { kind: 'assistant'; id: string; content: string }
  | { kind: 'decision'; id: string; content: string; options: any[]; rationale?: string }
  | { kind: 'tools'; id: string; calls: ToolCall[] };

// 把消息流重组:assistant.tool_calls → 一组;role:'tool' 按 tool_call_id 回填 result(调用+结果合一)
function buildItems(msgs: Msg[]): Item[] {
  const items: Item[] = [];
  for (const m of msgs) {
    const msg: any = m.message || {};
    const meta: any = m.meta || {};
    if (msg.role === 'user') { items.push({ kind: 'user', id: m.id, content: msg.content ?? '' }); continue; }
    if (msg.role === 'tool') {
      const tcId = msg.tool_call_id;
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.kind !== 'tools') continue;
        const idx = it.calls.findIndex((c) => c.id === tcId && c.result === undefined);
        if (idx < 0) continue;
        it.calls = it.calls.map((c, ci) => (ci === idx ? { ...c, result: content } : c));
        break;
      }
      continue;
    }
    if (msg.role === 'assistant') {
      if (meta.kind === 'decision' && Array.isArray(meta.options)) {
        items.push({ kind: 'decision', id: m.id, content: msg.content ?? '', options: meta.options, rationale: meta.rationale });
        continue;
      }
      if (typeof msg.content === 'string' && msg.content) items.push({ kind: 'assistant', id: m.id + 'a', content: msg.content });
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        items.push({ kind: 'tools', id: m.id + 'g', calls: msg.tool_calls.map((tc: any) => ({ id: tc.id, name: tc.function?.name ?? '工具', args: tc.function?.arguments ?? '', result: undefined })) });
      }
    }
  }
  return items;
}

function ItemRow({ item, onDecide }: { item: Item; onDecide: (l: string) => void }) {
  if (item.kind === 'user') {
    return <div className="flex flex-row-reverse items-start gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">你</div>
      <div className="max-w-[calc(100%-46px)] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm text-accent-foreground">{item.content}</div>
    </div>;
  }
  if (item.kind === 'assistant') return <AssistantRow><MD t={item.content} /></AssistantRow>;
  if (item.kind === 'decision') {
    return <AssistantRow>
      {item.content ? <MD t={item.content} /> : null}
      {item.rationale ? <div className="mt-1 text-sm text-muted-foreground">{item.rationale}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.options.map((o: any, i: number) => (
          <Button key={i} variant={o.recommend ? 'default' : 'outline'} size="sm" onClick={() => onDecide(o.label)}>{o.label}</Button>
        ))}
      </div>
    </AssistantRow>;
  }
  // tools
  return <AssistantRow>
    <div className="flex flex-col gap-1.5">
      {item.calls.map((c) => <ToolCard key={c.id} call={c} />)}
    </div>
  </AssistantRow>;
}

function argsSummary(s: string, max = 48): string {
  try {
    const o = JSON.parse(s);
    for (const k of ['cmd', 'command', 'text', 'content', 'path', 'url', 'query', 'script']) {
      if (typeof o?.[k] === 'string') return o[k].replace(/\s+/g, ' ').slice(0, max);
    }
    return '';
  } catch { return ''; }
}
function pretty(s: string): string { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }

/** 截图等工具结果里的图片(dataUrl)→ 渲染成图,而不是一坨 base64 */
function detectImage(result?: string): string | null {
  if (!result) return null;
  try {
    const o = JSON.parse(result);
    if (typeof o?.dataUrl === 'string' && o.dataUrl.startsWith('data:image/')) return o.dataUrl;
  } catch { /* */ }
  return null;
}

function ToolCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const running = call.result === undefined;
  const summary = argsSummary(call.args);
  const image = detectImage(call.result);
  return (
    <div className="max-w-xl overflow-hidden rounded-lg border border-cyan/30 bg-cyan/[0.05]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cyan/[0.08]">
        <span className={cn('shrink-0 text-[10px] text-muted-foreground transition-transform', open && 'rotate-90')}>▶</span>
        <Wrench className="size-3.5 shrink-0 text-cyan" />
        <span className="shrink-0 font-mono text-xs font-semibold text-cyan">{toolName(call.name)}</span>
        {!open && summary && <span className="ml-1 flex-1 truncate text-[11.5px] text-muted-foreground">· {summary}</span>}
        {(open || !summary) && <span className="flex-1" />}
        {running
          ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-amber"><span className="size-1.5 animate-pulse rounded-full bg-amber" />运行中</span>
          : <span className="shrink-0 text-[10px] text-lime">完成</span>}
      </button>
      {open && (
        <div className="border-t border-cyan/20 text-[11.5px]">
          {call.args && call.args !== '{}' && (
            <>
              <div className="px-3 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">参数</div>
              <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words px-3 pb-2 font-mono text-[#cfe6ff]">{pretty(call.args)}</pre>
            </>
          )}
          {call.result !== undefined && (
            <div className="border-t border-cyan/20">
              <div className="flex items-center justify-between px-3 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>结果{image ? ' · 截图' : ''}</span>
                {image && <a href={image} target="_blank" rel="noreferrer" className="text-cyan">放大 ↗</a>}
              </div>
              {image
                ? <a href={image} target="_blank" rel="noreferrer" className="block px-3 pb-2"><img src={image} alt="截图" className="max-h-72 w-auto rounded-md border border-cyan/20" loading="lazy" /></a>
                : <pre className="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-words px-3 pb-2 font-mono text-muted-foreground">{pretty(call.result).slice(0, 4000)}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <LogoMark className="size-8 rounded-md text-xs" />
      <div className="min-w-0 max-w-[calc(100%-46px)]">{children}</div>
    </div>
  );
}

function toolName(n = '') {
  if (n.startsWith('computer_')) return '用电脑 · ' + n.replace('computer_', '');
  if (n.startsWith('browser_')) return '用浏览器 · ' + n.replace('browser_', '');
  return n;
}

function Welcome() {
  const caps = [
    { t: '电脑 / 终端', d: '跑命令、装依赖、部署', icon: <TerminalSquare /> },
    { t: '文件', d: '浏览、读取、整理本机文件', icon: <Folder /> },
    { t: '浏览器', d: '上网查、比价、填表', icon: <Cloud /> },
    { t: '截图 / 状态', d: '看屏幕、看系统负载', icon: <Monitor /> },
  ];
  return (
    <div className="mx-auto max-w-3xl px-5 pt-[9vh] text-center">
      <div className="text-4xl font-black tracking-normal text-foreground">Meem</div>
      <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">用本地电脑、浏览器和 Cloudflare，把网站、内部应用和自动化工作流搭起来。</div>
      <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
        {caps.map((c) => (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm" key={c.t}>
            <div className="grid size-8 place-items-center rounded-md bg-accent text-accent-foreground [&_svg]:size-4">{c.icon}</div>
            <div className="mt-3 text-sm font-bold">{c.t}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{c.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
