// 六个系列的工具 schema。电脑/浏览器经 client/extension 执行,其余本地。
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });

export const COMPUTER_TOOLS = [
  // 与 client/apps/computer/schemas.js 严格对齐
  fn('computer_shell', '在本机执行一条 bash 命令(返回 stdout/stderr/exitCode)', { command: { type: 'string' }, cwd: { type: 'string' }, timeoutMs: { type: 'number' } }, ['command']),
  fn('computer_status', '电脑端状态与可用驱动', {}),
  fn('computer_screenshot', '截取本机屏幕', { outputPath: { type: 'string' }, format: { type: 'string', enum: ['png'] } }),
  fn('computer_mouse_move', '移动鼠标到屏幕坐标', { x: { type: 'number' }, y: { type: 'number' } }, ['x', 'y']),
  fn('computer_click', '在屏幕坐标点击', { x: { type: 'number' }, y: { type: 'number' }, button: { type: 'string', enum: ['left', 'right', 'middle'] }, clicks: { type: 'number' } }),
  fn('computer_double_click', '在屏幕坐标双击', { x: { type: 'number' }, y: { type: 'number' } }),
  fn('computer_right_click', '在屏幕坐标右键', { x: { type: 'number' }, y: { type: 'number' } }),
  fn('computer_scroll', '滚动当前桌面应用', { direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, amount: { type: 'number' } }),
  fn('computer_type', '向当前应用键盘输入文本', { text: { type: 'string' } }, ['text']),
  fn('computer_key', '按一个键(可带修饰键)', { key: { type: 'string' }, modifiers: { type: 'array', items: { type: 'string' } } }, ['key']),
  fn('computer_hotkey', '按快捷键组合,如 ["command","l"]', { keys: { type: 'array', items: { type: 'string' } } }, ['keys']),
];

export const BROWSER_TOOLS = [
  // 页面操作
  fn('browser_open', '打开网址(前台新标签,等加载完成)', { url: { type: 'string' } }, ['url']),
  fn('browser_navigate', '让当前标签跳转到网址', { url: { type: 'string' }, tabId: { type: 'number', description: '可选,指定标签' } }, ['url']),
  fn('browser_read', '读取当前页可见文本', {}),
  fn('browser_click', '按 CSS 选择器或文本点击元素', { selector: { type: 'string' } }, ['selector']),
  fn('browser_fill', '往输入框/文本域填值', { selector: { type: 'string' }, value: { type: 'string' } }, ['selector', 'value']),
  fn('browser_evaluate', '在当前页执行一段 JS 并返回结果(强力,可做 read/click/抓取做不到的事)', { script: { type: 'string' }, tabId: { type: 'number' } }, ['script']),
  fn('browser_screenshot', '截取当前页面', {}),
  // 标签管理
  fn('browser_status', '浏览器/扩展状态:活动标签、标签总数', {}),
  fn('browser_tabs', '列出已打开的标签', { currentWindow: { type: 'boolean' }, active: { type: 'boolean' } }),
  fn('browser_open_tab', '后台打开一个新标签', { url: { type: 'string' } }, ['url']),
  fn('browser_activate_tab', '切到指定标签(置前)', { tabId: { type: 'number' } }, ['tabId']),
  fn('browser_close_tab', '关闭指定标签', { tabId: { type: 'number' } }, ['tabId']),
];

export const INBOX_TOOLS = [
  fn('inbox_list', '列出收件箱(外部进来的消息)', { status: { type: 'string', description: 'new|handled|all' } }),
  fn('inbox_read', '读某条收件箱消息全文', { id: { type: 'string' } }, ['id']),
  fn('inbox_reply', '通过公开页通道回复外部发件人', { id: { type: 'string' }, text: { type: 'string' } }, ['id', 'text']),
  fn('inbox_link', '为某会话生成对方免登录的公开页链接', { chat_id: { type: 'string' }, label: { type: 'string' } }),
];

export const DB_TOOLS = [
  fn('sql', "对用户的私有数据库(Cloudflare D1)跑只读查询:仅支持 SELECT(不支持 PRAGMA 及任何写操作)。查有哪些表用 SELECT name FROM sqlite_master WHERE type='table';查某表字段用 SELECT sql FROM sqlite_master WHERE name='表名'。", { query: { type: 'string' } }, ['query']),
];

export const R2_TOOLS = [
  fn('r2_put', '写入用户的云存储', { path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']),
  fn('r2_get', '读取云存储文件', { path: { type: 'string' } }, ['path']),
  fn('r2_list', '列出某前缀下的文件', { prefix: { type: 'string' } }),
  fn('r2_delete', '删除云存储文件', { path: { type: 'string' } }, ['path']),
];

export const CONVERSATION_TOOLS = [
  fn('open_conversation', '开启一个执行会话去办一件事(返回 conversation_id)', { title: { type: 'string' }, category: { type: 'string' }, purpose: { type: 'string' } }, ['title', 'purpose']),
  fn('send_to_conversation', '对某执行会话发送消息/追加指令', { conversation_id: { type: 'string' }, text: { type: 'string' } }, ['conversation_id', 'text']),
  fn('reply_result', '把本会话结果回给开启它的会话;需用户拍板时带 options(渲染成决策卡)', {
    text: { type: 'string' },
    rationale: { type: 'string' },
    options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, recommend: { type: 'boolean' } }, required: ['label'] } },
  }, ['text']),
];

// 给电脑/浏览器工具注入必填的 device 参数(目标设备 id)
const withDevice = (tools: any[]) => tools.map((t) => ({
  ...t,
  function: {
    ...t.function,
    parameters: {
      ...t.function.parameters,
      properties: { device: { type: 'string', description: '目标设备 id(见系统提示「可用设备」清单)' }, ...t.function.parameters.properties },
      required: ['device', ...(t.function.parameters.required || [])],
    },
  },
}));

/** 按设备在线情况 + 视觉开关组装工具集 */
export function toolsFor(opts: { computer: boolean; browser: boolean; vision?: boolean }): unknown[] {
  const tools = [
    ...CONVERSATION_TOOLS, ...INBOX_TOOLS, ...DB_TOOLS, ...R2_TOOLS,
    ...(opts.computer ? withDevice(COMPUTER_TOOLS) : []),
    ...(opts.browser ? withDevice(BROWSER_TOOLS) : []),
  ];
  // 截图工具只在「视觉」开启时暴露(关了模型也看不了图,给了白给)
  return opts.vision ? tools : tools.filter((t: any) => !String(t.function?.name).endsWith('_screenshot'));
}
