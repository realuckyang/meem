import { useEffect, useRef, useState } from 'react';
import { openSocket, pushTokenToLocalServer } from '../api';
import TabButton from '../components/TabButton';
import { navigate, PATH, useRoute } from '../lib/router';
import Agent from './Agent';
import Contacts from './Contacts';
import Inbox from './Inbox';

type WsStatus = 'connecting' | 'open' | 'closed';

export default function Main({ onLogout }: { onLogout: () => void }) {
  const route = useRoute();
  const wsRef = useRef<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      navigate(PATH.messages(), { replace: true });
    }
  }, []);

  useEffect(() => {
    pushTokenToLocalServer();
    const timer = setInterval(pushTokenToLocalServer, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    let retry = 0;
    const connect = () => {
      if (!alive) return;
      setWsStatus('connecting');
      const ws = openSocket();
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setWsStatus('open');
      };
      ws.onmessage = (event) => {
        try {
          window.dispatchEvent(new CustomEvent('meem:frame', { detail: JSON.parse(event.data) }));
        } catch {}
      };
      ws.onclose = () => {
        if (!alive) return;
        setWsStatus('closed');
        retry = Math.min(retry + 1, 6);
        setTimeout(connect, 500 * 2 ** retry);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();
    return () => { alive = false; try { wsRef.current?.close(); } catch {} };
  }, []);

  const hideTabs =
    (route.tab === 'codex' && route.overlay === 'session') ||
    (route.tab === 'messages' && (route.overlay === 'inboxThread' || route.overlay === 'inboxProcess')) ||
    (route.tab === 'contacts' && route.overlay !== null);

  return (
    <div className="relative h-full bg-neutral-50 flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        {route.tab === 'messages' && (
          <Inbox
            threadId={route.threadId}
            processSessionId={route.overlay === 'inboxProcess' ? route.processSessionId : undefined}
            onOpenThread={(id) => navigate(PATH.messageThread(id))}
            onCloseThread={() => navigate(PATH.messages())}
          />
        )}
        {route.tab === 'contacts' && <Contacts route={route} />}
        {route.tab === 'codex' && <Agent onLogout={onLogout} route={route} />}
      </div>

      {!hideTabs && (
        <nav className="h-14 border-t bg-white/85 backdrop-blur flex">
          <TabButton label="消息" icon="💬" active={route.tab === 'messages'} onClick={() => navigate(PATH.messages())} />
          <TabButton label="联系人" icon="👥" active={route.tab === 'contacts'} onClick={() => navigate(PATH.contacts())} />
          <TabButton label="Codex" icon="⌘" active={route.tab === 'codex'} onClick={() => navigate(PATH.codex())} />
        </nav>
      )}

      {/* WS 状态：未连接时浮一条小条 */}
      {wsStatus !== 'open' && (
        <div className="pointer-events-none absolute top-2 inset-x-0 z-[90] flex justify-center">
          <div className={`meem-toast-enter rounded-full px-3 py-1 text-[11.5px] shadow-sm flex items-center gap-1.5 ${
            wsStatus === 'connecting'
              ? 'bg-white/95 text-neutral-500 border border-neutral-200'
              : 'bg-amber-50/95 text-amber-700 border border-amber-200'
          }`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              wsStatus === 'connecting' ? 'bg-neutral-400 animate-pulse' : 'bg-amber-500'
            }`} />
            {wsStatus === 'connecting' ? '连接中…' : '已离线，正在重连'}
          </div>
        </div>
      )}
    </div>
  );
}
