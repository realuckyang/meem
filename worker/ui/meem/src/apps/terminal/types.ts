export interface TerminalTab {
  id: string;
  title: string;
  cwd?: string;
  isActive?: boolean;
}

export interface FsItem {
  name: string;
  path: string;
  isDir: boolean;
}

export type PanelTab = 'keys' | 'commands';

export type TerminalCommand = 'restart' | 'clear' | 'ctrl_c';
