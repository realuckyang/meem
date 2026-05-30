import { LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';

interface TopbarProps {
  title: string;
  left?: JSX.Element;
  openApps: () => void;
}

export default function Topbar({ title, left, openApps }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        {left}
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
      </div>
      <Button variant="outline" size="icon" onClick={openApps} aria-label="打开应用面板" title="应用">
        <LayoutGrid />
      </Button>
    </header>
  );
}
