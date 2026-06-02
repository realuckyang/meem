import type { Env } from '../../types';
import type { DecisionsRepo, OpenDecision } from './types';

// 决策从 messages 派生:awaiting 会话 + 最近一条 kind=decision 消息
export function makeDecisions(env: Env, uid: string): DecisionsRepo {
  const DB = env.DB;
  return {
    async openDecisions() {
      const chats = await DB.prepare("SELECT id FROM meem_chats WHERE meem_uid=? AND status='awaiting' ORDER BY updated DESC").bind(uid).all<{ id: string }>();
      const out: OpenDecision[] = [];
      for (const t of chats.results) {
        const d = await DB.prepare("SELECT message,meta FROM meem_messages WHERE meem_uid=? AND chat_id=? AND json_extract(meta,'$.kind')='decision' ORDER BY created DESC LIMIT 1")
          .bind(uid, t.id).first<{ message: string; meta: string }>();
        if (!d) continue;
        let msg: any = {}; let meta: any = {};
        try { msg = JSON.parse(d.message); } catch { /* */ }
        try { meta = JSON.parse(d.meta || '{}'); } catch { /* */ }
        out.push({ chat_id: t.id, ask: msg.content ?? '', options: meta.options ?? [], rationale: meta.rationale ?? '' });
      }
      return out;
    },
  };
}
