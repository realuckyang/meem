-- Meem schema. Canonical table definitions for a fresh D1 database.
-- Naming rule:
--   meem_* = private Meem console, agent, apps, devices, deployments.
--   site_* = public website and public visitor interaction.
-- OpenAI-compatible assistant messages stay as a single message JSON blob.

CREATE TABLE meem_users (
  meem_uid  TEXT PRIMARY KEY DEFAULT 'me',
  handle    TEXT NOT NULL DEFAULT 'me',
  name      TEXT NOT NULL DEFAULT 'Meem',
  salt      TEXT NOT NULL,
  hash      TEXT NOT NULL,
  secret    TEXT NOT NULL,
  created   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE meem_settings (
  meem_uid      TEXT PRIMARY KEY DEFAULT 'me',
  persona       TEXT NOT NULL DEFAULT '',
  llm_url       TEXT NOT NULL DEFAULT '',
  llm_key       TEXT NOT NULL DEFAULT '',
  llm_model     TEXT NOT NULL DEFAULT '',
  max_rounds    INTEGER NOT NULL DEFAULT 30,
  vision        INTEGER NOT NULL DEFAULT 0,
  updated       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE meem_chats (
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
CREATE INDEX idx_meem_chats_board ON meem_chats(meem_uid, status, updated DESC);

CREATE TABLE meem_messages (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  chat_id  TEXT,
  message    TEXT NOT NULL,
  meta       TEXT,
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_messages_stream ON meem_messages(meem_uid, chat_id, created);

-- 设备(可添加的电脑/浏览器端;AI 按 id 调用)
CREATE TABLE meem_devices (
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
CREATE INDEX idx_meem_devices ON meem_devices(meem_uid, kind);
CREATE UNIQUE INDEX idx_meem_devices_token ON meem_devices(token);

CREATE TABLE meem_terminal_snippets (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  name       TEXT NOT NULL DEFAULT '',
  command    TEXT NOT NULL DEFAULT '',
  auto_send  INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_terminal_snippets_order ON meem_terminal_snippets(meem_uid, position, created);

CREATE TABLE site_settings (
  site_uid     TEXT PRIMARY KEY DEFAULT 'me',
  title        TEXT NOT NULL DEFAULT 'Meem Site',
  description  TEXT NOT NULL DEFAULT '',
  theme        TEXT,
  updated      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE site_inbox (
  id         TEXT PRIMARY KEY,
  site_uid   TEXT NOT NULL DEFAULT 'me',
  chat_id  TEXT,
  from_name  TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_site_inbox ON site_inbox(site_uid, status, created DESC);

CREATE TABLE site_events (
  id        TEXT PRIMARY KEY,
  site_uid  TEXT NOT NULL DEFAULT 'me',
  kind      TEXT NOT NULL DEFAULT '',
  payload   TEXT,
  created   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_site_events_kind ON site_events(site_uid, kind, created DESC);

-- 对外内容:动态 / 文章 / 项目(所有者发布,公网展示 + 门童机器人只读)
CREATE TABLE site_content (
  id        TEXT PRIMARY KEY,
  site_uid  TEXT NOT NULL DEFAULT 'me',
  kind      TEXT NOT NULL DEFAULT 'dynamic',   -- dynamic | article | project
  title     TEXT NOT NULL DEFAULT '',
  body      TEXT NOT NULL DEFAULT '',
  url       TEXT NOT NULL DEFAULT '',
  tags      TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'published',  -- draft | published
  pinned    INTEGER NOT NULL DEFAULT 0,
  created   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_site_content ON site_content(site_uid, kind, status, pinned DESC, created DESC);

-- 公网门童限流(按 IP + 全局)
CREATE TABLE site_ratelimit (
  bucket    TEXT PRIMARY KEY,
  win_start INTEGER NOT NULL DEFAULT 0,
  count     INTEGER NOT NULL DEFAULT 0
);

-- 访客账号(对外网站登录注册;与所有者 meem_users 完全分离)
CREATE TABLE site_visitors (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 每个访客一个对话
CREATE TABLE site_visitor_msgs (
  id         TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user',
  content    TEXT NOT NULL DEFAULT '',
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_site_visitor_msgs ON site_visitor_msgs(visitor_id, created);

-- 文档(控制台「文档」应用)· 笔记本树 + 页面
CREATE TABLE meem_doc_notebooks (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  parent_id  TEXT,
  name       TEXT NOT NULL DEFAULT '',
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_doc_notebooks ON meem_doc_notebooks(meem_uid, parent_id, sort_order);

CREATE TABLE meem_doc_pages (
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
CREATE INDEX idx_meem_doc_pages ON meem_doc_pages(meem_uid, notebook_id, sort_order);

-- 任务清单(控制台「任务」应用)
CREATE TABLE meem_tasks (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'todo',     -- todo | doing | done
  priority    TEXT NOT NULL DEFAULT 'medium',   -- low | medium | high
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_tasks ON meem_tasks(meem_uid, status, updated DESC);

-- Codex 会话事件(控制台「Codex」应用)· 归一化后的事件流,按 codex thread_id 归档
CREATE TABLE meem_codex_events (
  id         TEXT PRIMARY KEY,
  meem_uid   TEXT NOT NULL DEFAULT 'me',
  thread_id  TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'agent_message',
  payload    TEXT NOT NULL DEFAULT '{}',
  created    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_codex_events ON meem_codex_events(meem_uid, thread_id, created);

-- 随手记(控制台「随手记」应用)
CREATE TABLE meem_notes (
  id        TEXT PRIMARY KEY,
  meem_uid  TEXT NOT NULL DEFAULT 'me',
  title     TEXT NOT NULL DEFAULT '',
  body      TEXT NOT NULL DEFAULT '',
  pinned    INTEGER NOT NULL DEFAULT 0,
  created   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_notes ON meem_notes(meem_uid, pinned DESC, updated DESC);

INSERT INTO meem_settings (meem_uid) VALUES ('me');
INSERT INTO site_settings (site_uid, title, description)
VALUES ('me', 'Meem Site', 'A public site powered by Meem.');

INSERT INTO meem_terminal_snippets (id, meem_uid, name, command, auto_send, position)
VALUES
  ('snippet_claude', 'me', 'claude', 'claude', 1, 10),
  ('snippet_claude_yolo', 'me', 'claude --dangerously-skip-permissions', 'claude --dangerously-skip-permissions', 1, 20),
  ('snippet_codex', 'me', 'codex', 'codex', 1, 30),
  ('snippet_codex_yolo', 'me', 'codex --yolo', 'codex --yolo', 1, 40);
