import { Plus, SquareTerminal } from 'lucide-react';
import { Button } from '../../system/ui/button';
import { cn } from '../../system/lib/utils';
import type { TerminalTab } from './types';

interface TerminalTabsProps {
  tabs: TerminalTab[];
  active: string;
  onPick: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export default function TerminalTabs({ tabs, active, onPick, onClose, onNew }: TerminalTabsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn(
            'group flex h-8 max-w-[240px] shrink-0 items-center gap-2 rounded-md border border-transparent px-2.5 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100',
            tab.id === active && 'border-zinc-700 bg-zinc-900 text-zinc-50',
          )}
          onClick={() => onPick(tab.id)}
        >
          <SquareTerminal className="size-3.5 shrink-0" />
          <span className="truncate">{tab.title || 'shell'}</span>
          <span className="hidden max-w-[110px] truncate text-[10px] text-zinc-500 sm:block">{tab.cwd}</span>
          <span
            className="ml-auto rounded px-1 text-sm leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={(event) => { event.stopPropagation(); onClose(tab.id); }}
          >
            x
          </span>
        </button>
      ))}
      <Button variant="ghost" size="sm" className="h-8 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={onNew}>
        <Plus />
      </Button>
    </div>
  );
}
