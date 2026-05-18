import { useEffect, useState } from 'react';
import { req, type Presence } from '../api';
import { Card, Line } from '../components/List';
import { fmtUptime } from '../lib/time';

export default function ClientStatus({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Presence | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const load = () => req<Presence>('/api/presence').then(setData).catch(() => {});
    load();
    const timer = setInterval(load, 3000);
    const uptimeTimer = setInterval(() => setTick((tick) => tick + 1), 30_000);
    return () => {
      clearInterval(timer);
      clearInterval(uptimeTimer);
    };
  }, []);

  const desktop = (data?.sessions ?? []).find((session) => session.kind === 'desktop');
  const online = Boolean(desktop);
  const capabilities = desktop?.capabilities;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center px-3 border-b bg-white">
        <button onClick={onClose} className="text-neutral-600 text-sm pr-2">←</button>
        <div className="font-medium">连接器</div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card title="连接器">
          <Line
            label="状态"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                {online ? '在线' : '离线'}
              </span>
            }
          />
          <Line label="版本" value={capabilities?.bridgeVersion || '—'} />
          <Line label="运行时长" value={fmtUptime(capabilities?.bridgeStartedAt ?? 0)} last />
        </Card>

        {online && (
          <Card title="设备">
            <Line label="主机名" value={capabilities?.hostname || '—'} />
            <Line label="系统" value={capabilities?.os || '—'} last />
          </Card>
        )}

        {!online && (
          <section>
            <div className="rounded-2xl bg-white border p-5 space-y-3">
              <p className="text-sm text-neutral-600 leading-relaxed">
                连接器运行在你的电脑上，用来把云端会话交给本机 Codex。
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
