export const TERMINAL_THEME = {
  background: '#111318',
  foreground: '#e5e7eb',
  cursor: '#60a5fa',
  cursorAccent: '#111318',
  selectionBackground: '#243244',
  black: '#111318',
  red: '#f87171',
  green: '#34d399',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e5e7eb',
  brightBlack: '#4b5563',
  brightRed: '#fca5a5',
  brightGreen: '#6ee7b7',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f9fafb',
};

export const NAV_KEYS = [
  { label: 'Tab', code: '\t' },
  { label: 'Esc', code: '\x1b' },
  { label: '↑', code: '\x1b[A' },
  { label: '↓', code: '\x1b[B' },
  { label: '←', code: '\x1b[D' },
  { label: '→', code: '\x1b[C' },
  { label: 'PgUp', code: '\x1b[5~' },
  { label: 'PgDn', code: '\x1b[6~' },
  { label: 'Home', code: '\x1bOH' },
  { label: 'End', code: '\x1bOF' },
  { label: 'Space', code: ' ' },
  { label: 'Enter', code: '\r' },
];

export const CTRL_KEYS = [
  { label: '^C', code: '\x03' },
  { label: '^D', code: '\x04' },
  { label: '^L', code: '\x0c' },
  { label: '^R', code: '\x12' },
  { label: '^W', code: '\x17' },
  { label: '^U', code: '\x15' },
  { label: '^K', code: '\x0b' },
  { label: '^A', code: '\x01' },
  { label: '^E', code: '\x05' },
  { label: '^Z', code: '\x1a' },
];

export const FONT_KEY = 'meem_terminal_font_size';
export const HISTORY_KEY = 'meem_terminal_history';
export const PANEL_KEY = 'meem_terminal_panel_tab';
export const RECENT_DIRS_KEY = 'meem_terminal_recent_dirs';
