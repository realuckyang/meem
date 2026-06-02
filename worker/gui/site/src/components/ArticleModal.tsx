import { ArrowUpRight } from 'lucide-react';
import type { Item } from '../lib/types';
import { fmtDate } from '../lib/ui';

export default function ArticleModal({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-cyan/40 bg-card p-6 shadow-glow-sm sm:p-9" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{item.title}</h2>
          <button onClick={onClose} aria-label="关闭" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-cyan hover:text-cyan">✕</button>
        </div>
        <div className="mb-5 font-mono text-xs text-muted-foreground">{fmtDate(item.created)}</div>
        <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">{item.body}</div>
        {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm text-cyan hover:brightness-110">原文链接<ArrowUpRight className="size-4" /></a>}
      </div>
    </div>
  );
}
