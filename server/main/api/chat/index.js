import { readBody, parseCookies } from '../../../shared/http/readBody.js'
import { ok, fail, json } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { getAllSettings } from '../../repository/settings.js'
import { insertMessage, listMessagesAll, listMessagesPage } from '../../repository/messages.js'
import { chat } from '../../ai/handler.js'
import { DEFAULT_SYSTEM_PROMPT } from '../../ai/system-prompt.js'

const CONVERSATION_ID = 'main'

const safeParse = (s, fb = null) => { try { return JSON.parse(s) } catch { return fb } }

const serialize = (row) => ({
  id:              row.id,
  conversation_id: row.conversation_id,
  message:         safeParse(row.message, { role: 'assistant', content: row.message }),
  memo:            row.memo || '',
  usage:           safeParse(row.usage, null),
  meta:            safeParse(row.meta,  null),
  created_at:      row.created_at,
})

export const handleChatApi = async (req, res, path, url) => {
  if (path === '/api/chat/messages' && req.method === 'GET') {
    if (!isAuthenticated(req)) return fail(res, 'unauthorized', 401)
    const before = url.searchParams.get('before')
    const limit  = url.searchParams.get('limit')
    const rows = listMessagesPage(CONVERSATION_ID, {
      before: before ? Number(before) : undefined,
      limit:  limit  ? Number(limit)  : 30,
    })
    return ok(res, { messages: rows.map(serialize) })
  }

  if (path === '/api/chat/send' && req.method === 'POST') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, message: 'unauthorized' }))
    }
    const body = await readBody(req)
    const content = String(body?.content || '').trim()
    if (!content) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, message: 'content_required' }))
    }
    const settings = getAllSettings()
    const apiUrl = settings.ai_base_url
    const apiKey = settings.ai_api_key
    const model  = settings.ai_model
    if (!apiUrl || !apiKey || !model) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, message: 'ai_not_configured' }))
    }
    const rounds = [30, 100, 500].includes(Number(settings.ai_context_rounds))
      ? Number(settings.ai_context_rounds) : 100

    // 拉历史并截断到 rounds-1 个 user
    const allRows = listMessagesAll(CONVERSATION_ID).map(r => safeParse(r.message, null)).filter(Boolean)
    const target = Math.max(0, rounds - 1)
    let sliceFrom = 0
    if (target === 0) sliceFrom = allRows.length
    else {
      let seen = 0
      for (let i = allRows.length - 1; i >= 0; i--) {
        if (allRows[i].role === 'user') { seen++; if (seen >= target) { sliceFrom = i; break } }
      }
    }
    const history = allRows.slice(sliceFrom)

    const userMsg = { role: 'user', content }
    insertMessage({ conversationId: CONVERSATION_ID, message: userMsg })

    const systemPrompt = String(settings.ai_system_prompt || '').trim() || DEFAULT_SYSTEM_PROMPT
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      userMsg,
    ]

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
    const close = () => { try { res.write(`data: [DONE]\n\n`) } catch {} try { res.end() } catch {} }

    const send = (evt) => {
      sse(evt)
      try {
        if (evt.type === 'assistant_tool_calls' && evt.message) {
          insertMessage({ conversationId: CONVERSATION_ID, message: evt.message })
        } else if (evt.type === 'tool_result' && evt.message) {
          insertMessage({ conversationId: CONVERSATION_ID, message: evt.message })
        } else if (evt.type === 'done' && evt.message) {
          insertMessage({ conversationId: CONVERSATION_ID, message: evt.message, meta: { model } })
        }
      } catch (e) {
        console.error('persist message failed', e?.message)
      }
    }

    try {
      await chat(messages, { apiUrl, apiKey, model, toolContext: {}, send })
    } catch (err) {
      sse({ type: 'error', message: err?.message || 'chat_failed' })
    } finally {
      close()
    }
    return true
  }

  return false
}
