import { useEffect, useState } from 'react';
import { auth, pub, pushTokenToLocalServer } from '../api';

type AuthStatus = { initialized: boolean; account: string };
type AuthResult = { token: string; account: string; initialized: true; created: boolean };

export default function Login({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pub<AuthStatus>('/api/auth/status')
      .then((status) => {
        setRegistering(!status.initialized);
        if (status.account) setAccount(status.account);
        setReady(true);
      })
      .catch(() => {
        setRegistering(true);
        setReady(true);
      });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!account.trim() || !password || busy) return;
    setErr('');
    setBusy(true);
    try {
      const path = registering ? '/api/auth/register' : '/api/auth/login';
      const result = await pub<AuthResult>(path, {
        method: 'POST',
        body: JSON.stringify({ account: account.trim(), password }),
      });
      auth.set(result.token, result.account);
      pushTokenToLocalServer();
      onDone();
    } catch (error: any) {
      setErr(error?.message || '登录失败');
    } finally {
      setBusy(false);
    }
  }

  const mode = registering ? '注册' : '登录';

  return (
    <div className="h-full flex items-center justify-center bg-neutral-50">
      <form onSubmit={submit} className="w-80 bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Meem · {ready ? mode : '连接'}</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="账号"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button
          disabled={!ready || busy || !account.trim() || !password}
          className="w-full bg-neutral-900 text-white rounded py-2 disabled:bg-neutral-200"
        >
          {busy ? '请稍候…' : (registering ? '创建账号' : '登录')}
        </button>
        <button
          type="button"
          onClick={() => {
            setRegistering((value) => !value);
            setErr('');
          }}
          className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
        >
          {registering ? '已有账号，去登录' : '创建新账号'}
        </button>
      </form>
    </div>
  );
}
