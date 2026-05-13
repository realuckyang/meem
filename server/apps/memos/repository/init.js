import { db } from '../../../main/repository/client.js'

export const initMemosDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps_memos (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_apps_memos_created ON apps_memos(created_at DESC);
  `)
}
