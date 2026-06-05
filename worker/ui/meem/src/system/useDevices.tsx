import { useEffect, useState } from 'react';
import { ChevronDown, Globe, Monitor } from 'lucide-react';
import { api, type Device } from './lib/api';
import { useConnectionStatus } from './useConnectionStatus';
import { onDevicesChanged } from './lib/deviceBus';
import { useNav } from './nav';
import { Button } from './ui/button';
import { cn } from './lib/utils';

export interface DeviceWithStatus extends Device { online: boolean }

/** 设备列表(REST)+ 实时在线态(WS)合并 · 增删改后自动刷新 */
export function useDeviceList(kind?: 'computer' | 'browser'): DeviceWithStatus[] {
  const conn = useConnectionStatus();
  const [devices, setDevices] = useState<Device[]>([]);
  const [ver, setVer] = useState(0);
  useEffect(() => onDevicesChanged(() => setVer((v) => v + 1)), []);
  useEffect(() => { api.devices().then((d) => setDevices(d.devices)).catch(() => {}); }, [conn.online.length, ver]);
  const onlineIds = new Set(conn.online.map((o) => o.id));
  return devices.filter((d) => !kind || d.kind === kind).map((d) => ({ ...d, online: onlineIds.has(d.id) }));
}

const selKey = (kind: string) => `meem_device_${kind}`;

/** 选中的设备(按 kind 持久化;失效时自动落到第一台在线设备) */
export function useSelectedDevice(kind: 'computer' | 'browser'): [string, (id: string) => void, DeviceWithStatus[]] {
  const list = useDeviceList(kind);
  const [sel, setSel] = useState<string>(() => localStorage.getItem(selKey(kind)) || '');
  useEffect(() => {
    const valid = list.find((d) => d.id === sel);
    if (!valid) {
      const next = list.find((d) => d.online)?.id || list[0]?.id || '';
      if (next !== sel) setSel(next);
    }
  }, [list.map((d) => d.id + (d.online ? '1' : '0')).join(','), sel]);
  const set = (id: string) => { setSel(id); localStorage.setItem(selKey(kind), id); };
  return [sel, set, list];
}

/** 没有设备 / 设备离线时的占位引导 */
export function DeviceGuide({ devices, selected, kind }: { devices: DeviceWithStatus[]; selected: string; kind: 'computer' | 'browser' }) {
  const { openDevice } = useNav();
  const dev = devices.find((d) => d.id === selected);
  const noDevice = !devices.length;
  const label = kind === 'browser' ? '浏览器' : '电脑';
  const Icon = kind === 'browser' ? Globe : Monitor;
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm">
        <Icon className="mx-auto size-8 text-muted-foreground" />
        <div className="mt-3 text-base font-bold text-foreground">{noDevice ? `还没有${label}设备` : `设备「${dev?.name || '未命名'}」离线`}</div>
        <div className="mt-1.5 text-sm text-muted-foreground">
          {noDevice ? `去「设备」添加一台${label},拿到配置后在该设备上启动 ${kind === 'browser' ? '扩展' : 'client'} 即可连接。` : `在该设备上启动 ${kind === 'browser' ? '扩展' : 'client'},或在右上角切换到其它在线设备。`}
        </div>
        <Button className="mt-4" variant="outline" onClick={() => openDevice(devices.length ? selected : undefined)}>{noDevice ? '添加设备' : '设备详情'}</Button>
      </div>
    </div>
  );
}

/** 顶栏设备选择下拉 */
export function DeviceSelect({ value, onChange, devices }: { value: string; onChange: (id: string) => void; devices: DeviceWithStatus[] }) {
  const [open, setOpen] = useState(false);
  const cur = devices.find((d) => d.id === value);
  if (!devices.length) return null;
  const Icon = cur?.kind === 'browser' ? Globe : Monitor;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn('flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-2.5 py-1 text-xs transition-colors hover:border-cyan',
          open && 'border-cyan')}
      >
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="max-w-[10rem] truncate text-foreground">{cur?.name || '选择设备'}</span>
        <span className={cn('size-1.5 rounded-full', cur?.online ? 'bg-lime shadow-[0_0_6px_hsl(var(--lime))]' : 'bg-muted-foreground/40')} />
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover py-1 shadow-xl">
            {devices.map((d) => (
              <button key={d.id} onClick={() => { onChange(d.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-card', d.id === value && 'text-cyan')}>
                <span className={cn('size-1.5 shrink-0 rounded-full', d.online ? 'bg-lime' : 'bg-muted-foreground/40')} />
                <span className="min-w-0 flex-1 truncate text-foreground">{d.name || '未命名'}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{d.online ? '在线' : '离线'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
