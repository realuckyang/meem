import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Pin, Search, Send, Trash2 } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api, type NoteItem } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { cn } from '../../system/lib/utils';

const fmt = (s: number) => {
  if (!s) return '';
  const d = new Date(s * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const preview = (n: Partial<NoteItem>) => (n.title?.trim() || n.body?.split('\n')[0]?.trim() || '(空笔记)');

export default function NotesApp(_: SystemAppProps) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<NoteItem[]>([]);
  const [editing, setEditing] = useState<Partial<NoteItem> | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftPin, setDraftPin] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = () => api.noteList(q || undefined).then((d) => setItems(d.items)).catch(() => {});
  useEffect(() => { if (!editing) { const t = setTimeout(load, 200); return () => clearTimeout(t); } }, [q, editing]);

  async function post() {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await api.noteCreate({ body: draft.trim(), pinned: draftPin ? 1 : 0 });
      setDraft(''); setDraftPin(false);
      await load();
    } finally { setPosting(false); }
  }

  async function save() {
    if (!editing) return;
    if (!editing.title?.trim() && !editing.body?.trim()) { setEditing(null); return; }
    setBusy(true);
    try {
      const payload = { title: editing.title, body: editing.body, pinned: editing.pinned };
      if (editing.id) await api.noteUpdate(editing.id, payload);
      else await api.noteCreate(payload);
      setEditing(null);
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm('删除这条笔记?')) return;
    await api.noteDelete(id);
    setEditing(null);
  }

  // ───────── 编辑器(单列全宽) ─────────
  if (editing) {
    const canSave = !!(editing.title?.trim() || editing.body?.trim());
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="随手记" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <button onClick={save} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />返回</button>
          <button
            onClick={() => setEditing({ ...editing, pinned: editing.pinned ? 0 : 1 })}
            className={cn('ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
              editing.pinned ? 'border-cyan bg-cyan/10 text-cyan shadow-glow-sm' : 'border-border text-muted-foreground hover:text-foreground')}
          ><Pin className={cn('size-3.5', editing.pinned && 'fill-cyan')} />置顶</button>
          <Button size="sm" onClick={save} disabled={busy || !canSave}><Check />{busy ? '保存中' : '保存'}</Button>
          {editing.id && <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => remove(editing.id!)}><Trash2 /></Button>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-6 md:px-8">
            <input
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="标题(可留空)"
              className="w-full bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
            />
            <textarea
              value={editing.body || ''}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } }}
              autoFocus
              rows={18}
              placeholder="随手记点什么…"
              className="w-full resize-none bg-transparent text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </main>
    );
  }

  // ───────── 列表(单列全宽) ─────────
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="随手记" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
          {/* flomo 式常驻输入框:打完即发 */}
          <div className="rounded-xl border border-border bg-card/60 p-3 transition-colors focus-within:border-cyan/60">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); post(); } }}
              rows={3}
              placeholder="此刻的想法…(⌘↵ 发布)"
              className="w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
              <button
                onClick={() => setDraftPin((v) => !v)}
                title="发布后置顶"
                className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
                  draftPin ? 'border-cyan bg-cyan/10 text-cyan shadow-glow-sm' : 'border-border text-muted-foreground hover:text-foreground')}
              ><Pin className={cn('size-3.5', draftPin && 'fill-cyan')} />置顶</button>
              <Button size="sm" onClick={post} disabled={!draft.trim() || posting}><Send />{posting ? '发布中' : '发布'}</Button>
            </div>
          </div>

          {(items.length > 0 || q) && (
            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索笔记…"
                className="h-9 w-full rounded-lg border border-border bg-card/40 pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm"
              />
            </div>
          )}

          <ul className="mt-4 flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => setEditing(it)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-all hover:border-cyan/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {it.pinned ? <Pin className="size-3 shrink-0 fill-cyan text-cyan" /> : null}
                      <span className="truncate text-sm font-medium text-foreground">{preview(it)}</span>
                    </div>
                    {it.body ? <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{it.body}</div> : null}
                    <div className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">{fmt(it.updated)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {q ? '没有匹配的笔记' : '还没有笔记,在上面写一笔吧。'}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
