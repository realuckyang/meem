// 工具/agent 元数据注册表。
//
// 三类 tool：
//   - function：本地函数（browser_*、memory_*、feed_*、conversation_reply）
//   - agent  ：同步子 agent 调用（use_browser / use_memory / use_feed 等）
//   - trigger：异步 fire-and-forget（phase B 启用）
//
// 用户 maps 表里勾的 tool_name 必须在这张表里登记，否则 runtime 会拒绝。

import * as fns from './functions';

export type ToolKind = 'function' | 'agent' | 'trigger';

interface CommonProps {
  name: string;
  description: string;
}

export interface FunctionTool extends CommonProps {
  kind: 'function';
  parameters: Record<string, unknown>;
  exec: (args: any, ctx: any) => Promise<any> | any;
  /** vision/replyCid 等运行时门控；不通过则隐藏 */
  guard?: (config: { vision?: boolean; toolContext: any }) => boolean;
}

export interface AgentTool extends CommonProps {
  kind: 'agent';
  target_preset: string;
  silent?: boolean;
}

export interface TriggerTool extends CommonProps {
  kind: 'trigger';
  target_preset: string;
  silent?: boolean;
}

export type ToolDef = FunctionTool | AgentTool | TriggerTool;

// ── 帮助器 ─────────────────────────────────────────────────────────────────

const fn = (
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  exec: (args: any, ctx: any) => any,
  guard?: FunctionTool['guard'],
): FunctionTool => ({ kind: 'function', name, description, parameters, exec, guard });

const subAgent = (target_preset: string, name: string, description: string): AgentTool => ({
  kind: 'agent', name, description, target_preset,
});

// ── Registry ────────────────────────────────────────────────────────────────

export const REGISTRY: Record<string, ToolDef> = {
  // ── 浏览器 ────────────────────────────────────────────────────────────────
  browser_status: fn('browser_status',
    'Get Meem Browser Bridge status and current active tab information.',
    { type: 'object', properties: { timeoutSeconds: { type: 'number' } }, additionalProperties: false },
    fns.browser_status,
  ),
  browser_open_tab: fn('browser_open_tab',
    'Open a new inactive tab in the user current Chrome profile, optionally in a specific window.',
    {
      type: 'object',
      properties: {
        url: { type: 'string' },
        active: { type: 'boolean' },
        windowId: { type: 'number' },
        timeoutSeconds: { type: 'number' },
      },
      required: ['url'], additionalProperties: false,
    },
    fns.browser_open_tab,
  ),
  browser_tabs: fn('browser_tabs',
    'List Chrome tabs, optionally filtered by current window, active state, or windowId.',
    {
      type: 'object',
      properties: { currentWindow: { type: 'boolean' }, active: { type: 'boolean' }, windowId: { type: 'number' } },
      additionalProperties: false,
    },
    fns.browser_tabs,
  ),
  browser_activate_tab: fn('browser_activate_tab',
    'Bring a Chrome tab to focus.',
    { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'], additionalProperties: false },
    fns.browser_activate_tab,
  ),
  browser_close_tab: fn('browser_close_tab',
    'Close a Chrome tab.',
    { type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'], additionalProperties: false },
    fns.browser_close_tab,
  ),
  browser_navigate: fn('browser_navigate',
    'Navigate a Chrome tab to a new URL.',
    {
      type: 'object',
      properties: { tabId: { type: 'number' }, url: { type: 'string' } },
      required: ['url'], additionalProperties: false,
    },
    fns.browser_navigate,
  ),
  browser_evaluate: fn('browser_evaluate',
    'Run JavaScript in the active Chrome tab and return the result (must use return at top level).',
    {
      type: 'object',
      properties: { tabId: { type: 'number' }, script: { type: 'string' } },
      required: ['script'], additionalProperties: false,
    },
    fns.browser_evaluate,
  ),
  browser_screenshot: fn('browser_screenshot',
    'Take a screenshot of the active Chrome tab. Returns an image URL.',
    {
      type: 'object',
      properties: { tabId: { type: 'number' }, format: { type: 'string', enum: ['png', 'jpeg'] } },
      additionalProperties: false,
    },
    fns.browser_screenshot,
    (cfg) => !!cfg.vision,
  ),

  // ── 记忆 ──────────────────────────────────────────────────────────────────
  memory_search: fn('memory_search',
    '在用户长期记忆中搜索相关条目。',
    { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    fns.memory_search,
  ),
  memory_list: fn('memory_list',
    '列出长期记忆。可按优先级过滤。',
    { type: 'object', properties: { priority: { type: 'string', enum: ['must', 'starred', 'stored'] } } },
    fns.memory_list,
  ),
  memory_add: fn('memory_add',
    '新增一条长期记忆。priority 默认 stored；must 表示每次都注入系统提示词。',
    {
      type: 'object',
      properties: {
        title: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' },
        priority: { type: 'string', enum: ['must', 'starred', 'stored'] },
      },
      required: ['title'],
    },
    fns.memory_add,
  ),
  memory_edit: fn('memory_edit',
    '编辑一条已有记忆（按 id）。',
    {
      type: 'object',
      properties: {
        id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' },
        priority: { type: 'string', enum: ['must', 'starred', 'stored'] },
      },
      required: ['id'],
    },
    fns.memory_edit,
  ),
  memory_delete: fn('memory_delete',
    '删除一条记忆。仅当用户明确说"忘掉这个"或记忆完全过时时使用。',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    fns.memory_delete,
  ),

  // ── 广播 ──────────────────────────────────────────────────────────────────
  feed_list: fn('feed_list',
    '浏览社区最新的广播帖子（朋友圈风格）。',
    {
      type: 'object',
      properties: { limit: { type: 'number' }, cursor: { type: 'number' }, author: { type: 'string' } },
      additionalProperties: false,
    },
    fns.feed_list,
  ),
  feed_search: fn('feed_search',
    '在社区广播中全文搜索。',
    {
      type: 'object',
      properties: { q: { type: 'string' }, limit: { type: 'number' } },
      required: ['q'], additionalProperties: false,
    },
    fns.feed_search,
  ),
  feed_read: fn('feed_read',
    '读一条帖子的详情，包含全部评论。',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    fns.feed_read,
  ),
  feed_post: fn('feed_post',
    '代用户发一条社区广播。仅当用户明确请求时使用。',
    {
      type: 'object',
      properties: { body: { type: 'string' }, images: { type: 'array', items: { type: 'string' } } },
      required: ['body'], additionalProperties: false,
    },
    fns.feed_post,
  ),
  feed_comment: fn('feed_comment',
    '代用户对帖子或评论发表评论。',
    {
      type: 'object',
      properties: { post: { type: 'string' }, body: { type: 'string' }, parent: { type: 'string' } },
      required: ['post', 'body'], additionalProperties: false,
    },
    fns.feed_comment,
  ),
  feed_like: fn('feed_like',
    '切换点赞（已点过则取消）。',
    {
      type: 'object',
      properties: {
        target_kind: { type: 'string', enum: ['post', 'comment'] },
        target:      { type: 'string' },
      },
      required: ['target_kind', 'target'], additionalProperties: false,
    },
    fns.feed_like,
  ),

  // ── 对话原子动作 ──────────────────────────────────────────────────────────
  conversation_reply: fn('conversation_reply',
    '在用户和对方的私聊会话中代用户发送一条回复消息。',
    { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    fns.conversation_reply,
    (cfg) => !!cfg.toolContext?.replyCid,
  ),

  // ── 子 agent（同步） ─────────────────────────────────────────────────────
  use_browser: subAgent('browser', 'use_browser',
    '把一个浏览器相关的任务交给浏览器专才。它会自己规划多步操作（开标签、导航、执行脚本、截图）。'),
  use_memory:  subAgent('memory',  'use_memory',
    '把一个记忆相关的任务交给记忆管家。它自己决定增/删/改/查、优先级、是否合并已有记忆。'),
  use_feed:    subAgent('feed',    'use_feed',
    '把一个社区广播相关的任务交给广播官。它会浏览/搜索/发帖/评论/点赞。'),
};

// ── 工具：从 maps 取出的 tool_name 列表 → 构造给 LLM 的 tools schema ────────

export function buildToolsForAgent(
  toolNames: string[],
  config: { vision?: boolean; toolContext: any },
): { type: 'function'; function: { name: string; description: string; parameters: any } }[] {
  const out: any[] = [];
  for (const name of toolNames) {
    const def = REGISTRY[name];
    if (!def) continue;
    if (def.kind === 'function') {
      if (def.guard && !def.guard(config)) continue;
      out.push({ type: 'function', function: { name: def.name, description: def.description, parameters: def.parameters } });
    } else if (def.kind === 'agent') {
      out.push({
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: {
            type: 'object',
            properties: { task: { type: 'string', description: '要交给该 agent 的任务（自然语言）' } },
            required: ['task'],
            additionalProperties: false,
          },
        },
      });
    }
    // trigger：phase B 实现
  }
  return out;
}

export function getToolDef(name: string): ToolDef | undefined {
  return REGISTRY[name];
}
