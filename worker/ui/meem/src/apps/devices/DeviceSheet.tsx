import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Ban, Check, Copy, Globe, Monitor, Power, Trash2 } from 'lucide-react';
import { api, type Device } from '../../system/lib/api';
import { notifyDevicesChanged } from '../../system/lib/deviceBus';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../system/ui/sheet';
import { Button } from '../../system/ui/button';
import { Input } from '../../system/ui/input';
import { cn } from '../../system/lib/utils';

type Kind = 'computer' | 'browser';
type Draft = Partial<Device>;

/** 设备详情/新建弹层 · target = 设备 id | 'new' | null(关闭) */
export default function DeviceSheet({ target, onClose }: { target: string | 'new' | null; onClose: () => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<{ baseUrl: string; wsUrl: string }>({ baseUrl: '', wsUrl: '' });

  useEffect(() => {
    if (!target) { setD(null); return; }
    if (target === 'new') { setD({ kind: 'computer', name: '', description: '' }); return; }
    api.devices().then((r) => setD(r.devices.find((x) => x.id === target) || null)).catch(() => setD(null));
  }, [target]);
  useEffect(() => { api.installConfig().then((c) => setUrls({ baseUrl: c.baseUrl, wsUrl: c.wsUrl })).catch(() => {}); }, []);

  const isNew = !d?.id;
  const kind = (d?.kind as Kind) || 'computer';

  async function save() {
    if (!d || !d.name?.trim()) return;
    setBusy(true);
    try {
      if (d.id) { await api.deviceUpdate(d.id, { name: d.name, description: d.description }); notifyDevicesChanged(); onClose(); }
      else { const r = await api.deviceCreate({ kind, name: d.name!, description: d.description }); notifyDevicesChanged(); setD({ ...r.device }); }
    } finally { setBusy(false); }
  }
  async function remove() {
    if (!d?.id || !confirm('删除这个设备?该设备将无法再连接。')) return;
    await api.deviceDelete(d.id); notifyDevicesChanged(); onClose();
  }
  async function toggleDisabled() {
    if (!d?.id) return;
    const next = d.status === 'disabled' ? 'active' : 'disabled';
    await api.deviceUpdate(d.id, { status: next });
    setD({ ...d, status: next }); notifyDevicesChanged();
  }

  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-[400px] max-w-[92vw] flex-col gap-0 p-0">
        <SheetHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            {kind === 'browser' ? <Globe className="size-4 text-cyan" /> : <Monitor className="size-4 text-cyan" />}
            {isNew ? '添加设备' : (d?.name || '设备')}
          </SheetTitle>
          {d?.id && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={toggleDisabled} title={d.status === 'disabled' ? '启用' : '禁用'}
                className={cn('grid size-8 place-items-center rounded-md border border-border transition-colors hover:bg-card',
                  d.status === 'disabled' ? 'text-lime' : 'text-muted-foreground hover:text-amber')}>
                {d.status === 'disabled' ? <Power className="size-4" /> : <Ban className="size-4" />}
              </button>
              <button onClick={remove} title="删除" className="grid size-8 place-items-center rounded-md border border-border text-red-400 transition-colors hover:bg-card hover:text-red-300"><Trash2 className="size-4" /></button>
            </div>
          )}
        </SheetHeader>

        {d && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {d.status === 'disabled' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber"><Ban className="size-4" />已禁用,无法连接。点右上角图标启用。</div>
            )}
            <Field label="类型">
              {isNew ? (
                <div className="flex gap-2">
                  {(['computer', 'browser'] as Kind[]).map((k) => (
                    <button key={k} onClick={() => setD({ ...d, kind: k })}
                      className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all',
                        kind === k ? 'border-cyan bg-cyan/10 text-cyan shadow-glow-sm' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {k === 'browser' ? <Globe className="size-4" /> : <Monitor className="size-4" />}{k === 'browser' ? '浏览器' : '电脑'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 text-sm text-foreground">{kind === 'browser' ? <Globe className="size-4" /> : <Monitor className="size-4" />}{kind === 'browser' ? '浏览器' : '电脑'}</div>
              )}
            </Field>
            <Field label="名称"><Input value={d.name || ''} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="例如:我的 MacBook" /></Field>
            <Field label="描述(AI 会读到,用来区分设备)">
              <textarea value={d.description || ''} onChange={(e) => setD({ ...d, description: e.target.value })} rows={3}
                placeholder="例如:家里的开发机,放着所有项目代码" className="w-full resize-y rounded-lg border border-input bg-card/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm" />
            </Field>

            {d.id && d.token && (
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">连接配置</div>
                <p className="mb-3 text-xs text-muted-foreground">把下面内容填进{kind === 'browser' ? '扩展 popup' : 'client 的 config.js'},该端即作为本设备连接。</p>
                <ConfigBlock text={configText(kind, d.token, urls)} />
              </div>
            )}

            <div className="pt-1">
              <Button onClick={save} disabled={busy || !d.name?.trim()}><Check />{busy ? '保存中' : isNew ? '创建' : '保存'}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function configText(kind: Kind, token: string, urls: { baseUrl: string; wsUrl: string }) {
  if (kind === 'browser') return `打开扩展 popup,填入:\nWebSocket: ${urls.wsUrl}\n令牌 TOKEN: ${token}`;
  return `// client/config.js\nexport const BASE_URL = '${urls.baseUrl}';\nexport const WS_URL   = '${urls.wsUrl}';\nexport const TOKEN    = '${token}';`;
}

function ConfigBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-[11px] leading-5 text-foreground">{text}</pre>
      <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground hover:text-cyan">
        <Copy className="size-3" />{copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
