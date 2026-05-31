import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Grip, Monitor } from 'lucide-react';
import { APPS, type AppId } from './registry';
import { useNav } from './nav';
import { useConnectionStatus } from './useConnectionStatus';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from './lib/utils';

interface TopbarProps {
  title: string;
  left?: JSX.Element;
}

export default function Topbar({ title, left }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {left}
        <div className="truncate text-sm font-semibold tracking-wide text-foreground">{title}</div>
      </div>
      <div className="flex items-center gap-3">
        <Clock />
        <span className="hidden h-5 w-px bg-border sm:block" />
        <AppPanel />
      </div>
    </header>
  );
}

function Clock() {
  const [now, setNow] = useState('--:--:--');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow([d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="hidden font-mono text-xs tracking-widest text-muted-foreground sm:block">{now}</span>;
}

function AppPanel() {
  const { activeApp, openApp, openInstall } = useNav();
  const status = useConnectionStatus();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="应用面板"
          title="应用"
          className={cn(
            'waffle-btn grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-all',
            'hover:border-cyan hover:text-cyan hover:shadow-glow-sm',
            open && 'border-cyan text-cyan shadow-glow-sm',
          )}
        >
          <Grip className="size-[18px]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[312px] p-0">
        <div className="px-4 pb-2.5 pt-3.5">
          <div className="text-xs font-bold tracking-[0.26em] text-cyan [text-shadow:0_0_10px_hsl(var(--cyan)/0.6)]">应用</div>
          <div className="mt-1 text-[10px] tracking-widest text-muted-foreground">MEEM INTERNAL APPS</div>
        </div>
        <div className="flex gap-2 border-b border-border px-4 pb-3 pt-1">
          <ConnChip
            label="电脑"
            connected={status.computer}
            icon={<Monitor />}
            onClick={() => { setOpen(false); status.computer ? openApp('status') : openInstall('client'); }}
          />
          <ConnChip
            label="浏览器"
            connected={status.browser}
            icon={<Globe />}
            onClick={() => { setOpen(false); status.browser ? openApp('status') : openInstall('extension'); }}
          />
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-3 gap-2.5 p-4">
            {APPS.map((app) => (
              <Tooltip key={app.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); openApp(app.id); }}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-secondary text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-border hover:text-foreground [&_svg]:size-5',
                      app.id === activeApp && 'border-cyan bg-cyan/[0.06] text-cyan shadow-glow-sm hover:text-cyan',
                    )}
                  >
                    {app.icon}
                    <b className="text-[11px] font-medium tracking-wide">{app.label}</b>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{app.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <div className="border-t border-border p-4">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-xl border border-border px-3.5 py-3 text-sm text-foreground transition-all hover:border-cyan hover:shadow-glow-sm"
          >
            <span className="min-w-0">
              <span className="block font-medium">我的公开网站</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{location.host}</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-cyan" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ConnChip({ label, connected, icon, onClick }: { label: string; connected: boolean; icon: JSX.Element; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}连接状态`}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left transition-colors hover:border-border/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="flex-1 text-xs font-medium text-foreground">{label}</span>
      <Badge variant={connected ? 'success' : 'muted'} className="h-5 gap-1 px-1.5 text-[10px]">
        <span className={cn('size-1.5 rounded-full', connected ? 'bg-lime shadow-[0_0_6px_hsl(var(--lime))]' : 'bg-muted-foreground/40')} />
        {connected ? '已连接' : '未连接'}
      </Badge>
    </button>
  );
}

export type { AppId };
