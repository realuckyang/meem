DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS inbox_messages;
DROP TABLE IF EXISTS inbox_threads;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_users_handle
  ON users(handle);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL DEFAULT '',
  mode_direct TEXT NOT NULL DEFAULT 'managed'
    CHECK(mode_direct IN ('observe','approval','managed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'direct_chat'
    CHECK(kind IN ('direct_chat','inbox_reply')),
  status TEXT NOT NULL DEFAULT 'thinking'
    CHECK(status IN ('thinking','awaiting_approval','awaiting_input','done','cancelled','errored')),
  title TEXT,
  inbox_thread_id TEXT,
  trigger_msg_id TEXT,
  codex_thread_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER
);

CREATE INDEX idx_sessions_user_updated
  ON sessions(user_id, updated_at DESC);

CREATE INDEX idx_sessions_user_inbox_thread
  ON sessions(user_id, inbox_thread_id, updated_at DESC);

CREATE TABLE session_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  in_reply_to TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_session_events_user_session_time
  ON session_events(user_id, session_id, seq ASC);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_contact_at INTEGER
);

CREATE UNIQUE INDEX idx_contacts_user_address
  ON contacts(user_id, address);

CREATE INDEX idx_contacts_user_updated
  ON contacts(user_id, updated_at DESC);

CREATE TABLE inbox_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_token TEXT NOT NULL,
  contact_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','replied','archived')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_inbox_threads_public_token
  ON inbox_threads(public_token);

CREATE INDEX idx_inbox_threads_user_updated
  ON inbox_threads(user_id, updated_at DESC);

CREATE TABLE inbox_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  contact_id TEXT,
  direction TEXT NOT NULL
    CHECK(direction IN ('inbound','outbound')),
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_inbox_messages_user_thread_time
  ON inbox_messages(user_id, thread_id, created_at ASC);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  inclusion TEXT NOT NULL DEFAULT 'stored'
    CHECK(inclusion IN ('must_read','starred','stored')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_memories_user_inclusion
  ON memories(user_id, inclusion);

CREATE INDEX idx_memories_user_updated
  ON memories(user_id, updated_at DESC);
