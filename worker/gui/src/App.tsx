import { useEffect, useState } from 'react';
import { auth, req } from './api';
import Login from './pages/Login';
import Main from './pages/Main';
import PublicProfile from './pages/PublicProfile';
import PublicThread from './pages/PublicThread';
import ToastHost, { pushToast } from './components/Toast';

export default function App() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const publicPage =
    window.location.pathname.startsWith('/u/') ||
    window.location.pathname.startsWith('/t/');

  useEffect(() => {
    if (publicPage) return;
    if (!auth.token()) {
      setLogged(false);
      return;
    }
    req('/api/me')
      .then(() => setLogged(true))
      .catch(() => {
        auth.clear();
        setLogged(false);
      });
  }, [publicPage]);

  // 全局错误 → toast；401 静默，避免登录页弹错
  useEffect(() => {
    const onErr = (event: Event) => {
      const { message, status } = (event as CustomEvent).detail || {};
      if (status === 401 || !message) return;
      pushToast(String(message), 'error');
    };
    window.addEventListener('meem:error', onErr as EventListener);
    return () => window.removeEventListener('meem:error', onErr as EventListener);
  }, []);

  if (publicPage) {
    return (
      <>
        {window.location.pathname.startsWith('/t/') ? <PublicThread /> : <PublicProfile />}
        <ToastHost />
      </>
    );
  }

  if (logged === null) {
    return (
      <>
        <div className="h-full flex items-center justify-center text-sm text-neutral-400">Meem</div>
        <ToastHost />
      </>
    );
  }

  return (
    <>
      {logged
        ? <Main onLogout={() => setLogged(false)} />
        : <Login onDone={() => setLogged(true)} />}
      <ToastHost />
    </>
  );
}
