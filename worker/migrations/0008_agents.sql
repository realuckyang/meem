-- 多 agent 架构 v2
-- agents:  用户的智能体实例（含预置）
-- maps:    每个 agent 能用哪些 tool（tool_name 既可指向 function 也可指向其他 agent）
-- sessions.agent_id: 每个会话属于一个 agent

CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '🤖',
  description TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  preset      TEXT,                            -- 'chief'|'browser'|... NULL=用户自定义
  created     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_agents_uid ON agents(uid);
CREATE INDEX idx_agents_uid_preset ON agents(uid, preset);

CREATE TABLE maps (
  agent_id  TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  PRIMARY KEY (agent_id, tool_name)
);

ALTER TABLE sessions ADD COLUMN agent_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_sessions_agent ON sessions(agent_id, updated DESC);

-- ── 为所有现有用户播种预置 agents + 迁移现有 sessions ──────────────────────

-- 预置 chief（主助手）：从 settings 表搬 prompt 过来
INSERT INTO agents (id, uid, name, emoji, description, prompt, preset)
SELECT
  'chief_' || users.id,
  users.id,
  '主助手',
  '🤖',
  '你的主智能体，负责对话和编排其他专才',
  COALESCE(settings.prompt, ''),
  'chief'
FROM users
LEFT JOIN settings ON settings.uid = users.id;

-- 预置 browser（浏览器专才）
INSERT INTO agents (id, uid, name, emoji, description, prompt, preset)
SELECT 'browser_' || id, id, '浏览器助手', '🌐',
  '帮你操作浏览器：打开标签、导航、执行脚本、截图',
  '你是浏览器专才。用户会给你一个任务，请利用浏览器工具完成它，给出简洁的执行结果。如果需要多步操作，自己规划顺序。',
  'browser'
FROM users;

-- 预置 memory（记忆管家）
INSERT INTO agents (id, uid, name, emoji, description, prompt, preset)
SELECT 'memory_' || id, id, '记忆管家', '🧠',
  '管理你的长期记忆：增删改查',
  '你是记忆管家。用户会给你一个记忆相关的任务（要记什么、改什么、删什么、查什么）。请自行决定：是否值得记？记成什么优先级（must/starred/stored）？该 add 还是先查再 edit？给出操作结果摘要。',
  'memory'
FROM users;

-- 预置 feed（广播官）
INSERT INTO agents (id, uid, name, emoji, description, prompt, preset)
SELECT 'feed_' || id, id, '广播官', '📣',
  '帮你浏览社区、发广播、评论、点赞',
  '你是社区广播专才。用户会给你一个社区互动任务。请利用 feed_* 工具完成，给出执行结果。注意社交分寸。',
  'feed'
FROM users;

-- 预置 whisper（悄悄商量）
INSERT INTO agents (id, uid, name, emoji, description, prompt, preset)
SELECT 'whisper_' || id, id, '私聊参谋', '🤫',
  '基于你和别人的对话，私下帮你出主意',
  '你是用户的私聊参谋。用户会让你帮他想怎么回复别人。请基于已有的对话上下文，给出回复建议或处理思路。',
  'whisper'
FROM users;

-- ── 为每个 agent 写默认 maps ───────────────────────────────────────────────

-- chief 的工具：对话原子 + 三个子 agent
INSERT INTO maps (agent_id, tool_name)
SELECT id, 'conversation_reply' FROM agents WHERE preset = 'chief';
INSERT INTO maps (agent_id, tool_name)
SELECT id, 'use_browser' FROM agents WHERE preset = 'chief';
INSERT INTO maps (agent_id, tool_name)
SELECT id, 'use_memory' FROM agents WHERE preset = 'chief';
INSERT INTO maps (agent_id, tool_name)
SELECT id, 'use_feed' FROM agents WHERE preset = 'chief';

-- browser 的工具：8 个浏览器函数
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_status'        FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_open_tab'      FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_tabs'          FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_activate_tab'  FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_close_tab'     FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_navigate'      FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_evaluate'      FROM agents WHERE preset = 'browser';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'browser_screenshot'    FROM agents WHERE preset = 'browser';

-- memory 的工具：5 个记忆 CRUD
INSERT INTO maps (agent_id, tool_name) SELECT id, 'memory_search' FROM agents WHERE preset = 'memory';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'memory_list'   FROM agents WHERE preset = 'memory';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'memory_add'    FROM agents WHERE preset = 'memory';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'memory_edit'   FROM agents WHERE preset = 'memory';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'memory_delete' FROM agents WHERE preset = 'memory';

-- feed 的工具：6 个广播
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_list'    FROM agents WHERE preset = 'feed';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_search'  FROM agents WHERE preset = 'feed';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_read'    FROM agents WHERE preset = 'feed';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_post'    FROM agents WHERE preset = 'feed';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_comment' FROM agents WHERE preset = 'feed';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'feed_like'    FROM agents WHERE preset = 'feed';

-- whisper 的工具：跟 chief 一样能调度三个专才，加 conversation_reply
INSERT INTO maps (agent_id, tool_name) SELECT id, 'conversation_reply' FROM agents WHERE preset = 'whisper';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'use_browser'        FROM agents WHERE preset = 'whisper';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'use_memory'         FROM agents WHERE preset = 'whisper';
INSERT INTO maps (agent_id, tool_name) SELECT id, 'use_feed'           FROM agents WHERE preset = 'whisper';

-- ── 迁移现有 sessions ──────────────────────────────────────────────────────
-- direct sessions (跟主助手聊) → chief
UPDATE sessions
SET agent_id = (SELECT id FROM agents WHERE preset = 'chief' AND uid = sessions.uid LIMIT 1)
WHERE kind = 'direct';

-- agent sessions (悄悄商量) → whisper
UPDATE sessions
SET agent_id = (SELECT id FROM agents WHERE preset = 'whisper' AND uid = sessions.uid LIMIT 1)
WHERE kind = 'agent';
