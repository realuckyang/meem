import type { Item } from '../lib/types';
import { fmtDate, pageX } from '../lib/ui';
import { SectionHead } from './shared';

export default function Dynamics({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="dynamics">
      <SectionHead label="Now" title="动态" />
      <div className="grid gap-2.5">
        {items.map((d) => (
          <div className="flex items-start gap-4 rounded-xl border border-border bg-card/70 p-5 backdrop-blur-sm" key={d.id}>
            <span className="mt-1 shrink-0 font-mono text-xs text-cyan">{fmtDate(d.created)}</span>
            <div className="min-w-0">
              {d.title && <p className="font-medium">{d.title}</p>}
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{d.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
