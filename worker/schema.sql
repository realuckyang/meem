DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS session_events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS inbox_messages;
DROP TABLE IF EXISTS conversations;
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
  public_messages_enabled INTEGER NOT NULL DEFAULT 1,
  mode_direct TEXT NOT NULL DEFAULT 'managed'
    CHECK(mode_direct IN ('observe','approval','managed')),
  mode_message_agent TEXT NOT NULL DEFAULT 'managed'
    CHECK(mode_message_agent IN ('observe','approval','managed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'direct_chat'
    CHECK(kind IN ('direct_chat','message_agent')),
  status TEXT NOT NULL DEFAULT 'thinking'
    CHECK(status IN ('thinking','awaiting_approval','awaiting_input','done','cancelled','errored')),
  title TEXT,
  conversation_id TEXT,
  trigger_message_id TEXT,
  codex_thread_id TEXT,
  cwd TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER
);

CREATE INDEX idx_sessions_user_updated
  ON sessions(user_id, updated_at DESC);

CREATE INDEX idx_sessions_user_conversation
  ON sessions(user_id, conversation_id, updated_at DESC);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  in_reply_to TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_events_user_session_time
  ON events(user_id, session_id, seq ASC);

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

CREATE TABLE conversations (
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

CREATE UNIQUE INDEX idx_conversations_public_token
  ON conversations(public_token);

CREATE INDEX idx_conversations_user_updated
  ON conversations(user_id, updated_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  contact_id TEXT,
  direction TEXT NOT NULL
    CHECK(direction IN ('inbound','outbound')),
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_messages_user_conversation_time
  ON messages(user_id, conversation_id, created_at ASC);

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
