import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TerminalSnippet } from '../../system/lib/api';
import { Button } from '../../system/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../system/ui/sheet';

interface SnippetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet: Partial<TerminalSnippet> | null;
  onSave: (snippet: Partial<TerminalSnippet>) => void;
  onDelete: (id: string) => void;
}

export default function SnippetSheet({ open, onOpenChange, snippet, onSave, onDelete }: SnippetSheetProps) {
  const [form, setForm] = useState<Partial<TerminalSnippet>>({});

  useEffect(() => { if (open) setForm(snippet || { autoSend: true }); }, [open, snippet]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{form.id ? '编辑常用命令' : '新增常用命令'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 p-5">
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">名称</span>
            <input value={form.name || ''} maxLength={40} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" placeholder="如：部署" />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">命令</span>
            <textarea value={form.command || ''} rows={3} onChange={(event) => setForm((prev) => ({ ...prev, command: event.target.value }))} className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="npm run deploy" />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.autoSend !== false} onChange={(event) => setForm((prev) => ({ ...prev, autoSend: event.target.checked }))} />
            点击后直接发送
          </label>
        </div>
        <div className="flex items-center gap-2 border-t border-border p-4">
          {form.id ? <Button variant="subtle" onClick={() => onDelete(form.id!)}><Trash2 />删除</Button> : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!form.name?.trim() || !form.command?.trim()} onClick={() => onSave(form)}>保存</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
