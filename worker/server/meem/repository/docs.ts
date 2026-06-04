import type { Env } from '../../types';
import { now, uuid } from './util';
import type { DocsRepo, DocNotebook, DocPageMeta, DocPage } from './types';

// 文档(私有):笔记本树 + 页面
export function makeDocs(env: Env, uid: string): DocsRepo {
  const DB = env.DB;
  return {
    async docNotebooks() {
      const r = await DB.prepare('SELECT id,parent_id,name,icon,sort_order,created,updated FROM doc_notebooks WHERE meem_uid=? ORDER BY sort_order, created').bind(uid).all<DocNotebook>();
      return r.results;
    },
    async docPagesList(notebookId) {
      const r = notebookId === null
        ? await DB.prepare('SELECT id,notebook_id,title,icon,sort_order,updated FROM doc_pages WHERE meem_uid=? AND notebook_id IS NULL ORDER BY sort_order, updated DESC').bind(uid).all<DocPageMeta>()
        : await DB.prepare('SELECT id,notebook_id,title,icon,sort_order,updated FROM doc_pages WHERE meem_uid=? AND notebook_id=? ORDER BY sort_order, updated DESC').bind(uid, notebookId).all<DocPageMeta>();
      return r.results;
    },
    async docGetPage(id) {
      return DB.prepare('SELECT id,notebook_id,title,content,icon,sort_order,created,updated FROM doc_pages WHERE id=? AND meem_uid=?').bind(id, uid).first<DocPage>();
    },
    async docCreateNotebook(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO doc_notebooks (id,meem_uid,parent_id,name,icon,sort_order,created,updated) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.parentId ?? null, p.name, p.icon ?? null, now(), now(), now()).run();
      return { id, parent_id: p.parentId ?? null, name: p.name, icon: p.icon ?? null, sort_order: now(), created: now(), updated: now() };
    },
    async docCreatePage(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO doc_pages (id,meem_uid,notebook_id,title,content,icon,sort_order,created,updated) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.notebookId ?? null, p.title, '', null, now(), now(), now()).run();
      return (await this.docGetPage(id))!;
    },
    async docUpdatePage(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['title', 'content', 'icon'] as const) if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE doc_pages SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async docDeletePage(id) { await DB.prepare('DELETE FROM doc_pages WHERE id=? AND meem_uid=?').bind(id, uid).run(); },
    async docUpdateNotebook(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['name', 'icon'] as const) if ((p as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((p as any)[k]); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE doc_notebooks SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async docDeleteNotebook(id) {
      await DB.prepare('DELETE FROM doc_pages WHERE notebook_id=? AND meem_uid=?').bind(id, uid).run();
      await DB.prepare('DELETE FROM doc_notebooks WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },
  };
}
