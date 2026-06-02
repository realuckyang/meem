import type { Env } from '../../types';
import type { StorageRepo } from './types';

// 数据库只读 SQL + R2 云存储
export function makeStorage(env: Env, uid: string): StorageRepo {
  const DB = env.DB;
  return {
    async sql(query) { const r = await DB.prepare(query).all(); return r.results; },
    async r2Put(path, content) { await env.DOWNLOADS.put(`${uid}/${path}`, content); },
    async r2Get(path) { const o = await env.DOWNLOADS.get(`${uid}/${path}`); return o ? o.text() : null; },
    async r2List(prefix) { const l = await env.DOWNLOADS.list({ prefix: `${uid}/${prefix}` }); return l.objects.map((o) => o.key.slice(uid.length + 1)); },
    async r2Delete(path) { await env.DOWNLOADS.delete(`${uid}/${path}`); },
  };
}
