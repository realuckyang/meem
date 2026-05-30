import type { Repo } from '../../repository';

export async function board(repo: Repo) {
  const [chats, decisions] = await Promise.all([repo.listChats(), repo.openDecisions()]);
  return { chats, decisions };
}
export async function detail(repo: Repo, id: string) {
  const [chat, messages] = await Promise.all([repo.getChatRow(id), repo.listMessages(id)]);
  return { chat, messages };
}
export function create(repo: Repo, b: any) {
  return repo.createChat({ title: b.title || '新会话', category: b.category, peer_handle: b.peer_handle, purpose: b.purpose });
}
