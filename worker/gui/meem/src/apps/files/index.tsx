import { useEffect, useRef, useState } from 'react';
import { onFrame, sendWs } from '../../system/lib/ws';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { Button } from '../../system/ui/button';
import ConnectionGuide from '../../system/ConnectionGuide';
import { useConnectionStatus } from '../../system/useConnectionStatus';

interface Item { name: string; path: string; isDir: boolean; size: number; mtime: number }

let seq = 0;
const nextReq = () => 'r' + (++seq) + '_' + Date.now();

export default function FilesApp(_: SystemAppProps) {
  const [cwd, setCwd] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const pending = useRef<Map<string, (d: any) => void>>(new Map());
  const status = useConnectionStatus();

  function call(type: string, data: any = {}): Promise<any> {
    const reqId = nextReq();
    return new Promise((resolve) => {
      pending.current.set(reqId, resolve);
      sendWs({ type, to: 'client', data: { reqId, ...data } });
      setTimeout(() => { if (pending.current.delete(reqId)) resolve(null); }, 15000);
    });
  }

  useEffect(() => {
    const off = onFrame((m: any) => {
      const ty: string = m?.type || '';
      if (!ty.startsWith('fs.')) return;
      const d = m.data || {};
      const cb = d.reqId && pending.current.get(d.reqId);
      if (cb) { pending.current.delete(d.reqId); cb({ ok: ty.endsWith('.ok'), ...d }); }
    });
    if (!status.computer) return off;
    (async () => {
      const h = await call('fs.home');
      if (h?.path) open(h.path);
    })();
    return off;
  }, [status.computer]);

  async function open(path: string) {
    const r = await call('fs.list', { path, showHidden: false });
    if (r?.ok) { setCwd(r.path || path); setItems(r.items || []); setPreview(null); }
  }
  async function read(it: Item) {
    const r = await call('fs.read', { path: it.path });
    if (r?.ok) setPreview({ name: it.name, content: r.content ?? '' });
  }
  function up() { const p = cwd.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || '/'; open(p); }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="文件" />
      <div className="min-h-0 flex-1 overflow-hidden">
        {!status.computer ? <ConnectionGuide kind="computer" className="h-full" onRetry={() => location.reload()} /> : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <Button variant="outline" size="sm" onClick={up}>上级</Button>
            <span className="truncate font-mono text-xs text-muted-foreground">{cwd || '...'}</span>
          </div>
          {preview ? (
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <b className="truncate">{preview.name}</b>
                <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>关闭</Button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-[#0f1117] p-4 font-mono text-xs leading-6 text-[#e6e9f0]">{preview.content}</pre>
            </div>
          ) : (
            <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-3">
              {items.map((it) => (
                <button key={it.path} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted" onClick={() => (it.isDir ? open(it.path) : read(it))}>
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-muted-foreground stroke-[1.7]">{it.isDir
                    ? <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    : <><path d="M14 3v5h5" /><path d="M5 3h9l5 5v13H5z" /></>}</svg>
                  <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
                  <span className="text-xs text-muted-foreground">{it.isDir ? '' : fmtSize(it.size)}</span>
                </button>
              ))}
              {items.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">当前目录为空</div>}
            </div>
          )}
        </div>
        )}
      </div>
    </main>
  );
}

function fmtSize(n: number) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
