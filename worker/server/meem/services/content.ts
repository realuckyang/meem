import type { Repo } from '../repository/repo';

export const list = (repo: Repo, kind?: string) => repo.listContent(kind);

export async function create(repo: Repo, b: any) {
  if (!String(b.kind || '').trim() || !String(b.title || '').trim()) {
    return { error: 'kind_and_title_required' as const, status: 400 };
  }
  return { item: await repo.createContent({ kind: b.kind, title: b.title, body: b.body, url: b.url, tags: b.tags, status: b.status, pinned: b.pinned ? 1 : 0 }) };
}

export const update = (repo: Repo, id: string, b: any) =>
  repo.updateContent(id, { kind: b.kind, title: b.title, body: b.body, url: b.url, tags: b.tags, status: b.status, pinned: b.pinned === undefined ? undefined : (b.pinned ? 1 : 0) });

export const remove = (repo: Repo, id: string) => repo.deleteContent(id);
