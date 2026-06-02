import type { ContactInfo, Item } from '../lib/types';
import { pageX } from '../lib/ui';
import { SectionHead } from './shared';

export default function About({ item }: { item?: Item }) {
  if (!item) return null;
  let contacts: ContactInfo[] = [];
  try { contacts = JSON.parse(item.tags || '[]'); } catch { /* */ }
  return (
    <section className={`${pageX} py-12`} id="about">
      <SectionHead label="About" title="关于" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.62fr)]">
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-card/70 p-6 text-base leading-8 text-foreground backdrop-blur-sm">{item.body}</div>
        {contacts.length > 0 && (
          <div className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-cyan">联系</h3>
            <div className="grid gap-3">
              {contacts.map((c) => (
                <div className="flex items-baseline justify-between gap-3" key={c.label}>
                  <span className="text-sm text-muted-foreground">{c.label}</span>
                  {c.url
                    ? <a href={c.url} target="_blank" rel="noreferrer" className="text-sm text-foreground transition-colors hover:text-cyan">{c.value}</a>
                    : <span className={`text-sm text-foreground ${c.code ? 'font-mono' : ''}`}>{c.value}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
