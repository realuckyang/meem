import type { Env } from '../../types';
import type { ChatMessage, ChatLite } from '../ai/types';

const now = () => Math.floor(Date.now() / 1000);
const uuid = () => crypto.randomUUID();

export interface SettingsLite { llm_url: string; llm_key: string; llm_model: string; max_rounds: number; persona: string; }
export interface ChatRow {
  id: string; uid: string; parent: string | null; title: string; category: string;
  status: string; preview: string; peer: string | null; created: number; updated: number; closed: number | null;
}
export interface MessageRow { id: string; chat_id: string | null; message: string; meta: string | null; created: number; }
export interface OpenDecision { chat_id: string; ask: string; options: unknown[]; rationale: string; }
export interface TerminalSnippetRow { id: string; name: string; command: string; auto_send: number; position: number; created: number; updated: number; }

export interface Repo {
  listChats(): Promise<ChatRow[]>;
  getChat(id: string): Promise<ChatLite | null>;
  getChatRow(id: string): Promise<ChatRow | null>;
  createChat(p: { title: string; category?: string; parent?: string | null; peer_handle?: string | null; purpose?: string }): Promise<{ id: string; title: string }>;
  setChat(id: string, fields: Partial<{ status: string; preview: string; closed: number; title: string; category: string }>): Promise<void>;
  addMessage(m: { chatId: string | null; message: ChatMessage; meta?: unknown }): Promise<void>;
  loadHistory(chatId: string | null): Promise<ChatMessage[]>;
  listMessages(chatId: string | null): Promise<MessageRow[]>;
  openDecisions(): Promise<OpenDecision[]>;
  sql(query: string): Promise<unknown[]>;
  r2Put(path: string, content: string): Promise<void>;
  r2Get(path: string): Promise<string | null>;
  r2List(prefix: string): Promise<string[]>;
  r2Delete(path: string): Promise<void>;
  inboxList(status: string): Promise<unknown[]>;
  inboxRead(id: string): Promise<unknown | null>;
  inboxReply(id: string, text: string): Promise<void>;
  inboxLink(chatId: string | null, label: string): Promise<string>;
  inboxAdd(p: { fromName: string; body: string }): Promise<{ id: string; chatId: string | null }>;
  listTerminalSnippets(): Promise<TerminalSnippetRow[]>;
  createTerminalSnippet(p: { name: string; command: string; autoSend: boolean }): Promise<TerminalSnippetRow>;
  updateTerminalSnippet(id: string, p: Partial<{ name: string; command: string; autoSend: boolean; position: number }>): Promise<void>;
  deleteTerminalSnippet(id: string): Promise<void>;
  loadSettings(): Promise<SettingsLite>;
  getSettings(): Promise<Record<string, unknown>>;
  updateSettings(p: Record<string, unknown>): Promise<void>;
}

export function makeRepo(env: Env, uid: string): Repo {
  const DB = env.DB;
  const ensureSettings = () => DB.prepare('INSERT OR IGNORE INTO meem_settings (meem_uid) VALUES (?)').bind(uid).run();

  return {
    // ── chats ──
    async listChats() {
      const r = await DB.prepare('SELECT id,meem_uid AS uid,parent,title,category,status,preview,peer,created,updated,closed FROM meem_chats WHERE meem_uid=? ORDER BY updated DESC').bind(uid).all<ChatRow>();
      return r.results;
    },
    async getChat(id) {
      return DB.prepare('SELECT id,title,parent,peer AS peer_handle,status FROM meem_chats WHERE id=? AND meem_uid=?').bind(id, uid).first<ChatLite>();
    },
    async getChatRow(id) {
      return DB.prepare('SELECT id,meem_uid AS uid,parent,title,category,status,preview,peer,created,updated,closed FROM meem_chats WHERE id=? AND meem_uid=?').bind(id, uid).first<ChatRow>();
    },
    async createChat(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO meem_chats (id,meem_uid,parent,title,category,status,peer,created,updated) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.parent ?? null, p.title, p.category ?? '', 'running', p.peer_handle ?? null, now(), now()).run();
      if (p.purpose) {
        await DB.prepare('INSERT INTO meem_messages (id,meem_uid,chat_id,message,meta,created) VALUES (?,?,?,?,?,?)')
          .bind(uuid(), uid, id, JSON.stringify({ role: 'user', content: p.purpose }), JSON.stringify({ kind: 'instruct' }), now()).run();
      }
      return { id, title: p.title };
    },
    async setChat(id, f) {
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of ['status', 'preview', 'closed', 'title', 'category'] as const) {
        if ((f as any)[k] !== undefined) { cols.push(`${k}=?`); vals.push((f as any)[k]); }
      }
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE meem_chats SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },

    // ── messages(整存 message 对象) ──
    async addMessage(m) {
      await DB.prepare('INSERT INTO meem_messages (id,meem_uid,chat_id,message,meta,created) VALUES (?,?,?,?,?,?)')
        .bind(uuid(), uid, m.chatId, JSON.stringify(m.message), m.meta ? JSON.stringify(m.meta) : null, now()).run();
      if (m.chatId) await DB.prepare('UPDATE meem_chats SET updated=? WHERE id=?').bind(now(), m.chatId).run();
    },
    async listMessages(chatId) {
      const r = chatId === null
        ? await DB.prepare('SELECT id,chat_id,message,meta,created FROM meem_messages WHERE meem_uid=? AND chat_id IS NULL ORDER BY created').bind(uid).all<MessageRow>()
        : await DB.prepare('SELECT id,chat_id,message,meta,created FROM meem_messages WHERE meem_uid=? AND chat_id=? ORDER BY created').bind(uid, chatId).all<MessageRow>();
      return r.results;
    },
    async loadHistory(chatId) {
      const rows = await this.listMessages(chatId);
      const out: ChatMessage[] = [];
      for (const row of rows) {
        let msg: any; try { msg = JSON.parse(row.message); } catch { continue; }
        if (!msg?.role) continue;
        if (msg.role === 'user') {
          let from = ''; try { from = JSON.parse(row.meta || '{}').from || ''; } catch { /* */ }
          if (from) msg = { ...msg, content: `[from ${from}] ${msg.content ?? ''}` };
        }
        out.push(msg as ChatMessage);
      }
      return out;
    },

    // ── 决策(从 messages 派生:awaiting 会话 + 最近一条 decision 消息) ──
    async openDecisions() {
      const chats = await DB.prepare("SELECT id FROM meem_chats WHERE meem_uid=? AND status='awaiting' ORDER BY updated DESC").bind(uid).all<{ id: string }>();
      const out: OpenDecision[] = [];
      for (const t of chats.results) {
        const d = await DB.prepare("SELECT message,meta FROM meem_messages WHERE meem_uid=? AND chat_id=? AND json_extract(meta,'$.kind')='decision' ORDER BY created DESC LIMIT 1")
          .bind(uid, t.id).first<{ message: string; meta: string }>();
        if (!d) continue;
        let msg: any = {}; let meta: any = {};
        try { msg = JSON.parse(d.message); } catch { /* */ }
        try { meta = JSON.parse(d.meta || '{}'); } catch { /* */ }
        out.push({ chat_id: t.id, ask: msg.content ?? '', options: meta.options ?? [], rationale: meta.rationale ?? '' });
      }
      return out;
    },

    // ── 数据库 / 云存储 ──
    async sql(query) { const r = await DB.prepare(query).all(); return r.results; },
    async r2Put(path, content) { await env.DOWNLOADS.put(`${uid}/${path}`, content); },
    async r2Get(path) { const o = await env.DOWNLOADS.get(`${uid}/${path}`); return o ? o.text() : null; },
    async r2List(prefix) { const l = await env.DOWNLOADS.list({ prefix: `${uid}/${prefix}` }); return l.objects.map((o) => o.key.slice(uid.length + 1)); },
    async r2Delete(path) { await env.DOWNLOADS.delete(`${uid}/${path}`); },

    // ── 收件箱 ──
    async inboxList(status) {
      const r = status === 'all'
        ? await DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE site_uid=? ORDER BY created DESC LIMIT 50').bind(uid).all()
        : await DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE site_uid=? AND status=? ORDER BY created DESC LIMIT 50').bind(uid, status).all();
      return r.results;
    },
    async inboxRead(id) { return DB.prepare('SELECT id,site_uid AS uid,chat_id,from_name,body,status,created FROM site_inbox WHERE id=? AND site_uid=?').bind(id, uid).first(); },
    async inboxReply(id) { await DB.prepare("UPDATE site_inbox SET status='handled' WHERE id=? AND site_uid=?").bind(id, uid).run(); },
    async inboxLink() { return '/p'; },
    async inboxAdd(p) {
      const id = uuid();
      await DB.prepare('INSERT INTO site_inbox (id,site_uid,from_name,body,status,created) VALUES (?,?,?,?,?,?)')
        .bind(id, uid, p.fromName, p.body, 'new', now()).run();
      return { id, chatId: null };
    },

    // ── terminal snippets ──
    async listTerminalSnippets() {
      const r = await DB.prepare('SELECT id,name,command,auto_send,position,created,updated FROM meem_terminal_snippets WHERE meem_uid=? ORDER BY position ASC, created ASC')
        .bind(uid).all<TerminalSnippetRow>();
      return r.results;
    },
    async createTerminalSnippet(p) {
      const id = uuid();
      const created = now();
      const position = created;
      await DB.prepare('INSERT INTO meem_terminal_snippets (id,meem_uid,name,command,auto_send,position,created,updated) VALUES (?,?,?,?,?,?,?,?)')
        .bind(id, uid, p.name, p.command, p.autoSend ? 1 : 0, position, created, created).run();
      return { id, name: p.name, command: p.command, auto_send: p.autoSend ? 1 : 0, position, created, updated: created };
    },
    async updateTerminalSnippet(id, p) {
      const cols: string[] = []; const vals: unknown[] = [];
      if (p.name !== undefined) { cols.push('name=?'); vals.push(p.name); }
      if (p.command !== undefined) { cols.push('command=?'); vals.push(p.command); }
      if (p.autoSend !== undefined) { cols.push('auto_send=?'); vals.push(p.autoSend ? 1 : 0); }
      if (p.position !== undefined) { cols.push('position=?'); vals.push(p.position); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), id, uid);
      await DB.prepare(`UPDATE meem_terminal_snippets SET ${cols.join(',')} WHERE id=? AND meem_uid=?`).bind(...vals).run();
    },
    async deleteTerminalSnippet(id) {
      await DB.prepare('DELETE FROM meem_terminal_snippets WHERE id=? AND meem_uid=?').bind(id, uid).run();
    },

    // ── settings ──
    async loadSettings() {
      await ensureSettings();
      const s = await DB.prepare('SELECT llm_url,llm_key,llm_model,max_rounds,persona FROM meem_settings WHERE meem_uid=?').bind(uid).first<SettingsLite>();
      return s ?? { llm_url: '', llm_key: '', llm_model: '', max_rounds: 30, persona: '' };
    },
    async getSettings() { await ensureSettings(); return (await DB.prepare('SELECT * FROM meem_settings WHERE meem_uid=?').bind(uid).first()) ?? {}; },
    async updateSettings(p) {
      await ensureSettings();
      const allow = ['persona', 'outward_name', 'llm_url', 'llm_key', 'llm_model', 'max_rounds'];
      const cols: string[] = []; const vals: unknown[] = [];
      for (const k of allow) if (p[k] !== undefined) { cols.push(`${k}=?`); vals.push(p[k]); }
      if (!cols.length) return;
      cols.push('updated=?'); vals.push(now(), uid);
      await DB.prepare(`UPDATE meem_settings SET ${cols.join(',')} WHERE meem_uid=?`).bind(...vals).run();
    },
  };
}
