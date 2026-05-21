-- 广播功能（社区信息流，朋友圈风格）
-- posts: 帖子主体；body 文本 + images JSON 数组（最多 9 张，朋友圈语义）
-- comments: 评论，parent 自引用支持回复评论
-- reactions: 统一点赞表，主键防重复
-- posts_fts: FTS5 全文搜索
-- users.cover: 个人广播页顶部封面图 URL

ALTER TABLE users ADD COLUMN cover TEXT NOT NULL DEFAULT '';

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

-- 全文搜索（external content：FTS 表只存索引，body 来源于 posts）
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
