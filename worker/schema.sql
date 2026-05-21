CREATE TABLE users (
  id      TEXT PRIMARY KEY,
  handle  TEXT UNIQUE NOT NULL,
  name    TEXT NOT NULL DEFAULT '',
  bio     TEXT NOT NULL DEFAULT '',
  cover   TEXT NOT NULL DEFAULT '',
  salt    TEXT NOT NULL,
  hash    TEXT NOT NULL,
  secret  TEXT NOT NULL,
  created INTEGER NOT NULL DEFAULT (unixepoch()),
  updated INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  uid                    TEXT    PRIMARY KEY,
  prompt                 TEXT    NOT NULL DEFAULT '',
  public                 INTEGER NOT NULL DEFAULT 1,
  whisper_mode           TEXT    NOT NULL DEFAULT 'silent'
                                 CHECK(whisper_mode IN ('silent','suggest','auto')),
  whisper_suggest_prompt TEXT    NOT NULL DEFAULT '',
  whisper_auto_prompt    TEXT    NOT NULL DEFAULT '',
  url                    TEXT    NOT NULL DEFAULT '',
  key                    TEXT    NOT NULL DEFAULT '',
  model                  TEXT    NOT NULL DEFAULT '',
  max_rounds             INTEGER NOT NULL DEFAULT 20,
  tool_max_chars         INTEGER NOT NULL DEFAULT 12000,
  vision                 INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE conversations (
  id      TEXT PRIMARY KEY,
  preview TEXT NOT NULL DEFAULT '',
  updated INTEGER NOT NULL DEFAULT (unixepoch()),
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_conversations_updated ON conversations(updated DESC);

CREATE TABLE members (
  cid    TEXT NOT NULL,
  handle TEXT NOT NULL,
  unread INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cid, handle)
);

CREATE INDEX idx_members_handle ON members(handle);

CREATE TABLE messages (
  id      TEXT PRIMARY KEY,
  cid     TEXT NOT NULL,
  sender  TEXT NOT NULL,
  body    TEXT NOT NULL,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_messages_cid_created ON messages(cid, created ASC);

CREATE TABLE sessions (
  id       TEXT PRIMARY KEY,
  uid      TEXT NOT NULL,
  kind     TEXT NOT NULL DEFAULT 'direct'
    CHECK(kind IN ('direct','agent')),
  status   TEXT NOT NULL DEFAULT 'thinking'
    CHECK(status IN ('thinking','approval','input','done','cancelled','error')),
  title    TEXT,
  trigger  TEXT,
  created  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated  INTEGER NOT NULL DEFAULT (unixepoch()),
  finished INTEGER
);

CREATE INDEX idx_sessions_uid_updated ON sessions(uid, updated DESC);

CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  sid     TEXT NOT NULL,
  uid     TEXT NOT NULL,
  message TEXT NOT NULL,
  meta    TEXT,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_events_sid_id ON events(sid, id ASC);

CREATE TABLE memories (
  id       TEXT PRIMARY KEY,
  uid      TEXT NOT NULL,
  title    TEXT NOT NULL,
  summary  TEXT NOT NULL DEFAULT '',
  content  TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'stored'
    CHECK(priority IN ('must','starred','stored')),
  created  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_memories_uid_priority ON memories(uid, priority);
CREATE INDEX idx_memories_uid_updated ON memories(uid, updated DESC);

-- 广播 / 社区信息流
CREATE TABLE posts (
  id      TEXT PRIMARY KEY,
  author  TEXT NOT NULL,
  body    TEXT NOT NULL DEFAULT '',
  images  TEXT NOT NULL DEFAULT '[]',
  likes   INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT (unixepoch()),
  updated INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_posts_created ON posts(created DESC);
CREATE INDEX idx_posts_author  ON posts(author, created DESC);

CREATE TABLE comments (
  id      TEXT PRIMARY KEY,
  post    TEXT NOT NULL,
  parent  TEXT,
  author  TEXT NOT NULL,
  body    TEXT NOT NULL,
  likes   INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_comments_post ON comments(post, created ASC);

CREATE TABLE reactions (
  uid         TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK(target_kind IN ('post','comment')),
  target      TEXT NOT NULL,
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (uid, target_kind, target)
);
CREATE INDEX idx_reactions_target ON reactions(target_kind, target);

CREATE VIRTUAL TABLE posts_fts USING fts5(body, content='posts', content_rowid='rowid');

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, body) VALUES (new.rowid, new.body);
END;
CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.rowid, old.body);
END;
CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, body) VALUES('delete', old.rowid, old.body);
  INSERT INTO posts_fts(rowid, body) VALUES (new.rowid, new.body);
END;
