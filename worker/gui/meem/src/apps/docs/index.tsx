import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChevronLeft, Eye, FilePlus2, FileText, Folder, FolderPlus, Home, Pencil, Save, Trash2 } from 'lucide-react';
import Topbar from '../../system/Topbar';
import type { SystemAppProps } from '../../system/registry';
import { api, type DocNotebook, type DocPage, type DocPageMeta } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { cn } from '../../system/lib/utils';

export default function DocsApp(_: SystemAppProps) {
  const [notebooks, setNotebooks] = useState<DocNotebook[]>([]);
  const [cwd, setCwd] = useState<string | null>(null);   // 当前所在笔记本(null = 根)
  const [pages, setPages] = useState<DocPageMeta[]>([]);
  const [page, setPage] = useState<DocPage | null>(null); // 非空 = 进入页面编辑器
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [pageIcon, setPageIcon] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const loadNotebooks = () => api.docsNotebooks().then((d) => setNotebooks(d.notebooks)).catch(() => {});
  const loadPages = (c: string | null) => api.docsPages(c).then((d) => setPages(d.pages)).catch(() => {});

  useEffect(() => { loadNotebooks(); }, []);
  useEffect(() => { if (!page) loadPages(cwd); }, [cwd, page]);

  // 当前层的子笔记本 + 面包屑(从扁平 notebooks 算)
  const children = useMemo(() => notebooks.filter((n) => (n.parent_id || null) === cwd), [notebooks, cwd]);
  const trail = useMemo(() => {
    const out: DocNotebook[] = [];
    let id = cwd;
    const guard = new Set<string>();
    while (id && !guard.has(id)) {
      guard.add(id);
      const nb = notebooks.find((n) => n.id === id);
      if (!nb) break;
      out.unshift(nb);
      id = nb.parent_id || null;
    }
    return out;
  }, [notebooks, cwd]);
  const here = trail[trail.length - 1] || null;

  function goto(id: string | null) { setPage(null); setCwd(id); }

  async function openPage(id: string, edit = false) {
    const d = await api.docsPage(id);
    setPage(d.page); setTitle(d.page.title); setContent(d.page.content); setPageIcon(d.page.icon); setDirty(false);
    setMode(edit ? 'edit' : 'view');
    if (edit) setTimeout(() => ta.current?.focus(), 30);
  }
  async function save() {
    if (!page) return;
    setSaving(true);
    try { await api.docsUpdatePage(page.id, { title, content }); setDirty(false); }
    finally { setSaving(false); }
  }
  async function newPage() {
    const r = await api.docsCreatePage({ notebookId: cwd, title: '新页面' });
    await loadPages(cwd);
    openPage(r.page.id, true);
  }
  async function delPage() {
    if (!page || !confirm('删除这篇页面?')) return;
    await api.docsDeletePage(page.id); setPage(null); await loadPages(cwd);
  }
  async function newNotebook() {
    const name = prompt('笔记本名称')?.trim();
    if (!name) return;
    await api.docsCreateNotebook({ name, parentId: cwd });
    await loadNotebooks();
  }
  async function renameHere() {
    if (!here) return;
    const name = prompt('重命名笔记本', here.name)?.trim();
    if (!name || name === here.name) return;
    await api.docsUpdateNotebook(here.id, { name });
    await loadNotebooks();
  }
  async function editNotebookIcon() {
    if (!here) return;
    const icon = prompt('设置笔记本图标(粘贴一个 emoji,留空恢复默认)', here.icon || '');
    if (icon === null) return;
    await api.docsUpdateNotebook(here.id, { icon: icon.trim() });
    await loadNotebooks();
  }
  async function editPageIcon() {
    if (!page) return;
    const icon = prompt('设置页面图标(粘贴一个 emoji,留空恢复默认)', pageIcon || '');
    if (icon === null) return;
    const v = icon.trim();
    setPageIcon(v);
    await api.docsUpdatePage(page.id, { icon: v });
    await loadPages(cwd);
  }
  async function delHere() {
    if (!here || !confirm(`删除笔记本「${here.name}」及其内容?`)) return;
    await api.docsDeleteNotebook(here.id);
    await loadNotebooks();
    goto(here.parent_id || null);
  }

  // ───────── 页面编辑器 ─────────
  if (page) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <Topbar title="文档" />
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <button onClick={() => setPage(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />返回</button>
          <button
            onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-cyan hover:text-cyan"
          >{mode === 'view' ? <><Pencil className="size-3.5" />编辑</> : <><Eye className="size-3.5" />预览</>}</button>
          {dirty && <span className="text-xs text-amber">未保存</span>}
          <Button size="sm" onClick={save} disabled={saving || !dirty}><Save />{saving ? '保存中' : '保存'}</Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={delPage}><Trash2 /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-6 md:px-8">
            {mode === 'edit' ? (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={editPageIcon} title="设置图标" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-card"><DocIcon icon={pageIcon} kind="pg" lucide="size-6" /></button>
                  <input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                    placeholder="标题"
                    className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <textarea
                  ref={ta}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } }}
                  placeholder="正文(Markdown)…"
                  rows={20}
                  className="w-full resize-none bg-transparent font-mono text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={editPageIcon} title="设置图标" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-card"><DocIcon icon={pageIcon} kind="pg" lucide="size-6" /></button>
                  <h1 className="min-w-0 flex-1 truncate text-3xl font-bold text-foreground">{title || '(无标题)'}</h1>
                </div>
                {content.trim()
                  ? <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>{content}</ReactMarkdown></div>
                  : <button onClick={() => setMode('edit')} className="text-left text-sm text-muted-foreground hover:text-foreground">空白页面,点此开始写…</button>}
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ───────── 列表(混排 + 面包屑) ─────────
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Topbar title="文档" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 md:px-8">
          {/* 面包屑 */}
          <nav className="flex flex-wrap items-center gap-0.5 text-sm">
            <Crumb onClick={() => goto(null)} active={cwd === null}><Home className="size-3.5" />文档</Crumb>
            {trail.map((nb, i) => (
              <span key={nb.id} className="flex items-center gap-0.5">
                <span className="px-0.5 text-muted-foreground/50">/</span>
                <Crumb onClick={() => goto(nb.id)} active={i === trail.length - 1}>
                  <DocIcon icon={nb.icon} kind="nb" lucide="size-3.5" />{nb.name || '无标题'}
                </Crumb>
              </span>
            ))}
          </nav>

          {/* 当前层标题(非根可重命名/删除) */}
          <div className="mt-4 flex items-center gap-2">
            {here && <button onClick={editNotebookIcon} title="设置图标" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-card"><DocIcon icon={here.icon} kind="nb" lucide="size-5" /></button>}
            <h1 className="min-w-0 truncate text-2xl font-bold text-foreground">
              {here ? (here.name || '无标题') : '文档'}
            </h1>
            {here && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={renameHere} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground">重命名</button>
                <button onClick={delHere} className="rounded-md px-2 py-1 text-xs text-red-400/80 hover:bg-card hover:text-red-300">删除</button>
              </div>
            )}
          </div>

          {/* 混排列表 */}
          <ul className="mt-5 flex flex-col gap-0.5">
            {children.map((nb) => (
              <li key={nb.id}>
                <button onClick={() => goto(nb.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card">
                  <span className="shrink-0"><DocIcon icon={nb.icon} kind="nb" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{nb.name || '无标题'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground/60">/</span>
                </button>
              </li>
            ))}
            {pages.map((pg) => (
              <li key={pg.id}>
                <button onClick={() => openPage(pg.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card">
                  <span className="shrink-0"><DocIcon icon={pg.icon} kind="pg" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{pg.title || '(无标题)'}</span>
                </button>
              </li>
            ))}
            {children.length === 0 && pages.length === 0 && (
              <li className="px-2.5 py-10 text-center text-sm text-muted-foreground">这里还是空的</li>
            )}
          </ul>

          {/* 新建 */}
          <div className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3">
            <button onClick={newNotebook}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-card hover:text-cyan">
              <FolderPlus className="size-4" />新建笔记本
            </button>
            <button onClick={newPage}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-card hover:text-cyan">
              <FilePlus2 className="size-4" />新建页面
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** 文档图标:设了 emoji 用 emoji,否则用 lucide 兜底(笔记本=琥珀文件夹,页面=灰页面) */
function DocIcon({ icon, kind, lucide }: { icon?: string | null; kind: 'nb' | 'pg'; lucide?: string }) {
  if (icon && icon.trim()) return <span className="text-base leading-none">{icon}</span>;
  return kind === 'nb'
    ? <Folder className={cn('text-amber', lucide || 'size-4')} />
    : <FileText className={cn('text-muted-foreground', lucide || 'size-4')} />;
}

function Crumb({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={cn(
        'flex max-w-[12rem] items-center gap-1 truncate rounded-md px-1.5 py-0.5 transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >{children}</button>
  );
}
