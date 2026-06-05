import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowUpDown, ChevronLeft, Copy, Folder, FileText, FolderPlus,
  Home, MoreVertical, Pencil, RefreshCw, Search, Trash2,
} from 'lucide-react';
import { onFrame, sendWs } from '../../system/lib/ws';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { Button } from '../../system/ui/button';
import { useSelectedDevice, DeviceSelect, DeviceGuide } from '../../system/useDevices';
import { cn } from '../../system/lib/utils';
import { fmtBytes, relTime, makeReqId } from '../../system/lib/fmt';

interface Item { name: string; path: string; isDir: boolean; size: number; mtime: number }
type SortBy = 'name' | 'size' | 'mtime';

export default function FilesApp(_: SystemAppProps) {
  const [cwd, setCwd] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [filter, setFilter] = useState('');
  const [searching, setSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortMenu, setSortMenu] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const pending = useRef<Map<string, (d: any) => void>>(new Map());
  const [device, setDevice, devices] = useSelectedDevice('computer');
  const online = !!devices.find((d) => d.id === device)?.online;

  function call(type: string, data: any = {}): Promise<any> {
    const reqId = makeReqId('r');
    return new Promise((resolve) => {
      pending.current.set(reqId, resolve);
      sendWs({ type, to: 'client', device, data: { reqId, ...data } });
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
    if (!online) return off;
    (async () => { const h = await call('fs.home'); if (h?.path) open(h.path); })();
    return off;
  }, [online, device]);

  async function open(path: string, hidden = showHidden) {
    const r = await call('fs.list', { path, showHidden: hidden });
    if (r?.ok) { setCwd(r.path || path); setItems(r.items || []); setPreview(null); setMenuFor(null); }
  }
  const refresh = () => open(cwd);
  async function read(it: Item) {
    const r = await call('fs.read', { path: it.path });
    if (r?.ok) setPreview({ name: it.name, content: r.content ?? '' });
  }
  function up() { const p = cwd.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || '/'; open(p); }
  async function goHome() { const h = await call('fs.home'); if (h?.path) open(h.path); }
  async function mkdir() {
    const name = prompt('新建文件夹名称')?.trim();
    if (!name) return;
    const r = await call('fs.mkdir', { path: join(cwd, name) });
    if (r?.ok) refresh();
  }
  async function rename(it: Item) {
    setMenuFor(null);
    const name = prompt('重命名', it.name)?.trim();
    if (!name || name === it.name) return;
    const r = await call('fs.rename', { from: it.path, to: join(cwd, name) });
    if (r?.ok) refresh();
  }
  async function del(it: Item) {
    setMenuFor(null);
    if (!confirm(`删除「${it.name}」?${it.isDir ? '(含其内容)' : ''}`)) return;
    const r = await call('fs.delete', { path: it.path, recursive: it.isDir });
    if (r?.ok) refresh();
  }
  function toggleHidden() { const next = !showHidden; setShowHidden(next); open(cwd, next); }
  function toggleSort(by: SortBy) {
    if (by === sortBy) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(by); setSortDir('asc'); }
    setSortMenu(false);
  }

  const crumbs = useMemo(() => buildCrumbs(cwd), [cwd]);
  const view = useMemo(() => {
    let list = items;
    if (filter.trim()) { const q = filter.toLowerCase(); list = list.filter((i) => i.name.toLowerCase().includes(q)); }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;   // 目录永远在前
      if (sortBy === 'size') return (a.size - b.size) * dir;
      if (sortBy === 'mtime') return (a.mtime - b.mtime) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [items, filter, sortBy, sortDir]);

  if (!online) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="文件" left={devices.length ? <DeviceSelect value={device} onChange={setDevice} devices={devices} /> : undefined} />
        <DeviceGuide devices={devices} selected={device} kind="computer" />
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="文件" left={<DeviceSelect value={device} onChange={setDevice} devices={devices} />} />
      <div className="flex h-full min-h-0 flex-col">
        {/* 工具栏 */}
        <div className="shrink-0 border-b border-border">
          <div className="flex flex-wrap items-center gap-1 px-3 py-2">
            <TBtn onClick={() => setSearching((v) => !v)} active={searching || !!filter} title="搜索"><Search /></TBtn>
            <TBtn onClick={refresh} title="刷新"><RefreshCw /></TBtn>
            <div className="relative">
              <TBtn onClick={() => setSortMenu((v) => !v)} active={sortMenu} title="排序"><ArrowUpDown /></TBtn>
              {sortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortMenu(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-popover py-1 shadow-xl">
                    {([['name', '名称'], ['size', '大小'], ['mtime', '修改时间']] as [SortBy, string][]).map(([by, label]) => (
                      <button key={by} onClick={() => toggleSort(by)}
                        className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-card', sortBy === by ? 'text-cyan' : 'text-foreground')}>
                        <span>{label}</span>{sortBy === by && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <TBtn onClick={toggleHidden} active={showHidden} title="显示/隐藏 dot 文件"><span className="font-mono text-[11px]">.*</span></TBtn>
            <div className="mx-1 h-5 w-px bg-border" />
            <TBtn onClick={mkdir} title="新建文件夹"><FolderPlus /></TBtn>
            <TBtn onClick={() => navigator.clipboard?.writeText(cwd)} title="复制当前路径"><Copy /></TBtn>
          </div>

          {searching && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="在当前目录内搜索…"
                className="h-8 flex-1 rounded-md border border-border bg-card/50 px-2 text-xs text-foreground outline-none focus-visible:border-cyan" />
              {filter && <button onClick={() => setFilter('')} className="text-xs text-muted-foreground hover:text-foreground">✕</button>}
            </div>
          )}

          {/* 面包屑 */}
          <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 border-t border-border px-3 py-2">
            <SBtn onClick={up} title="上一级"><ChevronLeft /></SBtn>
            <SBtn onClick={goHome} title="主目录"><Home /></SBtn>
            <div className="mx-1 h-4 w-px bg-border" />
            {crumbs.map((c, i) => (
              <span key={c.path} className="flex items-center gap-0.5">
                <button onClick={() => open(c.path)} className="whitespace-nowrap rounded px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-card">{c.label}</button>
                {i < crumbs.length - 1 && c.label !== '/' && <span className="text-xs text-muted-foreground/50">/</span>}
              </span>
            ))}
          </div>
        </div>

        {/* 主区 */}
        {preview ? (
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <b className="truncate">{preview.name}</b>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>关闭</Button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-[#0f1117] p-4 font-mono text-xs leading-6 text-[#e6e9f0]">{preview.content}</pre>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view.map((it) => (
              <div key={it.path} className="group flex items-center gap-3 border-b border-border/50 px-3 py-2.5 transition-colors hover:bg-card">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (it.isDir ? open(it.path) : read(it))}>
                  {it.isDir ? <Folder className="size-[18px] shrink-0 text-lime" /> : <FileText className="size-[18px] shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.name}</span>
                  {!it.isDir && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtBytes(it.size)}</span>}
                  <span className="hidden w-20 shrink-0 text-right text-[11px] text-muted-foreground/70 sm:block">{relTime(it.mtime)}</span>
                </button>
                <div className="relative">
                  <button onClick={() => setMenuFor(menuFor === it.path ? null : it.path)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><MoreVertical className="size-4" /></button>
                  {menuFor === it.path && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-border bg-popover py-1 shadow-xl">
                        <button onClick={() => rename(it)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-card"><Pencil className="size-3.5" />重命名</button>
                        <button onClick={() => del(it)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-card"><Trash2 className="size-3.5" />删除</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {view.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">{filter ? `没有匹配「${filter}」的文件` : '(空目录)'}</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={cn('grid size-9 place-items-center rounded-lg border border-border bg-card/50 text-muted-foreground transition-colors hover:border-cyan hover:text-cyan [&_svg]:size-4',
        active && 'border-cyan text-cyan')}>{children}</button>
  );
}
function SBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground [&_svg]:size-3.5">{children}</button>
  );
}

function join(dir: string, name: string) { return (dir.replace(/\/+$/, '') || '') + '/' + name; }

function buildCrumbs(path: string): { label: string; path: string }[] {
  if (!path) return [];
  const parts = path.split('/').filter(Boolean);
  const out = [{ label: '/', path: '/' }];
  let acc = '';
  for (const p of parts) { acc += '/' + p; out.push({ label: p, path: acc }); }
  return out;
}

