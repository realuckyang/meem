-- Meem schema truth. Development stage: this file rebuilds D1 directly.
-- Naming rule:
--   meem_* = private Meem console, agent, apps, devices, deployments.
--   site_* = public website and public visitor interaction.
-- OpenAI-compatible assistant messages stay as a single message JSON blob.

DROP TABLE IF EXISTS meem_settings;
DROP TABLE IF EXISTS meem_users;
DROP TABLE IF EXISTS meem_chats;
DROP TABLE IF EXISTS meem_messages;
DROP TABLE IF EXISTS meem_apps;
DROP TABLE IF EXISTS meem_deployments;
DROP TABLE IF EXISTS meem_devices;
DROP TABLE IF EXISTS meem_terminal_snippets;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS site_pages;
DROP TABLE IF EXISTS site_inbox;
DROP TABLE IF EXISTS site_events;
DROP TABLE IF EXISTS site_content;
DROP TABLE IF EXISTS site_ratelimit;
DROP TABLE IF EXISTS site_visitors;
DROP TABLE IF EXISTS site_visitor_msgs;

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
  outward_name  TEXT NOT NULL DEFAULT '',
  llm_url       TEXT NOT NULL DEFAULT '',
  llm_key       TEXT NOT NULL DEFAULT '',
  llm_model     TEXT NOT NULL DEFAULT '',
  max_rounds    INTEGER NOT NULL DEFAULT 30,
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

CREATE TABLE meem_apps (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'internal',
  entry_path  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',
  config      TEXT,
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_meem_apps_slug ON meem_apps(meem_uid, slug);

CREATE TABLE meem_deployments (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  target      TEXT NOT NULL DEFAULT '',
  version_id  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',
  meta        TEXT,
  created     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_deployments_target ON meem_deployments(meem_uid, target, created DESC);

CREATE TABLE meem_devices (
  id          TEXT PRIMARY KEY,
  meem_uid    TEXT NOT NULL DEFAULT 'me',
  kind        TEXT NOT NULL DEFAULT '',
  label       TEXT NOT NULL DEFAULT '',
  token_hash  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'inactive',
  meta        TEXT,
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_meem_devices_kind ON meem_devices(meem_uid, kind, status);

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

CREATE TABLE site_pages (
  id          TEXT PRIMARY KEY,
  site_uid    TEXT NOT NULL DEFAULT 'me',
  path        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  meta        TEXT,
  published   INTEGER NOT NULL DEFAULT 1,
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_site_pages_path ON site_pages(site_uid, path);

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

-- 对外内容:动态 / 文章 / 项目(站主发布,公网展示 + 门童机器人只读)
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

-- 访客账号(对外网站登录注册;与站主 meem_users 完全分离)
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

INSERT INTO meem_settings (meem_uid) VALUES ('me');
INSERT INTO site_settings (site_uid, title, description)
VALUES ('me', 'Meem Site', 'A public site powered by Meem.');

INSERT INTO meem_apps (id, meem_uid, slug, title, kind, entry_path, status)
VALUES
  ('app_terminal', 'me', 'terminal', '终端', 'internal', '/meem/apps/terminal', 'active'),
  ('app_files', 'me', 'files', '文件', 'internal', '/meem/apps/files', 'active'),
  ('app_status', 'me', 'status', '状态', 'internal', '/meem/apps/status', 'active'),
  ('app_screen', 'me', 'screen', '截图', 'internal', '/meem/apps/screen', 'active');

INSERT INTO meem_terminal_snippets (id, meem_uid, name, command, auto_send, position)
VALUES
  ('snippet_claude', 'me', 'claude', 'claude', 1, 10),
  ('snippet_claude_yolo', 'me', 'claude --dangerously-skip-permissions', 'claude --dangerously-skip-permissions', 1, 20),
  ('snippet_codex', 'me', 'codex', 'codex', 1, 30),
  ('snippet_codex_yolo', 'me', 'codex --yolo', 'codex --yolo', 1, 40);
