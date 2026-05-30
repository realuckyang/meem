// 六个系列的工具 schema。电脑/浏览器经 client/extension 执行,其余本地。
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });

export const COMPUTER_TOOLS = [
  fn('computer_screenshot', '截取主人电脑屏幕', {}),
  fn('computer_click', '在屏幕坐标点击', { x: { type: 'number' }, y: { type: 'number' } }, ['x', 'y']),
  fn('computer_type', '键盘输入文本', { text: { type: 'string' } }, ['text']),
  fn('computer_key', '按下按键组合(如 cmd+c)', { keys: { type: 'string' } }, ['keys']),
  fn('computer_run', '执行一条 shell 命令', { command: { type: 'string' } }, ['command']),
];

export const BROWSER_TOOLS = [
  fn('browser_open', '打开网址(新标签)', { url: { type: 'string' } }, ['url']),
  fn('browser_read', '读取当前页可见文本', {}),
  fn('browser_click', '按文本/选择器点击', { selector: { type: 'string' } }, ['selector']),
  fn('browser_fill', '往输入框填值', { selector: { type: 'string' }, value: { type: 'string' } }, ['selector', 'value']),
  fn('browser_screenshot', '截取当前页面', {}),
];

export const INBOX_TOOLS = [
  fn('inbox_list', '列出收件箱(外部进来的消息)', { status: { type: 'string', description: 'new|handled|all' } }),
  fn('inbox_read', '读某条收件箱消息全文', { id: { type: 'string' } }, ['id']),
  fn('inbox_reply', '通过公开页通道回复外部发件人', { id: { type: 'string' }, text: { type: 'string' } }, ['id', 'text']),
  fn('inbox_link', '为某会话生成对方免登录的公开页链接', { chat_id: { type: 'string' }, label: { type: 'string' } }),
];

export const DB_TOOLS = [
  fn('sql', '对主人的私有数据库跑只读 SQL(表 records)', { query: { type: 'string' } }, ['query']),
];

export const R2_TOOLS = [
  fn('r2_put', '写入主人的云存储', { path: { type: 'string' }, content: { type: 'string' } }, ['path', 'content']),
  fn('r2_get', '读取云存储文件', { path: { type: 'string' } }, ['path']),
  fn('r2_list', '列出某前缀下的文件', { prefix: { type: 'string' } }),
  fn('r2_delete', '删除云存储文件', { path: { type: 'string' } }, ['path']),
];

export const CONVERSATION_TOOLS = [
  fn('open_conversation', '开启一个执行会话去办一件事(返回 conversation_id)', { title: { type: 'string' }, category: { type: 'string' }, purpose: { type: 'string' } }, ['title', 'purpose']),
  fn('send_to_conversation', '对某执行会话发送消息/追加指令', { conversation_id: { type: 'string' }, text: { type: 'string' } }, ['conversation_id', 'text']),
  fn('reply_result', '把本会话结果回给开启它的会话;需主人拍板时带 options(渲染成决策卡)', {
    text: { type: 'string' },
    rationale: { type: 'string' },
    options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, recommend: { type: 'boolean' } }, required: ['label'] } },
  }, ['text']),
];

/** 按 client/extension 在线情况组装工具集 */
export function toolsFor(opts: { computer: boolean; browser: boolean }): unknown[] {
  return [
    ...CONVERSATION_TOOLS, ...INBOX_TOOLS, ...DB_TOOLS, ...R2_TOOLS,
    ...(opts.computer ? COMPUTER_TOOLS : []),
    ...(opts.browser ? BROWSER_TOOLS : []),
  ];
}
