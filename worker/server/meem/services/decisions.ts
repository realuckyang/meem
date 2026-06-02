import type { Repo } from '../repository/repo';

/** 拍板:写一条"采纳"消息 + 会话转回 running;返回持久化记录 */
export async function decide(repo: Repo, chatId: string, chosen: string): Promise<{ chatId: string; id: string; created: number; text: string }> {
  const text = `采纳:${chosen}`;
  const r = await repo.addMessage({ chatId, message: { role: 'user', content: text }, meta: { kind: 'decision_made' } });
  await repo.setChat(chatId, { status: 'running' });
  return { chatId, id: r.id, created: r.created, text };
}
