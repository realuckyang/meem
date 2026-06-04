import type { Env } from '../../types';
import { now, uuid } from './util';
import type { TasksRepo, TaskRow } from './types';

export function makeTasks(env: Env, uid: string): TasksRepo {
  const DB = env.DB;
  return {
    async listTasks(status?: string) {
      const sql = 'SELECT id,meem_uid,title,description,status,priority,created,updated FROM tasks WHERE meem_uid=?'
        + (status ? ' AND status=?' : '') + ' ORDER BY updated DESC';
      const stmt = status ? DB.prepare(sql).bind(uid, status) : DB.prepare(sql).bind(uid);
      return (await stmt.all<TaskRow>()).results;
    },
    async getTask(id) {
      return DB.prepare('SELECT id,meem_uid,title,description,status,priority,created,updated FROM tasks WHERE id=? AND meem_uid=?').bind(id, uid).first<TaskRow>();
    },
    async createTask(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO tasks (id,meem_uid,title,description,status,priority,created,updated) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.title, p.description ?? '', p.status ?? 'todo', p.priority ?? 'medium', now(), now()).run();
      return (await this.getTask(id))!;
    },
    async updateTask(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['title', 'description', 'status', 'priority'] as const) {
        if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE tasks SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async deleteTask(id) {
      await DB.prepare('DELETE FROM tasks WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },
  };
}
