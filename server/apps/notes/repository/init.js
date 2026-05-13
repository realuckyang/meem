import { db } from '../../../main/repository/client.js'

export const initNotesDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps_notebooks (
      id          TEXT PRIMARY KEY,
      parent_id   TEXT REFERENCES apps_notebooks(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      icon        TEXT,
      cover       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_apps_notebooks_parent ON apps_notebooks(parent_id);

    CREATE TABLE IF NOT EXISTS apps_notes (
      id           TEXT PRIMARY KEY,
      notebook_id  TEXT REFERENCES apps_notebooks(id) ON DELETE CASCADE,
      title        TEXT NOT NULL DEFAULT '',
      content      TEXT NOT NULL DEFAULT '',
      icon         TEXT,
      cover        TEXT,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_apps_notes_notebook ON apps_notes(notebook_id);
  `)
}
