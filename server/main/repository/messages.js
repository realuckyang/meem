import { db } from './client.js'

// 列对齐 AIOS:message / meta / remark。
// remark = 助理在回答末尾用 <remark>...</remark> 写下的"长期记忆要点"(由 chat 流过滤器抽出后落库)。
export const insertMessage = ({ conversationId, message, meta, remark }) => {
  return db.prepare(
    `INSERT INTO messages (conversation_id, message, meta, remark)
     VALUES (?, ?, ?, ?)
     RETURNING id, conversation_id, message, meta, remark, created_at`
  ).get(
    conversationId,
    typeof message === 'string' ? message : JSON.stringify(message),
    meta   ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null,
    remark ?? null,
  )
}

export const listMessagesAll = (conversationId) =>
  db.prepare(
    `SELECT id, conversation_id, message, meta, remark, created_at
       FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC`
  ).all(conversationId)

export const listMessagesPage = (conversationId, { before, limit = 30 } = {}) => {
  const lim = Math.max(1, Math.min(200, Number(limit) || 30))
  const rows = before
    ? db.prepare(
        `SELECT id, conversation_id, message, meta, remark, created_at
           FROM messages WHERE conversation_id = ? AND id < ?
           ORDER BY id DESC LIMIT ?`
      ).all(conversationId, before, lim)
    : db.prepare(
        `SELECT id, conversation_id, message, meta, remark, created_at
           FROM messages WHERE conversation_id = ?
           ORDER BY id DESC LIMIT ?`
      ).all(conversationId, lim)
  return rows.reverse()
}
