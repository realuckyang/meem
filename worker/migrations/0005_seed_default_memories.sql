-- 为现有用户预置两条必读记忆（系统指令也用记忆承载，让用户能看能改）。
-- 用 title 作为去重键，避免重复种入。

INSERT INTO memories (id, uid, title, summary, content, priority)
SELECT
  lower(hex(randomblob(16))),
  u.id,
  '记忆使用指引',
  '何时调用 memory_* 工具维护长期记忆',
  '你拥有一个长期记忆库，通过 5 个工具维护：

- memory_search(query) — 按关键词搜索
- memory_list(priority?) — 列出（可按优先级过滤）
- memory_add({title, content, priority?}) — 新增；priority 默认 stored
- memory_edit({id, ...}) — 修改
- memory_delete({id}) — 仅在用户明确要求"忘记"或记忆完全过时时使用

优先级：
- must     每次对话都注入到系统提示
- starred  重要参考，可被搜到
- stored   默认级别，安静放着待检索

当用户透露重要事实（偏好、关键身份、长期目标、人际关系、习惯）时，主动调用 memory_add 记下来。
当发现旧记忆过时或可丰富时，主动 memory_edit 更新。',
  'must'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM memories m WHERE m.uid = u.id AND m.title = '记忆使用指引'
);

INSERT INTO memories (id, uid, title, summary, content, priority)
SELECT
  lower(hex(randomblob(16))),
  u.id,
  '建议输出格式',
  '在合适场景下，回复末尾追加 <suggestions> JSON 区块',
  '当用户需要"接下来怎么办"的可点击选项时，在回复**末尾**追加一段建议区块：

<suggestions>
[
  {"type": "reply", "text": "给对方的回复草稿，短、自然、直接可发"},
  {"type": "ask",   "text": "用户可能想继续问你的方向"}
]
</suggestions>

- type=reply：仅在「悄悄商量」场景下有意义——给对话中"对方"的回复草稿。点击后会塞进用户给对方的主输入框。
- type=ask：用户可能想继续追问你的话题。点击后塞进当前对话的输入框。
- 每种 0-3 条
- 严格合法 JSON 数组，不要在 <suggestions> 内加其他文字、注释或代码块标记
- 没有合适建议就不要输出这段，正常结束就行',
  'must'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM memories m WHERE m.uid = u.id AND m.title = '建议输出格式'
);
