import type { ReactNode } from 'react';

export function SectionHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="m-0 font-mono text-xs uppercase tracking-widest text-cyan">{label}</p>
    </div>
  );
}

export function Tags({ tags }: { tags: string }) {
  const list = (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {list.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs text-muted-foreground [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-input [&_input]:bg-secondary [&_input]:px-3.5 [&_input]:py-3 [&_input]:text-sm [&_input]:text-foreground [&_input]:outline-none [&_input]:transition-all [&_input]:placeholder:text-muted-foreground [&_input:focus]:border-cyan [&_input:focus]:shadow-glow-sm [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-secondary [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:text-foreground [&_textarea]:outline-none [&_textarea]:transition-all [&_textarea]:placeholder:text-muted-foreground [&_textarea:focus]:border-cyan [&_textarea:focus]:shadow-glow-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}
