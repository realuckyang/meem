// 把 woodchange 备份(backup/*.json)转成 meem site_content 的 SQL。
//   moments→dynamic  posts→article  works→project  about→about
//   确定性 id(wc_*),用 INSERT OR REPLACE,可重复执行不产生重复。
//   用法:node migrate-woodchange.mjs > woodchange-to-meem.sql
import { readFileSync } from 'node:fs';

const read = (f) => JSON.parse(readFileSync(new URL(`./backup/${f}`, import.meta.url), 'utf8'));
const moments = read('wc_moments.json');
const posts = read('wc_posts.json');
const content = read('wc_content.json');
const byKey = Object.fromEntries(content.map((r) => [r.key, JSON.parse(r.data)]));

const q = (v) => "'" + String(v ?? '').replace(/'/g, "''") + "'";
const unix = (s) => {
  if (!s) return "unixepoch()";
  const iso = /T/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const t = Math.floor(new Date(iso).getTime() / 1000);
  return Number.isFinite(t) ? String(t) : 'unixepoch()';
};
const rows = [];
const add = (id, kind, { title = '', body = '', url = '', tags = '', pinned = 0, created }) =>
  rows.push(`INSERT OR REPLACE INTO site_content (id,site_uid,kind,title,body,url,tags,status,pinned,created,updated) VALUES (${q(id)},'me',${q(kind)},${q(title)},${q(body)},${q(url)},${q(tags)},'published',${pinned},${created},unixepoch());`);

// 动态
moments.forEach((m) => add(`wc_m_${m.id}`, 'dynamic', { body: m.content, url: m.url || '', created: unix(m.published_at || m.created_at) }));
// 文章
posts.forEach((p) => add(`wc_p_${p.id}`, 'article', { title: p.title, body: p.content, url: p.cover_url || '', created: unix(p.published_at || p.created_at) }));
// 作品 → 项目(展开分组,组名进 tags)
let wi = 0;
for (const g of (byKey.works?.groups || [])) {
  for (const pr of (g.projects || [])) {
    const name = (pr.emoji ? pr.emoji + ' ' : '') + pr.name;
    add(`wc_w_${wi++}`, 'project', { title: name, body: pr.description || '', url: pr.url || '', tags: g.label || '', created: `unixepoch()` });
  }
}
// 关于(单条;contacts 以 JSON 存 tags 字段)
if (byKey.about) {
  add('wc_about', 'about', { title: byKey.about.title || '关于', body: byKey.about.intro || '', tags: JSON.stringify(byKey.about.contacts || []), created: 'unixepoch()' });
}

process.stdout.write(rows.join('\n') + '\n');
process.stderr.write(`生成 ${rows.length} 条:动态 ${moments.length} / 文章 ${posts.length} / 项目 ${wi} / 关于 ${byKey.about ? 1 : 0}\n`);
