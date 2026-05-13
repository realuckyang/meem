import { db } from '../../../main/repository/client.js'
import { randomBytes } from 'node:crypto'

const COLS = 'id, title, done, sort_order, created_at, updated_at'
export const makeId = () => randomBytes(6).toString('hex')

export const listTodos = () =>
  db.prepare(
    `SELECT ${COLS} FROM apps_todos
      ORDER BY done ASC, sort_order ASC, created_at ASC`
  ).all().map(r => ({ ...r, done: !!r.done }))

export const findTodoById = (id) => {
  const r = db.prepare(`SELECT ${COLS} FROM apps_todos WHERE id = ?`).get(id)
  return r ? { ...r, done: !!r.done } : null
}

export const insertTodo = ({ id, title }) => {
  db.prepare(
    `INSERT INTO apps_todos (id, title, done, sort_order, created_at, updated_at)
     VALUES (?, ?, 0, ?, datetime('now'), datetime('now'))`
  ).run(id, title, Date.now())
  return findTodoById(id)
}

export const updateTodo = (id, { title, done, sortOrder }) => {
  db.prepare(
    `UPDATE apps_todos
        SET title = COALESCE(?, title),
            done  = COALESCE(?, done),
            sort_order = COALESCE(?, sort_order),
            updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    title ?? null,
    done === undefined ? null : (done ? 1 : 0),
    sortOrder ?? null,
    id,
  )
  return findTodoById(id)
}

export const deleteTodo = (id) =>
  db.prepare(`DELETE FROM apps_todos WHERE id = ?`).run(id)
