import { useState } from 'react';
import { ExternalLink, Globe, Grip, Monitor, Plus, SlidersHorizontal } from 'lucide-react';
import { APPS, APP_GROUPS, type AppId } from './registry';
import { useNav } from './nav';
import { useDeviceList } from './useDevices';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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
        <AppPanel />
      </div>
    </header>
  );
}

function AppPanel() {
  const { activeApp, openApp, openDevice } = useNav();
  const devices = useDeviceList();
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
      <PopoverContent className="flex max-h-[min(80vh,640px)] w-[312px] flex-col overflow-y-auto p-0">
        <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
          <div className="text-xs font-bold tracking-[0.26em] text-cyan [text-shadow:0_0_10px_hsl(var(--cyan)/0.6)]">中控台</div>
          <button
            type="button"
            aria-label="设置"
            title="设置"
            onClick={() => { setOpen(false); openApp('settings'); }}
            className={cn(
              'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-cyan [&_svg]:size-4',
              activeApp === 'settings' && 'text-cyan',
            )}
          >
            <SlidersHorizontal />
          </button>
        </div>

        {/* 设备 */}
        <div className="border-b border-border px-4 pb-3.5 pt-1">
          <div className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">设备</div>
          <div className="grid grid-cols-3 gap-2.5">
            {devices.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setOpen(false); openDevice(d.id); }}
                className="relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground [&_svg]:size-5"
              >
                <span className={cn('absolute right-1.5 top-1.5 size-1.5 rounded-full', d.online ? 'bg-lime shadow-[0_0_6px_hsl(var(--lime))]' : 'bg-muted-foreground/40')} />
                {d.kind === 'browser' ? <Globe /> : <Monitor />}
                <b className="max-w-full truncate px-1 text-[11px] font-medium tracking-wide">{d.name || '未命名'}</b>
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setOpen(false); openDevice(); }}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-cyan hover:text-cyan [&_svg]:size-5"
            >
              <Plus />
              <b className="text-[11px] font-medium tracking-wide">添加</b>
            </button>
          </div>
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-3 p-4">
            {APP_GROUPS.map((g) => {
              const apps = APPS.filter((a) => a.group === g.id);
              if (!apps.length) return null;
              return (
                <div key={g.id}>
                  <div className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {apps.map((app) => (
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
                </div>
              );
            })}
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


export type { AppId };
