import { Activity, MessageSquare, Monitor, TerminalSquare, Folder, SlidersHorizontal, BookText, ListChecks, StickyNote, Bot } from 'lucide-react';
import type React from 'react';
import ChatApp from '../apps/chat';
import TerminalApp from '../apps/terminal';
import FilesApp from '../apps/files';
import StatusApp from '../apps/status';
import ScreenApp from '../apps/screen';
import DocsApp from '../apps/docs';
import SettingsApp from '../apps/settings';
import TasksApp from '../apps/tasks';
import NotesApp from '../apps/notes';
import CodexApp from '../apps/codex';

export type AppId = 'chat' | 'tasks' | 'notes' | 'codex' | 'terminal' | 'files' | 'status' | 'screen' | 'docs' | 'settings';

export type AppGroup = 'online' | 'computer' | 'system';

export interface MeemApp {
  id: AppId;
  label: string;
  path: string;
  icon: JSX.Element;
  group: AppGroup;
  Component: React.ComponentType<SystemAppProps>;
}

// 应用面板分组顺序与标题(system 组不进网格,设置单独放面板右上角)
export const APP_GROUPS: { id: AppGroup; label: string }[] = [
  { id: 'online', label: '在线' },
  { id: 'computer', label: '电脑' },
];

// Apps render their own Topbar; global navigation comes from NavContext (see ./nav).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SystemAppProps {}

export const APPS: MeemApp[] = [
  { id: 'chat', label: '聊天', path: '/meem/apps/chat', icon: <MessageSquare />, group: 'online', Component: ChatApp },
  { id: 'tasks', label: '任务', path: '/meem/apps/tasks', icon: <ListChecks />, group: 'online', Component: TasksApp },
  { id: 'notes', label: '随手记', path: '/meem/apps/notes', icon: <StickyNote />, group: 'online', Component: NotesApp },
  { id: 'docs', label: '文档', path: '/meem/apps/docs', icon: <BookText />, group: 'online', Component: DocsApp },
  { id: 'codex', label: 'Codex', path: '/meem/apps/codex', icon: <Bot />, group: 'computer', Component: CodexApp },
  { id: 'terminal', label: '终端', path: '/meem/apps/terminal', icon: <TerminalSquare />, group: 'computer', Component: TerminalApp },
  { id: 'files', label: '文件', path: '/meem/apps/files', icon: <Folder />, group: 'computer', Component: FilesApp },
  { id: 'status', label: '状态', path: '/meem/apps/status', icon: <Activity />, group: 'computer', Component: StatusApp },
  { id: 'screen', label: '截图', path: '/meem/apps/screen', icon: <Monitor />, group: 'computer', Component: ScreenApp },
  { id: 'settings', label: '设置', path: '/meem/apps/settings', icon: <SlidersHorizontal />, group: 'system', Component: SettingsApp },
];

export function appFromPath(pathname = location.pathname): AppId {
  const slug = pathname.match(/^\/meem\/apps\/([^/]+)/)?.[1];
  return APPS.some((app) => app.id === slug) ? slug as AppId : 'chat';
}

export function pathForApp(id: AppId): string {
  return APPS.find((app) => app.id === id)?.path ?? '/meem/apps/chat';
}
