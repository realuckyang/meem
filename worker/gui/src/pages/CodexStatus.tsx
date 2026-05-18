import { useEffect, useState } from 'react';
import { req, type Presence } from '../api';
import { Card, Line } from '../components/List';

export default function CodexStatus({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Presence | null>(null);

  useEffect(() => {
    const load = () => req<Presence>('/api/presence').then(setData).catch(() => {});
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const sessions = data?.sessions ?? [];
  const desktops = sessions.filter((session) => session.kind === 'desktop');
  const primary = desktops.find((session) => session.capabilities.codex) ?? desktops[0];
  const codexOn = Boolean(primary?.capabilities.codex);
  const version = primary?.capabilities.codexVersion || '';
  const loggedIn = Boolean(primary?.capabilities.codexLoggedIn);
  const hasDesktop = desktops.length > 0;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-3 border-b bg-white">
        <button onClick={onClose} className="text-neutral-600 text-sm pr-2">←</button>
        <div className="font-medium">Codex</div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <Line label="状态" value={codexOn ? '已就绪' : '未就绪'} />
          <Line label="版本" value={version || '—'} />
          <Line label="登录" value={!codexOn ? '—' : (loggedIn ? '已登录' : '未登录')} last />
        </Card>

        {!hasDesktop && (
          <Card title="先连连接器">
            <div className="px-4 py-3 text-sm text-neutral-600">
              Codex 跑在你电脑里的 Codex CLI 上，必须先有连接器在线上报状态。
            </div>
          </Card>
        )}

        {hasDesktop && !codexOn && (
          <Card title="本机没装 Codex">
            <div className="px-4 py-3 text-sm text-neutral-600 space-y-2">
              <p>装一下，连接器每 30 秒自动重探：</p>
              <pre className="bg-neutral-900 text-neutral-100 rounded p-2 text-xs overflow-x-auto">
npm i -g @openai/codex
codex login
              </pre>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
