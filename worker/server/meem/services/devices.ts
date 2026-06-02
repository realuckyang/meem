import type { Repo } from '../repository/repo';

export const list = (repo: Repo) => repo.listDevices();

export async function create(repo: Repo, b: any) {
  const kind = b.kind === 'browser' ? 'browser' : 'computer';
  if (!String(b.name || '').trim()) return { error: 'name_required' as const, status: 400 };
  return { device: await repo.createDevice({ kind, name: b.name, description: b.description }) };
}

export const update = (repo: Repo, id: string, b: any) => repo.updateDevice(id, { name: b.name, description: b.description, status: b.status });
export const remove = (repo: Repo, id: string) => repo.deleteDevice(id);
