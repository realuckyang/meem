import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import {
  listMemos, findMemoById, insertMemo, updateMemo, deleteMemo, makeId,
} from '../repository/memos.js'

const MAX_LEN = 20_000

export const handleMemosApi = async (req, res, path, url) => {
  // GET /apps/memos
  if (path === '/apps/memos' && req.method === 'GET') {
    const offset = Number(url.searchParams.get('offset')) || 0
    const limit  = Number(url.searchParams.get('limit'))  || 30
    return ok(res, { memos: listMemos({ offset, limit }) })
  }
  // POST /apps/memos
  if (path === '/apps/memos' && req.method === 'POST') {
    const body = await readBody(req)
    const content = String(body?.content || '').trim()
    if (!content) return fail(res, 'content_required', 400)
    if (content.length > MAX_LEN) return fail(res, 'content_too_long', 400)
    return ok(res, { memo: insertMemo({ id: makeId(), content }) })
  }
  // PATCH/DELETE /apps/memos/:id
  const m = path.match(/^\/apps\/memos\/([0-9a-zA-Z]+)$/)
  if (m) {
    const id = m[1]
    if (!findMemoById(id)) return fail(res, 'not_found', 404)
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      if (body?.content === undefined) return fail(res, 'content_required', 400)
      const content = String(body.content).trim()
      if (!content) return fail(res, 'content_required', 400)
      if (content.length > MAX_LEN) return fail(res, 'content_too_long', 400)
      return ok(res, { memo: updateMemo(id, { content }) })
    }
    if (req.method === 'DELETE') {
      deleteMemo(id)
      return ok(res, {})
    }
  }
  return false
}
