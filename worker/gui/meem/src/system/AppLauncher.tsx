import { ExternalLink, Globe, Monitor } from 'lucide-react';
import { APPS, type AppId } from './registry';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from './lib/utils';
import { useConnectionStatus } from './useConnectionStatus';

interface AppLauncherProps {
  activeApp: AppId;
  open: boolean;
  onClose: () => void;
  onPick: (app: AppId) => void;
  onInstall: (kind: 'client' | 'extension') => void;
}

export default function AppLauncher({ activeApp, open, onClose, onPick, onInstall }: AppLauncherProps) {
  const status = useConnectionStatus();

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent className="flex w-[330px] flex-col bg-secondary p-0 sm:w-[360px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>应用</SheetTitle>
          <SheetDescription>Meem 内部应用</SheetDescription>
        </SheetHeader>
        <section className="px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ConnectionStatus label="电脑" connected={status.computer} icon={<Monitor />} onClick={() => status.computer ? onPick('status') : onInstall('client')} />
            <Separator orientation="vertical" className="h-3" />
            <ConnectionStatus label="浏览器" connected={status.browser} icon={<Globe />} onClick={() => status.browser ? onPick('status') : onInstall('extension')} />
          </div>
        </section>
        <Separator />

        <div className="min-h-0 flex-1 p-4">
          <section className="h-full">
            <div className="mb-2 px-1 text-[11px] font-bold uppercase text-muted-foreground">应用</div>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-3 gap-2">
                {APPS.map((app) => (
                  <Tooltip key={app.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={app.id === activeApp ? 'default' : 'outline'}
                        className={cn(
                          'h-[78px] flex-col gap-2 rounded-lg bg-background shadow-sm',
                          app.id === activeApp && 'bg-accent text-accent-foreground hover:bg-accent',
                        )}
                        onClick={() => onPick(app.id)}
                      >
                        <span className="grid size-8 place-items-center rounded-md bg-secondary text-foreground shadow-sm [&_svg]:size-4">{app.icon}</span>
                        <b className="text-xs">{app.label}</b>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{app.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </section>
        </div>
        <Separator />
        <div className="p-4">
          <Button
            asChild
            variant="outline"
            className="group h-auto w-full justify-between rounded-lg bg-background px-3 py-3 text-left shadow-sm"
          >
            <a
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <span className="block font-semibold">外部网站入口</span>
              <span className="mt-0.5 block text-xs text-muted-foreground group-hover:text-accent-foreground/75">/</span>
            </span>
            <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConnectionStatus({ label, connected, icon, onClick }: { label: string; connected: boolean; icon: JSX.Element; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      aria-label={`查看${label}连接状态`}
    >
      <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>
      <span className="font-medium text-foreground">{label}</span>
      <Badge variant={connected ? 'success' : 'muted'} className="h-5 gap-1 px-1.5">
        <span className={cn('size-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-muted-foreground/35')} />
        {connected ? '已连接' : '未连接'}
      </Badge>
    </button>
  );
}
