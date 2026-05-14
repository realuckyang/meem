import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import {
  listMemories, getMemory, createMemory, updateMemory, deleteMemory,
} from '../../repository/memory.js'

export const handleMemoryApi = async (req, res, path, url) => {
  if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)

  if (path === '/api/memory/list' && req.method === 'GET') {
    return ok(res, { items: listMemories() })
  }
  if (path === '/api/memory/get' && req.method === 'GET') {
    const id = Number(url.searchParams.get('id') || 0)
    if (!id) return fail(res, 'id_required', 400)
    const item = getMemory(id)
    if (!item) return fail(res, 'not_found', 404)
    return ok(res, { item })
  }
  if (path === '/api/memory/create' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    const title   = String(body.title || '').trim()
    const content = String(body.content || '').trim()
    if (!title)   return fail(res, 'title_required', 400)
    if (!content) return fail(res, 'content_required', 400)
    const item = createMemory({
      title,
      description: body.description || '',
      content,
      visibility:  body.visibility || 'full',
    })
    return ok(res, { item })
  }
  if (path === '/api/memory/update' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    const id = Number(body.id || 0)
    if (!id) return fail(res, 'id_required', 400)
    if (!getMemory(id)) return fail(res, 'not_found', 404)
    const item = updateMemory(id, {
      title:       body.title,
      description: body.description,
      content:     body.content,
      visibility:  body.visibility,
    })
    return ok(res, { item })
  }
  if (path === '/api/memory/delete' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    const id = Number(body.id || 0)
    if (!id) return fail(res, 'id_required', 400)
    deleteMemory(id)
    return ok(res, {})
  }
  return false
}
