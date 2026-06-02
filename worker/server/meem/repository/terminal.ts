import type { Env } from '../../types';
import { now, uuid } from './util';
import type { TerminalRepo, TerminalSnippetRow } from './types';

export function makeTerminal(env: Env, uid: string): TerminalRepo {
  const DB = env.DB;
  return {
    async listTerminalSnippets() {
      const r = await DB.prepare('SELECT id,name,command,auto_send,position,created,updated FROM meem_terminal_snippets WHERE meem_uid=? ORDER BY position ASC, created ASC')
        .bind(uid).all<TerminalSnippetRow>();
      return r.results;
    },
    async createTerminalSnippet(p) {
      const id = uuid();
      const created = now();
      const position = created;
      await DB.prepare('INSERT INTO meem_terminal_snippets (id,meem_uid,name,command,auto_send,position,created,updated) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.name, p.command, p.autoSend ? 1 : 0, position, created, created).run();
      return { id, name: p.name, command: p.command, auto_send: p.autoSend ? 1 : 0, position, created, updated: created };
    },
    async updateTerminalSnippet(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      if (p.name !== undefined) { cols.push('name=?'); vals.push(p.name); }
      if (p.command !== undefined) { cols.push('command=?'); vals.push(p.command); }
      if (p.autoSend !== undefined) { cols.push('auto_send=?'); vals.push(p.autoSend ? 1 : 0); }
      if (p.position !== undefined) { cols.push('position=?'); vals.push(p.position); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE meem_terminal_snippets SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async deleteTerminalSnippet(id) {
      await DB.prepare('DELETE FROM meem_terminal_snippets WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },
  };
}
