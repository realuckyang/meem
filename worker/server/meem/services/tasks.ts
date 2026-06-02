import type { Repo } from '../repository/repo';

export const list = (repo: Repo, status?: string) => repo.listTasks(status);

export async function create(repo: Repo, b: any) {
  if (!String(b.title || '').trim()) {
    return { error: 'title_required' as const, status: 400 };
  }
  return { item: await repo.createTask({ title: b.title, description: b.description, status: b.status, priority: b.priority }) };
}

export const update = (repo: Repo, id: string, b: any) =>
  repo.updateTask(id, { title: b.title, description: b.description, status: b.status, priority: b.priority });

export const remove = (repo: Repo, id: string) => repo.deleteTask(id);
