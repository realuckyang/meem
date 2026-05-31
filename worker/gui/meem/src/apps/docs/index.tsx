import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, FilePlus2, FolderPlus, Save, Trash2 } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api, type DocNotebook, type DocPage, type DocPageMeta } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { cn } from '../../system/lib/utils';

const NULL_NB = '__null__'; // 未归类

export default function DocsApp(_: SystemAppProps) {
  const [notebooks, setNotebooks] = useState<DocNotebook[]>([]);
  const [sel, setSel] = useState<string | null>(NULL_NB);
  const [pages, setPages] = useState<DocPageMeta[]>([]);
  const [page, setPage] = useState<DocPage | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const loadNotebooks = () => api.docsNotebooks().then((d) => setNotebooks(d.notebooks)).catch(() => {});
  const nbId = (s: string | null) => (s === NULL_NB ? null : s);
  const loadPages = (s: string | null) => api.docsPages(nbId(s)).then((d) => setPages(d.pages)).catch(() => {});

  useEffect(() => { loadNotebooks(); }, []);
  useEffect(() => { setPage(null); loadPages(sel); }, [sel]);

  // 构建树
  const tree = useMemo(() => {
    const byParent: Record<string, DocNotebook[]> = {};
    for (const n of notebooks) { (byParent[n.parent_id || '__root__'] ||= []).push(n); }
    return byParent;
  }, [notebooks]);

  async function openPage(id: string) {
    const d = await api.docsPage(id);
    setPage(d.page); setTitle(d.page.title); setContent(d.page.content); setDirty(false);
    setTimeout(() => ta.current?.focus(), 30);
  }
  async function save() {
    if (!page) return;
    setSaving(true);
    try { await api.docsUpdatePage(page.id, { title, content }); setDirty(false); await loadPages(sel); }
    finally { setSaving(false); }
  }
  async function newPage() {
    const r = await api.docsCreatePage({ notebookId: nbId(sel), title: '新页面' });
    await loadPages(sel);
    openPage(r.page.id);
  }
  async function delPage() {
    if (!page || !confirm('删除这篇页面?')) return;
    await api.docsDeletePage(page.id); setPage(null); await loadPages(sel);
  }
  async function newNotebook() {
    const name = prompt('笔记本名称')?.trim();
    if (!name) return;
    const r = await api.docsCreateNotebook({ name, parentId: nbId(sel) });
    await loadNotebooks(); setSel(r.notebook.id);
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="文档" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 笔记本树 */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">笔记本</span>
            <button onClick={newNotebook} title="新建笔记本" className="text-muted-foreground hover:text-cyan"><FolderPlus className="size-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
            <NbItem id={NULL_NB} name="未归类" icon="📄" depth={0} sel={sel} onSel={setSel} tree={{}} />
            <NotebookTree parent="__root__" tree={tree} depth={0} sel={sel} onSel={setSel} />
          </div>
        </aside>

        {/* 主区 */}
        <section className="flex min-w-0 flex-1 flex-col">
          {page ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <button onClick={() => setPage(null)} className="text-sm text-muted-foreground hover:text-foreground">‹ 返回</button>
                <span className="ml-auto text-xs text-muted-foreground">{dirty ? '未保存' : '已保存'}</span>
                <Button size="sm" onClick={save} disabled={saving || !dirty}><Save />{saving ? '保存中' : '保存'}</Button>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={delPage}><Trash2 /></Button>
              </div>
              <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 p-5">
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                  placeholder="标题"
                  className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                />
                <textarea
                  ref={ta}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } }}
                  placeholder="正文(Markdown)…"
                  className="min-h-0 flex-1 w-full resize-none bg-transparent font-mono text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="text-sm font-semibold tracking-wide">{notebooks.find((n) => n.id === sel)?.name || '未归类'} · {pages.length} 篇</h2>
                <Button size="sm" onClick={newPage}><FilePlus2 />新页面</Button>
              </div>
              <div className="px-3 pb-5">
                {pages.map((pg) => (
                  <button key={pg.id} onClick={() => openPage(pg.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-card">
                    <span className="shrink-0 text-sm">{pg.icon || '📄'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{pg.title || '(无标题)'}</span>
                  </button>
                ))}
                {pages.length === 0 && <div className="px-3 py-10 text-center text-sm text-muted-foreground">这个笔记本还没有页面</div>}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function NotebookTree({ parent, tree, depth, sel, onSel }: { parent: string; tree: Record<string, DocNotebook[]>; depth: number; sel: string | null; onSel: (id: string) => void }) {
  const list = tree[parent] || [];
  return (
    <>
      {list.map((n) => (
        <div key={n.id}>
          <NbItem id={n.id} name={n.name} icon={n.icon || '📁'} depth={depth} sel={sel} onSel={onSel} tree={tree} />
          <NotebookTree parent={n.id} tree={tree} depth={depth + 1} sel={sel} onSel={onSel} />
        </div>
      ))}
    </>
  );
}

function NbItem({ id, name, icon, depth, sel, onSel, tree }: { id: string; name: string; icon: string; depth: number; sel: string | null; onSel: (id: string) => void; tree: Record<string, DocNotebook[]> }) {
  const hasChildren = (tree[id]?.length || 0) > 0;
  return (
    <button
      onClick={() => onSel(id)}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn('flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors',
        sel === id ? 'bg-cyan/10 text-cyan' : 'text-muted-foreground hover:bg-card hover:text-foreground')}
    >
      <ChevronRight className={cn('size-3 shrink-0', hasChildren ? 'opacity-60' : 'opacity-0')} />
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </button>
  );
}
