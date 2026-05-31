import { useEffect, useRef, useState } from 'react';
import { onFrame, sendWs } from '../../system/lib/ws';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import ConnectionGuide from '../../system/ConnectionGuide';
import { useConnectionStatus } from '../../system/useConnectionStatus';

interface Stat { platform?: string; cpu?: number; memUsed?: number; memTotal?: number; uptime?: number; load?: number[] }

export default function StatusApp(_: SystemAppProps) {
  const [s, setS] = useState<Stat | null>(null);
  const reqId = useRef('');
  const status = useConnectionStatus();

  useEffect(() => {
    const off = onFrame((m: any) => {
      if (m?.type === 'status.ok' && m.data?.reqId === reqId.current) setS(m.data);
    });
    const poll = () => { reqId.current = 'st' + Date.now(); sendWs({ type: 'status.get', to: 'client', data: { reqId: reqId.current } }); };
    if (status.computer) poll();
    const t = status.computer ? setInterval(poll, 3000) : undefined;
    return () => { if (t) clearInterval(t); off(); };
  }, [status.computer]);

  if (!status.computer || !s) return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="状态" />
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2">
        <ConnectionGuide kind="computer" connected={status.computer && !!s} className="min-h-[360px]" onRetry={() => location.reload()} />
        <ConnectionGuide kind="browser" connected={status.browser} className="min-h-[360px] border-t border-border lg:border-l lg:border-t-0" />
      </div>
    </main>
  );
  const memPct = s.memTotal ? Math.round((s.memUsed! / s.memTotal) * 100) : 0;
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="状态" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!status.browser && <ConnectionGuide kind="browser" className="min-h-[340px] border-b border-border" />}
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card k="平台" v={s.platform || '-'} />
          <Card k="CPU" v={(s.cpu ?? 0) + '%'} bar={s.cpu ?? 0} />
          <Card k="内存" v={`${gb(s.memUsed)} / ${gb(s.memTotal)} GB`} bar={memPct} />
          <Card k="运行" v={fmtUp(s.uptime)} />
          {s.load && <Card k="负载" v={s.load.map((x) => x.toFixed(2)).join('  ')} />}
        </div>
      </div>
    </main>
  );
}
function Card({ k, v, bar }: { k: string; v: string; bar?: number }) {
  return <div className="rounded-xl border border-border bg-card/70 p-4 backdrop-blur-sm">
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
    <div className="mt-1 break-all text-2xl font-bold text-foreground">{v}</div>
    {bar != null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><i className="block h-full bg-cyan shadow-glow-sm" style={{ width: Math.min(100, bar) + '%' }} /></div>}
  </div>;
}
const gb = (b?: number) => b ? (b / 1024 / 1024 / 1024).toFixed(1) : '0';
function fmtUp(s?: number) { if (!s) return '—'; const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return d ? `${d}天 ${h}时` : `${h}时`; }
