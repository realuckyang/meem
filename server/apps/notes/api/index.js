import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail } from '../../../shared/http/json.js'
import {
  findNotebookById, listNotebooksUnder, createNotebook, updateNotebook, deleteNotebook,
  getNotebookAncestors, isSelfOrDescendant, makeId as makeNotebookId,
} from '../repository/notebooks.js'
import {
  findNoteById, listNotesIn, createNote, updateNote, deleteNote, makeId as makeNoteId,
} from '../repository/notes.js'

const readNullableString = (body, key, maxLen) => {
  if (!body || !(key in body)) return undefined
  const v = body[key]
  if (v === null || v === '') return null
  return String(v).slice(0, maxLen)
}

export const handleNotesApi = async (req, res, path, url) => {
  // ===== 笔记本根列表 =====
  if (path === '/apps/notebooks' && req.method === 'GET') {
    const parentId = url.searchParams.get('parent_id') || null
    return ok(res, { notebooks: listNotebooksUnder(parentId) })
  }
  if (path === '/apps/notebooks' && req.method === 'POST') {
    const body = await readBody(req)
    const name = String(body?.name || '').trim().slice(0, 120)
    if (!name) return fail(res, 'name_required', 400)
    const parentId = body?.parent_id ? String(body.parent_id) : null
    if (parentId && !findNotebookById(parentId)) return fail(res, 'parent_not_found', 404)
    const nb = createNotebook({
      id: makeNotebookId(),
      parentId,
      name,
      icon: body?.icon ? String(body.icon).slice(0, 32) : null,
      cover: body?.cover ? String(body.cover).slice(0, 2048) : null,
    })
    return ok(res, { notebook: nb }, 201)
  }
  const nbM = path.match(/^\/apps\/notebooks\/([0-9a-zA-Z]+)$/)
  if (nbM) {
    const id = nbM[1]
    const existing = findNotebookById(id)
    if (!existing) return fail(res, 'not_found', 404)
    if (req.method === 'GET') {
      const [ancestors, children, notes] = [
        getNotebookAncestors(id),
        listNotebooksUnder(id),
        listNotesIn(id),
      ]
      return ok(res, { notebook: existing, breadcrumb: ancestors, children, notes })
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const patch = {}
      if (typeof body?.name === 'string') patch.name = body.name.trim().slice(0, 120)
      if (Number.isFinite(body?.sort_order)) patch.sortOrder = Number(body.sort_order)
      const icon  = readNullableString(body, 'icon',  32)
      const cover = readNullableString(body, 'cover', 2048)
      if (icon  !== undefined) patch.icon  = icon
      if (cover !== undefined) patch.cover = cover
      if ('parent_id' in (body || {})) {
        const nextParent = body.parent_id ? String(body.parent_id) : null
        if (nextParent) {
          if (nextParent === id) return fail(res, 'cannot_nest_in_self', 400)
          if (!findNotebookById(nextParent)) return fail(res, 'parent_not_found', 404)
          if (isSelfOrDescendant(id, nextParent)) return fail(res, 'cannot_nest_in_descendant', 400)
        }
        patch.parentId = nextParent
      }
      return ok(res, { notebook: updateNotebook(id, patch) })
    }
    if (req.method === 'DELETE') {
      deleteNotebook(id)
      return ok(res, { deleted: true })
    }
  }

  // ===== 笔记 =====
  if (path === '/apps/notes' && req.method === 'POST') {
    const body = await readBody(req)
    const notebookId = body?.notebook_id ? String(body.notebook_id) : null
    if (notebookId && !findNotebookById(notebookId)) return fail(res, 'notebook_not_found', 404)
    const note = createNote({
      id: makeNoteId(),
      notebookId,
      title: String(body?.title || '').slice(0, 200),
      content: String(body?.content || '').slice(0, 200_000),
      icon:  body?.icon  ? String(body.icon).slice(0, 32)   : null,
      cover: body?.cover ? String(body.cover).slice(0, 2048): null,
    })
    return ok(res, { note }, 201)
  }
  const nM = path.match(/^\/apps\/notes\/([0-9a-zA-Z]+)$/)
  if (nM) {
    const id = nM[1]
    const existing = findNoteById(id)
    if (!existing) return fail(res, 'not_found', 404)
    if (req.method === 'GET') {
      const breadcrumb = existing.notebook_id ? getNotebookAncestors(existing.notebook_id) : []
      return ok(res, { note: existing, breadcrumb })
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const patch = {}
      if (typeof body?.title === 'string')   patch.title = body.title.slice(0, 200)
      if (typeof body?.content === 'string') patch.content = body.content.slice(0, 200_000)
      if (Number.isFinite(body?.sort_order)) patch.sortOrder = Number(body.sort_order)
      const icon  = readNullableString(body, 'icon',  32)
      const cover = readNullableString(body, 'cover', 2048)
      if (icon  !== undefined) patch.icon  = icon
      if (cover !== undefined) patch.cover = cover
      if ('notebook_id' in (body || {})) {
        if (body.notebook_id === null) patch.notebookId = null
        else if (typeof body.notebook_id === 'string' && body.notebook_id) {
          if (!findNotebookById(body.notebook_id)) return fail(res, 'notebook_not_found', 404)
          patch.notebookId = body.notebook_id
        }
      }
      return ok(res, { note: updateNote(id, patch) })
    }
    if (req.method === 'DELETE') {
      deleteNote(id)
      return ok(res, { deleted: true })
    }
  }

  return false
}
