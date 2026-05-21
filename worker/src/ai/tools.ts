// LLM 可见的工具 schema。
// 浏览器系：通过 functions.ts → DO /dispatch 转发给扩展执行。
// 记忆系：服务端直接读写 D1。

export const tools = [
  // ── 浏览器控制 ────────────────────────────────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'browser_status',
      description: 'Get Meem Browser Bridge status and current active tab information.',
      parameters: {
        type: 'object',
        properties: {
          timeoutSeconds: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_open_tab',
      description: 'Open a new inactive tab in the user current Chrome profile, optionally in a specific window.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          active: { type: 'boolean', description: 'Set true only when the user explicitly wants the tab focused. Defaults to false.' },
          windowId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        required: ['url'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_tabs',
      description: 'List Chrome tabs, optionally filtered by current window, active state, or windowId.',
      parameters: {
        type: 'object',
        properties: {
          currentWindow: { type: 'boolean' },
          active: { type: 'boolean' },
          windowId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_activate_tab',
      description: 'Activate a Chrome tab and focus its window.',
      parameters: {
        type: 'object',
        properties: {
          tabId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        required: ['tabId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_close_tab',
      description: 'Close a Chrome tab.',
      parameters: {
        type: 'object',
        properties: {
          tabId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        required: ['tabId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Navigate a Chrome tab to a URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          tabId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        required: ['url'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_evaluate',
      description: 'Evaluate JavaScript in a Chrome tab and return the result. Use this to extract DOM data, click elements, fill forms, scroll, etc.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JavaScript expression or statements. The last expression value is returned.' },
          tabId: { type: 'number' },
          timeoutSeconds: { type: 'number' },
        },
        required: ['code'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Capture a screenshot of a Chrome tab visible viewport, return as base64 data URL.',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['png', 'jpeg'] },
          tabId: { type: 'number' },
          quality: { type: 'number', description: 'jpeg quality 0-100' },
          timeoutSeconds: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },

  // ── 记忆 ─────────────────────────────────────────────────────────────────

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
