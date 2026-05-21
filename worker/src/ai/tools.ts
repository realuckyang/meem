// LLM 可见的工具 schema。
// 实际执行在 functions.ts，会通过 WS 分发给浏览器扩展。

export const tools = [
  {
    type: 'function',
    function: {
      name: 'get_active_tab',
      description: '获取用户当前正在浏览的标签页信息（URL、标题、是否激活）。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tabs',
      description: '列出浏览器中所有打开的标签页。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_active_tab',
      description: '让当前激活的标签页跳转到指定 URL。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '目标 URL，需带协议（https:// 等）' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_page',
      description: '提取当前激活标签页的标题、URL 和正文文本。',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ── 记忆工具：分身管理自己的长期记忆库 ───────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'memory_search',
      description: '在你自己的记忆库里按关键词搜索。返回标题/摘要/内容包含关键词的条目。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '搜索关键词' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_list',
      description: '列出记忆条目（仅标题和摘要）。可按优先级过滤。',
      parameters: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['must', 'starred', 'stored'], description: 'must=每次对话必读，starred=重要参考，stored=普通存档' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_add',
      description: '记下一条新记忆。当用户透露重要信息（偏好、关键事实、长期目标）时主动记录。',
      parameters: {
        type: 'object',
        properties: {
          title:    { type: 'string', description: '简短标题（10-20 字）' },
          summary:  { type: 'string', description: '一句话摘要（可选）' },
          content:  { type: 'string', description: '完整内容' },
          priority: { type: 'string', enum: ['must', 'starred', 'stored'], description: '默认 stored；只在用户明确表达"以后都要记住"时用 must' },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_edit',
      description: '更新已有记忆。当发现旧记忆过时、错误或可以丰富时使用。',
      parameters: {
        type: 'object',
        properties: {
          id:       { type: 'string' },
          title:    { type: 'string' },
          summary:  { type: 'string' },
          content:  { type: 'string' },
          priority: { type: 'string', enum: ['must', 'starred', 'stored'] },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory_delete',
      description: '删除一条记忆。仅当用户明确说"忘掉这个"或记忆完全过时时使用。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
] as const;
