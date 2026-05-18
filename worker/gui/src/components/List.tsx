import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 pb-2">
      <div className="text-xs text-neutral-400 px-2 pb-1">{title}</div>
      <div className="rounded-2xl bg-white border overflow-hidden">{children}</div>
    </section>
  );
}

export function Row({ icon, label, value, last, onClick }: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b'} ${
        interactive ? 'cursor-pointer active:bg-neutral-50' : ''
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-neutral-400 truncate">{value}</span>
      {interactive && <span className="text-neutral-300 text-sm">›</span>}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <div className="text-xs text-neutral-400 px-2 pb-1">{title}</div>}
      <div className="rounded-2xl bg-white border overflow-hidden">{children}</div>
    </section>
  );
}

export function Line({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? '' : 'border-b'}`}>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-neutral-400 truncate">{value}</span>
    </div>
  );
}
