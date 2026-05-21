import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { req, hasToken, type Me } from './lib/api';
import { startSocket, stopSocket } from './lib/socket';
// 工具执行已下沉到 extension/src/background.ts；side panel 仅负责 UI。
import { MeContext } from './lib/me';

import Login from './pages/Login';
import Layout from './pages/Layout';
import Messages from './pages/Messages';
import Conversation from './pages/Conversation';
import Sessions from './pages/Sessions';
import Session from './pages/Session';
import Contacts from './pages/Contacts';
import UserDetail from './pages/UserDetail';
import Settings from './pages/Settings';
import ProfileSub from './pages/settings/Profile';
import ModelSub from './pages/settings/Model';
import PersonaSub from './pages/settings/Persona';
import ModeSub from './pages/settings/Mode';
import ExtensionSub from './pages/settings/Extension';
import MemorySub from './pages/settings/Memory';
import LimitsSub from './pages/settings/Limits';

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(hasToken());

  const refresh = useCallback(async () => {
    const fresh = await req<Me>('/api/me');
    setMe(fresh);
  }, []);

  const logout = useCallback(() => {
    setMe(null);
  }, []);

  useEffect(() => {
    if (!hasToken()) return;
    refresh().catch(() => {}).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    startSocket();
    return stopSocket;
  }, [me]);

  if (loading) return <div className="flex items-center justify-center h-full text-neutral-400">…</div>;
  if (!me) return <Login onDone={setMe} />;

  return (
    <MeContext.Provider value={{ me, refresh, logout }}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/messages" replace />} />
          <Route element={<Layout />}>
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:cid" element={<Conversation />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/sessions/:sid" element={<Session />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:handle" element={<UserDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/profile" element={<ProfileSub />} />
            <Route path="/settings/model" element={<ModelSub />} />
            <Route path="/settings/persona" element={<PersonaSub />} />
            <Route path="/settings/mode" element={<ModeSub />} />
            <Route path="/settings/extension" element={<ExtensionSub />} />
            <Route path="/settings/memory" element={<MemorySub />} />
            <Route path="/settings/limits" element={<LimitsSub />} />
          </Route>
          <Route path="*" element={<Navigate to="/messages" replace />} />
        </Routes>
      </HashRouter>
    </MeContext.Provider>
  );
}
