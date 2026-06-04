-- Meem schema. Canonical table definitions for a fresh D1 database.
-- Single-tenant personal workstation: one owner, keyed by the meem_uid column ('me').
-- OpenAI-compatible assistant messages stay as a single message JSON blob.

CREATE TABLE users (
  meem_uid  TEXT PRIMARY KEY DEFAULT 'me',
  handle    TEXT NOT NULL DEFAULT 'me',
  name      TEXT NOT NULL DEFAULT 'Meem',
  salt      TEXT NOT NULL,
  hash      TEXT NOT NULL,
  secret    TEXT NOT NULL,
  created   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  meem_uid      TEXT PRIMARY KEY DEFAULT 'me',
  persona       TEXT NOT NULL DEFAULT '',
  llm_url       TEXT NOT NULL DEFAULT '',
  llm_key       TEXT NOT NULL DEFAULT '',
  llm_model     TEXT NOT NULL DEFAULT '',
  max_rounds    INTEGER NOT NULL DEFAULT 30,
  vision        INTEGER NOT NULL DEFAULT 0,
  updated       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE chats (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  parent     TEXT,
  title      TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'running',
  preview    TEXT NOT NULL DEFAULT '',
  peer       TEXT,
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated    INTEGER NOT NULL DEFAULT (unixepoch()),
  closed     INTEGER
);
CREATE INDEX idx_chats_board ON chats(meem_uid, status, updated DESC);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  chat_id  TEXT,
  message    TEXT NOT NULL,
  meta       TEXT,
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_messages_stream ON messages(meem_uid, chat_id, created);

-- 设备(可添加的电脑/浏览器端;AI 按 id 调用)
CREATE TABLE devices (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  kind        TEXT NOT NULL DEFAULT 'computer',   -- computer | browser
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  token       TEXT NOT NULL DEFAULT '',            -- 设备连接令牌
  status      TEXT NOT NULL DEFAULT 'active',       -- active | disabled
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_devices ON devices(meem_uid, kind);
CREATE UNIQUE INDEX idx_devices_token ON devices(token);

CREATE TABLE terminal_snippets (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  name       TEXT NOT NULL DEFAULT '',
  command    TEXT NOT NULL DEFAULT '',
  auto_send  INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_terminal_snippets_order ON terminal_snippets(meem_uid, position, created);

-- 文档(控制台「文档」应用)· 笔记本树 + 页面
CREATE TABLE doc_notebooks (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  parent_id  TEXT,
  name       TEXT NOT NULL DEFAULT '',
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_doc_notebooks ON doc_notebooks(meem_uid, parent_id, sort_order);

CREATE TABLE doc_pages (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  notebook_id TEXT,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_doc_pages ON doc_pages(meem_uid, notebook_id, sort_order);

-- 任务清单(控制台「任务」应用)
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'todo',     -- todo | doing | done
  priority    TEXT NOT NULL DEFAULT 'medium',   -- low | medium | high
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tasks ON tasks(meem_uid, status, updated DESC);

-- Codex 会话事件(控制台「Codex」应用)· 归一化后的事件流,按 codex thread_id 归档
CREATE TABLE codex_events (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  thread_id  TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'agent_message',
  payload    TEXT NOT NULL DEFAULT '{}',
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_codex_events ON codex_events(meem_uid, thread_id, created);

-- 随手记(控制台「随手记」应用)
CREATE TABLE notes (
  id        TEXT PRIMARY KEY,
  meem_uid  TEXT NOT NULL DEFAULT 'me',
  title     TEXT NOT NULL DEFAULT '',
  body      TEXT NOT NULL DEFAULT '',
  pinned    INTEGER NOT NULL DEFAULT 0,
  created   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_notes ON notes(meem_uid, pinned DESC, updated DESC);

INSERT INTO settings (meem_uid) VALUES ('me');

INSERT INTO terminal_snippets (id, meem_uid, name, command, auto_send, position)
VALUES
  ('snippet_claude', 'me', 'claude', 'claude', 1, 10),
  ('snippet_claude_yolo', 'me', 'claude --dangerously-skip-permissions', 'claude --dangerously-skip-permissions', 1, 20),
  ('snippet_codex', 'me', 'codex', 'codex', 1, 30),
  ('snippet_codex_yolo', 'me', 'codex --yolo', 'codex --yolo', 1, 40);
