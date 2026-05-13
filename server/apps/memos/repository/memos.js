import { db } from '../../../main/repository/client.js'
import { randomBytes } from 'node:crypto'

const COLS = 'id, content, created_at, updated_at'
export const makeId = () => randomBytes(6).toString('hex')

export const listMemos = ({ limit = 30, offset = 0 } = {}) =>
  db.prepare(
    `SELECT ${COLS} FROM apps_memos ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(Math.max(1, Math.min(500, Number(limit) || 30)), Math.max(0, Number(offset) || 0))

export const findMemoById = (id) =>
  db.prepare(`SELECT ${COLS} FROM apps_memos WHERE id = ?`).get(id)

export const insertMemo = ({ id, content }) => {
  db.prepare(
    `INSERT INTO apps_memos (id, content, created_at, updated_at)
     VALUES (?, ?, datetime('now'), datetime('now'))`
  ).run(id, content)
  return findMemoById(id)
}

export const updateMemo = (id, { content }) => {
  db.prepare(
    `UPDATE apps_memos SET content = COALESCE(?, content), updated_at = datetime('now') WHERE id = ?`
  ).run(content ?? null, id)
  return findMemoById(id)
}

export const deleteMemo = (id) =>
  db.prepare(`DELETE FROM apps_memos WHERE id = ?`).run(id)
