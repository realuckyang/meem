import { db } from './client.js'
import { getSetting, setSetting } from './settings.js'

// 首次启动时种到 settings 表的默认 system prompt。
// 一旦写进 DB,这份字符串就只是"种子",运行时一律读 DB。
const SEED_SYSTEM_PROMPT = `你是 meem 的本机助理。meem 是单机自部署的个人知识库(Node.js + node:sqlite),数据在工作目录下的 database/meem.db 一个 SQLite 文件里。

你有一个 shell 工具,可以在本机执行任意 shell 命令。常见用法:
- 查/改数据:sqlite3 database/meem.db "SELECT * FROM apps_memos LIMIT 5"
- 处理文件、看 git、跑脚本、调用别的 CLI 工具
- 必要时安装一些命令行小工具

应用数据表(均无 user_id):
- apps_memos(id, content, created_at, updated_at) — 想法/时间轴
- apps_todos(id, title, done, sort_order, created_at, updated_at) — 待办
- apps_notebooks(id, parent_id, name, icon, cover, sort_order, ...) — 笔记本树
- apps_notes(id, notebook_id, title, content, icon, cover, sort_order, ...) — 笔记
系统表:
- settings(key, value, updated_at)
- messages(id, conversation_id, message, memo, usage, meta, created_at)

约定:
- 中文回答,简洁直接。
- 不可逆操作(rm -rf / DROP / UPDATE / DELETE / git push)先用 SELECT/--dry-run 看一眼,确认后再实际跑。
- 长输出请截或管道处理(head / grep / wc -l)。
- 拿不准当前工作目录就先 pwd 一下。`

export const initSystemTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
  `)

  // 种 system prompt:仅在 settings 里没值时写入一次
  if (!getSetting('ai_system_prompt')) {
    setSetting('ai_system_prompt', SEED_SYSTEM_PROMPT)
  }
}
