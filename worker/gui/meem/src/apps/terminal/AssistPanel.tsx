import type { TerminalSnippet } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { cn } from '../../system/lib/utils';
import { CTRL_KEYS, NAV_KEYS } from './constants';
import type { PanelTab } from './types';

interface AssistPanelProps {
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;
  snippets: TerminalSnippet[];
  onKey: (code: string) => void;
  onRun: (snippet: TerminalSnippet) => void;
  onEdit: (snippet: TerminalSnippet) => void;
  onAdd: () => void;
}

export default function AssistPanel({ tab, setTab, snippets, onKey, onRun, onEdit, onAdd }: AssistPanelProps) {
  return (
    <section className="shrink-0 border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center border-b border-zinc-800 px-2">
        <button className={cn('relative px-3 py-2 text-xs transition-colors', tab === 'keys' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')} onClick={() => setTab('keys')}>
          按键
          {tab === 'keys' && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-blue-500" />}
        </button>
        <button className={cn('relative px-3 py-2 text-xs transition-colors', tab === 'commands' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')} onClick={() => setTab('commands')}>
          命令
          {!!snippets.length && <span className="ml-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">{snippets.length}</span>}
          {tab === 'commands' && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-blue-500" />}
        </button>
      </div>
      {tab === 'keys' ? (
        <div className="space-y-1.5 px-2 py-2">
          {[NAV_KEYS, CTRL_KEYS].map((group, index) => (
            <div className="flex flex-wrap gap-1" key={index}>
              {group.map((key) => (
                <Button key={key.label} variant="ghost" size="sm" className="min-w-12 border border-zinc-800 bg-zinc-900 px-3 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100" onClick={() => onKey(key.code)}>
                  {key.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-2 py-2">
          {snippets.length ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {snippets.map((snippet) => (
                <button
                  key={snippet.id}
                  className="group flex min-w-0 items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                  onClick={() => onRun(snippet)}
                  onContextMenu={(event) => { event.preventDefault(); onEdit(snippet); }}
                >
                  <span className="truncate">{snippet.name}</span>
                  <span className="shrink-0 text-zinc-500 opacity-0 group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); onEdit(snippet); }}>编辑</span>
                </button>
              ))}
              <Button variant="ghost" size="sm" className="border border-dashed border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={onAdd}>新增常用命令</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>保存高频命令，之后可一键发送到终端。</span>
              <Button variant="ghost" size="sm" className="border border-dashed border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100" onClick={onAdd}>新增</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
