import { ArrowUpRight } from 'lucide-react';
import type { Item } from '../lib/types';
import { fmtDate, pageX } from '../lib/ui';
import { SectionHead, Tags } from './shared';

export default function Articles({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="articles">
      <SectionHead label="Articles" title="文章" />
      <div className="grid gap-2.5">
        {items.map((a) => (
          <button onClick={() => onOpen(a)} className="rounded-xl border border-border bg-card/70 p-5 text-left backdrop-blur-sm transition-all hover:border-cyan/60 hover:shadow-glow-sm sm:p-6" key={a.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold sm:text-xl">{a.title}</h3>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{fmtDate(a.created)}</span>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{a.body}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-cyan">阅读全文<ArrowUpRight className="size-3.5" /></span>
            <Tags tags={a.tags} />
          </button>
        ))}
      </div>
    </section>
  );
}
