import { RotateCcw } from 'lucide-react';
import { Badge } from '../../system/ui/badge';
import { Button } from '../../system/ui/button';
import { Separator } from '../../system/ui/separator';

interface ControlStripProps {
  cwd?: string;
  fontSize: number;
  onFont: (delta: number) => void;
  onRestart: () => void;
  onClear: () => void;
  onInterrupt: () => void;
}

export default function ControlStrip({ cwd, fontSize, onFont, onRestart, onClear, onInterrupt }: ControlStripProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-500">
      <span className="min-w-0 flex-1 truncate font-mono">{cwd || '未选择目录'}</span>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={() => onFont(-1)}>A-</Button>
      <Badge variant="outline" className="border-zinc-700 text-zinc-400">{fontSize}</Badge>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={() => onFont(1)}>A+</Button>
      <Separator orientation="vertical" className="h-4 bg-zinc-800" />
      <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={onInterrupt}>Ctrl+C</Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={onClear}>清屏</Button>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" onClick={onRestart}><RotateCcw /></Button>
    </div>
  );
}
