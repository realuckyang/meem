import { ExternalLink } from 'lucide-react';
import type { Item } from '../lib/types';
import { pageX } from '../lib/ui';
import { SectionHead, Tags } from './shared';

export default function Projects({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <section className={`${pageX} py-12`} id="projects">
      <SectionHead label="Projects" title="项目" />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {items.map((p) => (
          <article className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur-sm transition-all hover:border-cyan/60 hover:shadow-glow-sm" key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold">{p.title}</h3>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="shrink-0 text-cyan hover:brightness-110"><ExternalLink className="size-4" /></a>}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{p.body}</p>
            <Tags tags={p.tags} />
          </article>
        ))}
      </div>
    </section>
  );
}
