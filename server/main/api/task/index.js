import { readBody } from '../../../shared/http/readBody.js'
import { ok, fail, json } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { listTaskRecords } from '../../service/task/list.js'
import { getTaskDetail } from '../../service/task/detail.js'
import { listTaskMessages } from '../../service/task/messages.js'
import { stopTask } from '../../service/task/stop.js'
import { createAgentTask, createInstantTask } from '../../service/task/create.js'

const handleCreateInstant = async (req, res) => {
  const { app, title = '', payload, meta = null } = (await readBody(req)) || {}
  if (!String(app || '').trim()) return fail(res, 'app_required', 400)
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return fail(res, 'payload.messages_required', 400)
  }
  try {
    const result = await createInstantTask({
      app: String(app).trim(),
      title: String(title).trim(),
      meta,
      payload,
    })
    return ok(res, result)
  } catch (e) {
    return fail(res, e?.message || 'task_failed', 500)
  }
}

const handleCreateAgent = async (req, res) => {
  const { app, title = '', payload, meta = null, wait = true } = (await readBody(req)) || {}
  if (!String(app || '').trim()) return fail(res, 'app_required', 400)
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return fail(res, 'payload.messages_required', 400)
  }
  try {
    const result = await createAgentTask({
      app: String(app).trim(),
      title: String(title).trim(),
      payload,
      meta,
      wait: Boolean(wait),
    })
    return ok(res, result)
  } catch (e) {
    return fail(res, e?.message || 'task_failed', 500)
  }
}

export const handleTaskApi = async (req, res, path, url) => {
  if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)

  if (path === '/api/task' && req.method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || 20)
    return json(res, listTaskRecords({ limit }))
  }
  if (path === '/api/task/detail' && req.method === 'GET') {
    const id = Number(url.searchParams.get('id') || 0)
    if (!Number.isInteger(id) || id <= 0) return fail(res, 'invalid_id', 400)
    const task = getTaskDetail({ id })
    if (!task) return fail(res, 'not_found', 404)
    return ok(res, { task })
  }
  if (path === '/api/task/messages' && req.method === 'GET') {
    const id = Number(url.searchParams.get('id') || 0)
    if (!Number.isInteger(id) || id <= 0) return fail(res, 'invalid_id', 400)
    const task = getTaskDetail({ id })
    if (!task) return fail(res, 'not_found', 404)
    return ok(res, { messages: listTaskMessages({ conversationId: task.conversation_id || '' }) })
  }
  if (path === '/api/task/create/instant' && req.method === 'POST') return handleCreateInstant(req, res)
  if (path === '/api/task/create/agent'   && req.method === 'POST') return handleCreateAgent(req, res)
  if (path === '/api/task/stop' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    const id = Number(body.id || 0)
    if (!Number.isInteger(id) || id <= 0) return fail(res, 'invalid_id', 400)
    const result = stopTask({ id })
    if (result?.status) return fail(res, result.message, result.status)
    return ok(res, result)
  }
  return false
}
