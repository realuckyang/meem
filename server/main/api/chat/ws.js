// 聊天的 WS handler:
// 客户端发 { type: 'chat.send', content }
// 服务端推:
//   { type: 'chat.delta', delta }
//   { type: 'chat.assistant_tool_calls', message }
//   { type: 'chat.tool_result', message }
//   { type: 'chat.done' }
//   { type: 'chat.error', message }

import { registerHandler } from '../../service/runtime/ws.js'
import { getAllSettings } from '../../repository/settings.js'
import { insertMessage, listMessagesAll } from '../../repository/messages.js'
import { chat } from '../../ai/handler.js'
import { buildSystemPrompt } from '../../service/prompt/index.js'

const CONVERSATION_ID = 'main'
const safeParse = (s, fb = null) => { try { return JSON.parse(s) } catch { return fb } }

// 同一个客户端不允许并发跑多个 chat
const runningByClient = new Map() // clientId → AbortController

registerHandler('chat.send', async (msg, { send, clientId }) => {
  if (runningByClient.has(clientId)) {
    send({ type: 'chat.error', message: 'already_running' })
    return
  }

  const content = String(msg?.content || '').trim()
  if (!content) { send({ type: 'chat.error', message: 'content_required' }); return }

  const settings = getAllSettings()
  const apiUrl = settings.ai_base_url
  const apiKey = settings.ai_api_key
  const model  = settings.ai_model
  if (!apiUrl || !apiKey || !model) {
    send({ type: 'chat.error', message: 'ai_not_configured' })
    return
  }
  const rounds = [30, 100, 500].includes(Number(settings.ai_context_rounds))
    ? Number(settings.ai_context_rounds) : 100

  // 截断历史到 (rounds - 1) 个 user
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
  send({ type: 'chat.user_committed' })

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    userMsg,
  ]

  const abortController = new AbortController()
  runningByClient.set(clientId, abortController)

  // 把 ai/handler 的事件转成 chat.* 推送 + 落库
  const onEvent = (evt) => {
    try {
      if (evt.type === 'delta') {
        send({ type: 'chat.delta', delta: evt.delta })
      } else if (evt.type === 'assistant_tool_calls' && evt.message) {
        send({ type: 'chat.assistant_tool_calls', message: evt.message })
        insertMessage({ conversationId: CONVERSATION_ID, message: evt.message })
      } else if (evt.type === 'tool_call') {
        // 这条只是逐个 tool_call 的镜像,assistant_tool_calls 里已有完整列表,这里转发即可
        send({ type: 'chat.tool_call', toolCall: evt.toolCall })
      } else if (evt.type === 'tool_result' && evt.message) {
        send({ type: 'chat.tool_result', message: evt.message })
        insertMessage({ conversationId: CONVERSATION_ID, message: evt.message })
      } else if (evt.type === 'done' && evt.message) {
        send({ type: 'chat.done' })
        insertMessage({ conversationId: CONVERSATION_ID, message: evt.message, meta: { model } })
      }
    } catch (e) { console.error('chat onEvent failed', e?.message) }
  }

  try {
    await chat(messages, {
      apiUrl,
      apiKey,
      model,
      toolContext: {},
      signal: abortController.signal,
      send: onEvent,
    })
  } catch (err) {
    if (err?.name === 'AbortError') send({ type: 'chat.aborted' })
    else send({ type: 'chat.error', message: err?.message || 'chat_failed' })
  } finally {
    runningByClient.delete(clientId)
  }
})

registerHandler('chat.abort', async (_msg, { clientId, send }) => {
  const c = runningByClient.get(clientId)
  if (c) {
    c.abort()
    send({ type: 'chat.aborted' })
  }
})
