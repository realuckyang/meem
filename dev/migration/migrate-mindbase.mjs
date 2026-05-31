// mindbase 笔记 → meem 文档(doc_notebooks / doc_pages)
//   保留原 id(树形 parent_id / notebook_id 引用不变)· INSERT OR REPLACE 可重跑
//   用法:node migrate-mindbase.mjs > mindbase-to-meem.sql
import { readFileSync } from 'node:fs';
const read = (f) => JSON.parse(readFileSync(new URL(`./backup/${f}`, import.meta.url), 'utf8'));
const notebooks = read('mb_notebooks.json');
const pages = read('mb_pages.json');

const q = (v) => v === null || v === undefined ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const unix = (s) => {
  if (!s) return 'unixepoch()';
  const iso = /T/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const t = Math.floor(new Date(iso).getTime() / 1000);
  return Number.isFinite(t) ? String(t) : 'unixepoch()';
};
const out = [];
for (const n of notebooks) {
  out.push(`INSERT OR REPLACE INTO doc_notebooks (id,meem_uid,parent_id,name,icon,sort_order,created,updated) VALUES (${q(n.id)},'me',${q(n.parent_id)},${q(n.name)},${q(n.icon)},${n.sort_order || 0},${unix(n.created_at)},${unix(n.updated_at)});`);
}
for (const p of pages) {
  out.push(`INSERT OR REPLACE INTO doc_pages (id,meem_uid,notebook_id,title,content,icon,sort_order,created,updated) VALUES (${q(p.id)},'me',${q(p.notebook_id)},${q(p.title)},${q(p.content)},${q(p.icon)},${p.sort_order || 0},${unix(p.created_at)},${unix(p.updated_at)});`);
}
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`生成 ${out.length} 条:笔记本 ${notebooks.length} / 页面 ${pages.length}\n`);
