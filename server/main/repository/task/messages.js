// 任务过程消息存到通用 messages 表(复用 conversation_id 做隔离,
// task 的 conversation_id 形如 'task:xxxx',和聊天的 'main' 区分)
import { db } from '../client.js'

export const saveTaskMessage = (conversationId, msg, meta = null) => {
  db.prepare(
    'INSERT INTO messages (conversation_id, message, meta) VALUES (?, ?, ?)'
  ).run(
    conversationId,
    JSON.stringify(msg),
    meta ? JSON.stringify(meta) : null,
  )
}

export const listMessagesByConversationId = (conversationId) =>
  db.prepare(
    `SELECT id, message, meta, created_at FROM messages
      WHERE conversation_id = ? ORDER BY id ASC`
  ).all(conversationId)
