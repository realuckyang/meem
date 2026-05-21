import { useEffect, useState } from 'react';
import { req } from '../../lib/api';
import SubHeader from '../../components/SubHeader';

interface Memory {
  id: string;
  title: string;
  summary: string;
  content: string;
  priority: 'must' | 'starred' | 'stored';
  created: number;
  updated: number;
}

const PRIORITIES: { key: Memory['priority']; label: string; emoji: string; desc: string }[] = [
  { key: 'must',    label: '必读', emoji: '⭐', desc: '每次对话都会注入到上下文' },
  { key: 'starred', label: '重点', emoji: '📌', desc: '可被搜索，重要场景下使用' },
  { key: 'stored',  label: '存档', emoji: '📦', desc: '安静放着，分身按需检索' },
];

export default function Memory() {
  const [list, setList] = useState<Memory[]>([]);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () => req<Memory[]>('/api/memories').then(setList).catch(() => {});

  useEffect(() => { load(); }, []);

  if (editing || creating) {
    return (
      <MemoryEditor
        initial={editing}
        onCancel={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(); }}
      />
    );
  }

  const grouped = PRIORITIES.map((p) => ({
    ...p,
    items: list.filter((m) => m.priority === p.key),
  }));

  return (
    <div className="flex flex-col h-full">
      <SubHeader title="自我更新" />
      <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100">
        <p className="text-[12.5px] text-amber-700 leading-relaxed">
          分身会在对话里主动用 <code className="bg-amber-100 px-1 rounded text-[11.5px]">memory_add / memory_edit / memory_delete</code> 维护这里的内容。
          你也可以手动添加和编辑。
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.map(({ key, label, emoji, desc, items }) => (
          <div key={key} className="px-4 pt-5">
            <div className="px-1 pb-2 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">{emoji} {label}</span>
                <span className="ml-2 text-[11px] text-neutral-400">{items.length}</span>
              </div>
              <span className="text-[11px] text-neutral-400">{desc}</span>
            </div>
            <div className="bg-white rounded-xl overflow-hidden">
              {items.length === 0 ? (
                <div className="px-4 py-3 text-sm text-neutral-400 text-center">无</div>
              ) : items.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setEditing(m)}
                  className={`w-full text-left px-4 py-3 active:bg-neutral-50 ${i < items.length - 1 ? 'border-b border-neutral-100' : ''}`}
                >
                  <div className="font-medium text-[14px] truncate">{m.title}</div>
                  {(m.summary || m.content) && (
                    <div className="text-[12.5px] text-neutral-500 mt-0.5 line-clamp-2">{m.summary || m.content}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="px-4 pt-6 pb-10">
          <button onClick={() => setCreating(true)} className="btn-primary">＋ 新增记忆</button>
        </div>
      </div>
    </div>
  );
}

function MemoryEditor({ initial, onCancel, onSaved }: { initial: Memory | null; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [priority, setPriority] = useState<Memory['priority']>(initial?.priority ?? 'stored');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await req(`/api/memories/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, content, priority }),
        });
      } else {
        await req('/api/memories', {
          method: 'POST',
          body: JSON.stringify({ title, content, priority }),
        });
      }
      onSaved();
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm('确认删除这条记忆？')) return;
    setSaving(true);
    try {
      await req(`/api/memories/${initial.id}`, { method: 'DELETE' });
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 flex items-center gap-2 px-3 bg-white/90 backdrop-blur border-b border-neutral-200 flex-shrink-0">
        <button onClick={onCancel} className="text-2xl text-accent px-1 leading-none">‹</button>
        <span className="text-[17px] font-semibold flex-1">{initial ? '编辑记忆' : '新增记忆'}</span>
        <button onClick={save} disabled={saving || !title.trim()} className="text-accent font-medium px-2 disabled:opacity-40">
          {saving ? '…' : '保存'}
        </button>
      </header>
      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">标题</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句话概括" autoFocus />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">内容</label>
          <textarea
            className="input textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="详细内容……"
            rows={8}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-500 px-1 font-medium">优先级</label>
          <div className="bg-white rounded-xl overflow-hidden">
            {PRIORITIES.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setPriority(p.key)}
                className={`flex items-start gap-3 w-full px-4 py-3 text-left ${i < PRIORITIES.length - 1 ? 'border-b border-neutral-100' : ''} active:bg-neutral-50`}
              >
                <span className="text-accent w-5 text-center flex-shrink-0 text-lg leading-snug">{priority === p.key ? '✓' : ''}</span>
                <div className="flex-1">
                  <div className="text-[15px]">{p.emoji} {p.label}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        {initial && (
          <button onClick={remove} className="btn-danger" disabled={saving}>删除这条记忆</button>
        )}
      </div>
    </div>
  );
}
