import { useState } from 'react';
import { req, setToken, type Me } from '../lib/api';

interface Props { onDone: (me: Me) => void; }

export default function Login({ onDone }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!handle.trim() || !password) { setErr('请输入账号和密码'); return; }
    if (mode === 'register' && password !== confirm) { setErr('两次密码不一致'); return; }
    setLoading(true);
    try {
      const res = await req<{ token: string }>(
        mode === 'login' ? '/api/login' : '/api/register',
        { method: 'POST', body: JSON.stringify({ handle: handle.trim(), password }) }
      );
      setToken(res.token);
      const me = await req<Me>('/api/me');
      onDone(me);
    } catch (e: any) {
      setErr(e.message ?? '请求失败');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setErr('');
    setConfirm('');
  }

  return (
    <div className="flex items-center justify-center h-full p-6 bg-neutral-100">
      <div className="w-full max-w-sm bg-white rounded-2xl px-7 pt-10 pb-8 flex flex-col">
        <h1 className="text-[30px] font-bold text-center tracking-tight">Meem</h1>
        <p className="text-center text-neutral-400 text-sm mt-1 mb-8">数字智能体</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="账号" autoFocus autoComplete="username" className="input" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="input" />
          {mode === 'register' && (
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="确认密码" autoComplete="new-password" className="input" />
          )}
          {err && <p className="text-danger text-sm">{err}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? '…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        <button onClick={switchMode} className="btn-ghost mt-1">
          {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
        </button>
      </div>
    </div>
  );
}
