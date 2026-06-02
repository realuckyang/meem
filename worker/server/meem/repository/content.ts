import type { Env } from '../../types';
import { now, uuid } from './util';
import type { ContentRepo, ContentRow } from './types';

export function makeContent(env: Env, uid: string): ContentRepo {
  const DB = env.DB;
  return {
    async listContent(kind) {
      const sql = 'SELECT id,site_uid,kind,title,body,url,tags,status,pinned,created,updated FROM site_content WHERE site_uid=?'
        + (kind ? ' AND kind=?' : '') + ' ORDER BY pinned DESC, created DESC';
      const stmt = kind ? DB.prepare(sql).bind(uid, kind) : DB.prepare(sql).bind(uid);
      return (await stmt.all<ContentRow>()).results;
    },
    async publicContent(kind) {
      const sql = "SELECT id,site_uid,kind,title,body,url,tags,status,pinned,created,updated FROM site_content WHERE site_uid=? AND status='published'"
        + (kind ? ' AND kind=?' : '') + ' ORDER BY pinned DESC, created DESC LIMIT 100';
      const stmt = kind ? DB.prepare(sql).bind(uid, kind) : DB.prepare(sql).bind(uid);
      return (await stmt.all<ContentRow>()).results;
    },
    async getContent(id) {
      return DB.prepare('SELECT id,site_uid,kind,title,body,url,tags,status,pinned,created,updated FROM site_content WHERE id=? AND site_uid=?').bind(id, uid).first<ContentRow>();
    },
    async createContent(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO site_content (id,site_uid,kind,title,body,url,tags,status,pinned,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.kind, p.title, p.body ?? '', p.url ?? '', p.tags ?? '', p.status ?? 'published', p.pinned ?? 0, now(), now()).run();
      return (await this.getContent(id))!;
    },
    async updateContent(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['kind', 'title', 'body', 'url', 'tags', 'status', 'pinned'] as const) {
        if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE site_content SET ${cols.join(',')} WHERE id=? AND site_uid=?`).bind(...vals).run();
    },
    async deleteContent(id) {
      await DB.prepare('DELETE FROM site_content WHERE id=? AND site_uid=?').bind(id, uid).run();
    },
  };
}
