import { useState } from 'react';
import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import type { Auth } from '../lib/types';
import { pageX } from '../lib/ui';
import { applyTheme, getTheme, type Theme } from '../lib/theme';

const NAV: [string, string][] = [
  ['欢迎', '#welcome'], ['动态', '#dynamics'], ['文章', '#articles'], ['项目', '#projects'], ['关于', '#about'],
];

function ThemeToggle() {
  const [theme, set] = useState<Theme>(getTheme());
  return (
    <button type="button" aria-label="切换主题" title="切换主题" onClick={() => { const n: Theme = theme === 'light' ? 'dark' : 'light'; set(n); applyTheme(n); }}
      className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-all hover:border-cyan hover:text-cyan hover:shadow-glow-sm">
      {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}

export default function Header({ auth, onLogin, onLogout }: { auth: Auth | null; onLogin: () => void; onLogout: () => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className={`${pageX} sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-border bg-background/80 py-4 backdrop-blur-xl`}>
      <a className="inline-flex items-center gap-2.5 font-bold tracking-wide" href="/"><img className="size-8 rounded-lg shadow-glow-sm" src="/favicon.svg" alt="" /><span>Meem Site</span></a>
      <div className="flex items-center gap-2">
        <nav className="hidden gap-1.5 sm:flex">
          {NAV.map(([l, h]) => (
            <a className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground" href={h} key={h}>{l}</a>
          ))}
        </nav>
        <ThemeToggle />
        {auth ? (
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} aria-label="账户"
              className="grid size-9 place-items-center rounded-full border border-cyan bg-cyan/10 text-sm font-bold text-cyan shadow-glow-sm">
              {(auth.profile.name || auth.profile.email || '?').slice(0, 1).toUpperCase()}
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-11 z-40 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-glow-sm">
                  <div className="border-b border-border px-3.5 py-3">
                    <div className="truncate text-sm font-semibold">{auth.profile.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{auth.profile.email}</div>
                  </div>
                  <button onClick={() => { setMenu(false); onLogout(); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <LogOut className="size-4" />退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={onLogin} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground transition-all hover:border-cyan hover:text-cyan hover:shadow-glow-sm">
            <UserRound className="size-4" />登录
          </button>
        )}
      </div>
    </header>
  );
}
