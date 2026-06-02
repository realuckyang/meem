import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import type { Auth, Msg } from '../lib/types';
import { pageX } from '../lib/ui';

const SAMPLES = ['他最近在做什么?', '有哪些项目?', '我想找他合作'];

/** 欢迎前门:AI 助手对话 */
export default function Concierge({ auth, onNeedLogin }: { auth: Auth | null; onNeedLogin: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, sending]);

  // 登录后:拉取该访客的持久对话;退出后:清空
  useEffect(() => {
    if (!auth) { setMsgs([]); return; }
    fetch('/site/api/visitor/conversation', { headers: { Authorization: `Bearer ${auth.token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.messages) setMsgs(d.messages.map((m: any) => ({ role: m.role, content: m.content }))); })
      .catch(() => {});
  }, [auth?.token]);

  async function send(text?: string) {
    const t = (text ?? input).trim();
    if (!t || sending) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: t }]);
    setSending(true);
    try {
      const r = await fetch('/site/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
        body: JSON.stringify({ message: t, history: msgs.slice(-8) }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply || '暂无回应' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '网络连接失败,请稍后重试,或在下方留言。' }]);
    } finally { setSending(false); }
  }

  return (
    <section id="welcome" className={`${pageX} grid min-h-[calc(100vh-69px)] grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.82fr)] lg:gap-16`}>
      <div className="max-w-[760px]">
        <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-cyan"><Sparkles className="size-4" />会回话的个人主页</p>
        <h1 className="text-[42px] font-bold leading-[.98] tracking-tight sm:text-[64px] lg:text-[84px]">别只是浏览,直接问我的网站。</h1>
        <p className="mt-6 max-w-[620px] text-lg leading-8 text-muted-foreground">右边这个 AI 助手懂我发布的全部动态、文章和项目——问它任何事,或者直接留言,我会接住。</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:border-cyan hover:text-cyan">{s}</button>
          ))}
        </div>
      </div>

      <aside className="flex h-[460px] flex-col overflow-hidden rounded-2xl border border-cyan/40 bg-card/80 shadow-glow-sm backdrop-blur-sm" aria-label="AI 助手">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm">
          <span className="size-2 rounded-full bg-lime shadow-[0_0_8px_hsl(var(--lime))]" />
          <b className="font-semibold">AI 助手</b>
          {auth
            ? <span className="ml-auto truncate text-xs text-muted-foreground">{auth.profile.name} · 对话已保存</span>
            : <button onClick={onNeedLogin} className="ml-auto text-xs text-cyan hover:brightness-110">登录保存对话</button>}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="text-sm leading-7 text-muted-foreground">你好 👋 我是这个站的 AI 助手。可以问我「最近在做什么 / 有哪些项目 / 怎么联系」。</div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={m.role === 'user'
                ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan/15 px-3.5 py-2 text-sm text-foreground'
                : 'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border bg-secondary px-3.5 py-2 text-sm leading-6 text-foreground'}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">正在想…</div>}
          <div ref={end} />
        </div>
        <div className="border-t border-border p-2.5">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-secondary px-3 py-1.5 transition-all focus-within:border-cyan focus-within:shadow-glow-sm">
            <textarea
              value={input} rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="问点什么…" className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground" />
            <button onClick={() => send()} disabled={!input.trim() || sending} aria-label="发送"
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan text-cyan-foreground shadow-glow-sm transition-all hover:brightness-110 disabled:opacity-40">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}
