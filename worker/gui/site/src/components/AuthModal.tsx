import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Auth } from '../lib/types';

const ERR_MAP: Record<string, string> = {
  invalid_email: '邮箱格式有误', password_too_short: '密码至少 6 位', email_taken: '该邮箱已注册',
  unauthorized: '邮箱或密码错误', rate_limited: '操作过于频繁,请稍后再试',
};

export default function AuthModal({ onClose, onAuthed }: { onClose: () => void; onAuthed: (a: Auth) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
      if (!r.ok || !d.token) { setErr(ERR_MAP[d.error] || '失败,请重试'); return; }
      onAuthed({ token: d.token, profile: d.profile });
    } catch { setErr('网络错误'); } finally { setBusy(false); }
  }

  const inputCls = 'rounded-lg border border-input bg-secondary px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-cyan focus:shadow-glow-sm';

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
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </label>
          {mode === 'register' && (
            <label className="grid gap-1.5 text-xs text-muted-foreground">昵称(可选)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="怎么称呼你" className={inputCls} />
            </label>
          )}
          <label className="grid gap-1.5 text-xs text-muted-foreground">密码
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? '至少 6 位' : '密码'} className={inputCls} />
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
