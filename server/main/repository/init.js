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
- messages(id, conversation_id, message, meta, remark, created_at)
  remark = 助理在 <remark>...</remark> 里写下的"长期主线",长对话切窗口时回灌

约定:
- 中文回答,简洁直接。
- 不可逆操作(rm -rf / DROP / UPDATE / DELETE / git push)先用 SELECT/--dry-run 看一眼,确认后再实际跑。
- 长输出请截或管道处理(head / grep / wc -l)。
- 拿不准当前工作目录就先 pwd 一下。`

// 老 DB 迁移:meem 早期把 remark 列叫 memo,还多了 usage 列。
// 这里把它们对齐回 AIOS 的形态(remark + 没有 usage)。
const migrateMessages = () => {
  const cols = db.prepare(`PRAGMA table_info(messages)`).all().map((c) => c.name)
  if (!cols.length) return // 表都不存在,新建走 DDL
  if (cols.includes('memo') && !cols.includes('remark')) {
    db.exec(`ALTER TABLE messages RENAME COLUMN memo TO remark`)
  }
  if (cols.includes('usage')) {
    db.exec(`ALTER TABLE messages DROP COLUMN usage`)
  }
  // 老索引名(meem 自创)→ 删,后面统一用 AIOS 的 partial index
  db.exec(`DROP INDEX IF EXISTS idx_messages_conv`)
}

// 老 DB 迁移:memories 从 enabled+pinned 双开关改为三档 visibility。
//   visibility='count'   只让助理知道"有 N 条记忆"
//   visibility='summary' 注入标题 + 描述,内容隐藏
//   visibility='full'    全部注入(标题 + 描述 + 内容)
const migrateMemories = () => {
  const cols = db.prepare(`PRAGMA table_info(memories)`).all().map((c) => c.name)
  if (!cols.length) return
  if (!cols.includes('visibility')) {
    db.exec(`ALTER TABLE memories ADD COLUMN visibility TEXT NOT NULL DEFAULT 'full'`)
    // enabled=0 → 'count'(原本就藏起来的),enabled=1 → 'full'(原本完全注入的)
    if (cols.includes('enabled')) {
      db.exec(`UPDATE memories SET visibility = CASE WHEN enabled = 0 THEN 'count' ELSE 'full' END`)
    }
  }
  // 必须先把引用旧列的索引干掉,否则 DROP COLUMN 会失败(SQLite 不允许列被索引引用时删除)
  db.exec(`DROP INDEX IF EXISTS idx_memories_enabled_pinned_updated`)
  for (const dead of ['enabled', 'pinned', 'updated_at']) {
    if (cols.includes(dead)) db.exec(`ALTER TABLE memories DROP COLUMN ${dead}`)
  }
}

export const initSystemTables = () => {
  // 表结构对齐 AIOS(messages、tasks、memories)。
  // settings 在 AIOS 里只有 key/value,meem 多保留 updated_at(便于诊断)。
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
      meta            TEXT,
      remark          TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT,
      app             TEXT NOT NULL,
      title           TEXT NOT NULL DEFAULT '',
      mode            TEXT NOT NULL DEFAULT 'agent',
      payload         TEXT NOT NULL,
      meta            TEXT,
      response        TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      error           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, id DESC);

    -- 用户写给助理的长期记忆。visibility 三档,见 migrateMemories 注释。
    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      visibility  TEXT NOT NULL DEFAULT 'full',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // 表建好后做列迁移(老 DB);索引依赖迁移后的列,在后面统一建。
  migrateMessages()
  migrateMemories()

  // 迁移后的列已经齐了,这里统一建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_conv_remark
      ON messages(conversation_id, id DESC) WHERE remark IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_memories_visibility_id
      ON memories(visibility, id DESC);
  `)

  // 种 system prompt:仅在 settings 里没值时写入一次
  if (!getSetting('ai_system_prompt')) {
    setSetting('ai_system_prompt', SEED_SYSTEM_PROMPT)
  }
}
