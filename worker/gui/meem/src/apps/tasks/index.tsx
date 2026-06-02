import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronLeft, ListChecks, Plus, Trash2 } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api, type TaskItem } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { Input } from '../../system/ui/input';
import { cn } from '../../system/lib/utils';

type Status = 'todo' | 'doing' | 'done';
type Priority = 'low' | 'medium' | 'high';

const STATUSES: { id: Status | ''; label: string }[] = [
  { id: '', label: '全部' },
  { id: 'todo', label: '待办' },
  { id: 'doing', label: '进行中' },
  { id: 'done', label: '已完成' },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
];

const blank = (): Partial<TaskItem> => ({ title: '', description: '', status: 'todo', priority: 'medium' });

export default function TasksApp(_: SystemAppProps) {
  const [filter, setFilter] = useState<Status | ''>('');
  const [items, setItems] = useState<TaskItem[]>([]);
  const [editing, setEditing] = useState<Partial<TaskItem> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.taskList(filter || undefined).then((d) => setItems(d.items)).catch(() => {});
  useEffect(() => { load(); }, [filter]);

  async function save() {
    if (!editing || !editing.title?.trim()) return;
    setBusy(true);
    try {
      const payload = { title: editing.title, description: editing.description, status: editing.status, priority: editing.priority };
      if (editing.id) await api.taskUpdate(editing.id, payload);
      else await api.taskCreate(payload);
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    await api.taskDelete(id);
    if (editing?.id === id) setEditing(null);
    await load();
  }

  const statusLabel = (s?: string) => STATUSES.find((x) => x.id === s)?.label || s;
  const priorityLabel = (p?: string) => PRIORITIES.find((x) => x.id === p)?.label || p;

  // ───────── 编辑页(下钻 · 全宽 · 面包屑返回) ─────────
  if (editing) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="任务" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <nav className="flex items-center gap-1 text-sm">
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft className="size-4" />任务</button>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-foreground">{editing.id ? '编辑' : '新建'}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy || !editing.title?.trim()}><Check />{busy ? '保存中' : '保存'}</Button>
            {editing.id && <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => remove(editing.id!)}><Trash2 /></Button>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-6 md:px-8">
            <Field label="标题"><Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="任务标题" /></Field>
            <Field label="描述">
              <textarea
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={6}
                placeholder="任务描述(可选)…"
                className="w-full resize-y rounded-lg border border-input bg-card/50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-cyan focus-visible:shadow-glow-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="状态">
                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter((s) => s.id).map((s) => (
                    <Toggle key={s.id} on={editing.status === s.id} onClick={() => setEditing({ ...editing, status: s.id as Status })}>
                      <span className={cn('size-2 rounded-full', statusDot(s.id as Status))} />{s.label}
                    </Toggle>
                  ))}
                </div>
              </Field>
              <Field label="优先级">
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <Toggle key={p.id} on={editing.priority === p.id} onClick={() => setEditing({ ...editing, priority: p.id })}>
                      {p.label}
                    </Toggle>
                  ))}
                </div>
              </Field>
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
        title="任务"
        left={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card/50 p-0.5">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className={cn('rounded-md px-3 py-1 text-xs transition-colors', filter === s.id ? 'bg-cyan/10 text-cyan' : 'text-muted-foreground hover:text-foreground')}
              >{s.label}</button>
            ))}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">任务</h1>
            <Button size="sm" onClick={() => setEditing(blank())}><Plus />新建</Button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setEditing(it)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-left transition-all hover:border-cyan/60',
                  it.status === 'done' && 'opacity-60',
                )}
              >
                <div className={cn('mt-0.5 size-4 shrink-0 rounded-full border-2', statusDot(it.status))} />
                <div className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm font-medium', it.status === 'done' && 'text-muted-foreground line-through')}>{it.title || '(无标题)'}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px]', priorityBadge(it.priority))}>{priorityLabel(it.priority)}</span>
                    <span className="text-[10px] text-muted-foreground">{statusLabel(it.status)}</span>
                  </div>
                  {it.description ? <div className="mt-1 truncate text-xs text-muted-foreground">{it.description}</div> : null}
                </div>
              </button>
            ))}
            {items.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">还没有任务,点「新建」开始。</div>}
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

function statusDot(status?: string) {
  switch (status) {
    case 'done': return 'bg-lime border-lime';
    case 'doing': return 'bg-cyan border-cyan';
    default: return 'border-muted-foreground';
  }
}

function priorityBadge(priority?: string) {
  switch (priority) {
    case 'high': return 'bg-red-400/10 text-red-400';
    case 'low': return 'bg-muted text-muted-foreground';
    default: return 'bg-amber/10 text-amber';
  }
}
