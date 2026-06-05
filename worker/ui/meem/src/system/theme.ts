export type Theme = 'dark' | 'light';

const KEY = 'meem_theme';

export function getTheme(): Theme {
  return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(KEY, t); } catch { /* */ }
}
