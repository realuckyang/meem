import { db } from './client.js'

const COLS = 'id, name, token, scope, created_at, last_used_at'

export const listTokens = () =>
  db.prepare(`SELECT ${COLS} FROM tokens ORDER BY created_at DESC`).all()

export const findTokenByValue = (token) =>
  db.prepare(`SELECT id AS token_id, scope FROM tokens WHERE token = ?`).get(token)

export const touchToken = (id) =>
  db.prepare(`UPDATE tokens SET last_used_at = datetime('now') WHERE id = ?`).run(id)

export const createToken = ({ id, name, token, scope = 'read_write' }) => {
  db.prepare(
    `INSERT INTO tokens (id, name, token, scope, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, name, token, scope)
  return db.prepare(`SELECT ${COLS} FROM tokens WHERE id = ?`).get(id)
}

export const deleteAllTokens = () => db.prepare(`DELETE FROM tokens`).run()
export const deleteToken = (id) => db.prepare(`DELETE FROM tokens WHERE id = ?`).run(id)
