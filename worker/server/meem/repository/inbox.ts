import type { Env } from '../../types';
import { now, uuid } from './util';
import type { InboxRepo } from './types';

export function makeInbox(env: Env, uid: string): InboxRepo {
  const DB = env.DB;
  return {
    async inboxList(status) {
      const r = status === 'all'
        ? await DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE site_uid=? ORDER BY created DESC LIMIT 50').bind(uid).all()
        : await DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE site_uid=? AND status=? ORDER BY created DESC LIMIT 50').bind(uid, status).all();
      return r.results;
    },
    async inboxRead(id) { return DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE id=? AND site_uid=?').bind(id, uid).first(); },
    async inboxReply(id) { await DB.prepare("UPDATE site_inbox SET status='handled' WHERE id=? AND site_uid=?").bind(id, uid).run(); },
    async inboxLink() { return '/p'; },
    async inboxAdd(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO site_inbox (id,site_uid,from_name,body,status,created) VALUES (?,?,?,?,?,?)')
        .bind(id, uid, p.fromName, p.body, 'new', now()).run();
      return { id, chatId: null };
    },
  };
}
