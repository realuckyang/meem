import { createRoot } from 'react-dom/client';
import { ArrowUpRight, BookOpen, CheckCircle2, Code2, Layers3, Mail, MessageSquare, PenLine, Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { ReactNode } from 'react';
import './styles.css';

const pageX = 'px-5 sm:px-8 lg:px-[72px]';
const panel = 'rounded-xl border border-[#dfe5ec] bg-white/80 shadow-site';

const projects = [
  { title: '公开作品', desc: '整理长期项目、开源工具和可以直接体验的 demo。', tag: 'Work' },
  { title: '构建日志', desc: '记录产品判断、技术选择、发布节奏和踩过的坑。', tag: 'Log' },
  { title: '小型工具', desc: '把常用脚本、自动化流程和内部应用逐步开放出来。', tag: 'Tools' },
];

const notes = [
  '一个好网站应该能承接外部关系，而不仅是展示页面。',
  '把想法变成可运行的应用，比把想法写完整更重要。',
  'AI 适合处理重复、连接和整理，人保留判断与审美。',
];

const links = [
  { label: '项目', href: '#work' },
  { label: '笔记', href: '#notes' },
  { label: '留言', href: '#contact' },
];

function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fb] bg-[linear-gradient(90deg,rgba(32,33,36,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(32,33,36,0.04)_1px,transparent_1px)] [background-size:44px_44px]">
      <Header />
      <Hero />
      <Work />
      <Notes />
      <Contact />
      <footer className={`${pageX} flex justify-between gap-5 pb-10 pt-6 text-sm text-[#6a7280]`}>
        <span>Powered by Meem</span>
        <a className="inline-flex items-center gap-1.5 hover:text-[#202124]" href="/meem" aria-label="进入 Meem">
          <span>Meem</span>
          <ArrowUpRight className="size-4" />
        </a>
      </footer>
    </main>
  );
}

function Header() {
  return (
    <header className={`${pageX} sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-[#dfe5ec]/80 bg-[#f7f8fb]/85 py-4 backdrop-blur-xl`}>
      <a className="inline-flex items-center gap-2.5 font-bold tracking-normal" href="/" aria-label="首页">
        <img className="size-8 rounded-lg shadow-[0_12px_28px_-18px_rgba(0,0,0,.75)]" src="/favicon.svg" alt="" />
        <span>Meem Site</span>
      </a>
      <nav className="hidden gap-1.5 sm:flex">
        {links.map((link) => (
          <a className="rounded-md px-3 py-2 text-sm text-[#6a7280] transition-colors hover:bg-white hover:text-[#202124]" href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className={`${pageX} grid min-h-[calc(100vh-69px)] grid-cols-1 items-center gap-10 py-16 lg:grid-cols-[minmax(0,1.14fr)_minmax(300px,.86fr)] lg:gap-20 lg:py-24`}>
      <div className="max-w-[830px]">
        <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600">
          <Sparkles className="size-4" />个人开发者的公开工作台
        </p>
        <h1 className="max-w-[820px] text-[48px] font-bold leading-[.94] tracking-normal sm:text-[72px] lg:text-[104px]">展示正在构建的东西，也接住外部世界的消息。</h1>
        <p className="mt-7 max-w-[680px] text-lg leading-8 text-[#6a7280] sm:text-xl">
          这里可以放作品、文章、实验、工具和联系方式。访客留下的信息会进入 Meem，由内部 AI 帮你整理、提醒和跟进。
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a className="inline-flex min-h-11 items-center rounded-md bg-[#202124] px-5 text-sm font-bold text-white transition-colors hover:bg-black" href="#contact">给我留言</a>
          <a className="inline-flex min-h-11 items-center rounded-md border border-[#c8d2dd] bg-white/70 px-5 text-sm font-bold transition-colors hover:bg-white" href="#work">看看正在做什么</a>
        </div>
      </div>
      <aside className={`${panel} relative p-4 before:absolute before:-inset-px before:-z-10 before:rounded-[13px] before:bg-[linear-gradient(135deg,rgba(37,99,235,.24),rgba(15,159,110,.18),transparent_48%)]`} aria-label="站点信号">
        <div className="flex items-center gap-2.5 text-sm text-[#6a7280]">
          <span className="size-2 rounded-full bg-emerald-600 shadow-[0_0_0_7px_rgba(15,159,110,.12)]" />
          <span>Open for useful messages</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3">
          <Metric value="3" label="开放区块" />
          <Metric value="24h" label="异步回复" />
          <Metric value="AI" label="辅助整理" />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-[#dfe5ec]">
          <RouteLine icon={<Layers3 />} label="作品与项目" />
          <RouteLine icon={<PenLine />} label="笔记与日志" />
          <RouteLine icon={<MessageSquare />} label="留言与反馈" />
        </div>
      </aside>
    </section>
  );
}

function Work() {
  return (
    <section className={`${pageX} py-12`} id="work">
      <SectionHead label="Work" title="适合持续更新的公开入口" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {projects.map((project) => (
          <article className="min-h-48 rounded-xl border border-[#dfe5ec] bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] lg:min-h-[250px]" key={project.title}>
            <span className="inline-flex rounded-full border border-[#dfe5ec] px-2.5 py-1 text-xs text-[#6a7280]">{project.tag}</span>
            <h3 className="mt-9 text-2xl font-bold lg:mt-14">{project.title}</h3>
            <p className="mt-3 leading-7 text-[#6a7280]">{project.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Notes() {
  return (
    <section className={`${pageX} py-8`} id="notes">
      <SectionHead label="Notes" title="把进展写成短记录" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)]">
        <div className="rounded-xl border border-[#dfe5ec] bg-white/75 p-6 leading-8 text-[#6a7280]">
          <BookOpen className="mb-10 size-7 text-blue-600" />
          <p>默认站点不限定成博客，但它应该天然支持写作。短笔记、长文章、项目日志和发布记录都可以从这里生长出来。</p>
        </div>
        <div className="grid gap-2.5">
          {notes.map((note, index) => (
            <div className="flex items-start gap-4 rounded-xl border border-[#dfe5ec] bg-white/75 p-5 sm:items-center sm:gap-6 sm:p-6" key={note}>
              <span className="font-mono text-sm text-[#9aa3af]">{String(index + 1).padStart(2, '0')}</span>
              <p className="m-0 text-xl leading-snug sm:text-2xl">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
      const res = await fetch('/site/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, body }),
      });
      if (!res.ok) throw new Error('send failed');
      event.currentTarget.reset();
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <section className="mx-0 my-12 grid grid-cols-1 gap-8 border-y border-[#dfe5ec] bg-[#202124] px-5 py-8 text-white sm:mx-5 sm:rounded-2xl sm:border lg:mx-[72px] lg:grid-cols-[minmax(0,.86fr)_minmax(320px,.72fr)] lg:gap-16 lg:p-12" id="contact">
      <div>
        <p className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-400">
          <Mail className="size-4" />留言
        </p>
        <h2 className="max-w-[680px] text-[34px] font-bold leading-none tracking-normal sm:text-[52px] lg:text-[68px]">合作、反馈、问题和想法都可以先放在这里。</h2>
        <p className="mt-5 max-w-[560px] text-base leading-8 text-white/65">消息会进入站点收件箱。适合异步沟通，也适合作为产品反馈、试用申请和项目咨询入口。</p>
      </div>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="称呼">
          <input name="name" autoComplete="name" placeholder="你的名字" />
        </Field>
        <Field label="联系方式">
          <input name="contact" autoComplete="email" placeholder="邮箱、社交账号或其他方式" />
        </Field>
        <Field label="内容">
          <textarea name="body" rows={5} required placeholder="想交流的事" />
        </Field>
        <button className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white font-bold text-[#202124] disabled:cursor-default disabled:opacity-70" disabled={state === 'sending'} type="submit">
          {state === 'sending' ? '发送中' : state === 'sent' ? '已送达' : '发送留言'}
          {state === 'sent' ? <CheckCircle2 className="size-4" /> : <ArrowUpRight className="size-4" />}
        </button>
        {state === 'error' && <p className="m-0 text-sm text-red-300">暂时没有送达，请稍后再试。</p>}
      </form>
    </section>
  );
}

function SectionHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end">
      <p className="m-0 text-xs font-extrabold uppercase text-blue-600">{label}</p>
      <h2 className="m-0 max-w-[680px] text-left text-[30px] font-bold leading-none tracking-normal sm:text-[44px] lg:text-right lg:text-[56px]">{title}</h2>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[#dfe5ec] bg-white px-3 py-3.5">
      <strong className="block text-2xl leading-none">{value}</strong>
      <span className="mt-2 block text-xs text-[#6a7280]">{label}</span>
    </div>
  );
}

function RouteLine({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b border-[#dfe5ec] bg-[#f7f8fb]/75 px-3 last:border-b-0">
      <span className="grid size-8 place-items-center rounded-lg bg-white text-blue-600 [&_svg]:size-4">{icon}</span>
      <p className="m-0 flex-1 text-sm font-bold">{label}</p>
      <Code2 className="size-4 text-[#9aa3af]" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs text-white/60 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-white/15 [&_input]:bg-white/10 [&_input]:px-3.5 [&_input]:py-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:placeholder:text-white/35 [&_input:focus]:border-blue-300 [&_input:focus]:ring-4 [&_input:focus]:ring-blue-300/20 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-white/15 [&_textarea]:bg-white/10 [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:text-white [&_textarea]:outline-none [&_textarea]:placeholder:text-white/35 [&_textarea:focus]:border-blue-300 [&_textarea:focus]:ring-4 [&_textarea:focus]:ring-blue-300/20">
      <span>{label}</span>
      {children}
    </label>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
