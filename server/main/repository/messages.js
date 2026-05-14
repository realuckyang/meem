import { db } from './client.js'

export const insertMessage = ({ conversationId, message, meta }) => {
  return db.prepare(
    `INSERT INTO messages (conversation_id, message, meta)
     VALUES (?, ?, ?)
     RETURNING id, conversation_id, message, meta, created_at`
  ).get(
    conversationId,
    typeof message === 'string' ? message : JSON.stringify(message),
    meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null,
  )
}

export const listMessagesAll = (conversationId) =>
  db.prepare(
    `SELECT id, conversation_id, message, meta, created_at
       FROM messages
      WHERE conversation_id = ?
      ORDER BY id ASC`
  ).all(conversationId)

export const listMessagesPage = (conversationId, { before, limit = 30 } = {}) => {
  const lim = Math.max(1, Math.min(200, Number(limit) || 30))
  const rows = before
    ? db.prepare(
        `SELECT id, conversation_id, message, meta, created_at
           FROM messages WHERE conversation_id = ? AND id < ?
           ORDER BY id DESC LIMIT ?`
      ).all(conversationId, before, lim)
    : db.prepare(
        `SELECT id, conversation_id, message, meta, created_at
           FROM messages WHERE conversation_id = ?
           ORDER BY id DESC LIMIT ?`
      ).all(conversationId, lim)
  return rows.reverse()
}
