import { ok, fail } from '../../../shared/http/json.js'
import { isAuthenticated } from '../../service/auth/index.js'
import { listMessagesPage } from '../../repository/messages.js'

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

// HTTP 只剩历史拉取;实时收发走 WS(/ws → chat.send / chat.abort)
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
  return false
}
