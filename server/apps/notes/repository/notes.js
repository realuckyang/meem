import { db } from '../../../main/repository/client.js'
import { randomBytes } from 'node:crypto'

const COLS = 'id, notebook_id, title, content, icon, cover, sort_order, created_at, updated_at'
export const makeId = () => randomBytes(6).toString('hex')

export const findNoteById = (id) =>
  db.prepare(`SELECT ${COLS} FROM apps_notes WHERE id = ?`).get(id)

export const listNotesIn = (notebookId) =>
  notebookId
    ? db.prepare(`SELECT ${COLS} FROM apps_notes WHERE notebook_id = ? ORDER BY sort_order ASC, created_at ASC`).all(notebookId)
    : db.prepare(`SELECT ${COLS} FROM apps_notes WHERE notebook_id IS NULL ORDER BY sort_order ASC, created_at ASC`).all()

export const createNote = ({ id, notebookId, title, content, icon, cover }) => {
  db.prepare(
    `INSERT INTO apps_notes (id, notebook_id, title, content, icon, cover, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, notebookId ?? null, title ?? '', content ?? '', icon ?? null, cover ?? null, Date.now())
  return findNoteById(id)
}

export const updateNote = (id, { title, content, icon, cover, notebookId, sortOrder }) => {
  db.prepare(
    `UPDATE apps_notes
        SET title = COALESCE(?, title),
            content = COALESCE(?, content),
            icon = COALESCE(?, icon),
            cover = COALESCE(?, cover),
            notebook_id = CASE WHEN ? = 1 THEN ? ELSE notebook_id END,
            sort_order = COALESCE(?, sort_order),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    title ?? null, content ?? null, icon ?? null, cover ?? null,
    notebookId === undefined ? 0 : 1, notebookId ?? null,
    sortOrder ?? null,
    id,
  )
  return findNoteById(id)
}

export const deleteNote = (id) =>
  db.prepare(`DELETE FROM apps_notes WHERE id = ?`).run(id)
