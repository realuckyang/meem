import type { Repo } from '../../repository';

export function get(repo: Repo) { return repo.getSettings(); }
export function update(repo: Repo, b: Record<string, unknown>) { return repo.updateSettings(b); }
