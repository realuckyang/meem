import { db } from '../../../main/repository/client.js'

export const initTodosDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps_todos (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      done        INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_apps_todos_done ON apps_todos(done, sort_order);
  `)
}
