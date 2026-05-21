export type Tab = 'messages' | 'contacts' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'messages', label: '消息', icon: '💬' },
  { key: 'contacts', label: '联系人', icon: '👥' },
  { key: 'settings', label: '设置', icon: '⚙️' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="h-14 flex border-t border-neutral-200 bg-white/90 backdrop-blur">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${active === t.key ? 'text-accent' : 'text-neutral-400'}`}
          onClick={() => onChange(t.key)}
        >
          <span className="text-xl leading-none">{t.icon}</span>
          <span className="text-[11px]">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
