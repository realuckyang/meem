import type { Repo, TerminalSnippetRow } from '../../repository';

const MAX_SNIPPETS = 50;

function shape(row: TerminalSnippetRow) {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    autoSend: row.auto_send === 1,
    position: row.position,
  };
}

export async function listSnippets(repo: Repo) {
  const snippets = await repo.listTerminalSnippets();
  return { snippets: snippets.map(shape) };
}

export async function createSnippet(repo: Repo, body: any) {
  const current = await repo.listTerminalSnippets();
  if (current.length >= MAX_SNIPPETS) return { error: `最多保存 ${MAX_SNIPPETS} 条`, status: 400 };

  const name = String(body.name ?? '').trim().slice(0, 40);
  const command = String(body.command ?? '').trim();
  if (!name || !command) return { error: '缺少名称或命令', status: 400 };

  const snippet = await repo.createTerminalSnippet({ name, command, autoSend: body.autoSend !== false });
  return { snippet: shape(snippet) };
}

export async function updateSnippet(repo: Repo, id: string, body: any) {
  const patch: Partial<{ name: string; command: string; autoSend: boolean; position: number }> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 40);
  if (body.command !== undefined) patch.command = String(body.command).trim();
  if (body.autoSend !== undefined) patch.autoSend = !!body.autoSend;
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (patch.name === '' || patch.command === '') return { error: '缺少名称或命令', status: 400 };
  await repo.updateTerminalSnippet(id, patch);
  return { ok: true };
}

export async function deleteSnippet(repo: Repo, id: string) {
  await repo.deleteTerminalSnippet(id);
  return { ok: true };
}
