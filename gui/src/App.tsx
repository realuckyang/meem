import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { req, hasToken, type Me } from './lib/api';
import { startSocket, stopSocket } from './lib/socket';
// 工具执行已下沉到 extension/src/background.ts；side panel 仅负责 UI。
import { MeContext } from './lib/me';

import Login from './pages/Login';
import Layout from './pages/Layout';
import MessagesList from './pages/messages/List';
import MessageDetail from './pages/messages/Detail';
import SessionDetail from './pages/sessions/Detail';
import FeedList from './pages/feed/List';
import FeedDetail from './pages/feed/Detail';
import FeedCompose from './pages/feed/Compose';
import ContactsList from './pages/contacts/List';
import ContactDetail from './pages/contacts/Detail';
import AgentsList from './pages/agents/List';
import AgentDetail from './pages/agents/Detail';
import AgentSettings from './pages/agents/Settings';
import AgentNew from './pages/agents/New';
import MeHub from './pages/me/Hub';
import ProfileSub from './pages/me/Profile';
import ModelSub from './pages/me/Model';
import PersonaSub from './pages/me/Persona';
import WhisperSub from './pages/me/Whisper';
import ExtensionSub from './pages/me/Extension';
import MemorySub from './pages/me/Memory';
import LimitsSub from './pages/me/Limits';

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
            <Route path="/messages" element={<MessagesList />} />
            <Route path="/messages/:cid" element={<MessageDetail />} />
            <Route path="/sessions" element={<Navigate to="/agents" replace />} />
            <Route path="/sessions/:sid" element={<SessionDetail />} />
            <Route path="/feed" element={<FeedList />} />
            <Route path="/feed/new" element={<FeedCompose />} />
            <Route path="/feed/:id" element={<FeedDetail />} />
            <Route path="/contacts" element={<ContactsList />} />
            <Route path="/contacts/:handle" element={<ContactDetail />} />
            <Route path="/agents" element={<AgentsList />} />
            <Route path="/agents/new" element={<AgentNew />} />
            <Route path="/agents/:aid" element={<AgentDetail />} />
            <Route path="/agents/:aid/settings" element={<AgentSettings />} />
            <Route path="/me" element={<MeHub />} />
            <Route path="/me/profile" element={<ProfileSub />} />
            <Route path="/me/model" element={<ModelSub />} />
            <Route path="/me/persona" element={<PersonaSub />} />
            <Route path="/me/whisper" element={<WhisperSub />} />
            <Route path="/me/extension" element={<ExtensionSub />} />
            <Route path="/me/memory" element={<MemorySub />} />
            <Route path="/me/limits" element={<LimitsSub />} />
          </Route>
          <Route path="*" element={<Navigate to="/messages" replace />} />
        </Routes>
      </HashRouter>
    </MeContext.Provider>
  );
}
