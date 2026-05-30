import { useEffect, useState } from 'react';
import { Button } from '../../system/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../system/ui/sheet';
import type { FsItem } from './types';
import { joinPath } from './utils';

interface NewTerminalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentDirs: string[];
  fsCall: (type: string, data?: Record<string, unknown>) => Promise<any>;
  onCreate: (cwd: string) => void;
}

export default function NewTerminalSheet({ open, onOpenChange, recentDirs, fsCall, onCreate }: NewTerminalSheetProps) {
  const [cwd, setCwd] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [home, setHome] = useState('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const sep = cwd.includes('\\') || home.includes('\\') ? '\\' : '/';

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const h = await fsCall('fs.home');
      const homePath = h?.path || '';
      setHome(homePath);
      const desktop = homePath ? joinPath(homePath, 'Desktop', homePath.includes('\\') ? '\\' : '/') : '';
      const ok = await openDir(desktop || recentDirs[0] || homePath, false);
      if (!ok && homePath) await openDir(homePath, false);
      setLoading(false);
    })();
  }, [open]);

  async function openDir(path: string, spin = true) {
    const target = path.trim();
    if (!target) return false;
    if (spin) setLoading(true);
    setMessage('');
    const res = await fsCall('fs.list', { path: target, showHidden: false });
    if (spin) setLoading(false);
    if (!res?.ok) { setMessage(res?.error || '目录读取失败'); return false; }
    setCwd(res.path || target);
    setPathInput(res.path || target);
    setItems((res.items || []).filter((item: FsItem) => item.isDir));
    return true;
  }

  function parent(dir: string) {
    const value = dir.replace(/[\\/]+$/, '');
    const idx = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));
    if (idx <= 0) return sep === '\\' ? value.slice(0, 3) : '/';
    return value.slice(0, idx);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[86vh] max-w-3xl flex-col overflow-hidden rounded-t-xl p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>新建终端</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {recentDirs.length ? (
            <section className="space-y-2">
              <div className="text-[11px] font-bold uppercase text-muted-foreground">最近目录</div>
              <div className="flex flex-wrap gap-2">
                {recentDirs.map((dir) => <Button key={dir} variant="outline" size="sm" className="max-w-full truncate" onClick={() => void openDir(dir)}>{dir}</Button>)}
              </div>
            </section>
          ) : null}
          <section className="space-y-2">
            <div className="text-[11px] font-bold uppercase text-muted-foreground">启动目录</div>
            <div className="flex gap-2">
              <input value={pathInput} onChange={(event) => setPathInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void openDir(pathInput); }} className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <Button variant="outline" onClick={() => void openDir(pathInput)}>前往</Button>
            </div>
            {message ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</div> : null}
          </section>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void openDir(parent(cwd))}>上级</Button>
              <Button variant="outline" size="sm" onClick={() => void openDir(home)}>Home</Button>
              <Button variant="outline" size="sm" onClick={() => void openDir(joinPath(home, 'Desktop', sep))}>Desktop</Button>
              <span className="truncate font-mono text-xs text-muted-foreground">{cwd || '未选择目录'}</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border bg-secondary">
              {loading ? <div className="py-10 text-center text-sm text-muted-foreground">目录读取中...</div> : null}
              {!loading && !items.length ? <div className="py-10 text-center text-sm text-muted-foreground">当前目录没有可进入的子目录</div> : null}
              {items.map((item) => (
                <button key={item.path} className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-background" onClick={() => void openDir(item.path)}>
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">进入</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => onCreate(pathInput || cwd)}>新建终端</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
