import { db } from './client.js'

export const initSystemTables = () => {
  db.exec(`
    -- 系统 KV(账号哈希 / AI 配置 / 主页元数据 / 想法元数据 等)
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 助理对话(单一全局对话,conversation_id 暂硬编码 'main')
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      message         TEXT NOT NULL,
      memo            TEXT,
      usage           TEXT,
      meta            TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

    -- 对外授权 token
    CREATE TABLE IF NOT EXISTS tokens (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      token         TEXT NOT NULL UNIQUE,
      scope         TEXT NOT NULL DEFAULT 'read_write',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
  `)
}
