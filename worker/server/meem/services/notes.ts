import type { Repo } from '../repository/repo';

export const list = (repo: Repo, q?: string) => repo.listNotes(q);

export async function create(repo: Repo, b: any) {
  if (!String(b.title || '').trim() && !String(b.body || '').trim()) {
    return { error: 'empty_note' as const, status: 400 };
  }
  return { item: await repo.createNote({ title: b.title, body: b.body, pinned: b.pinned ? 1 : 0 }) };
}

export const update = (repo: Repo, id: string, b: any) =>
  repo.updateNote(id, { title: b.title, body: b.body, pinned: b.pinned === undefined ? undefined : (b.pinned ? 1 : 0) });

export const remove = (repo: Repo, id: string) => repo.deleteNote(id);
