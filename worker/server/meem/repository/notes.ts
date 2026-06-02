import type { Env } from '../../types';
import { now, uuid } from './util';
import type { NotesRepo, NoteRow } from './types';

const COLS = 'id,meem_uid,title,body,pinned,created,updated';

export function makeNotes(env: Env, uid: string): NotesRepo {
  const DB = env.DB;
  return {
    async listNotes(q?: string) {
      const like = `%${q}%`;
      const sql = `SELECT ${COLS} FROM meem_notes WHERE meem_uid=?`
        + (q ? ' AND (title LIKE ? OR body LIKE ?)' : '')
        + ' ORDER BY pinned DESC, updated DESC';
      const stmt = q ? DB.prepare(sql).bind(uid, like, like) : DB.prepare(sql).bind(uid);
      return (await stmt.all<NoteRow>()).results;
    },
    async getNote(id) {
      return DB.prepare(`SELECT ${COLS} FROM meem_notes WHERE id=? AND meem_uid=?`).bind(id, uid).first<NoteRow>();
    },
    async createNote(p) {
      const id = uuid();
      await DB.prepare(`INSERT INTO meem_notes (${COLS}) VALUES (?,?,?,?,?,?,?)`)
        .bind(id, uid, p.title ?? '', p.body ?? '', p.pinned ?? 0, now(), now()).run();
      return (await this.getNote(id))!;
    },
    async updateNote(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['title', 'body', 'pinned'] as const) {
        if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE meem_notes SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async deleteNote(id) {
      await DB.prepare('DELETE FROM meem_notes WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },
  };
}
