// sql_query 用 better-sqlite3 跑;同步,但在 async 包裹里返回 promise
import { db } from '../repository/client.js'

const isSelect = (sql) => /^\s*(select|with|pragma)\b/i.test(sql)

export const sql_query = async ({ sql }) => {
  const text = String(sql || '').trim().replace(/;+\s*$/, '')
  if (!text) throw new Error('sql is empty')
  const stmt = db.prepare(text)
  if (isSelect(text)) {
    const results = stmt.all()
    return { results, meta: { rows: results.length } }
  }
  const info = stmt.run()
  return {
    results: [],
    meta: {
      changes: info.changes,
      last_insert_rowid: typeof info.lastInsertRowid === 'bigint'
        ? Number(info.lastInsertRowid) : info.lastInsertRowid,
    },
  }
}
