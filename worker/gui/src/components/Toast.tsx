import { useEffect, useState } from 'react';

type ToastKind = 'info' | 'error' | 'success';
type ToastItem = { id: number; kind: ToastKind; text: string };

let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  for (const fn of listeners) fn(items);
}

export function pushToast(text: string, kind: ToastKind = 'info', ttl = 3200) {
  const id = nextId++;
  items = [...items, { id, kind, text }];
  emit();
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, ttl);
}

export default function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (!list.length) return null;
  return (
    <div className="pointer-events-none fixed top-3 inset-x-0 z-[100] flex flex-col items-center gap-1.5 px-3">
      {list.map((item) => (
        <div
          key={item.id}
          className={`meem-toast-enter pointer-events-auto max-w-[88vw] rounded-xl px-3 py-2 text-[13px] shadow-md backdrop-blur ${
            item.kind === 'error'   ? 'bg-rose-50/95 text-rose-700 border border-rose-100' :
            item.kind === 'success' ? 'bg-emerald-50/95 text-emerald-700 border border-emerald-100' :
                                      'bg-white/95 text-neutral-700 border border-neutral-200'
          }`}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
