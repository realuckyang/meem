-- 重构 settings：mode 三值化 + 各自可编辑提示词。
-- SQLite 不能直接改 CHECK 约束，重建表迁移数据。

CREATE TABLE settings_new (
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

INSERT INTO settings_new (
  uid, prompt, public,
  whisper_mode, whisper_suggest_prompt, whisper_auto_prompt,
  url, "key", model, max_rounds, tool_max_chars, vision
)
SELECT
  uid, prompt, public,
  CASE WHEN mode = 'review' THEN 'suggest' ELSE 'silent' END,
  '', '',
  url, "key", model, max_rounds, tool_max_chars, vision
FROM settings;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;
