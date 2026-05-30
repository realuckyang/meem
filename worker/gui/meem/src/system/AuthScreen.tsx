import { FormEvent, useEffect, useState } from 'react';
import LogoMark from './LogoMark';
import { api, setToken } from './lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function AuthScreen({ onReady }: { onReady: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Meem');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.authStatus().then((r) => setConfigured(r.configured)).catch(() => setConfigured(false)); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = configured ? await api.login({ password }) : await api.setup({ password, name });
      setToken(res.token);
      onReady();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }

  const setup = configured === false;

  return (
    <main className="grid min-h-full place-items-center bg-background px-5 py-10">
      <form className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-card" onSubmit={submit}>
        <div className="mb-5 flex items-center gap-3">
          <LogoMark className="size-11 rounded-xl text-base" />
          <div>
            <h1 className="text-xl font-bold tracking-normal">{setup ? '设置 Meem 密码' : '登录 Meem'}</h1>
            <p className="text-sm text-muted-foreground">{setup ? '用于保护内部控制台和工具连接。' : '进入内部控制台。'}</p>
          </div>
        </div>
        {setup && (
          <label className="mb-3 block text-sm">
            <span className="mb-1.5 block text-muted-foreground">名称</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted-foreground">密码</span>
          <Input type="password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} minLength={setup ? 8 : undefined} />
        </label>
        {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button className="mt-5 w-full" disabled={busy || configured === null || !password} type="submit">
          {busy ? '处理中' : setup ? '完成设置' : '登录'}
        </Button>
      </form>
    </main>
  );
}
