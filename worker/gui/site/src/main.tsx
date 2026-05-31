import { createRoot } from 'react-dom/client';
import { ArrowUpRight, CheckCircle2, ExternalLink, LogOut, Mail, Moon, Send, Sparkles, Sun, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './styles.css';

/* ── 主题 ── */
type Theme = 'dark' | 'light';
const THEME_KEY = 'meem_theme';
const applyTheme = (t: Theme) => { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch { /* */ } };
const getTheme = (): Theme => (localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
applyTheme(getTheme());

interface Item { id: string; kind: 'dynamic' | 'article' | 'project' | 'about'; title: string; body: string; url: string; tags: string; created: number; }
type Msg = { role: 'user' | 'assistant'; content: string };

const pageX = 'px-5 sm:px-8 lg:px-[72px]';
const fmtDate = (s: number) => { try { return new Date(s * 1000).toLocaleDateString('zh-CN'); } catch { return ''; } };

/* ── 访客账号 ── */
interface Profile { id: string; email: string; name: string }
interface Auth { token: string; profile: Profile }
const VKEY = 'meem_visitor_token';
const vGetToken = () => { try { return localStorage.getItem(VKEY) || ''; } catch { return ''; } };
const vSetToken = (t: string) => { try { localStorage.setItem(VKEY, t); } catch { /* */ } };
const vClearToken = () => { try { localStorage.removeItem(VKEY); } catch { /* */ } };

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => { fetch('/site/api/content').then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => {}); }, []);
  useEffect(() => {
    const t = vGetToken();
    if (!t) return;
    fetch('/site/api/visitor/me', { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.profile) setAuth({ token: t, profile: d.profile }); else vClearToken(); })
      .catch(() => {});
  }, []);

  const [article, setArticle] = useState<Item | null>(null);
  const by = (k: Item['kind']) => items.filter((i) => i.kind === k);
  const about = items.find((i) => i.kind === 'about');
  function onAuthed(a: Auth) { vSetToken(a.token); setAuth(a); setAuthOpen(false); }
  function logout() { vClearToken(); setAuth(null); }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="neon-field" aria-hidden />
      <main className="relative z-[1] min-h-screen bg-transparent">
        <Header auth={auth} onLogin={() => setAuthOpen(true)} onLogout={logout} />
        <Hero auth={auth} onNeedLogin={() => setAuthOpen(true)} />
        <Dynamics items={by('dynamic')} />
        <Articles items={by('article')} onOpen={setArticle} />
        <Projects items={by('project')} />
        <About item={about} />
        <Contact />
        <footer className={`${pageX} flex justify-between gap-5 pb-10 pt-6 text-sm text-muted-foreground`}>
          <span>Powered by Meem</span>
        </footer>
      </main>
      <div className="neon-scan" aria-hidden />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />}
      {article && <ArticleModal item={article} onClose={() => setArticle(null)} />}
    </div>
  );
}

function ThemeToggle() {
  const [theme, set] = useState<Theme>(getTheme());
  return (
    <button type="button" aria-label="切换主题" title="切换主题" onClick={() => { const n: Theme = theme === 'light' ? 'dark' : 'light'; set(n); applyTheme(n); }}
      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-all hover:border-cyan hover:text-cyan hover:shadow-glow-sm">
      {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

function Header({ auth, onLogin, onLogout }: { auth: Auth | null; onLogin: () => void; onLogout: () => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className={`${pageX} sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-border bg-background/80 py-4 backdrop-blur-xl`}>
      <a className="inline-flex items-center gap-2.5 font-bold tracking-wide" href="/"><img className="size-8 rounded-lg shadow-glow-sm" src="/favicon.svg" alt="" /><span>Meem Site</span></a>
      <div className="flex items-center gap-2">
        <nav className="hidden gap-1.5 sm:flex">
          {[['欢迎', '#welcome'], ['动态', '#dynamics'], ['文章', '#articles'], ['项目', '#projects'], ['关于', '#about']].map(([l, h]) => (
            <a className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground" href={h} key={h}>{l}</a>
          ))}
        </nav>
        <ThemeToggle />
        {auth ? (
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} aria-label="账户"
              className="grid size-9 place-items-center rounded-full border border-cyan bg-cyan/10 text-sm font-bold text-cyan shadow-glow-sm">
              {(auth.profile.name || auth.profile.email || '?').slice(0, 1).toUpperCase()}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-glow-sm">
                  <div className="border-b border-border px-3.5 py-3">
                    <div className="truncate text-sm font-semibold">{auth.profile.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{auth.profile.email}</div>
                  </div>
                  <button onClick={() => { setMenu(false); onLogout(); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <LogOut className="size-4" />退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={onLogin} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground transition-all hover:border-cyan hover:text-cyan hover:shadow-glow-sm">
            <UserRound className="size-4" />登录
          </button>
        )}
      </div>
    </header>
  );
}

/* ── AI 助手对话:欢迎前门 ── */
function Hero({ auth, onNeedLogin }: { auth: Auth | null; onNeedLogin: () => void }) {
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
    const next = [...msgs, { role: 'user' as const, content: t }];
    setMsgs(next);
    setSending(true);
    try {
      const r = await fetch('/site/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}) },
        body: JSON.stringify({ message: t, history: msgs.slice(-8) }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { role: 'assistant', content: d.reply || '(没有回应)' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '网络不太顺,稍后再试,或到下方留言。' }]);
    } finally { setSending(false); }
  }

  const samples = ['他最近在做什么?', '有哪些项目?', '我想找他合作'];

  return (
    <section id="welcome" className={`${pageX} grid min-h-[calc(100vh-69px)] grid-cols-1 items-center gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.82fr)] lg:gap-16`}>
      <div className="max-w-[760px]">
        <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-cyan"><Sparkles className="size-4" />会回话的个人主页</p>
        <h1 className="text-[42px] font-bold leading-[.98] tracking-tight sm:text-[64px] lg:text-[84px]">别只是浏览,直接问我的网站。</h1>
        <p className="mt-6 max-w-[620px] text-lg leading-8 text-muted-foreground">右边这个 AI 助手懂我发布的全部动态、文章和项目——问它任何事,或者直接留言,我会接住。</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {samples.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-card/50 px-3.5 py-1.5 text-sm text-muted-foreground transition-all hover:border-cyan hover:text-cyan">{s}</button>
          ))}
        </div>
      </div>

      {/* 门童面板 */}
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

function Projects({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="projects">
      <SectionHead label="Projects" title="项目" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {items.map((p) => (
          <article className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur-sm transition-all hover:border-cyan/60 hover:shadow-glow-sm" key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold">{p.title}</h3>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="shrink-0 text-cyan hover:brightness-110"><ExternalLink className="size-4" /></a>}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{p.body}</p>
            <Tags tags={p.tags} />
          </article>
        ))}
      </div>
    </section>
  );
}

function Articles({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="articles">
      <SectionHead label="Articles" title="文章" />
      <div className="grid gap-2.5">
        {items.map((a) => (
          <button onClick={() => onOpen(a)} className="rounded-xl border border-border bg-card/70 p-5 text-left backdrop-blur-sm transition-all hover:border-cyan/60 hover:shadow-glow-sm sm:p-6" key={a.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold sm:text-xl">{a.title}</h3>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{fmtDate(a.created)}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{a.body}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-cyan">阅读全文<ArrowUpRight className="size-3.5" /></span>
            <Tags tags={a.tags} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Dynamics({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="dynamics">
      <SectionHead label="Now" title="动态" />
      <div className="grid gap-2.5">
        {items.map((d) => (
          <div className="flex items-start gap-4 rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm" key={d.id}>
            <span className="mt-1 shrink-0 font-mono text-xs text-cyan">{fmtDate(d.created)}</span>
            <div className="min-w-0">
              {d.title && <p className="font-medium">{d.title}</p>}
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{d.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tags({ tags }: { tags: string }) {
  const list = (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {list.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}
    </div>
  );
}

function Contact() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const contact = String(form.get('contact') || '').trim();
    const body = String(form.get('body') || '').trim();
    if (!body) return;
    setState('sending');
    try {
      const res = await fetch('/site/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, contact, body }) });
      if (!res.ok) throw new Error('fail');
      event.currentTarget.reset();
      setState('sent');
    } catch { setState('error'); }
  }
  return (
    <section className={`${pageX} my-12`} id="contact">
      <div className="grid grid-cols-1 gap-8 rounded-2xl border border-cyan/40 bg-card/80 p-6 shadow-glow-sm backdrop-blur-sm lg:grid-cols-[minmax(0,.86fr)_minmax(320px,.72fr)] lg:gap-16 lg:p-12">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-cyan"><Mail className="size-4" />留言</p>
          <h2 className="max-w-[680px] text-[30px] font-bold leading-tight tracking-tight sm:text-[44px] lg:text-[56px]">合作、反馈、想法,都先放这里。</h2>
          <p className="mt-5 max-w-[560px] text-base leading-8 text-muted-foreground">消息进入收件箱,AI 助手先看到、按需转达。适合异步沟通和项目咨询。</p>
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="称呼"><input name="name" autoComplete="name" placeholder="你的名字" /></Field>
          <Field label="联系方式"><input name="contact" autoComplete="email" placeholder="邮箱 / 社交账号" /></Field>
          <Field label="内容"><textarea name="body" rows={5} required placeholder="想交流的事" /></Field>
          <button className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan font-bold text-cyan-foreground shadow-glow-sm transition-all hover:brightness-110 disabled:opacity-70" disabled={state === 'sending'} type="submit">
            {state === 'sending' ? '发送中' : state === 'sent' ? '已送达' : '发送留言'}
            {state === 'sent' ? <CheckCircle2 className="size-4" /> : <ArrowUpRight className="size-4" />}
          </button>
          {state === 'error' && <p className="m-0 text-sm text-red-400">暂时没送达,请稍后再试。</p>}
        </form>
      </div>
    </section>
  );
}

function SectionHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="m-0 font-mono text-xs uppercase tracking-widest text-cyan">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs text-muted-foreground [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-input [&_input]:bg-secondary [&_input]:px-3.5 [&_input]:py-3 [&_input]:text-sm [&_input]:text-foreground [&_input]:outline-none [&_input]:transition-all [&_input]:placeholder:text-muted-foreground [&_input:focus]:border-cyan [&_input:focus]:shadow-glow-sm [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-secondary [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:text-foreground [&_textarea]:outline-none [&_textarea]:transition-all [&_textarea]:placeholder:text-muted-foreground [&_textarea:focus]:border-cyan [&_textarea:focus]:shadow-glow-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface Contact { label: string; value: string; url?: string; code?: boolean }
function About({ item }: { item?: Item }) {
  if (!item) return null;
  let contacts: Contact[] = [];
  try { contacts = JSON.parse(item.tags || '[]'); } catch { /* */ }
  return (
    <section className={`${pageX} py-12`} id="about">
      <SectionHead label="About" title="关于" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.62fr)]">
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-card/70 p-6 text-base leading-8 text-foreground backdrop-blur-sm">{item.body}</div>
        {contacts.length > 0 && (
          <div className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-cyan">联系</h3>
            <div className="grid gap-3">
              {contacts.map((c) => (
                <div className="flex items-baseline justify-between gap-3" key={c.label}>
                  <span className="text-sm text-muted-foreground">{c.label}</span>
                  {c.url
                    ? <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-foreground transition-colors hover:text-cyan">{c.value}</a>
                    : <span className={`text-sm text-foreground ${c.code ? 'font-mono' : ''}`}>{c.value}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ArticleModal({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-cyan/40 bg-card p-6 shadow-glow-sm sm:p-9" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{item.title}</h2>
          <button onClick={onClose} aria-label="关闭" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-cyan hover:text-cyan">✕</button>
        </div>
        <div className="mb-5 font-mono text-xs text-muted-foreground">{fmtDate(item.created)}</div>
        <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">{item.body}</div>
        {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm text-cyan hover:brightness-110">原文链接<ArrowUpRight className="size-4" /></a>}
      </div>
    </div>
  );
}

function AuthModal({ onClose, onAuthed }: { onClose: () => void; onAuthed: (a: Auth) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const errMap: Record<string, string> = {
    invalid_email: '邮箱格式不对', password_too_short: '密码至少 6 位', email_taken: '该邮箱已注册',
    unauthorized: '邮箱或密码不正确', rate_limited: '尝试太频繁,稍后再试',
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/site/api/visitor/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      const d = await r.json();
      if (!r.ok || !d.token) { setErr(errMap[d.error] || '失败,请重试'); return; }
      onAuthed({ token: d.token, profile: d.profile });
    } catch { setErr('网络错误'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-cyan/40 bg-card p-6 shadow-glow-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex gap-1 rounded-lg border border-border bg-secondary p-0.5 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setErr(''); }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${mode === m ? 'bg-cyan/10 text-cyan' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>
        <form className="grid gap-3" onSubmit={submit}>
          <label className="grid gap-1.5 text-xs text-muted-foreground">邮箱
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="rounded-lg border border-input bg-secondary px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-cyan focus:shadow-glow-sm" />
          </label>
          {mode === 'register' && (
            <label className="grid gap-1.5 text-xs text-muted-foreground">昵称(可选)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="怎么称呼你"
                className="rounded-lg border border-input bg-secondary px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-cyan focus:shadow-glow-sm" />
            </label>
          )}
          <label className="grid gap-1.5 text-xs text-muted-foreground">密码
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? '至少 6 位' : '密码'}
              className="rounded-lg border border-input bg-secondary px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-cyan focus:shadow-glow-sm" />
          </label>
          {err && <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}
          <button type="submit" disabled={busy}
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan font-bold text-cyan-foreground shadow-glow-sm transition-all hover:brightness-110 disabled:opacity-60">
            {busy ? '处理中' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">登录后你和 AI 助手的对话会被保存,下次接着聊。</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
