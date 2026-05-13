export const tools = [
  {
    type: 'function',
    function: {
      name: 'sql_query',
      description: '在 meem 的本机 SQLite 数据库上执行任意 SQL,返回 JSON 结果(results + meta)。单条语句,不带末尾分号。',
      parameters: {
        type: 'object',
        properties: {
          sql:    { type: 'string', description: '要执行的单条 SQL' },
          reason: { type: 'string', description: '简要说明执行原因' },
        },
        required: ['sql', 'reason'],
      },
    },
  },
]
