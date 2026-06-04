import type { Env } from '../../types';
import { now, uuid } from './util';
import type { CodexRepo, CodexEventRow } from './types';

export function makeCodex(env: Env, uid: string): CodexRepo {
  const DB = env.DB;
  return {
    async listCodexEvents(threadId) {
      return (await DB.prepare('SELECT id,meem_uid,thread_id,kind,payload,created FROM codex_events WHERE meem_uid=? AND thread_id=? ORDER BY created, id')
        .bind(uid, String(threadId || '')).all<CodexEventRow>()).results;
    },
    async addCodexEvent(p) {
      await DB.prepare('INSERT INTO codex_events (id,meem_uid,thread_id,kind,payload,created) VALUES (?,?,?,?,?,?)')
        .bind(uuid(), uid, String(p.threadId), String(p.kind || 'agent_message'), JSON.stringify(p.payload ?? {}), now()).run();
    },
  };
}
