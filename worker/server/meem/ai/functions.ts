import type { ToolCtx } from './types';
import { asText } from './utils';

type FnResult = string | { content: string; awaitHuman?: boolean };
type Fn = (args: any, ctx: ToolCtx) => Promise<FnResult>;

// 跑在 Worker 端的工具(会话管理 / 收件箱 / 数据库 / 云存储)
const worker: Record<string, Fn> = {
  // ===== 会话管理系列 =====
  async open_conversation(a, ctx) {
    const m = await ctx.store.createChat({
      title: String(a.title ?? '新会话'), category: a.category, parent: ctx.chat?.id ?? null, purpose: String(a.purpose ?? ''),
    });
    return `已开启执行会话 ${m.id}「${m.title}」,目标已下达。`;
  },
  async send_to_conversation(a, ctx) {
    const t = await ctx.store.getChat(String(a.conversation_id));
    if (!t) return '目标会话不存在';
    await ctx.store.addMessage({ chatId: t.id, message: { role: 'user', content: String(a.text ?? '') }, meta: { kind: 'instruct', from: ctx.chat ? `conv:${ctx.chat.id}` : 'main' } });
    return `已发送给会话 ${t.id}。`;
  },
  async reply_result(a, ctx) {
    const text = String(a.text ?? '');
    const options = (a.options || []).map((o: any) => ({ label: String(o.label ?? ''), recommend: !!o.recommend }));
    const from = ctx.chat ? `conv:${ctx.chat.id}` : 'sub';
    const target = (ctx.chat?.parent ?? null) ?? ctx.chat?.id ?? null; // 决策挂上级会话,无上级则本会话
    if (options.length) {
      // 带选项 = 决策卡(就是一条 meta.kind='decision' 的消息),把会话转 awaiting
      await ctx.store.addMessage({ chatId: target, message: { role: 'assistant', content: text }, meta: { kind: 'decision', options, rationale: a.rationale, from } });
      if (target) await ctx.store.setChat(target, { status: 'awaiting', preview: text });
    } else {
      await ctx.store.addMessage({ chatId: ctx.chat?.parent ?? null, message: { role: 'user', content: text }, meta: { kind: 'result', from } });
    }
    if (ctx.chat) await ctx.store.setChat(ctx.chat.id, { status: 'done', preview: text });
    return { content: '已回复结果。', awaitHuman: options.length > 0 };
  },

  // ===== 收件箱系列 =====
  async inbox_list(a, ctx) { return asText(await ctx.store.inboxList(String(a.status ?? 'new'))); },
  async inbox_read(a, ctx) { const r = await ctx.store.inboxRead(String(a.id)); return r ? asText(r) : '没有这条'; },
  async inbox_reply(a, ctx) { await ctx.store.inboxReply(String(a.id), String(a.text ?? '')); return '已通过公开页回复。'; },
  async inbox_link(a, ctx) { return `公开页链接:${await ctx.store.inboxLink(a.chat_id ?? null, String(a.label ?? ''))}`; },

  // ===== 数据库系列 =====
  async sql(a, ctx) {
    const q = String(a.query ?? '');
    if (!/^\s*select/i.test(q)) return "只允许 SELECT 查询;查表用 SELECT name FROM sqlite_master WHERE type='table',查字段用 SELECT sql FROM sqlite_master WHERE name='表名'";
    try {
      const rows = await ctx.store.sql(q);
      return asText(rows);
    } catch (e: any) { return 'SQL 错误: ' + (e?.message || String(e)); }
  },

  // ===== 云存储系列 =====
  async r2_put(a, ctx) { await ctx.store.r2Put(String(a.path), String(a.content ?? '')); return `已存入 ${a.path}`; },
  async r2_get(a, ctx) { return (await ctx.store.r2Get(String(a.path))) ?? '文件不存在'; },
  async r2_list(a, ctx) { return asText(await ctx.store.r2List(String(a.prefix ?? ''))); },
  async r2_delete(a, ctx) { await ctx.store.r2Delete(String(a.path)); return `已删除 ${a.path}`; },
};

/** 工具分发:电脑/浏览器经 client/extension 执行,其余在 Worker 端执行 */
export async function runFunction(name: string, args: any, ctx: ToolCtx): Promise<FnResult> {
  // 电脑/浏览器工具:必须带 device(目标设备 id),转发到该设备执行
  if (name.startsWith('computer_') || name.startsWith('browser_')) {
    const deviceId = String(args?.device || '');
    if (!deviceId) return `缺少 device 参数:请在工具参数里填写目标设备 id(见系统提示里的「可用设备」清单)。`;
    return ctx.callToolEndpoint(deviceId, name, args);
  }
  const fn = worker[name];
  if (!fn) return `未知工具: ${name}`;
  return fn(args, ctx);
}
