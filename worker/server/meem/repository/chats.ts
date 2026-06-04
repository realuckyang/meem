import type { Env } from '../../types';
import type { ChatLite } from '../ai/types';
import { now, uuid } from './util';
import type { ChatsRepo, ChatRow } from './types';

export function makeChats(env: Env, uid: string): ChatsRepo {
  const DB = env.DB;
  return {
    async listChats() {
      const r = await DB.prepare('SELECT id,meem_uid AS uid,parent,title,category,status,preview,peer,created,updated,closed FROM chats WHERE meem_uid=? ORDER BY updated DESC').bind(uid).all<ChatRow>();
      return r.results;
    },
    async getChat(id) {
      return DB.prepare('SELECT id,title,parent,peer AS peer_handle,status FROM chats WHERE id=? AND meem_uid=?').bind(id, uid).first<ChatLite>();
    },
    async getChatRow(id) {
      return DB.prepare('SELECT id,meem_uid AS uid,parent,title,category,status,preview,peer,created,updated,closed FROM chats WHERE id=? AND meem_uid=?').bind(id, uid).first<ChatRow>();
    },
    async createChat(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO chats (id,meem_uid,parent,title,category,status,peer,created,updated) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.parent ?? null, p.title, p.category ?? '', 'running', p.peer_handle ?? null, now(), now()).run();
      if (p.purpose) {
        await DB.prepare('INSERT INTO messages (id,meem_uid,chat_id,message,meta,created) VALUES (?,?,?,?,?,?)')
          .bind(uuid(), uid, id, JSON.stringify({ role: 'user', content: p.purpose }), JSON.stringify({ kind: 'instruct' }), now()).run();
      }
      return { id, title: p.title };
    },
    async setChat(id, f) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['status', 'preview', 'closed', 'title', 'category'] as const) {
        if ((f as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((f as any)[k]); }
      }
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE chats SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
  };
}
