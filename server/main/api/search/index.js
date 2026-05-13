// 跨应用搜索:笔记本/笔记/想法
import { ok, fail } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { db } from '../../repository/client.js'

const MAX_LIMIT = 50
const SNIPPET_LEN = 120
const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const makeSnippet = (text, q) => {
  if (!text) return ''
  const lower = text.toLowerCase()
  const i = lower.indexOf(q.toLowerCase())
  if (i < 0) return text.slice(0, SNIPPET_LEN)
  const start = Math.max(0, i - 30)
  const end = Math.min(text.length, i + q.length + SNIPPET_LEN - 30)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

// 检查表存在(应用没启动建表时不报错)
const tableExists = (name) =>
  !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name)

export const handleSearchApi = async (req, res, path, url) => {
  if (path !== '/api/search' || req.method !== 'GET') return false
  if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)

  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120)
  if (!q) return ok(res, { query: '', notebooks: [], notes: [], memos: [] })

  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(url.searchParams.get('limit')) || 20))
  const like  = `%${q.replace(/[%_]/g, m => `\\${m}`)}%`

  let notebooks = [], notes = [], memos = []
  if (tableExists('apps_notebooks')) {
    notebooks = db.prepare(
      `SELECT id, parent_id, name, icon, cover, updated_at
         FROM apps_notebooks WHERE name LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?`
    ).all(like, limit)
  }
  if (tableExists('apps_notes')) {
    const rows = db.prepare(
      `SELECT id, notebook_id, title, icon, content, updated_at
         FROM apps_notes WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?`
    ).all(like, like, limit)
    notes = rows.map(n => ({
      id: n.id, notebook_id: n.notebook_id, title: n.title, icon: n.icon,
      updated_at: n.updated_at, snippet: makeSnippet(stripHtml(n.content), q),
    }))
  }
  if (tableExists('apps_memos')) {
    const rows = db.prepare(
      `SELECT id, content, created_at, updated_at
         FROM apps_memos WHERE content LIKE ? ESCAPE '\\'
         ORDER BY created_at DESC LIMIT ?`
    ).all(like, limit)
    memos = rows.map(m => ({
      id: m.id, created_at: m.created_at, updated_at: m.updated_at,
      snippet: makeSnippet(String(m.content || ''), q),
    }))
  }

  return ok(res, { query: q, notebooks, notes, memos })
}
