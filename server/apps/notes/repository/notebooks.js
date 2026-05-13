import { db } from '../../../main/repository/client.js'
import { randomBytes } from 'node:crypto'

const COLS = 'id, parent_id, name, icon, cover, sort_order, created_at, updated_at'
export const makeId = () => randomBytes(6).toString('hex')

export const findNotebookById = (id) =>
  db.prepare(`SELECT ${COLS} FROM apps_notebooks WHERE id = ?`).get(id)

export const listNotebooksUnder = (parentId) =>
  parentId
    ? db.prepare(`SELECT ${COLS} FROM apps_notebooks WHERE parent_id = ? ORDER BY sort_order ASC, created_at ASC`).all(parentId)
    : db.prepare(`SELECT ${COLS} FROM apps_notebooks WHERE parent_id IS NULL ORDER BY sort_order ASC, created_at ASC`).all()

export const createNotebook = ({ id, parentId, name, icon, cover }) => {
  db.prepare(
    `INSERT INTO apps_notebooks (id, parent_id, name, icon, cover, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, parentId ?? null, name, icon ?? null, cover ?? null, Date.now())
  return findNotebookById(id)
}

export const updateNotebook = (id, { name, icon, cover, parentId, sortOrder }) => {
  db.prepare(
    `UPDATE apps_notebooks
        SET name = COALESCE(?, name),
            icon = COALESCE(?, icon),
            cover = COALESCE(?, cover),
            parent_id = CASE WHEN ? = 1 THEN ? ELSE parent_id END,
            sort_order = COALESCE(?, sort_order),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    name ?? null, icon ?? null, cover ?? null,
    parentId === undefined ? 0 : 1, parentId ?? null,
    sortOrder ?? null,
    id,
  )
  return findNotebookById(id)
}

export const deleteNotebook = (id) =>
  db.prepare(`DELETE FROM apps_notebooks WHERE id = ?`).run(id)

export const getNotebookAncestors = (id) => {
  const chain = []
  let cur = findNotebookById(id)
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    chain.push(cur); seen.add(cur.id)
    if (!cur.parent_id) break
    cur = findNotebookById(cur.parent_id)
  }
  return chain.reverse()
}

export const isSelfOrDescendant = (ancestorId, descendantId) => {
  if (!descendantId) return false
  if (ancestorId === descendantId) return true
  let cur = findNotebookById(descendantId)
  const seen = new Set()
  while (cur && cur.parent_id && !seen.has(cur.id)) {
    seen.add(cur.id)
    if (cur.parent_id === ancestorId) return true
    cur = findNotebookById(cur.parent_id)
  }
  return false
}
