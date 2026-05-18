import { useEffect, useMemo, useState } from 'react';
import { req, type Inclusion, type Memory } from '../api';
import { navigate, PATH, useRoute } from '../lib/router';
import { fmtTime } from '../lib/time';
import { pushToast } from '../components/Toast';

const INCLUSIONS: Inclusion[] = ['must_read', 'starred', 'stored'];
const INCLUSION_LABEL: Record<Inclusion, string> = {
  must_read: '必读',
  starred: '星标',
  stored: '只存',
};
const INCLUSION_HINT: Record<Inclusion, string> = {
  must_read: '每次任务全文注入，并显式要求 Codex 内化。放最重要的原则、不能弄错的事实',
  starred: '全文注入，作为重要参考。Codex 按需引用',
  stored: '默认不注入标题、摘要和正文。Codex 只知道还有更多记忆，需要时会主动搜索',
};

export default function MemoryList({ onClose }: { onClose: () => void }) {
  const route = useRoute();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tab, setTab] = useState<Inclusion>('must_read');

  const refresh = () => req<Memory[]>('/api/memories').then(setMemories).catch(() => {});
  useEffect(() => {
    refresh();
    const onFrame = (event: Event) => {
      const f = (event as CustomEvent).detail;
      if (f?.type === 'memory-updated' || f?.type === 'memory-deleted') refresh();
    };
    window.addEventListener('meem:frame', onFrame as EventListener);
    return () => window.removeEventListener('meem:frame', onFrame as EventListener);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Inclusion, number> = { must_read: 0, starred: 0, stored: 0 };
    for (const m of memories) c[m.inclusion]++;
    return c;
  }, [memories]);
  const tabItems = useMemo(
    () => memories.filter((m) => m.inclusion === tab),
    [memories, tab],
  );

  const editing = route.overlay === 'memoryNew'
    ? { mode: 'new' as const, defaultInclusion: tab }
    : route.overlay === 'memoryEdit' && route.memoryId
      ? { mode: 'edit' as const, target: memories.find((m) => m.id === route.memoryId) }
      : null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium text-[15px]">记忆</div>
        <button
          onClick={() => navigate(PATH.memoryNew())}
          title="新增"
          className="w-7 h-7 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* 三档 tab */}
      <nav className="shrink-0 flex border-b bg-white">
        {INCLUSIONS.map((lv) => (
          <button key={lv}
                  onClick={() => setTab(lv)}
                  className={`flex-1 py-2.5 text-sm relative ${
                    tab === lv ? 'text-neutral-900 font-medium' : 'text-neutral-500'
                  }`}>
            {INCLUSION_LABEL[lv]}
            <span className={`ml-1 text-xs ${tab === lv ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {counts[lv]}
            </span>
            {tab === lv && (
              <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-8 h-0.5 bg-neutral-900 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 pt-2 pb-1 text-[11.5px] text-neutral-400 leading-relaxed">
        {INCLUSION_HINT[tab]}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tabItems.length === 0 ? (
          <div className="p-10 text-center text-neutral-400 text-sm">
            还没有「{INCLUSION_LABEL[tab]}」的记忆
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden">
            {tabItems.map((m, i) => (
              <button key={m.id}
                      onClick={() => navigate(PATH.memoryEdit(m.id))}
                      className={`w-full text-left px-4 py-3 hover:bg-neutral-50 ${i ? 'border-t border-neutral-100' : ''}`}>
                <div className="flex items-baseline gap-2">
                  <div className="font-medium text-sm truncate">{m.title}</div>
                  <span className="ml-auto text-xs text-neutral-400 shrink-0">{fmtTime(m.updated_at)}</span>
                </div>
                {m.summary && (
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">{m.summary}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <MemoryEditor
          mode={editing.mode}
          target={editing.mode === 'edit' ? editing.target : undefined}
          defaultInclusion={editing.mode === 'new' ? editing.defaultInclusion : undefined}
          onClose={() => navigate(PATH.memoryList())}
          onSaved={(saved) => {
            refresh();
            if (editing.mode === 'new' && saved) {
              setTab(saved.inclusion);
            }
            navigate(PATH.memoryList());
          }}
          onDeleted={() => {
            refresh();
            navigate(PATH.memoryList());
          }}
        />
      )}
    </div>
  );
}

// ============ 内嵌编辑器 ============
function MemoryEditor({
  mode, target, defaultInclusion, onClose, onSaved, onDeleted,
}: {
  mode: 'new' | 'edit';
  target?: Memory;
  defaultInclusion?: Inclusion;
  onClose: () => void;
  onSaved: (saved: Memory | null) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(target?.title ?? '');
  const [summary, setSummary] = useState(target?.summary ?? '');
  const [content, setContent] = useState(target?.content ?? '');
  const [inclusion, setInclusion] = useState<Inclusion>(target?.inclusion ?? defaultInclusion ?? 'stored');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (target) {
      setTitle(target.title);
      setSummary(target.summary);
      setContent(target.content);
      setInclusion(target.inclusion);
    }
  }, [target?.id]);

  async function save() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      if (mode === 'edit' && target) {
        const updated = await req<Memory>(`/api/memories/${target.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: t, summary, content, inclusion }),
        });
        pushToast('已保存', 'success');
        onSaved(updated);
      } else {
        const created = await req<Memory>('/api/memories', {
          method: 'POST',
          body: JSON.stringify({ title: t, summary, content, inclusion }),
        });
        pushToast('已添加', 'success');
        onSaved(created);
      }
    } catch {} finally { setBusy(false); }
  }

  async function remove() {
    if (!target || busy) return;
    setBusy(true);
    try {
      await req(`/api/memories/${target.id}`, { method: 'DELETE' });
      pushToast('已删除', 'success');
      onDeleted();
    } catch {} finally { setBusy(false); setConfirmDelete(false); }
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-50">
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b bg-white/85 backdrop-blur">
        <button onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-neutral-600 text-lg">‹</button>
        <div className="font-medium text-[15px]">{mode === 'new' ? '新记忆' : '记忆'}</div>
        <button onClick={save}
                disabled={busy || !title.trim()}
                className="text-sm text-neutral-900 disabled:text-neutral-300 px-1">
          {busy ? '保存中…' : '保存'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（一句话点出这条记忆是什么）"
          maxLength={120}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-neutral-400"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="摘要（可选，一行内能讲清楚就放这）"
          maxLength={500}
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="正文（可选，复杂或长的写这里）"
          rows={8}
          maxLength={8000}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-neutral-400"
        />

        <div>
          <div className="text-[11px] text-neutral-400 px-2 pb-1">档位</div>
          <div className="rounded-xl bg-white border border-neutral-200 overflow-hidden flex">
            {INCLUSIONS.map((lv, i) => (
              <button key={lv}
                      onClick={() => setInclusion(lv)}
                      className={`flex-1 py-2.5 text-sm ${i ? 'border-l border-neutral-200' : ''} ${
                        inclusion === lv ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}>
                {INCLUSION_LABEL[lv]}
              </button>
            ))}
          </div>
          <div className="mt-1 px-2 text-[11.5px] text-neutral-400 leading-relaxed">
            {INCLUSION_HINT[inclusion]}
          </div>
        </div>

        {mode === 'edit' && target && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full bg-white border border-neutral-200 rounded-xl py-2.5 text-red-500 text-sm hover:bg-red-50/40"
          >
            删除
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button onClick={() => setConfirmDelete(false)}
                  className="absolute inset-0 bg-black/30 meem-fade-enter" />
          <div className="relative mx-3 mb-3 w-full max-w-md rounded-2xl bg-white shadow-xl p-4 meem-sheet-enter">
            <div className="font-semibold text-[15px]">删除这条记忆？</div>
            <div className="text-sm text-neutral-500 mt-1">无法恢复。</div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100">取消</button>
              <button onClick={remove}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
