import type { Repo } from '../repository/repo';

// 笔记本
export const notebooks = (repo: Repo) => repo.docNotebooks();
export const createNotebook = (repo: Repo, b: any) => repo.docCreateNotebook({ name: b.name, parentId: b.parentId ?? null, icon: b.icon });
export const updateNotebook = (repo: Repo, id: string, b: any) => repo.docUpdateNotebook(id, { name: b.name, icon: b.icon });
export const deleteNotebook = (repo: Repo, id: string) => repo.docDeleteNotebook(id);

// 页面
export const pages = (repo: Repo, notebookId: string | null) => repo.docPagesList(notebookId);
export const getPage = (repo: Repo, id: string) => repo.docGetPage(id);
export const createPage = (repo: Repo, b: any) => repo.docCreatePage({ notebookId: b.notebookId ?? null, title: String(b.title || '新页面') });
export const updatePage = (repo: Repo, id: string, b: any) => repo.docUpdatePage(id, { title: b.title, content: b.content, icon: b.icon });
export const deletePage = (repo: Repo, id: string) => repo.docDeletePage(id);
