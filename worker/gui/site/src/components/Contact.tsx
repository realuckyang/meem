import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, Mail } from 'lucide-react';
import { pageX } from '../lib/ui';
import { Field } from './shared';

export default function Contact() {
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
