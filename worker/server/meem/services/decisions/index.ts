import type { Repo } from '../../repository';

/** 拍板:写一条"采纳"消息 + 会话转回 running;返回 chatId 供继续跑 */
export async function decide(repo: Repo, chatId: string, chosen: string): Promise<string> {
  await repo.addMessage({ chatId, message: { role: 'user', content: `采纳:${chosen}` }, meta: { kind: 'decision_made' } });
  await repo.setChat(chatId, { status: 'running' });
  return chatId;
}
