import { Clipboard, Minus, Plus, Send } from 'lucide-react';
import { Button } from '../../system/ui/button';

interface InputBarProps {
  value: string;
  onValue: (value: string) => void;
  onSend: () => void;
  onHistory: (direction: -1 | 1) => void;
  panelOpen: boolean;
  togglePanel: () => void;
  disabled: boolean;
  onPaste: () => void;
}

export default function InputBar({ value, onValue, onSend, onHistory, panelOpen, togglePanel, disabled, onPaste }: InputBarProps) {
  return (
    <footer className="flex shrink-0 items-center gap-1.5 border-t border-zinc-800 bg-zinc-950 px-2 py-2">
      <Button variant="ghost" size="icon" className="size-9 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" onClick={togglePanel}>
        {panelOpen ? <Minus /> : <Plus />}
      </Button>
      <input
        value={value}
        onChange={(event) => onValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); onSend(); }
          if (event.key === 'ArrowUp') { event.preventDefault(); onHistory(-1); }
          if (event.key === 'ArrowDown') { event.preventDefault(); onHistory(1); }
        }}
        disabled={disabled}
        placeholder="输入命令，回车发送"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-9 min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-blue-500"
      />
      <Button variant="ghost" size="icon" className="size-9 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" onClick={onPaste}>
        <Clipboard />
      </Button>
      <Button size="icon" className="size-9 bg-zinc-100 text-zinc-950 hover:bg-white" disabled={!value.trim() || disabled} onClick={onSend}>
        <Send />
      </Button>
    </footer>
  );
}
