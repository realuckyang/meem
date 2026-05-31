import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ArrowUp, CheckCircle2, Cloud, Folder, Menu, Monitor, Plus, TerminalSquare, Wrench } from 'lucide-react';
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
  const [err, setErr] = useState('');
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, force] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const curRef = useRef<string | null>(null);
  const pending = useRef<string>('');

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
        if (f.chat === curRef.current) {
          setRunning(f.status === 'running');
          if (f.status === 'running') setErr('');
          if (f.status === 'error') setErr(f.error || '运行出错');
        }
        break;
      case 'message':
        if (f.chat === curRef.current) reqOpen(curRef.current);
        break;
    }
  }), []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, running]);

  function selectConv(id: string) {
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
    if (!curRef.current) { pending.current = t; sendWs({ type: 'chat.new', title: t.slice(0, 24) }); }
    else sendWs({ type: 'send', chat: curRef.current, text: t });
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
        onClose={() => setDrawerOpen(false)}
        onNew={newChat}
        onPick={selectConv}
      />
      <section className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
        {msgs.length === 0 && !running && !err ? <Welcome onPick={send} /> : (
          <div className="mx-auto flex max-w-read flex-col gap-6 px-5 pb-36 pt-7">
            {msgs.map((m) => <Message key={m.id} m={m} onDecide={decide} />)}
            {err && (
              <div className="flex items-start gap-3">
                <LogoMark className="size-8 rounded-md text-xs" />
                <div className="min-w-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm leading-6 text-red-300">
                  <b className="text-red-200">运行出错</b>
                  <div className="mt-1 break-words font-mono text-xs text-red-300/90">{err}</div>
                  <div className="mt-1.5 text-xs text-muted-foreground">多半是 LLM 未配置(LLM_KEY / LLM_MODEL)。</div>
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
            <div ref={end} />
          </div>
        )}
      </section>
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
            <Button size="icon" disabled={!input.trim() || running} onClick={() => send()} aria-label="发送" className="size-9 rounded-full">
              <ArrowUp />
            </Button>
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
  onClose,
  onNew,
  onPick,
}: {
  open: boolean;
  convs: Chat[];
  cur: string | null;
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
          {convs.map((c) => (
            <button
              key={c.id}
              className={cn(
                'block w-full truncate rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground',
                c.id === cur && 'bg-background font-medium text-foreground shadow-sm',
              )}
              onClick={() => onPick(c.id)}
            >
              {c.title || c.preview || '新对话'}
            </button>
          ))}
          {convs.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">还没有对话</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Message({ m, onDecide }: { m: Msg; onDecide: (l: string) => void }) {
  const msg = m.message || {};
  const meta = m.meta || {};
  const content: string = msg.content ?? '';
  const MD = ({ t }: { t: string }) => (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>{t}</ReactMarkdown>
    </div>
  );

  if (meta.kind === 'decision' && Array.isArray(meta.options)) {
    return <AssistantRow>
      <MD t={content} />
      {meta.rationale ? <div className="mt-1 text-sm text-muted-foreground">{meta.rationale}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {meta.options.map((o: any, i: number) => (
          <Button key={i} variant={o.recommend ? 'default' : 'outline'} size="sm" onClick={() => onDecide(o.label)}>{o.label}</Button>
        ))}
      </div>
    </AssistantRow>;
  }
  if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
    return <AssistantRow>
      {content ? <MD t={content} /> : null}
      {msg.tool_calls.map((tc: any) => (
        <div className="mt-2 max-w-xl rounded-lg border border-cyan/30 bg-cyan/[0.06] p-3" key={tc.id}>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan"><Wrench className="size-3.5" />{toolName(tc.function?.name)}</div>
          {tc.function?.arguments && tc.function.arguments !== '{}' ? <div className="mt-2 max-h-40 overflow-auto rounded-md border border-cyan/20 bg-[#06090f] p-2 font-mono text-xs text-[#cfe6ff]">{tc.function.arguments}</div> : null}
        </div>
      ))}
    </AssistantRow>;
  }
  if (msg.role === 'tool') {
    return <AssistantRow>
      <div className="max-w-xl rounded-lg border border-border bg-muted p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><CheckCircle2 className="size-3.5" />完成</div>
        <div className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">{content.slice(0, 1500)}</div>
      </div>
    </AssistantRow>;
  }
  if (msg.role === 'user') {
    return <div className="flex flex-row-reverse items-start gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">你</div>
      <div className="max-w-[calc(100%-46px)] rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-sm text-accent-foreground">{content}</div>
    </div>;
  }
  return <AssistantRow><MD t={content} /></AssistantRow>;
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

function Welcome({ onPick }: { onPick: (t: string) => void }) {
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
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {['帮我看看磁盘占用，清理一下', '把这个项目 build 然后部署', '查一下当前目录有哪些大文件', '截个屏看看现在屏幕上是什么'].map((s) => (
          <Button variant="outline" size="sm" key={s} onClick={() => onPick(s)}>{s}</Button>
        ))}
      </div>
    </div>
  );
}
