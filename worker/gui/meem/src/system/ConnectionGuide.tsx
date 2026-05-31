import { CheckCircle2, Globe, Monitor, PlugZap, RefreshCw, TerminalSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './lib/utils';

type GuideKind = 'computer' | 'browser';

interface ConnectionGuideProps {
  kind: GuideKind;
  connected?: boolean;
  dark?: boolean;
  className?: string;
  onRetry?: () => void;
}

const guides = {
  computer: {
    icon: Monitor,
    kicker: '电脑端',
    title: '电脑未连接',
    desc: '启动本机客户端后，终端、文件、截图和状态会自动可用。',
    steps: ['打开 Meem 项目的 client 目录', '安装依赖并启动客户端', '保持客户端运行'],
    command: 'cd client && npm install && npm start',
  },
  browser: {
    icon: Globe,
    kicker: '浏览器插件',
    title: '浏览器未连接',
    desc: '安装并登录 Meem 扩展后，浏览器工具会自动接入。',
    steps: ['打开 Chrome 扩展程序页面', '开启开发者模式并加载 extension 目录', '打开 Meem 扩展完成登录'],
    command: 'chrome://extensions',
  },
};

export default function ConnectionGuide({ kind, connected = false, dark = false, className, onRetry }: ConnectionGuideProps) {
  const guide = guides[kind];
  const Icon = guide.icon;

  return (
    <div className={cn('grid h-full min-h-[320px] place-items-center px-5 py-8', dark ? 'bg-[#111318]' : 'bg-background', className)}>
      <div className={cn('w-full max-w-md rounded-lg border p-5 shadow-sm', dark ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-border bg-card')}>
        <div className="flex items-start gap-3">
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg', dark ? 'bg-zinc-900 text-zinc-100' : 'bg-secondary text-foreground')}>
            {connected ? <CheckCircle2 className="size-5 text-lime" /> : <Icon className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium', dark ? 'text-zinc-500' : 'text-muted-foreground')}>{guide.kicker}</span>
              <Badge variant={connected ? 'success' : 'muted'} className="h-5 px-1.5">{connected ? '已连接' : '未连接'}</Badge>
            </div>
            <h2 className={cn('mt-1 text-lg font-semibold tracking-normal', dark ? 'text-zinc-50' : 'text-foreground')}>{connected ? `${guide.kicker}已连接` : guide.title}</h2>
            <p className={cn('mt-1 text-sm leading-6', dark ? 'text-zinc-400' : 'text-muted-foreground')}>
              {connected ? '连接状态正常，相关能力已经可以使用。' : guide.desc}
            </p>
          </div>
        </div>

        {!connected && (
          <>
            <div className="mt-5 space-y-2">
              {guide.steps.map((step, index) => (
                <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', dark ? 'border-zinc-800 bg-zinc-900/60 text-zinc-300' : 'border-border bg-background text-foreground')} key={step}>
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold', dark ? 'bg-zinc-800 text-zinc-300' : 'bg-secondary text-muted-foreground')}>{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <div className={cn('mt-4 flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs', dark ? 'border-zinc-800 bg-[#111318] text-zinc-300' : 'border-border bg-muted text-foreground')}>
              {kind === 'computer' ? <TerminalSquare className="size-4 shrink-0" /> : <PlugZap className="size-4 shrink-0" />}
              <span className="min-w-0 truncate">{guide.command}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {onRetry && (
                <Button variant={dark ? 'secondary' : 'default'} size="sm" onClick={onRetry}>
                  <RefreshCw className="size-4" />重新检查
                </Button>
              )}
              {kind === 'browser' && (
                <Button asChild variant="outline" size="sm" className={dark ? 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800' : undefined}>
                  <a href="chrome://extensions" target="_blank" rel="noreferrer">打开扩展管理</a>
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
