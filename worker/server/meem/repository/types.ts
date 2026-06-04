import type { ChatMessage, ChatLite } from '../ai/types';

// ── 行类型 ──
export interface SettingsLite { llm_url: string; llm_key: string; llm_model: string; max_rounds: number; persona: string; vision: number; }
export interface ChatRow {
  id: string; uid: string; parent: string | null; title: string; category: string;
  status: string; preview: string; peer: string | null; created: number; updated: number; closed: number | null;
}
export interface MessageRow { id: string; chat_id: string | null; message: string; meta: string | null; created: number; }
export interface DocNotebook { id: string; parent_id: string | null; name: string; icon: string | null; sort_order: number; created: number; updated: number; }
export interface DocPageMeta { id: string; notebook_id: string | null; title: string; icon: string | null; sort_order: number; updated: number; }
export interface DocPage extends DocPageMeta { content: string; created: number; }
export interface OpenDecision { chat_id: string; ask: string; options: unknown[]; rationale: string; }
export interface TerminalSnippetRow { id: string; name: string; command: string; auto_send: number; position: number; created: number; updated: number; }
export interface TaskRow { id: string; meem_uid: string; title: string; description: string; status: string; priority: string; created: number; updated: number; }
export interface NoteRow { id: string; meem_uid: string; title: string; body: string; pinned: number; created: number; updated: number; }
export interface CodexEventRow { id: string; meem_uid: string; thread_id: string; kind: string; payload: string; created: number; }
export interface DeviceRow { id: string; meem_uid: string; kind: string; name: string; description: string; token: string; status: string; created: number; updated: number; }

// ── 各域接口 ──
export interface ChatsRepo {
  listChats(): Promise<ChatRow[]>;
  getChat(id: string): Promise<ChatLite | null>;
  getChatRow(id: string): Promise<ChatRow | null>;
  createChat(p: { title: string; category?: string; parent?: string | null; peer_handle?: string | null; purpose?: string }): Promise<{ id: string; title: string }>;
  setChat(id: string, fields: Partial<{ status: string; preview: string; closed: number; title: string; category: string }>): Promise<void>;
}
export interface MessagesRepo {
  addMessage(m: { chatId: string | null; message: ChatMessage; meta?: unknown }): Promise<{ id: string; created: number }>;
  loadHistory(chatId: string | null): Promise<ChatMessage[]>;
  listMessages(chatId: string | null): Promise<MessageRow[]>;
}
export interface DecisionsRepo {
  openDecisions(): Promise<OpenDecision[]>;
}
export interface DocsRepo {
  docNotebooks(): Promise<DocNotebook[]>;
  docPagesList(notebookId: string | null): Promise<DocPageMeta[]>;
  docGetPage(id: string): Promise<DocPage | null>;
  docCreateNotebook(p: { name: string; parentId?: string | null; icon?: string | null }): Promise<DocNotebook>;
  docCreatePage(p: { notebookId: string | null; title: string }): Promise<DocPage>;
  docUpdatePage(id: string, p: Partial<{ title: string; content: string; icon: string }>): Promise<void>;
  docDeletePage(id: string): Promise<void>;
  docUpdateNotebook(id: string, p: Partial<{ name: string; icon: string }>): Promise<void>;
  docDeleteNotebook(id: string): Promise<void>;
}
export interface StorageRepo {
  sql(query: string): Promise<unknown[]>;
  r2Put(path: string, content: string): Promise<void>;
  r2Get(path: string): Promise<string | null>;
  r2List(prefix: string): Promise<string[]>;
  r2Delete(path: string): Promise<void>;
}
export interface TerminalRepo {
  listTerminalSnippets(): Promise<TerminalSnippetRow[]>;
  createTerminalSnippet(p: { name: string; command: string; autoSend: boolean }): Promise<TerminalSnippetRow>;
  updateTerminalSnippet(id: string, p: Partial<{ name: string; command: string; autoSend: boolean; position: number }>): Promise<void>;
  deleteTerminalSnippet(id: string): Promise<void>;
}
export interface TasksRepo {
  listTasks(status?: string): Promise<TaskRow[]>;
  getTask(id: string): Promise<TaskRow | null>;
  createTask(p: { title: string; description?: string; status?: string; priority?: string }): Promise<TaskRow>;
  updateTask(id: string, p: Partial<{ title: string; description: string; status: string; priority: string }>): Promise<void>;
  deleteTask(id: string): Promise<void>;
}
export interface NotesRepo {
  listNotes(q?: string): Promise<NoteRow[]>;
  getNote(id: string): Promise<NoteRow | null>;
  createNote(p: { title?: string; body?: string; pinned?: number }): Promise<NoteRow>;
  updateNote(id: string, p: Partial<{ title: string; body: string; pinned: number }>): Promise<void>;
  deleteNote(id: string): Promise<void>;
}
export interface CodexRepo {
  listCodexEvents(threadId: string): Promise<CodexEventRow[]>;
  addCodexEvent(p: { threadId: string; kind: string; payload: unknown }): Promise<void>;
}
export interface DevicesRepo {
  listDevices(): Promise<DeviceRow[]>;
  getDevice(id: string): Promise<DeviceRow | null>;
  createDevice(p: { kind: string; name?: string; description?: string }): Promise<DeviceRow>;
  updateDevice(id: string, p: Partial<{ name: string; description: string; status: string }>): Promise<void>;
  deleteDevice(id: string): Promise<void>;
}
export interface SettingsRepo {
  loadSettings(): Promise<SettingsLite>;
  getSettings(): Promise<Record<string, unknown>>;
  updateSettings(p: Record<string, unknown>): Promise<void>;
}

export interface Repo extends
  ChatsRepo, MessagesRepo, DecisionsRepo,
  DocsRepo, StorageRepo, TerminalRepo, TasksRepo, NotesRepo, CodexRepo, DevicesRepo, SettingsRepo {}
