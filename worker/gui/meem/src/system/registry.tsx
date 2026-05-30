import { Activity, MessageSquare, Monitor, TerminalSquare, Folder } from 'lucide-react';
import type React from 'react';
import ChatApp from '../apps/chat';
import TerminalApp from '../apps/terminal';
import FilesApp from '../apps/files';
import StatusApp from '../apps/status';
import ScreenApp from '../apps/screen';

export type AppId = 'chat' | 'terminal' | 'files' | 'status' | 'screen';

export interface MeemApp {
  id: AppId;
  label: string;
  path: string;
  icon: JSX.Element;
  Component: React.ComponentType<SystemAppProps>;
}

export interface SystemAppProps {
  activeApp: AppId;
  openApps: () => void;
}

export const APPS: MeemApp[] = [
  { id: 'chat', label: '聊天', path: '/meem/apps/chat', icon: <MessageSquare />, Component: ChatApp },
  { id: 'terminal', label: '终端', path: '/meem/apps/terminal', icon: <TerminalSquare />, Component: TerminalApp },
  { id: 'files', label: '文件', path: '/meem/apps/files', icon: <Folder />, Component: FilesApp },
  { id: 'status', label: '状态', path: '/meem/apps/status', icon: <Activity />, Component: StatusApp },
  { id: 'screen', label: '截图', path: '/meem/apps/screen', icon: <Monitor />, Component: ScreenApp },
];

export function appFromPath(pathname = location.pathname): AppId {
  const slug = pathname.match(/^\/meem\/apps\/([^/]+)/)?.[1];
  return APPS.some((app) => app.id === slug) ? slug as AppId : 'chat';
}

export function pathForApp(id: AppId): string {
  return APPS.find((app) => app.id === id)?.path ?? '/meem/apps/chat';
}
