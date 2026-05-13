import { db } from './client.js'

export const getAllSettings = () => {
  const rows = db.prepare(`SELECT key, value FROM settings`).all()
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export const getSetting = (key) =>
  db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)?.value ?? null

export const setSetting = (key, value) => {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value ?? null)
}
