import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import { listTodos, findTodoById, insertTodo, updateTodo, deleteTodo, makeId } from '../repository/todos.js'

const MAX_TITLE = 500

export const handleTodosApi = async (req, res, path) => {
  if (path === '/apps/todos' && req.method === 'GET') {
    return ok(res, { todos: listTodos() })
  }
  if (path === '/apps/todos' && req.method === 'POST') {
    const body = await readBody(req)
    const title = String(body?.title || '').trim().slice(0, MAX_TITLE)
    if (!title) return fail(res, 'title_required', 400)
    return ok(res, { todo: insertTodo({ id: makeId(), title }) })
  }
  const m = path.match(/^\/apps\/todos\/([0-9a-zA-Z]+)$/)
  if (m) {
    const id = m[1]
    if (!findTodoById(id)) return fail(res, 'not_found', 404)
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const patch = {}
      if (typeof body?.title === 'string') {
        const t = body.title.trim().slice(0, MAX_TITLE)
        if (!t) return fail(res, 'title_required', 400)
        patch.title = t
      }
      if (body?.done !== undefined) patch.done = !!body.done
      if (Number.isFinite(body?.sort_order)) patch.sortOrder = Number(body.sort_order)
      return ok(res, { todo: updateTodo(id, patch) })
    }
    if (req.method === 'DELETE') {
      deleteTodo(id)
      return ok(res, {})
    }
  }
  return false
}
