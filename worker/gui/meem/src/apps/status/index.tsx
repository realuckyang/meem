import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onFrame, sendWs } from '../../system/lib/ws';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { useSelectedDevice, DeviceSelect, DeviceGuide } from '../../system/useDevices';
import { cn } from '../../system/lib/utils';
import { fmtBytes, makeReqId } from '../../system/lib/fmt';

interface Host { hostname: string; platform: string; release: string; arch: string; uptime: number }
interface Cpu { count: number; model: string; speed: number; usagePercent: number; loadavg: number[] }
interface Mem { total: number; free: number; used: number; percent: number }
interface Disk { mount: string; total: number; used: number; free: number; percent: number }
interface Net { name: string; address: string; mac?: string }
interface Stat { host?: Host; cpu?: Cpu; mem?: Mem; disk?: Disk | null; network?: Net[]; capturedAt?: number }

export default function StatusApp(_: SystemAppProps) {
  const [s, setS] = useState<Stat | null>(null);
  const reqId = useRef('');
  const [device, setDevice, devices] = useSelectedDevice('computer');
  const online = !!devices.find((d) => d.id === device)?.online;

  useEffect(() => {
    setS(null);
    const off = onFrame((m: any) => {
      if (m?.type === 'status.ok' && m.data?.reqId === reqId.current) setS(m.data);
    });
    const poll = () => { reqId.current = makeReqId('st'); sendWs({ type: 'status.get', to: 'client', device, data: { reqId: reqId.current } }); };
    if (online) poll();
    const t = online ? setInterval(poll, 5000) : undefined;
    return () => { if (t) clearInterval(t); off(); };
  }, [online, device]);

  if (!online || !s?.host) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="状态" left={devices.length ? <DeviceSelect value={device} onChange={setDevice} devices={devices} /> : undefined} />
        {online ? <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted-foreground">正在读取设备状态…</div> : <DeviceGuide devices={devices} selected={device} kind="computer" />}
      </main>
    );
  }

  const { host, cpu, mem, disk, network } = s;
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="状态" left={<DeviceSelect value={device} onChange={setDevice} devices={devices} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-6 md:px-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono text-cyan">{host.hostname}</span>
            <span>每 5 秒自动刷新 · {s.capturedAt ? new Date(s.capturedAt).toLocaleTimeString() : ''}</span>
          </div>

          {/* 主机 */}
          <Card title="主机">
            <Row k="系统" v={`${host.platform} ${host.release}`} />
            <Row k="架构" v={host.arch} />
            <Row k="运行时长" v={fmtUptime(host.uptime)} />
          </Card>

          {/* CPU */}
          {cpu && (
            <Card title="CPU" pct={cpu.usagePercent}>
              <Row k="核心" v={String(cpu.count)} />
              <Row k="型号" v={cpu.model || '—'} />
              <Row k="主频" v={cpu.speed ? (cpu.speed / 1000).toFixed(2) + ' GHz' : '—'} />
              <Row k="负载 1/5/15" v={cpu.loadavg.map((n) => n.toFixed(2)).join(' / ')} mono />
            </Card>
          )}

          {/* 内存 */}
          {mem && (
            <Card title="内存" pct={mem.percent}>
              <Row k="已用 / 总量" v={`${fmtBytes(mem.used)} / ${fmtBytes(mem.total)}`} mono />
              <Row k="空闲" v={fmtBytes(mem.free)} mono />
            </Card>
          )}

          {/* 磁盘 */}
          {disk && (
            <Card title={`磁盘 (${disk.mount})`} pct={disk.percent}>
              <Row k="已用 / 总量" v={`${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}`} mono />
              <Row k="可用" v={fmtBytes(disk.free)} mono />
            </Card>
          )}

          {/* 网络 */}
          {network && network.length > 0 && (
            <Card title="网络">
              {network.map((n) => (
                <div key={n.name + n.address} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className="shrink-0 text-muted-foreground">{n.name}</span>
                  <span className="truncate font-mono text-foreground">{n.address}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function Card({ title, pct, children }: { title: string; pct?: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {pct != null && <div className="font-mono text-2xl font-bold text-foreground">{pct}<span className="text-base text-muted-foreground"> %</span></div>}
      </div>
      {pct != null && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <i className={cn('block h-full transition-all', barColor(pct))} style={{ width: Math.min(100, pct) + '%' }} />
        </div>
      )}
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className={cn('truncate text-right text-foreground', mono && 'font-mono')}>{v}</span>
    </div>
  );
}

function barColor(p: number) {
  if (p < 60) return 'bg-lime shadow-[0_0_6px_hsl(var(--lime))]';
  if (p < 85) return 'bg-amber shadow-[0_0_6px_hsl(var(--amber))]';
  return 'bg-red-500';
}

function fmtUptime(sec?: number) {
  if (!Number.isFinite(sec) || (sec ?? 0) <= 0) return '—';
  const dd = Math.floor(sec! / 86400), h = Math.floor((sec! % 86400) / 3600), m = Math.floor((sec! % 3600) / 60);
  const parts: string[] = [];
  if (dd) parts.push(`${dd}天`);
  if (h) parts.push(`${h}小时`);
  if (m || (!dd && !h)) parts.push(`${m}分钟`);
  return parts.join(' ');
}
