import type { Env } from '../../types';
import type { ChatMessage } from '../ai/types';
import { now, uuid } from './util';
import type { MessagesRepo, MessageRow } from './types';

export function makeMessages(env: Env, uid: string): MessagesRepo {
  const DB = env.DB;
  return {
    async addMessage(m) {
      const id = uuid(); const created = now();
      await DB.prepare('INSERT INTO meem_messages (id,meem_uid,chat_id,message,meta,created) VALUES (?,?,?,?,?,?)')
        .bind(id, uid, m.chatId, JSON.stringify(m.message), m.meta ? JSON.stringify(m.meta) : null, created).run();
      if (m.chatId) await DB.prepare('UPDATE meem_chats SET updated=? WHERE id=?').bind(created, m.chatId).run();
      return { id, created };
    },
    async listMessages(chatId) {
      const r = chatId === null
        ? await DB.prepare('SELECT id,chat_id,message,meta,created FROM meem_messages WHERE meem_uid=? AND chat_id IS NULL ORDER BY created').bind(uid).all<MessageRow>()
        : await DB.prepare('SELECT id,chat_id,message,meta,created FROM meem_messages WHERE meem_uid=? AND chat_id=? ORDER BY created').bind(uid, chatId).all<MessageRow>();
      return r.results;
    },
    async loadHistory(chatId) {
      const rows = await this.listMessages(chatId);
      const out: ChatMessage[] = [];
      for (const row of rows) {
        let msg: any; try { msg = JSON.parse(row.message); } catch { continue; }
        if (!msg?.role) continue;
        if (msg.role === 'user') {
          let from = ''; try { from = JSON.parse(row.meta || '{}').from || ''; } catch { /* */ }
          if (from) msg = { ...msg, content: `[from ${from}] ${msg.content ?? ''}` };
        }
        out.push(msg as ChatMessage);
      }
      return out;
    },
  };
}
