import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronLeft, Pin, Plus, Trash2 } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api, type ContentItem } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { Input } from '../../system/ui/input';
import { cn } from '../../system/lib/utils';

type Kind = 'dynamic' | 'article' | 'project';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'dynamic', label: '动态' },
  { id: 'article', label: '文章' },
  { id: 'project', label: '项目' },
];

const blank = (kind: Kind): Partial<ContentItem> => ({ kind, title: '', body: '', url: '', tags: '', status: 'published', pinned: 0 });

export default function ContentApp(_: SystemAppProps) {
  const [kind, setKind] = useState<Kind>('dynamic');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [editing, setEditing] = useState<Partial<ContentItem> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.contentList(kind).then((d) => setItems(d.items)).catch(() => {});
  useEffect(() => { load(); }, [kind]);

  async function save() {
    if (!editing || !editing.title?.trim()) return;
    setBusy(true);
    try {
      const payload = { kind: editing.kind || kind, title: editing.title, body: editing.body, url: editing.url, tags: editing.tags, status: editing.status, pinned: editing.pinned };
      if (editing.id) await api.contentUpdate(editing.id, payload);
      else await api.contentCreate(payload);
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    await api.contentDelete(id);
    if (editing?.id === id) setEditing(null);
    await load();
  }

  const kindLabel = (k?: string) => KINDS.find((x) => x.id === k)?.label;

  // ───────── 编辑页(下钻 · 全宽 · 面包屑返回) ─────────
  if (editing) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="内容" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft className="size-4" />内容</button>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground">{editing.id ? '编辑' : '新建'} · {kindLabel(editing.kind || kind)}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy || !editing.title?.trim()}><Check />{busy ? '保存中' : '保存'}</Button>
            {editing.id && <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => remove(editing.id!)}><Trash2 /></Button>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-6 md:px-8">
            <Field label="标题"><Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="标题" /></Field>
            <Field label={editing.kind === 'project' ? '简介' : '正文(支持 Markdown)'}>
              <textarea
                value={editing.body || ''}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={editing.kind === 'dynamic' ? 5 : 14}
                placeholder={editing.kind === 'dynamic' ? '此刻在想什么…' : '内容…'}
                className="w-full resize-y rounded-lg border border-input bg-card/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm"
              />
            </Field>
            {editing.kind !== 'dynamic' && (
              <Field label="链接(可选)"><Input value={editing.url || ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" /></Field>
            )}
            <Field label="标签(逗号分隔,可选)"><Input value={editing.tags || ''} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="AI, 工具" /></Field>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Toggle on={editing.status === 'published'} onClick={() => setEditing({ ...editing, status: editing.status === 'published' ? 'draft' : 'published' })}>
                {editing.status === 'published' ? '已发布' : '草稿'}
              </Toggle>
              <Toggle on={!!editing.pinned} onClick={() => setEditing({ ...editing, pinned: editing.pinned ? 0 : 1 })}>
                <Pin className="size-3.5" />置顶
              </Toggle>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ───────── 列表(全宽单列) ─────────
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar
        title="内容"
        left={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/50 p-0.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={cn('rounded-md px-3 py-1 text-xs transition-colors', kind === k.id ? 'bg-cyan/10 text-cyan' : 'text-muted-foreground hover:text-foreground')}
              >{k.label}</button>
            ))}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">{kindLabel(kind)}</h1>
            <Button size="sm" onClick={() => setEditing(blank(kind))}><Plus />新建</Button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setEditing(it)}
                className="flex w-full items-start gap-2 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-all hover:border-cyan/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {it.pinned ? <Pin className="size-3 text-amber" /> : null}
                    <span className="truncate text-sm font-medium">{it.title || '(无标题)'}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{it.body || it.url || '—'}</div>
                </div>
                <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px]', it.status === 'published' ? 'bg-lime/10 text-lime' : 'bg-muted text-muted-foreground')}>
                  {it.status === 'published' ? '已发布' : '草稿'}
                </span>
              </button>
            ))}
            {items.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">还没有{kindLabel(kind)},点「新建」开始。</div>}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all',
        on ? 'border-cyan bg-cyan/10 text-cyan shadow-glow-sm' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >{children}</button>
  );
}
